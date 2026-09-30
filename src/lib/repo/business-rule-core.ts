import type { Sql } from "../db.ts";
import {
  describeRule,
  parseBusinessRule,
  ruleFingerprint,
  type BusinessRule,
} from "../../domain/business-rule.ts";
import { redecideOpenEnquiries } from "./decision-apply.ts";
import { cleanPrefs, withDefaults, workingHoursChange } from "../../domain/workspace-prefs.ts";
import { requireBusinessAccess } from "./tenancy.server.ts";
import {
  minimumScope,
  describeDetail,
  detailSection,
  detailTitle,
  parseBusinessDetail,
  type BusinessDetail,
} from "../../domain/business-detail.ts";

/**
 * Saving a confirmed pricing rule, as pure SQL logic - separate from
 * `enquiry-actions.ts`, which owns auth and connection management, so a
 * PGLite test can prove what actually lands in the database.
 *
 * The defect this closes: the save path inserted a new Active rule and left
 * every earlier Active rule for the same service Active too. Two live prices
 * for one service, and `selectRule` picked whichever the query returned first -
 * so an owner correcting AUD 190 to AUD 240 could keep quoting AUD 190 with no
 * error anywhere. Correcting a price is the most ordinary thing a business
 * does; it must not be the thing that produces a wrong quote.
 *
 * Supersession rather than deletion or overwrite: the previous price stays on
 * file as a Superseded row with the date it stopped applying, because a quote
 * already sent at that price has to remain explicable.
 *
 * Assumes it is ALREADY inside a transaction - the read of current Active rules
 * and the supersede/insert have to be atomic, or two concurrent saves can both
 * see no conflict and both leave an Active row behind.
 */

export type SaveBusinessRuleInput = {
  businessId: string;
  rule: BusinessRule;
  readable: string;
  /** The owner's own words for it, shown back to them exactly as written. */
  said?: string;
};

/** Longest owner line kept with a saved fact. */
export const MAX_SAID = 300;

/** Who a fact came from, with the owner's own words when there are some. */
function ownerSource(said: string | undefined): Record<string, string> {
  const words = (said ?? "").trim().slice(0, MAX_SAID);
  return {
    kind: "user",
    label: "Confirmed by the owner",
    ...(words ? { detail: words } : {}),
  };
}

export type SaveBusinessRuleResult = {
  id: string;
  /**
   * `created` - nothing priced this service before.
   * `superseded` - an earlier Active price for this service was retired.
   * `duplicate` - this exact price was already Active; nothing changed.
   */
  outcome: "created" | "superseded" | "duplicate";
  supersededIds: string[];
  /** The readable form of each price this save retired, for the audit line. */
  supersededLabels: string[];
};

const norm = (s: string): string => s.trim().toLowerCase();

export async function saveBusinessRuleInTransaction(
  sql: Sql,
  input: SaveBusinessRuleInput,
): Promise<SaveBusinessRuleResult> {
  // `for update` so a concurrent save of a competing price for the same service
  // cannot slip between this read and the insert below. On the single-connection
  // PGLite fallback there is nothing to block, but the production Postgres path
  // is where two owners on two devices actually race.
  const existing = await sql<{
    id: string;
    title: string;
    body: string;
    version: string;
    rule_payload: unknown;
  }>`
    select id, title, body, version, rule_payload from knowledge_item
    where business_id = ${input.businessId}
      and rule_payload is not null
      and state = ${"Active"}
    for update
  `;

  const wanted = ruleFingerprint(input.rule);
  const sameService: { id: string; body: string; version: string; fingerprint: string }[] = [];
  for (const row of existing) {
    const parsed = parseBusinessRule(row.rule_payload);
    if (!parsed.ok) continue;
    if (norm(parsed.rule.service) !== norm(input.rule.service)) continue;
    sameService.push({
      id: row.id,
      body: row.body,
      version: row.version,
      fingerprint: ruleFingerprint(parsed.rule),
    });
  }

  // Saving the identical price again is a no-op, not a new version and not a
  // conflict. Without this, pressing save twice would supersede a rule with a
  // byte-identical copy of itself and grow the history for nothing.
  const identical = sameService.find((r) => r.fingerprint === wanted);
  if (identical) {
    return { id: identical.id, outcome: "duplicate", supersededIds: [], supersededLabels: [] };
  }

  const supersededIds = sameService.map((r) => r.id);
  const supersededLabels = sameService.map((r) => r.body);
  if (supersededIds.length > 0) {
    await sql`
      update knowledge_item
      set state = ${"Superseded"}, effective_to = now(), updated_at = now()
      where id = any(${supersededIds}::uuid[])
    `;
  }

  // A monotonic version so the history reads in order. Non-numeric legacy
  // versions fall back to the count of what came before rather than throwing.
  const priorVersions = sameService
    .map((r) => Number.parseInt(r.version, 10))
    .filter((n) => Number.isFinite(n));
  const nextVersion = priorVersions.length
    ? Math.max(...priorVersions) + 1
    : sameService.length + 1;

  const rows = await sql<{ id: string }>`
    insert into knowledge_item
      (business_id, section, title, body, class, state, source, version, rule_payload,
       effective_from)
    values (
      ${input.businessId}, ${"pricing"}, ${input.rule.service}, ${input.readable},
      ${"authoritative"}, ${"Active"},
      ${JSON.stringify(ownerSource(input.said))}::jsonb,
      ${String(nextVersion)}, ${JSON.stringify(input.rule)}::jsonb,
      now()
    )
    returning id
  `;
  const id = rows[0]?.id;
  if (!id) throw new Error("Could not save that pricing rule.");

  return {
    id,
    outcome: supersededIds.length > 0 ? "superseded" : "created",
    supersededIds,
    supersededLabels,
  };
}

