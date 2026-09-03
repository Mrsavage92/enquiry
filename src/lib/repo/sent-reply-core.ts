import type { Sql } from "../db.ts";
import type { Channel, DecisionPrice, EvaluatorResult, LineItem } from "../../domain/types.ts";
import { channelLabel } from "../../domain/channel.ts";

/**
 * Recording a real send, as pure SQL logic - deliberately separate from
 * `enquiry-actions.ts`, which owns auth and connection management. Kept here,
 * against the same `sql` the caller passes in, so it can be exercised against
 * a real database in tests: the interesting failure here is a double-submit
 * or a retry creating two records, and only a database proves that didn't
 * happen.
 *
 * Everything here assumes it is ALREADY inside a transaction - the duplicate
 * check and the insert must be atomic, or a race between two requests could
 * both pass the check and both insert.
 */

export type RecordSentInput = {
  enquiryId: string;
  businessId: string;
  userId: string;
  body: string;
  channel: Channel;
  /** One idempotency key per dialog open on the client - a uuid, or absent. */
  clientRequestId?: string;
};

export type RecordSentResult = { ok: true; duplicate: boolean };

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

function normalizeForCompare(body: string): string {
  return body.replace(/\r\n?/g, "\n").trim();
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

/**
 * The recipient is derived here, server-side, from the enquiry's own stored
 * contact fields for the resolved channel - never from anything the client
 * sent. An unknown/unsupported channel (or a channel with nothing on file)
 * resolves to "", which the UI already reads as "no recipient on file",
 * never an invented address.
 */
function resolveToAddr(
  channel: Channel,
  enquiry: {
    customer_email: string;
    customer_phone: string | null;
    customer_handle: string | null;
  },
): string {
  if (channel === "email") return enquiry.customer_email;
  if (channel === "sms") return enquiry.customer_phone ?? "";
  if (channel === "instagram" || channel === "facebook") return enquiry.customer_handle ?? "";
  return "";
}

export async function recordSentReplyInTransaction(
  sql: Sql,
  input: RecordSentInput,
): Promise<RecordSentResult> {
  const externalId = input.clientRequestId
    ? namespacedExternalId(input.enquiryId, input.clientRequestId)
    : null;

  if (externalId) {
    const existing = await sql<{ id: string }>`
      select id from message
      where enquiry_id = ${input.enquiryId} and external_id = ${externalId}
      limit 1
    `;
    if (existing[0]) return { ok: true, duplicate: true };
  }

  const [enq] = await sql<{
    customer_email: string;
    customer_phone: string | null;
    customer_handle: string | null;
    reason: string | null;
    action: string | null;
    prepared_body: string | null;
    price: DecisionPrice | null;
    explanation: string | null;
    evaluators: EvaluatorResult[] | null;
    engine_version: string;
  }>`
    select customer_email, customer_phone, customer_handle,
      decision_snapshot -> 'recommendation' ->> 'reason' as reason,
      decision_snapshot -> 'recommendation' ->> 'action' as action,
      decision_snapshot -> 'draft' ->> 'body' as prepared_body,
      decision_snapshot -> 'price' as price,
      decision_snapshot ->> 'explanation' as explanation,
      decision_snapshot -> 'evaluators' as evaluators,
      engine_version
    from enquiry where id = ${input.enquiryId}
  `;
  if (!enq) throw new Error("That enquiry no longer exists.");
  const [biz] = await sql<{ name: string }>`
    select name from business where id = ${input.businessId}
  `;

  const toAddr = resolveToAddr(input.channel, enq);
  const fromAddr = biz?.name ?? "";

  try {
    await sql`
      insert into message
        (enquiry_id, direction, channel, at, from_addr, to_addr, body, intake, sent_at, sent_by, external_id)
      values (
        ${input.enquiryId}, ${"outbound"}, ${input.channel}, now(), ${fromAddr}, ${toAddr},
        ${input.body}, ${"manual"}, now(), ${input.userId}, ${externalId}
      )
    `;
  } catch (err) {
    // A concurrent request for the same idempotency key can lose the earlier
    // SELECT-based check to a genuine race; the partial unique index on
    // (channel, external_id) is the backstop that still makes this safe.
    if (isUniqueViolation(err)) return { ok: true, duplicate: true };
    throw err;
  }

  // The ball is now with the customer, not the business. A confirmed
  // SEND_QUOTE/SEND_ESTIMATE also moves the commercial state past QUOTABLE -
  // without this, the desk never recognised the sheet as sent and the
  // waiting-desk follow-up view (with its own send preview) was unreachable
  // for a real enquiry, only for hand-authored fixtures.
  const commercialState =
    enq.action === "SEND_QUOTE" ? "QUOTED" : enq.action === "SEND_ESTIMATE" ? "ESTIMATED" : null;
  await sql`
    update enquiry
    set responsibility = ${"CUSTOMER"}, decision_state = ${"WAITING_ON_CLIENT"},
        commercial_state = coalesce(${commercialState}, commercial_state),
        updated_at = now()
    where id = ${input.enquiryId}
  `;

  // A structural quote/estimate record, not just prose in the message body -
  // this is what lets the case file, the queue row and a reload all show the
  // figure from data. Gated on the send actually being a priced one: a
  // REQUEST_INFORMATION or ACKNOWLEDGE send writes no quote_version row at
  // all, and neither does a duplicate (this code is never reached for one -
  // the early return above already sent it back).
  if (enq.action === "SEND_QUOTE" && enq.price?.kind === "EXACT") {
    const [{ next_version }] = await sql<{ next_version: number }>`
      select coalesce(max(version), 0) + 1 as next_version
      from quote_version where enquiry_id = ${input.enquiryId}
    `;
    const lineItems = lineItemsForQuote(enq.evaluators, enq.explanation, enq.price.amountMinor / 100);
    await sql`
      insert into quote_version
        (enquiry_id, version, status, sent_at, total_minor, currency, line_items, rule_set_version)
      values (
        ${input.enquiryId}, ${next_version}, ${"sent"}, now(),
        ${enq.price.amountMinor}, ${enq.price.currency}, ${JSON.stringify(lineItems)}::jsonb,
        ${enq.engine_version ?? "0"}
      )
    `;
    await sql`
      update enquiry
      set value_exact_minor = ${enq.price.amountMinor}, currency = ${enq.price.currency}, updated_at = now()
      where id = ${input.enquiryId}
    `;
  } else if (enq.action === "SEND_ESTIMATE" && enq.price?.kind === "RANGE") {
    const [{ next_version }] = await sql<{ next_version: number }>`
      select coalesce(max(version), 0) + 1 as next_version
      from quote_version where enquiry_id = ${input.enquiryId}
    `;
    const midpointMajor = (enq.price.minMinor + enq.price.maxMinor) / 2 / 100;
    const lineItems = lineItemsForQuote(enq.evaluators, enq.explanation, midpointMajor);
    await sql`
      insert into quote_version
        (enquiry_id, version, status, sent_at, range_min_minor, range_max_minor, currency, line_items, rule_set_version)
      values (
        ${input.enquiryId}, ${next_version}, ${"sent"}, now(),
        ${enq.price.minMinor}, ${enq.price.maxMinor}, ${enq.price.currency}, ${JSON.stringify(lineItems)}::jsonb,
        ${enq.engine_version ?? "0"}
      )
    `;
    await sql`
      update enquiry
      set value_range_min_minor = ${enq.price.minMinor}, value_range_max_minor = ${enq.price.maxMinor},
          currency = ${enq.price.currency}, updated_at = now()
      where id = ${input.enquiryId}
    `;
  }

  // `edited` is derived here, from what Enquiry actually prepared, rather
  // than trusted from the client - a client-reported value can't be told
  // apart from a stale or spoofed one. A blank prepared body (no decision
  // ever ran a compose step, e.g. a hand-authored fixture) has nothing to
  // compare against, so it stays "unknown" rather than a false "unedited".
  const preparedBody = enq.prepared_body ?? "";
  const edited = preparedBody
    ? normalizeForCompare(input.body) !== normalizeForCompare(preparedBody)
    : null;

  const recipientLabel = toAddr || "no recipient on file";
  const editedLabel = typeof edited === "boolean" ? String(edited) : "unknown";
  const reasonLabel = enq.reason || "no reason recorded";
  await sql`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${input.businessId}, ${input.userId},
      ${`Reply confirmed sent by the owner via ${channelLabel(input.channel)} to ${recipientLabel}`},
      ${`Reason: ${reasonLabel}. Edited: ${editedLabel}`},
      ${"enquiry"}, ${input.enquiryId}
    )
  `;

  return { ok: true, duplicate: false };
}
