import type { Sql } from "../db.ts";
import { activeRules, decideEnquiry } from "../../domain/decide.ts";
import { ASAP_VALUE, isFollowUp, replyContextFromFacts } from "../../domain/reply-context.ts";
import { practicePriceFrom } from "./practice-price.ts";
import { COVERAGE_FIELD } from "../../domain/coverage.ts";
import { activeDetails, closedTimesOf, surchargeDaysOf } from "../../domain/business-detail.ts";
import { snapshotFromDecision, stateFromDecision } from "../../domain/decision-snapshot.ts";
import type { Decision } from "../../domain/decide.ts";
import {
  inboundBodies,
  inferBlockedQuantity,
  inferExtras,
  inferQuestions,
  type LiveFact,
} from "./quantity-inference.ts";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The stored value of a date fact that says "as soon as possible". */
export { ASAP_VALUE };

/** They asked for it as soon as possible (a date fact read as "asap"). */
export function asapFrom(facts: LiveFact[]): boolean {
  return facts.some(
    (f) => f.field.trim().toLowerCase() === "date" && String(f.value ?? "").trim() === ASAP_VALUE,
  );
}

/** The day the customer asked about, when one was read or confirmed. */
export function jobDateIsoFrom(facts: LiveFact[]): string | undefined {
  const date = facts.find(
    (f) =>
      f.field.trim().toLowerCase() === "date" &&
      ISO_DAY.test(String(f.value ?? "").trim()) &&
      String(f.date_asked) === "true",
  );
  return date ? String(date.value).trim() : undefined;
}

/**
 * Re-decide one enquiry and store the result, as one atomic step.
 *
 * The defect this closes (review P2-01): `answerEnquiryFact` and
 * `setEnquiryService` wrote the fact change inside a transaction, then read the
 * inputs, computed a decision and updated the snapshot OUTSIDE it. A failure
 * between the two left new facts sitting under an old decision - the desk
 * showing "we still need the guest count" over an enquiry whose guest count was
 * already answered - and two overlapping edits could finish their snapshot
 * writes in the opposite order to their fact writes, so the stored decision
 * belonged to neither.
 *
 * Every writer of `decision_snapshot` now goes through here, inside its
 * caller's transaction, after taking the per-enquiry lock. The lock is what
 * serialises the read-decide-write against a concurrent one; the shared code is
 * what stops the three writers drifting apart.
 *
 * `decision_revision` is bumped on every write so a send preview can name the
 * exact decision it was prepared against, and the server can tell a current
 * approval from one prepared before the facts moved.
 */

export type ApplyDecisionResult = {
  decision: Decision;
  revision: number;
  /** False when the enquiry is closed, in which case nothing was written. */
  applied: boolean;
};

/**
 * Take the per-enquiry write lock.
 *
 * `for update` on real Postgres blocks a second transaction until this one
 * commits, which is what makes the read-decide-write below a critical section.
 * The PGLite fallback runs one connection, so there is nothing to block there -
 * it is correct, not proven, on that backend.
 *
 * Returns the enquiry's identity and lifecycle, or null when it no longer
 * exists.
 */
export async function lockEnquiry(
  sql: Sql,
  enquiryId: string,
): Promise<{
  businessId: string;
  serviceLabel: string;
  customerName: string;
  lifecycle: string;
  decisionRevision: number;
} | null> {
  const [row] = await sql<{
    business_id: string;
    service_label: string;
    customer_name: string;
    lifecycle: string;
    decision_revision: number;
  }>`
    select business_id, service_label, customer_name, lifecycle, decision_revision
    from enquiry where id = ${enquiryId}
    for update
  `;
  if (!row) return null;
  return {
    businessId: row.business_id,
    serviceLabel: row.service_label ?? "",
    customerName: row.customer_name ?? "",
    lifecycle: row.lifecycle,
    decisionRevision: Number(row.decision_revision ?? 0),
  };
}

/**
 * An enquiry the owner has closed is not re-opened by a late write.
 *
 * An interpreter call in flight when the owner declines, or an old preview
 * acted on afterwards, must not silently move a declined enquiry back into the
 * queue or re-quote it (acceptance T05).
 */