/**
 * Save the price and bring every open enquiry up to date with it, as one
 * transaction: an owner who adds their prices should see the enquiries that
 * were waiting on those prices change, not keep reading "no prices yet".
 */
export async function saveBusinessRuleAndRedecide(
  sql: Sql,
  input: SaveBusinessRuleInput,
): Promise<SaveBusinessRuleResult & { updatedEnquiryIds: string[] }> {
  const saved = await saveBusinessRuleInTransaction(sql, input);
  const updatedEnquiryIds =
    saved.outcome === "duplicate" ? [] : await redecideOpenEnquiries(sql, input.businessId);
  return { ...saved, updatedEnquiryIds };
}

/**
 * Several prices from one "Add business detail" preview, all or nothing: every
 * price is saved and the open enquiries are decided once, in one transaction,
 * so a failure part-way leaves nothing half-saved for the owner to untangle.
 */
export async function saveBusinessRulesAndRedecide(
  sql: Sql,
  input: {
    businessId: string;
    rules: { rule: BusinessRule; readable: string; said?: string }[];
    details?: BusinessDetail[];
    /** The owner's own line for each detail, in order, kept to show back to them. */
    detailSaid?: (string | undefined)[];
  },
): Promise<{
  saved: SaveBusinessRuleResult[];
  detailIds: string[];
  updatedEnquiryIds: string[];
}> {
  const saved: SaveBusinessRuleResult[] = [];
  for (const r of input.rules) {
    saved.push(
      await saveBusinessRuleInTransaction(sql, {
        businessId: input.businessId,
        rule: r.rule,
        readable: r.readable,
        ...(r.said ? { said: r.said } : {}),
      }),
    );
  }
  const detailIds = await saveBusinessDetailsInTransaction(sql, {
    businessId: input.businessId,
    details: input.details ?? [],
    said: input.detailSaid,
  });
  const changedAny = saved.some((s) => s.outcome !== "duplicate") || detailIds.length > 0;
  const updatedEnquiryIds = changedAny ? await redecideOpenEnquiries(sql, input.businessId) : [];
  return { saved, detailIds, updatedEnquiryIds };
}

function detailKey(detail: BusinessDetail): string {
  if (detail.kind === "note") return `note|${norm(detail.text)}|${norm(detail.service ?? "")}`;
  if (detail.kind === "not_offered") return `not_offered|${norm(detail.service)}`;
  if (detail.kind === "closed_days") return `closed_days|${detail.days.join(",")}`;
  return JSON.stringify(detail).toLowerCase();
}

/**
 * Business details that are not prices - notes, services not offered, days not
 * worked - saved Active because the owner confirmed them in the preview. The
 * same detail saved twice is one row. Returns the ids of new rows.
 */
