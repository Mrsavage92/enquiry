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

export type DeclineEnquiryResult = { ok: true; alreadyDeclined: boolean };

const MAX_REASON_LENGTH = 400;

export async function declineEnquiryInTransaction(
  sql: Sql,
  input: DeclineEnquiryInput,
): Promise<DeclineEnquiryResult> {
  const [existing] = await sql<{ lifecycle: string }>`
    select lifecycle from enquiry where id = ${input.enquiryId}
  `;
  if (!existing) throw new Error("That enquiry no longer exists.");

  // Idempotent: a retried request (or a second click that raced the first)
  // must not close an already-closed enquiry a second time or write a second
  // audit line claiming it happened twice.
  if (existing.lifecycle === "DECLINED") {
    return { ok: true, alreadyDeclined: true };
  }

  await sql`
    update enquiry
    set lifecycle = ${"DECLINED"}, decision_state = ${"NONE"}, responsibility = ${"NONE"},
        follow_up_due = ${false}, follow_up_reason = ${null}, at_risk = ${false},
        snoozed_until = ${null}, updated_at = now()
    where id = ${input.enquiryId}
  `;

  const reason = (input.reason ?? "").trim().slice(0, MAX_REASON_LENGTH);
  await sql`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${input.businessId}, ${input.userId}, ${"Declined by the owner"},
      ${reason || null}, ${"enquiry"}, ${input.enquiryId}
    )
  `;

  return { ok: true, alreadyDeclined: false };
}
