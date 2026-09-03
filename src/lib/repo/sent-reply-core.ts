import type { Sql } from "../db.ts";
import type { Channel } from "../../domain/types.ts";
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
  }>`
    select customer_email, customer_phone, customer_handle,
      decision_snapshot -> 'recommendation' ->> 'reason' as reason,
      decision_snapshot -> 'recommendation' ->> 'action' as action,
      decision_snapshot -> 'draft' ->> 'body' as prepared_body
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
