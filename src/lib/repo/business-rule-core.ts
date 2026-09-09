import type { Sql } from "../db.ts";
import {
  parseBusinessRule,
  ruleFingerprint,
  type BusinessRule,
} from "../../domain/business-rule.ts";

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
};

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
      ${JSON.stringify({ kind: "user", label: "Confirmed by the owner" })}::jsonb,
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