export async function saveBusinessDetailsInTransaction(
  sql: Sql,
  input: { businessId: string; details: BusinessDetail[]; said?: (string | undefined)[] },
): Promise<string[]> {
  if (input.details.length === 0) return [];
  const existing = await sql<{ id: string; rule_payload: unknown }>`
    select id, rule_payload from knowledge_item
    where business_id = ${input.businessId} and state = ${"Active"} and rule_payload is not null
    for update
  `;
  const have = new Set<string>();
  // One minimum per scope: the highest stands, a lower one is never saved
  // beside it, and a higher one supersedes it (the preview says which).
  const minimums = new Map<string, { id?: string; amount: number }>();
  for (const row of existing) {
    const parsed = parseBusinessDetail(row.rule_payload);
    if (!parsed.ok) continue;
    have.add(detailKey(parsed.detail));
    if (parsed.detail.kind === "minimum_charge") {
      minimums.set(minimumScope(parsed.detail), { id: row.id, amount: parsed.detail.amount });
    }
  }
  const ids: string[] = [];
  for (const [index, detail] of input.details.entries()) {
    // Working hours live in Settings, and only there: saving them here sets
    // them, so the business screen and Settings can never say two things.
    if (detail.kind === "working_hours") {
      await saveWorkingHours(sql, input.businessId, detail);
      continue;
    }
    const key = detailKey(detail);
    if (have.has(key)) continue;
    if (detail.kind === "minimum_charge") {
      const scope = minimumScope(detail);
      const held = minimums.get(scope);
      if (held && held.amount >= detail.amount) continue;
      if (held?.id) {
        await sql`
          update knowledge_item
          set state = ${"Superseded"}, effective_to = now(), updated_at = now()
          where id = ${held.id} and business_id = ${input.businessId}
        `;
      }
    }
    have.add(key);
    const [row] = await sql<{ id: string }>`
      insert into knowledge_item
        (business_id, section, title, body, class, state, source, version, rule_payload,
         effective_from)
      values (
        ${input.businessId}, ${detailSection(detail)}, ${detailTitle(detail)},
        ${describeDetail(detail)}, ${"authoritative"}, ${"Active"},
        ${JSON.stringify(ownerSource(input.said?.[index]))}::jsonb,
        ${"1"}, ${JSON.stringify(detail)}::jsonb, now()
      )
      returning id
    `;
    if (!row?.id) throw new Error("Could not save that business detail.");
    if (detail.kind === "minimum_charge") {
      minimums.set(minimumScope(detail), { id: row.id, amount: detail.amount });
    }
    ids.push(row.id);
  }
  return ids;
}

/** Set the business's working hours in its Settings, keeping every other preference. */
async function saveWorkingHours(
  sql: Sql,
  businessId: string,
  hours: Extract<BusinessDetail, { kind: "working_hours" }>,
): Promise<void> {
  const rows = await sql<{ prefs: unknown }>`
    select prefs from workspace_prefs where business_id = ${businessId}
  `;
  const previous = withDefaults(cleanPrefs(rows[0]?.prefs));
  const next = withDefaults({
    ...previous,
    ...cleanPrefs({
      workingDays: hours.workingDays,
      hoursStart: hours.hoursStart,
      hoursEnd: hours.hoursEnd,
    }),
  });
  await sql`
    insert into workspace_prefs (business_id, prefs, updated_at)
    values (${businessId}, ${JSON.stringify(next)}::jsonb, now())
    on conflict (business_id) do update set prefs = excluded.prefs, updated_at = now()
  `;
  // On the record with the hours they replaced, so the change can be undone.
  await sql`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${businessId}, ${"owner"},
      ${workingHoursChange(previous, next)},
      ${JSON.stringify({
        previous: {
          workingDays: previous.workingDays,
          hoursStart: previous.hoursStart,
          hoursEnd: previous.hoursEnd,
        },
        next: { workingDays: next.workingDays, hoursStart: next.hoursStart, hoursEnd: next.hoursEnd },
      })},
      ${"brain"}, ${null}
    )
  `;
}

/**
 * The "Add a business detail" save as the server function runs it: the
 * caller's membership of the business is checked first, then every price and
 * detail saves in one transaction. Another tenant gets Forbidden and nothing
 * is written.
 */
export async function saveBusinessDetailsForUser(
  sql: Sql,
  runInTransaction: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>,
  userId: string,
  input: SaveFactsInput,
): Promise<{
  businessId: string;
  rules: { rule: BusinessRule; readable: string }[];
  saved: SaveBusinessRuleResult[];
  detailIds: string[];
  updatedEnquiryIds: string[];
}> {
  const businessId = await requireBusinessAccess(userId, input.businessId, sql);
  const rules = rulesToSave(input);
  const result = await runInTransaction((tx) =>
    saveBusinessRulesAndRedecide(tx, {
      businessId,
      rules,
      details: input.details,
      detailSaid: input.said?.details,
    }),
  );
  return { businessId, rules, ...result };
}

