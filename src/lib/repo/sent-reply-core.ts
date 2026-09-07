import type { Sql } from "../db.ts";
import type { Channel, EvaluatorResult, LineItem } from "../../domain/types.ts";
import { channelLabel } from "../../domain/channel.ts";
import { isClosed } from "./decision-apply.ts";

/**
 * Recording a real send, as pure SQL logic - deliberately separate from
 * `enquiry-actions.ts`, which owns auth and connection management. Kept here,
 * against the same `sql` the caller passes in, so it can be exercised against
 * a real database in tests: the interesting failure here is a double-submit
 * or a retry creating two records, and only a database proves that didn't
 * happen.
 *
 * Everything here assumes it is ALREADY inside a transaction - the claim of the
 * reviewed artefact and the insert must be atomic, or a race between two
 * requests could both pass the check and both insert.
 *
 * There used to be a second entry point here, `recordSentReplyInTransaction`,
 * which took the body from the client and the amount from the enquiry's current
 * snapshot. That combination is what let a recorded message say AUD 500 beside
 * a recorded quote saying AUD 580 (review P1-05), so it is gone rather than
 * kept alongside: two ways to record a send, one of them unsafe, is how the
 * unsafe one gets called.
 */

/**
 * Confirming an external send the owner has actually made.
 *
 * The reviewed artefact - not the current snapshot - is the authority for what
 * gets recorded. `recordSentReplyInTransaction` below reads the enquiry's
 * decision at record time, which is correct only when nothing has moved since
 * the review; `confirmReviewedSendInTransaction` records exactly the text and
 * amount that were on screen when the owner approved them, which is correct
 * always.
 */
export type ConfirmReviewedSendInput = {
  reviewedSendId: string;
  enquiryId: string;
  businessId: string;
  userId: string;
  /**
   * The owner attesting that they already sent this older approved message
   * externally, after the enquiry has moved on. Records the historical truth
   * without advancing the newer decision. Absent, a stale artefact is refused.
   */
  staleAttestation?: boolean;
};

export type ConfirmReviewedSendResult =
  | { ok: true; duplicate: boolean; stale: boolean; messageId: string | null }
  | {
      ok: false;
      reason: "missing" | "stale" | "closed";
      message: string;
      /** The revision the artefact was prepared against, and the current one. */
      reviewedRevision?: number;
      currentRevision?: number;
    };

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

/**
 * The DB-level unique index that backstops the duplicate check is
 * `(channel, external_id)` - it has no enquiry column, because it also
 * has to dedupe inbound provider webhook ids across the whole table.
 * Namespacing the stored value by enquiry here is what keeps a client
 * idempotency key reused across two different enquiries from colliding on
 * that index: without it, the second enquiry's insert would 23505 and get
 * reported as `duplicate: true` while nothing had actually been written
 * for it.
 */
function namespacedExternalId(enquiryId: string, clientRequestId: string): string {
  return `${enquiryId}:${clientRequestId}`;
}

/**
 * Two genuinely concurrent sends on the same enquiry can each compute the
 * same "next" version; `unique (enquiry_id, version)` on `quote_version`
 * (migrations/0004_product_core.sql) is what catches that. A caught 23505
 * alone is not enough to recover from, though: Postgres marks the whole
 * surrounding transaction ABORTED the moment any statement fails, and every
 * later statement - even a harmless retry of this same insert - fails with
 * 25P02 ("current transaction is aborted") until a ROLLBACK runs. The
 * SAVEPOINT here is what makes a retry possible at all: on 23505, roll back
 * to it (which un-aborts the transaction without discarding anything
 * inserted before it) and run `insert` again, now reading the version the
 * other request just committed. A second collision inside that retry means
 * two sends are still landing in the same instant - that's left to fail
 * loudly with a message the owner can act on, rather than looping forever.
 */
async function insertQuoteVersionWithRetry(
  sql: Sql,
  insert: () => Promise<unknown>,
): Promise<void> {
  await sql`savepoint quote_version_insert`;
  try {
    await insert();
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    await sql`rollback to savepoint quote_version_insert`;
    try {
      await insert();
    } catch (retryErr) {
      if (!isUniqueViolation(retryErr)) throw retryErr;
      await sql`rollback to savepoint quote_version_insert`;
      throw new Error("Another send for this enquiry landed at the same moment - please try again");
    }
  }
}

/**
 * The line items a quote_version row is recorded with.
 *
 * A structured breakdown when the decision's own pricing evaluator carries
 * one (amounts already in major units, matching LineItem), otherwise a
 * single line carrying the compiler's own workings sentence - never an
 * invented breakdown of a number nobody itemised.
 */