export function isClosed(lifecycle: string): boolean {
  return lifecycle === "DECLINED" || lifecycle === "LOST" || lifecycle === "BOOKED";
}

/**
 * Re-read the live facts and rules, decide, and store the snapshot, state and
 * next revision. Must be called inside a transaction that already holds
 * `lockEnquiry` on this enquiry.
 */
export async function applyDecision(
  sql: Sql,
  input: { enquiryId: string; businessId: string; serviceLabel: string; customerName: string },
): Promise<ApplyDecisionResult> {
  const worked = await workOutDecision(sql, input);
  const revision = await writeDecision(sql, input.enquiryId, worked);
  return { decision: worked.decision, revision, applied: true };
}

type WorkedDecision = {
  decision: Decision;
  snapshot: ReturnType<typeof snapshotFromDecision>;
  state: ReturnType<typeof stateFromDecision>;
};

type DecisionInputs = {
  knowledge: { state: string; rulePayload: unknown }[];
  ownerFirstName?: string;
  /** Every service the business prices or lists, for reading extras. */
  services: string[];
};

/** The business half of a decision: its rules and owner, read once. */
async function businessInputs(sql: Sql, businessId: string): Promise<DecisionInputs> {
  const knowledge = await sql<{ state: string; rule_payload: unknown }>`
    select state, rule_payload from knowledge_item
    where business_id = ${businessId} and rule_payload is not null
  `;
  const [owner] = await sql<{ owner_first_name: string | null }>`
    select owner_first_name from business where id = ${businessId}
  `;
  const listed = await sql<{ customer_label: string | null; name: string | null }>`
    select customer_label, name from business_service where business_id = ${businessId}
  `;
  const knowledgeRows = knowledge.map((k) => ({ state: k.state, rulePayload: k.rule_payload }));
  const priced = activeRules({ knowledge: knowledgeRows }).map((r) => r.service);
  const services = [
    ...new Set(
      [...priced, ...listed.map((s) => s.customer_label || s.name || "")]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  return {
    knowledge: knowledgeRows,
    ownerFirstName: owner?.owner_first_name ?? undefined,
    services,
  };
}

function decideFrom(
  inputs: DecisionInputs,
  enquiry: { serviceLabel: string; customerName: string },
  facts: LiveFact[],
  messageText = "",
  followUp = false,
): WorkedDecision {
  const decision = decideEnquiry(
    { knowledge: inputs.knowledge },
    {
      serviceLabel: enquiry.serviceLabel,
      facts: facts.map((f) => ({ ...f, displayValue: f.display_value ?? undefined })) as never,
      messageText,
      services: inputs.services,
    },
  );
  // A name or day only read from their message is never stated as fact.
  const snapshot = snapshotFromDecision(
    decision,
    replyContextFromFacts(facts, {
      customerName: enquiry.customerName,
      ownerFirstName: inputs.ownerFirstName,
      serviceLabel: enquiry.serviceLabel,
      closed: closedTimesOf(activeDetails({ knowledge: inputs.knowledge })),
      surchargeDays: surchargeDaysOf(activeDetails({ knowledge: inputs.knowledge })),
      followUp,
      message: messageText,
    }),
  );
  return { decision, snapshot, state: stateFromDecision(decision) };
}

/**
 * Read the live facts and rules and decide. Writes no decision, but may insert
 * one `inferred` fact: the count the price needs, when the customer's message
 * already gives it (see quantity-inference.ts). Caller holds the lock.
 */
async function workOutDecision(
  sql: Sql,
  input: { enquiryId: string; businessId: string; serviceLabel: string; customerName: string },
): Promise<WorkedDecision> {
  const facts = await sql<LiveFact>`
    select field, value, status, display_value, provenance->>'asked' as date_asked,
      provenance->>'span' as date_span, provenance->'issue' as date_issue,
      provenance->>'role' as date_role, provenance->>'what' as date_what
    from enquiry_fact
    where enquiry_id = ${input.enquiryId} and superseded = false
  `;
  const inputs = await businessInputs(sql, input.businessId);
  const messages = (await inboundBodies(sql, [input.enquiryId])).get(input.enquiryId) ?? [];
  return readAndDecide(sql, input.enquiryId, inputs, input, facts, messages);
}

/**
 * Decide, recording on the way what the customer already wrote: the other
 * things they asked for, and the count the price is blocked on. Each is an
 * `inferred` reading the owner checks; the decision is taken again after each
 * so the next step is "check it", never "ask for it".
 */
/**
 * A practice enquiry's sample price, added to this one decision only. It is a
 * fact on the practice enquiry (written only by the practice-only server
 * function), never a knowledge row, so no real enquiry can ever be priced by it.
 */
function withPracticePrice(inputs: DecisionInputs, facts: LiveFact[]): DecisionInputs {
  const rule = practicePriceFrom(facts);
  if (!rule) return inputs;
  // Once the owner saves a real price for the same job, the sample steps
  // aside: never "two prices disagree" over a price they never set.
  const same = (s: string) => s.trim().toLowerCase() === rule.service.trim().toLowerCase();
  if (activeRules({ knowledge: inputs.knowledge }).some((r) => same(r.service))) return inputs;
  return {
    ...inputs,
    knowledge: [...inputs.knowledge, { state: "Active", rulePayload: rule }],
    services: [...new Set([...inputs.services, rule.service])],
  };
}

async function readAndDecide(
  sql: Sql,
  enquiryId: string,
  inputs: DecisionInputs,
  who: { serviceLabel: string; customerName: string },
  known: LiveFact[],
  messages: { id: string; body: string }[],
): Promise<WorkedDecision> {
  let facts = known;
  const extras = await inferExtras(
    sql,
    enquiryId,
    who.serviceLabel,
    inputs.services,
    facts,
    messages,
  );
  const questions = await inferQuestions(
    sql,
    enquiryId,
    [who.serviceLabel, ...inputs.services],
    inputs.knowledge,
    facts,
    messages,
  );
  facts = [...facts, ...extras, ...questions];
  const text = messages.map((m) => m.body).join("\n");
  const priced = withPracticePrice(inputs, facts);
  const [sent] = await sql<{ n: number }>`
    select count(*)::int as n from message
    where enquiry_id = ${enquiryId} and direction = ${"outbound"}
  `;
  const followUp = isFollowUp(
    messages.map((m) => m.body),
    Number(sent?.n ?? 0) > 0,
  );
  let worked = decideFrom(priced, who, facts, text, followUp);
  const read = await inferBlockedQuantity(sql, enquiryId, worked.decision, facts, messages);
  if (read) worked = decideFrom(priced, who, [...facts, read], text, followUp);
  return worked;
}

async function writeDecision(sql: Sql, enquiryId: string, worked: WorkedDecision): Promise<number> {
  const [updated] = await sql<{ decision_revision: number }>`
    update enquiry
    set decision_snapshot = ${JSON.stringify(worked.snapshot)}::jsonb,
        decision_state = ${worked.state.decisionState},
        commercial_state = ${worked.state.commercialState},
        responsibility = ${worked.state.responsibility},
        decision_revision = decision_revision + 1,
        updated_at = now()
    where id = ${enquiryId}
    returning decision_revision
  `;
  // A confirmation of what the price covers counts only for the coverage it
  // was given for. The moment the key moves it is retired, never revived.
  const key = worked.decision.coverage?.key ?? "";
  await sql`
    update enquiry_fact set superseded = true, updated_at = now()
    where enquiry_id = ${enquiryId} and lower(field) = ${COVERAGE_FIELD}
      and superseded = false and value <> ${key}
  `;
  return Number(updated?.decision_revision ?? 0);
}

/** JSON with sorted keys, so a jsonb round trip compares equal to the original. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Decide every open enquiry that is waiting on the owner again, after the
 * business's prices changed. Must run inside the transaction that changed them.
 *
 * The defect this closes: an owner saved "End of lease clean $190 per bedroom"
 * and every open enquiry kept saying "No pricing rules are set up yet",
 * because a decision was only ever re-derived when that enquiry's own facts
 * moved. Enquiries waiting on the customer, or closed, are left alone - what
 * was sent stays as it was sent. An enquiry whose decision comes out the same
 * is not rewritten either, so an unchanged enquiry keeps its revision and any
 * reply the owner is part-way through.
 *
 * Returns the ids whose decision actually changed.
 */
export async function redecideOpenEnquiries(sql: Sql, businessId: string): Promise<string[]> {
  // One locking read for every candidate, one read of their facts, one of the
  // business's rules: a few queries however many enquiries are open, instead
  // of several per enquiry inside the save's transaction.
  const rows = await sql<{
    id: string;
    service_label: string | null;
    customer_name: string | null;
    decision_snapshot: unknown;
  }>`
    select id, service_label, customer_name, decision_snapshot from enquiry
    where business_id = ${businessId} and lifecycle = ${"OPEN"}
      and responsibility = ${"BUSINESS"}
      and decision_state in (${"NEEDS_HUMAN"}, ${"NEEDS_INFORMATION"}, ${"ACTION_READY"})
    order by received_at
    for update
  `;
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const facts = await sql<LiveFact & { enquiry_id: string }>`
    select enquiry_id, field, value, status, display_value, provenance->>'asked' as date_asked,
      provenance->>'span' as date_span, provenance->'issue' as date_issue,
      provenance->>'role' as date_role, provenance->>'what' as date_what
    from enquiry_fact
    where enquiry_id = any(${ids}::uuid[]) and superseded = false
  `;
  const factsById = new Map<string, LiveFact[]>();
  for (const f of facts) {
    const list = factsById.get(f.enquiry_id) ?? [];
    list.push({
      field: f.field,
      value: f.value,
      status: f.status,
      display_value: f.display_value,
      date_asked: f.date_asked,
      date_span: f.date_span,
      date_issue: f.date_issue,
      date_role: f.date_role,
      date_what: f.date_what,
    });
    factsById.set(f.enquiry_id, list);
  }
  const inputs = await businessInputs(sql, businessId);
  const bodies = await inboundBodies(sql, ids);

  const changed: string[] = [];
  for (const row of rows) {
    const who = { serviceLabel: row.service_label ?? "", customerName: row.customer_name ?? "" };
    const known = factsById.get(row.id) ?? [];
    // A new price per bedroom over a message that said "2 bed", or a new
    // price for the oven they also asked for: read it now.
    const worked = await readAndDecide(sql, row.id, inputs, who, known, bodies.get(row.id) ?? []);
    if (stable(worked.snapshot) === stable(row.decision_snapshot ?? null)) continue;
    await writeDecision(sql, row.id, worked);
    changed.push(row.id);
  }
  return changed;
}

/**
 * Open enquiries decided before the price check existed: a stored price and no
 * coverage key. The Send button showed, the server refused the send, and there
 * was no check to confirm - the owner was stuck. Each is re-decided under its
 * lock so the check appears. Idempotent (a re-decided snapshot carries a key,
 * or no price), and scoped to the business ids the caller already checked.
 * What was sent is left alone: only enquiries whose turn it is are touched.
 *
 * Returns the ids re-decided.
 */
export async function redecideLegacyOpen(sql: Sql, businessIds: string[]): Promise<string[]> {
  if (businessIds.length === 0) return [];
  const rows = await sql<{
    id: string;
    business_id: string;
    service_label: string | null;
    customer_name: string | null;
  }>`
    select id, business_id, service_label, customer_name from enquiry
    where business_id = any(${businessIds}::uuid[]) and lifecycle = ${"OPEN"}
      and responsibility = ${"BUSINESS"}
      and decision_state in (${"NEEDS_HUMAN"}, ${"NEEDS_INFORMATION"}, ${"ACTION_READY"})
      and (decision_snapshot -> 'coverage') is null
      and ((decision_snapshot -> 'price') is not null
        or decision_snapshot -> 'recommendation' ->> 'action' = ${"SEND_QUOTE"})
    order by received_at
    for update
  `;
  for (const r of rows) {
    await applyDecision(sql, {
      enquiryId: r.id,
      businessId: r.business_id,
      serviceLabel: r.service_label ?? "",
      customerName: r.customer_name ?? "",
    });
  }
  return rows.map((r) => r.id);
}