export type SaveFactsInput = {
  businessId: string;
  rules: BusinessRule[];
  details: BusinessDetail[];
  /** The owner's own line behind each rule and detail, in the same order. */
  said?: { rules?: (string | undefined)[]; details?: (string | undefined)[] };
};

function rulesToSave(
  input: SaveFactsInput,
): { rule: BusinessRule; readable: string; said?: string }[] {
  return input.rules.map((rule, i) => {
    const said = input.said?.rules?.[i];
    return { rule, readable: describeRule(rule), ...(said ? { said } : {}) };
  });
}

/** What retiring a fact changed, for the owner and the audit line. */
export type RetireResult = { businessId: string; body: string; updatedEnquiryIds: string[] };

/**
 * Take one of the business's own facts out of use: a price, a closed day, a
 * rule, a note. Never deleted - retired (`Disabled`, with the day it stopped),
 * so a reply already sent on it stays explicable. Tenant-scoped (the row must
 * belong to the checked business) and audited in the same transaction. Every
 * open enquiry waiting on the owner is decided again without it, so a reply
 * that said "I don't work Saturdays" stops saying it.
 */
async function retireInTransaction(
  tx: Sql,
  businessId: string,
  knowledgeId: string,
): Promise<{ body: string }> {
  const [row] = await tx<{ id: string; body: string }>`
    update knowledge_item
    set state = ${"Disabled"}, effective_to = now(), updated_at = now()
    where id = ${knowledgeId} and business_id = ${businessId}
      and state in (${"Active"}, ${"Needs review"}, ${"Proposed"}, ${"Confirmed"})
    returning id, body
  `;
  if (!row) throw new Error("That business detail is no longer in use.");
  return { body: row.body };
}

async function auditIn(
  tx: Sql,
  businessId: string,
  event: { actor: string; summary: string; detail?: string; objectId?: string },
): Promise<void> {
  await tx`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${businessId}, ${event.actor}, ${event.summary}, ${event.detail ?? null},
      ${"brain"}, ${event.objectId ?? null}
    )
  `;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function retireBusinessFactForUser(
  sql: Sql,
  runInTransaction: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>,
  userId: string,
  input: { businessId: string; knowledgeId: string },
): Promise<RetireResult> {
  const businessId = await requireBusinessAccess(userId, input.businessId, sql);
  if (!UUID.test(input.knowledgeId)) throw new Error("That business detail is no longer in use.");
  return runInTransaction(async (tx) => {
    const { body } = await retireInTransaction(tx, businessId, input.knowledgeId);
    await auditIn(tx, businessId, {
      actor: userId,
      summary: `Business detail removed: ${body}`,
      objectId: input.knowledgeId,
    });
    const updatedEnquiryIds = await redecideOpenEnquiries(tx, businessId);
    return { businessId, body, updatedEnquiryIds };
  });
}

/**
 * Change one fact: the old one is retired and what the owner wrote instead is
 * saved, in one transaction, so there is never a moment with both or neither.
 */
export async function replaceBusinessFactForUser(
  sql: Sql,
  runInTransaction: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>,
  userId: string,
  input: SaveFactsInput & { knowledgeId: string },
): Promise<RetireResult & { saved: number; details: number }> {
  const businessId = await requireBusinessAccess(userId, input.businessId, sql);
  if (!UUID.test(input.knowledgeId)) throw new Error("That business detail is no longer in use.");
  if (input.rules.length + input.details.length === 0) {
    throw new Error("Write what it should say instead, or remove it.");
  }
  return runInTransaction(async (tx) => {
    const { body } = await retireInTransaction(tx, businessId, input.knowledgeId);
    const result = await saveBusinessRulesAndRedecide(tx, {
      businessId,
      rules: rulesToSave(input),
      details: input.details,
      detailSaid: input.said?.details,
    });
    const now = [
      ...input.rules.map((r) => describeRule(r)),
      ...input.details.map((d) => describeDetail(d)),
    ].join("; ");
    await auditIn(tx, businessId, {
      actor: userId,
      summary: `Business detail changed: ${body}`,
      detail: `Now: ${now}`,
      objectId: input.knowledgeId,
    });
    // Retiring alone can change a reply even when the new wording saved nothing new.
    const updatedEnquiryIds = result.updatedEnquiryIds.length
      ? result.updatedEnquiryIds
      : await redecideOpenEnquiries(tx, businessId);
    return {
      businessId,
      body,
      updatedEnquiryIds,
      saved: result.saved.filter((s) => s.outcome !== "duplicate").length,
      details: result.detailIds.length,
    };
  });
}