function lineItemsForQuote(
  evaluators: EvaluatorResult[] | null,
  explanation: string | null,
  amountMajor: number,
): LineItem[] {
  const pricing = (evaluators ?? []).find(
    (e) => e.type === "pricing" && Array.isArray(e.lineItems) && e.lineItems.length > 0,
  );
  if (pricing?.lineItems?.length) return pricing.lineItems;
  return [{ id: "line-1", label: explanation || "Quote", amount: amountMajor }];
}

type ReviewedSendRow = {
  id: string;
  enquiry_id: string;
  business_id: string;
  decision_revision: string | number;
  action: string;
  channel: string;
  recipient: string;
  body: string;
  price_kind: string | null;
  amount_minor: string | number | null;
  range_min_minor: string | number | null;
  range_max_minor: string | number | null;
  currency: string | null;
  reason: string | null;
  evaluators: EvaluatorResult[] | null;
  engine_version: string;
  consumed_at: string | null;
  consumed_message_id: string | null;
};

const asNumber = (v: string | number | null): number | null =>
  v === null || v === undefined ? null : Number(v);

/**
 * Record the send the owner says they made, exactly as they reviewed it.
 *
 * Assumes it is ALREADY inside a transaction. The order matters: claim the
 * artefact first with a conditional update, so two concurrent confirmations of
 * the same reviewed send cannot both proceed to write a message. The loser sees
 * the row already consumed and reports a duplicate, which is the truth - one
 * logical send, recorded once.
 */
