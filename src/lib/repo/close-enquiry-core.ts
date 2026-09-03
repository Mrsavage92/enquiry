import type { Sql } from "../db.ts";

/**
 * Closing an enquiry as declined, as pure SQL logic - deliberately separate
 * from `enquiry-actions.ts`, which owns auth and connection management. Kept
 * here, against whatever `sql` the caller passes in, the same way
 * `sent-reply-core.ts` is: so a PGLite test can prove what actually lands in
 * the database, not just what the handler claims to do.
 *
 * This is a state change, not a customer-facing send: no message is written,
 * no channel is contacted, nothing claims to have reached the customer. The
 * standalone "Decline" control used to be pure client-side Zustand state -
 * real-looking in the UI, gone on the next reload, and the toast that
 * accompanied it said "Decline sent" when nothing had been sent to anyone.
 * This is the honest, persisted version: it closes the enquiry and records
 * that the owner did it, and nothing more.
 */

export type DeclineEnquiryInput = {
  enquiryId: string;
  businessId: string;
  userId: string;
  /** Optional, owner-typed, capped well below the audit detail column's
   *  practical size - long before this reaches SQL. */
  reason?: string;
};

export type DeclineEnquiryResult = { ok: true; alreadyClosed: boolean };

const MAX_REASON_LENGTH = 400;

export async function declineEnquiryInTransaction(
  sql: Sql,
  input: DeclineEnquiryInput,
): Promise<DeclineEnquiryResult> {
  // A single conditional statement, not select-then-update: the previous
  // version read `lifecycle`, decided in application code, and only then
  // wrote - which left a window where two concurrent declines could both
  // read "not yet declined" and both go on to update and insert an audit
  // row. The `lifecycle <> 'DECLINED'` guard lives in the same statement as
  // the write, so at most one concurrent call can ever see a returned row.
  const [updated] = await sql<{ id: string }>`
    update enquiry
    set lifecycle = ${"DECLINED"}, decision_state = ${"NONE"}, responsibility = ${"NONE"},
        follow_up_due = ${false}, follow_up_reason = ${null}, at_risk = ${false},
        snoozed_until = ${null}, updated_at = now()
    where id = ${input.enquiryId} and lifecycle <> ${"DECLINED"}
    returning id
  `;

  if (!updated) {
    // No row came back either because the enquiry doesn't exist, or because
    // it is already declined (a concurrent decline won the race, or this is
    // a retried request). This read only tells the two apart for the error
    // case below - it never gates a write.
    const [existing] = await sql<{ lifecycle: string }>`
      select lifecycle from enquiry where id = ${input.enquiryId}
    `;
    if (!existing) throw new Error("That enquiry no longer exists.");
    return { ok: true, alreadyClosed: true };
  }

  const reason = (input.reason ?? "").trim().slice(0, MAX_REASON_LENGTH);
  await sql`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${input.businessId}, ${input.userId}, ${"Declined by the owner"},
      ${reason || null}, ${"enquiry"}, ${input.enquiryId}
    )
  `;

  return { ok: true, alreadyClosed: false };
}
