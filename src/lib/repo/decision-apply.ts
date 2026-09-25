import type { Sql } from "../db.ts";
import { decideEnquiry } from "../../domain/decide.ts";
import { snapshotFromDecision, stateFromDecision } from "../../domain/decision-snapshot.ts";
import type { Decision } from "../../domain/decide.ts";
import { inboundBodies, inferBlockedQuantity, type LiveFact } from "./quantity-inference.ts";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

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
  return {
    knowledge: knowledge.map((k) => ({ state: k.state, rulePayload: k.rule_payload })),
    ownerFirstName: owner?.owner_first_name ?? undefined,
  };
}

function decideFrom(
  inputs: DecisionInputs,
  enquiry: { serviceLabel: string; customerName: string },
  facts: LiveFact[],
): WorkedDecision {
  const decision = decideEnquiry(
    { knowledge: inputs.knowledge },
    {
      serviceLabel: enquiry.serviceLabel,
      facts: facts.map((f) => ({ ...f, displayValue: f.display_value ?? undefined })) as never,
    },
  );
  const snapshot = snapshotFromDecision(decision, {
    customerName: enquiry.customerName,
    ownerFirstName: inputs.ownerFirstName,
    serviceLabel: enquiry.serviceLabel,
    jobDateIso: jobDateIsoFrom(facts),
  });
  return { decision, snapshot, state: stateFromDecision(decision) };
}

/** Read the live facts and rules and decide, writing nothing. */
async function workOutDecision(
  sql: Sql,
  input: { enquiryId: string; businessId: string; serviceLabel: string; customerName: string },
): Promise<WorkedDecision> {
  const facts = await sql<LiveFact>`
    select field, value, status, display_value, provenance->>'asked' as date_asked
    from enquiry_fact
    where enquiry_id = ${input.enquiryId} and superseded = false
  `;
  const inputs = await businessInputs(sql, input.businessId);
  const worked = decideFrom(inputs, input, facts);
  // Blocked on a count the customer already wrote: record the reading, then
  // decide again so the next step is "check it", not "ask for it".
  const messages = (await inboundBodies(sql, [input.enquiryId])).get(input.enquiryId) ?? [];
  const read = await inferBlockedQuantity(sql, input.enquiryId, worked.decision, facts, messages);
  return read ? decideFrom(inputs, input, [...facts, read]) : worked;
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
    select enquiry_id, field, value, status, display_value, provenance->>'asked' as date_asked
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
    });
    factsById.set(f.enquiry_id, list);
  }
  const inputs = await businessInputs(sql, businessId);
  const bodies = await inboundBodies(sql, ids);

  const changed: string[] = [];
  for (const row of rows) {
    const who = { serviceLabel: row.service_label ?? "", customerName: row.customer_name ?? "" };
    const known = factsById.get(row.id) ?? [];
    let worked = decideFrom(inputs, who, known);
    // A new price per bedroom over a message that said "2 bed": read it now.
    const read = await inferBlockedQuantity(
      sql,
      row.id,
      worked.decision,
      known,
      bodies.get(row.id) ?? [],
    );
    if (read) worked = decideFrom(inputs, who, [...known, read]);
    if (stable(worked.snapshot) === stable(row.decision_snapshot ?? null)) continue;
    await writeDecision(sql, row.id, worked);
    changed.push(row.id);
  }
  return changed;
}