export async function confirmReviewedSendInTransaction(
  sql: Sql,
  input: ConfirmReviewedSendInput,
): Promise<ConfirmReviewedSendResult> {
  const [reviewed] = await sql<ReviewedSendRow>`
    select * from reviewed_send
    where id = ${input.reviewedSendId} and enquiry_id = ${input.enquiryId}
      and business_id = ${input.businessId}
    for update
  `;
  if (!reviewed) {
    return {
      ok: false,
      reason: "missing",
      message: "That reviewed message no longer exists. Review it again before recording a send.",
    };
  }

  // Already confirmed. A retry, a refresh, a lost response, a double click -
  // all of them land here, and all of them are the same send.
  if (reviewed.consumed_at) {
    return { ok: true, duplicate: true, stale: false, messageId: reviewed.consumed_message_id };
  }

  const [enq] = await sql<{
    lifecycle: string;
    decision_revision: string | number;
    customer_email: string;
  }>`
    select lifecycle, decision_revision, customer_email from enquiry
    where id = ${input.enquiryId}
    for update
  `;
  if (!enq) {
    return { ok: false, reason: "missing", message: "That enquiry no longer exists." };
  }

  const reviewedRevision = Number(reviewed.decision_revision);
  const currentRevision = Number(enq.decision_revision);
  const stale = reviewedRevision !== currentRevision;

  // A stale artefact used to start a NEW send is refused - the owner reviews
  // again. But an owner attesting that they ALREADY sent this older approved
  // message is telling the truth about history, and erasing that would be worse
  // than recording it: the customer really does hold that quote. So it is
  // recorded exactly as written, at its own reviewed amount and revision, and
  // it deliberately does NOT advance the newer decision.
  if (stale && !input.staleAttestation) {
    return {
      ok: false,
      reason: "stale",
      message:
        "This enquiry has changed since that message was prepared. Review it again - or, if you already sent that older message, say so and Enquiry will record it as it was.",
      reviewedRevision,
      currentRevision,
    };
  }

  if (isClosed(enq.lifecycle) && !input.staleAttestation) {
    return {
      ok: false,
      reason: "closed",
      message: "That enquiry is closed. Reopen it before recording a send.",
    };
  }

  // Claim it. `consumed_at is null` in the same statement as the write is what
  // makes two concurrent confirmations resolve to one - the second updates zero
  // rows and reports the duplicate rather than writing a second message.
  const claimed = await sql<{ id: string }>`
    update reviewed_send
    set consumed_at = now(), stale_attested = ${stale}
    where id = ${reviewed.id} and consumed_at is null
    returning id
  `;
  if (claimed.length === 0) {
    const [again] = await sql<{ consumed_message_id: string | null }>`
      select consumed_message_id from reviewed_send where id = ${reviewed.id}
    `;
    return { ok: true, duplicate: true, stale, messageId: again?.consumed_message_id ?? null };
  }

  const [biz] = await sql<{ name: string }>`
    select name from business where id = ${input.businessId}
  `;
  const fromAddr = biz?.name ?? "";

  const [message] = await sql<{ id: string }>`
    insert into message
      (enquiry_id, direction, channel, at, from_addr, to_addr, body, intake, sent_at,
       sent_by, external_id, reviewed_send_id)
    values (
      ${input.enquiryId}, ${"outbound"}, ${reviewed.channel}, now(), ${fromAddr},
      ${reviewed.recipient}, ${reviewed.body}, ${"manual"}, now(), ${input.userId},
      ${namespacedExternalId(input.enquiryId, reviewed.id)}, ${reviewed.id}
    )
    returning id
  `;
  const messageId = message?.id ?? null;
  await sql`
    update reviewed_send set consumed_message_id = ${messageId} where id = ${reviewed.id}
  `;

  // A stale attestation records history without rewriting the present: the
  // newer decision keeps its own state, and no responsibility transfer is
  // implied by a message the owner sent before it existed.
  if (!stale) {
    const commercialState =
      reviewed.action === "SEND_QUOTE"
        ? "QUOTED"
        : reviewed.action === "SEND_ESTIMATE"
          ? "ESTIMATED"
          : null;
    await sql`
      update enquiry
      set responsibility = ${"CUSTOMER"}, decision_state = ${"WAITING_ON_CLIENT"},
          commercial_state = coalesce(${commercialState}, commercial_state),
          decision_revision = decision_revision + 1,
          updated_at = now()
      where id = ${input.enquiryId}
    `;
  }

  // The quote comes from the ARTEFACT, not from a snapshot re-read now. This is
  // the whole of P1-05: the figure recorded is the figure the owner reviewed,
  // and it cannot disagree with the text recorded beside it.
  const amountMinor = asNumber(reviewed.amount_minor);
  const rangeMin = asNumber(reviewed.range_min_minor);
  const rangeMax = asNumber(reviewed.range_max_minor);
  const currency = reviewed.currency ?? "AUD";

  if (reviewed.action === "SEND_QUOTE" && reviewed.price_kind === "EXACT" && amountMinor !== null) {
    const lineItems = lineItemsForQuote(reviewed.evaluators, reviewed.reason, amountMinor / 100);
    await insertQuoteVersionWithRetry(
      sql,
      () =>
        sql`
        insert into quote_version
          (enquiry_id, version, status, sent_at, total_minor, currency, line_items,
           rule_set_version, reviewed_send_id)
        select
          ${input.enquiryId},
          coalesce((select max(version) from quote_version where enquiry_id = ${input.enquiryId}), 0) + 1,
          ${stale ? "superseded" : "sent"}, now(), ${amountMinor}, ${currency},
          ${JSON.stringify(lineItems)}::jsonb, ${reviewed.engine_version ?? "0"}, ${reviewed.id}
      `,
    );
    if (!stale) {
      await sql`
        update enquiry
        set value_exact_minor = ${amountMinor}, currency = ${currency}, updated_at = now()
        where id = ${input.enquiryId}
      `;
    }
  } else if (
    reviewed.action === "SEND_ESTIMATE" &&
    reviewed.price_kind === "RANGE" &&
    rangeMin !== null &&
    rangeMax !== null
  ) {
    const lineItems = lineItemsForQuote(
      reviewed.evaluators,
      reviewed.reason,
      (rangeMin + rangeMax) / 2 / 100,
    );
    await insertQuoteVersionWithRetry(
      sql,
      () =>
        sql`
        insert into quote_version
          (enquiry_id, version, status, sent_at, range_min_minor, range_max_minor, currency,
           line_items, rule_set_version, reviewed_send_id)
        select
          ${input.enquiryId},
          coalesce((select max(version) from quote_version where enquiry_id = ${input.enquiryId}), 0) + 1,
          ${stale ? "superseded" : "sent"}, now(), ${rangeMin}, ${rangeMax}, ${currency},
          ${JSON.stringify(lineItems)}::jsonb, ${reviewed.engine_version ?? "0"}, ${reviewed.id}
      `,
    );
    if (!stale) {
      await sql`
        update enquiry
        set value_range_min_minor = ${rangeMin}, value_range_max_minor = ${rangeMax},
            currency = ${currency}, updated_at = now()
        where id = ${input.enquiryId}
      `;
    }
  }

  const summary = reviewed.recipient
    ? `Reply confirmed sent by the owner via ${channelLabel(reviewed.channel as Channel)} to ${reviewed.recipient}`
    : `Reply confirmed sent by the owner via ${channelLabel(reviewed.channel as Channel)}; no recipient on file`;
  await sql`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${input.businessId}, ${input.userId},
      ${stale ? `${summary} (an earlier approved message, recorded after the enquiry moved on)` : summary},
      ${`Reason: ${reviewed.reason || "no reason recorded"}. Reviewed revision: ${reviewedRevision}.${
        stale ? ` Current revision: ${currentRevision}. The newer decision was left unchanged.` : ""
      }`},
      ${"enquiry"}, ${input.enquiryId}
    )
  `;

  return { ok: true, duplicate: false, stale, messageId };
}
