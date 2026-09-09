import type { Sql } from "../db.ts";
import { decideEnquiry } from "../../domain/decide.ts";
import { snapshotFromDecision, stateFromDecision } from "../../domain/decision-snapshot.ts";
import type { Decision } from "../../domain/decide.ts";

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
  const facts = await sql<{ field: string; value: string; status: string }>`
    select field, value, status from enquiry_fact
    where enquiry_id = ${input.enquiryId} and superseded = false
  `;
  const knowledge = await sql<{ state: string; rule_payload: unknown }>`
    select state, rule_payload from knowledge_item
    where business_id = ${input.businessId} and rule_payload is not null
  `;
  const [owner] = await sql<{ owner_first_name: string | null }>`
    select owner_first_name from business where id = ${input.businessId}
  `;

  const decision = decideEnquiry(
    { knowledge: knowledge.map((k) => ({ state: k.state, rulePayload: k.rule_payload })) },
    { serviceLabel: input.serviceLabel, facts: facts as never },
  );
  const snapshot = snapshotFromDecision(decision, {
    customerName: input.customerName,
    ownerFirstName: owner?.owner_first_name ?? undefined,
    serviceLabel: input.serviceLabel,
  });
  const state = stateFromDecision(decision);

  const [updated] = await sql<{ decision_revision: number }>`
    update enquiry
    set decision_snapshot = ${JSON.stringify(snapshot)}::jsonb,
        decision_state = ${state.decisionState},
        commercial_state = ${state.commercialState},
        responsibility = ${state.responsibility},
        decision_revision = decision_revision + 1,
        updated_at = now()
    where id = ${input.enquiryId}
    returning decision_revision
  `;

  return {
    decision,
    revision: Number(updated?.decision_revision ?? 0),
    applied: true,
  };
}
