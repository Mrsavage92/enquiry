import type { Sql } from "../db.ts";

/**
 * Undo "I sent this", for real.
 *
 * The toast after recording a send offered nothing to take it back, and a
 * mis-tap on the wrong enquiry left a customer marked as quoted with no way
 * out. This removes exactly what that confirmation created - the outbound
 * message and any quote row written from the same reviewed artefact - and puts
 * the enquiry back to the state recorded on the artefact the moment before
 * (`prior_state`, migrations/0012). The reviewed artefact is deleted with them:
 * prepare reuses an artefact by (enquiry, body), so a kept one would pin the
 * old revision and every later confirm of the same text would be refused as
 * stale. Sending again means reviewing again, and that review is fresh.
 *
 * Deliberately narrow: only the send's own business, only within a short
 * window, only while the enquiry is open and still at the revision the send
 * left it at (`after_revision`), and only while no message came after it. A
 * decline, an answered detail or a customer's reply after the send makes it
 * history, and history is not undone.
 *
 * Assumes it is already inside a transaction, like every other writer here.
 */

export const UNDO_SEND_WINDOW_MS = 15 * 60_000;

export type UndoRecordedSendInput = {
  enquiryId: string;
  businessId: string;
  messageId: string;
  userId: string;
  now?: Date;
};

export type UndoRecordedSendResult =
  { ok: true } | { ok: false; reason: "missing" | "too_late" | "moved_on"; message: string };

type PriorState = {
  after_revision?: number | string;
  decision_state?: string;
  commercial_state?: string;
  responsibility?: string;
  value_exact_minor?: number | string | null;
  value_range_min_minor?: number | string | null;
  value_range_max_minor?: number | string | null;
  currency?: string;
};

const MISSING: UndoRecordedSendResult = {
  ok: false,
  reason: "missing",
  message: "That send is no longer on record, so there is nothing to undo.",
};

export async function undoRecordedSendInTransaction(
  sql: Sql,
  input: UndoRecordedSendInput,
): Promise<UndoRecordedSendResult> {
  // Same lock order as prepare and confirm: the enquiry first.
  const [enq] = await sql<{ id: string; lifecycle: string; decision_revision: string | number }>`
    select id, lifecycle, decision_revision from enquiry
    where id = ${input.enquiryId} and business_id = ${input.businessId}
    for update
  `;
  if (!enq) return MISSING;

  const [sent] = await sql<{
    id: string;
    at: string | Date;
    sent_at: string | Date | null;
    reviewed_send_id: string;
    prior_state: PriorState | null;
    stale_attested: boolean | null;
  }>`
    select m.id, m.at, m.sent_at, m.reviewed_send_id, r.prior_state, r.stale_attested
    from message m
    join reviewed_send r on r.id = m.reviewed_send_id
    where m.id = ${input.messageId} and m.enquiry_id = ${input.enquiryId}
      and m.direction = ${"outbound"}
      and r.enquiry_id = ${input.enquiryId} and r.business_id = ${input.businessId}
    for update of r
  `;
  if (!sent) return MISSING;

  const now = (input.now ?? new Date()).getTime();
  const sentAt = new Date(sent.sent_at ?? sent.at).getTime();
  if (!Number.isFinite(sentAt) || now - sentAt > UNDO_SEND_WINDOW_MS) {
    return {
      ok: false,
      reason: "too_late",
      message: "That send was recorded more than 15 minutes ago, so it stays on record.",
    };
  }

  const movedOn: UndoRecordedSendResult = {
    ok: false,
    reason: "moved_on",
    message: "Something has happened on this enquiry since, so that send stays on record.",
  };
  const afterRevision = Number(sent.prior_state?.after_revision ?? Number.NaN);
  if (
    enq.lifecycle !== "OPEN" ||
    !Number.isFinite(afterRevision) ||
    Number(enq.decision_revision) !== afterRevision
  ) {
    return movedOn;
  }

  const later = await sql<{ id: string }>`
    select id from message
    where enquiry_id = ${input.enquiryId} and id <> ${sent.id}
      and at > (select at from message where id = ${sent.id})
    limit 1
  `;
  if (later.length > 0) return movedOn;

  await sql`delete from quote_version where reviewed_send_id = ${sent.reviewed_send_id}`;
  await sql`delete from message where id = ${sent.id}`;
  await sql`delete from reviewed_send where id = ${sent.reviewed_send_id}`;

  const prior = sent.prior_state;
  if (prior && !sent.stale_attested && prior.decision_state && prior.responsibility) {
    await sql`
      update enquiry
      set decision_state = ${prior.decision_state},
          commercial_state = ${prior.commercial_state ?? "UNASSESSED"},
          responsibility = ${prior.responsibility},
          value_exact_minor = ${prior.value_exact_minor ?? null},
          value_range_min_minor = ${prior.value_range_min_minor ?? null},
          value_range_max_minor = ${prior.value_range_max_minor ?? null},
          currency = ${prior.currency ?? "AUD"},
          decision_revision = decision_revision + 1,
          updated_at = now()
      where id = ${input.enquiryId}
    `;
  } else {
    // A stale attestation never moved the enquiry, so there is nothing to put
    // back; the revision still moves so nothing prepared before it is current.
    await sql`
      update enquiry set decision_revision = decision_revision + 1, updated_at = now()
      where id = ${input.enquiryId}
    `;
  }

  await sql`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${input.businessId}, ${input.userId}, ${"Recorded send undone by the owner"},
      ${"The outbound message and any quote recorded with it were removed."},
      ${"enquiry"}, ${input.enquiryId}
    )
  `;
  return { ok: true };
}
