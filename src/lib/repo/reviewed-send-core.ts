import { createHash } from "node:crypto";
import type { Sql } from "../db.ts";
import type { Channel, DecisionPrice, EvaluatorResult } from "../../domain/types.ts";
import { dollarAmounts } from "../../domain/voice-detect.ts";
import { isClosed, lockEnquiry } from "./decision-apply.ts";

/**
 * Preparing a send for review, as pure SQL logic.
 *
 * A reviewed send is the artefact the whole commercial-correctness slice rests
 * on. It freezes, server-side, exactly what the owner had in front of them: the
 * text, the structured amount, the service, the channel, the recipient and the
 * decision revision. Confirming a send then records THAT, rather than
 * re-reading a snapshot which may have moved, or trusting an amount the client
 * sent.
 *
 * Three defects it closes:
 *
 *  - the recorded message could say AUD 500 while the recorded quote said
 *    AUD 580, because the body came from the client and the amount from the
 *    current snapshot (review P1-05);
 *  - an approval prepared against one decision could be acted on after the
 *    facts changed, pairing old text with a new amount;
 *  - a retry, a refresh or a lost response created a second send, because the
 *    idempotency key was a fresh uuid generated on every dialog open (P1-04).
 *
 * The last one is why identity is content-derived: one row per (enquiry,
 * decision revision, exact text). Preparing the same review twice returns the
 * same row, so every one of those recoveries confirms the SAME send. Two
 * genuinely different follow-ups differ in their text and get their own rows.
 */

export type PrepareReviewInput = {
  enquiryId: string;
  businessId: string;
  userId: string;
  /** The text on screen, which the owner may have edited. */
  body: string;
  channel: Channel;
};

export type PrepareReviewResult =
  | {
      ok: true;
      reviewedSendId: string;
      decisionRevision: number;
      recipient: string;
      channel: Channel;
      action: string;
      body: string;
      amountMinor: number | null;
      currency: string | null;
      alreadyConfirmed: boolean;
    }
  | {
      ok: false;
      /**
       * `closed` - the enquiry is no longer open.
       * `not_sendable` - the decision does not authorise a customer-facing send.
       * `service_unconfirmed` - a quote whose service premise nobody confirmed.
       * `amount_mismatch` - the text names money the structured decision does not.
       */
      reason: "closed" | "not_sendable" | "service_unconfirmed" | "amount_mismatch";
      message: string;
    };

/** Normalised so trivial line-ending or trailing-space differences are one text. */
export function normalizeBody(body: string): string {
  return body.replace(/\r\n?/g, "\n").trim();
}

export function bodyHash(body: string): string {
  return createHash("sha256").update(normalizeBody(body), "utf8").digest("hex");
}

/**
 * Mirrors `resolveToAddr` in `sent-reply-core.ts` exactly: the recipient is
 * derived from the enquiry's own stored contact fields for the resolved
 * channel, never from anything the client sent, and "" is a genuine "no
 * recipient on file" rather than an invented address.
 */
export function resolveRecipient(
  channel: Channel,
  enquiry: { customer_email: string; customer_phone: string | null; customer_handle: string | null },
): string {
  if (channel === "email") return enquiry.customer_email;
  if (channel === "sms") return enquiry.customer_phone ?? "";
  if (channel === "instagram" || channel === "facebook") return enquiry.customer_handle ?? "";
  return enquiry.customer_email || enquiry.customer_phone || enquiry.customer_handle || "";
}

/**
 * Actions that put a real outbound record on the enquiry when confirmed.
 * Anything else has no business creating a reviewed send.
 */
const SENDABLE = new Set([
  "ACKNOWLEDGE",
  "REQUEST_INFORMATION",
  "SEND_QUALIFICATION_RESPONSE",
  "SEND_AVAILABILITY",
  "SEND_ESTIMATE",
  "SEND_QUOTE",
  "RECOMMEND_OFFER",
  "OFFER_BOOKING",
  "HANDOFF_BOOKING",
  "FOLLOW_UP",
  "DECLINE",
]);

/**
 * Whether the reviewed text's money agrees with the structured decision.
 *
 * Deliberately a CHECK, not an extraction: prose never becomes an authoritative
 * price here. An owner is free to rewrite the tone, the greeting, the whole
 * letter - but if they change the figure, the structured amount and the text
 * would then say different things, and that is refused rather than recorded
 * with a warning attached. Repricing goes through the decision, not the
 * textarea.
 */
export function amountAgrees(body: string, price: DecisionPrice | null): boolean {
  const named = dollarAmounts(body);
  if (named.length === 0) return true;
  if (!price) {
    // No structured amount at all, but the text names money. Nothing to agree
    // with, and recording it would create a quote-shaped message with no quote.
    return false;
  }
  const allowed =
    price.kind === "EXACT"
      ? [price.amountMinor / 100]
      : [price.minMinor / 100, price.maxMinor / 100];
  return named.every((n) => allowed.includes(n));
}

type SnapshotRow = {
  customer_email: string;
  customer_phone: string | null;
  customer_handle: string | null;
  service_label: string | null;
  action: string | null;
  reason: string | null;
  price: DecisionPrice | null;
  evaluators: EvaluatorResult[] | null;
  engine_version: string;
};

/**
 * Freeze what the owner is about to review. Assumes it is ALREADY inside a
 * transaction: the lock, the validation and the insert have to be atomic, or a
 * concurrent fact change can move the decision between the check and the row.
 */
export async function prepareReviewedSendInTransaction(
  sql: Sql,
  input: PrepareReviewInput,
): Promise<PrepareReviewResult> {
  const locked = await lockEnquiry(sql, input.enquiryId);
  if (!locked) {
    return { ok: false, reason: "closed", message: "That enquiry no longer exists." };
  }
  if (isClosed(locked.lifecycle)) {
    return {
      ok: false,
      reason: "closed",
      message: "That enquiry is closed, so there is nothing to send.",
    };
  }

  const [enq] = await sql<SnapshotRow>`
    select customer_email, customer_phone, customer_handle, service_label,
      decision_snapshot -> 'recommendation' ->> 'action' as action,
      decision_snapshot -> 'recommendation' ->> 'reason' as reason,
      decision_snapshot -> 'price' as price,
      decision_snapshot -> 'evaluators' as evaluators,
      engine_version
    from enquiry where id = ${input.enquiryId}
  `;
  if (!enq) {
    return { ok: false, reason: "closed", message: "That enquiry no longer exists." };
  }

  const action = enq.action ?? "";
  if (!SENDABLE.has(action)) {
    return {
      ok: false,
      reason: "not_sendable",
      message: "Enquiry has not prepared anything to send for this one.",
    };
  }

  // A quote is the point at which a service becomes a commercial commitment, so
  // this is where the owner's confirmation of it is actually required - not
  // merely displayed. A model-proposed service never reaches here (the decision
  // is ESCALATE_HUMAN, filtered above), but an enquiry created before that rule
  // existed can carry a nonblank service_label with no authority behind it at
  // all, and a bare label is not evidence that a human agreed with it.
  if (action === "SEND_QUOTE" || action === "SEND_ESTIMATE") {
    const [confirmedService] = await sql<{ id: string }>`
      select id from enquiry_fact
      where enquiry_id = ${input.enquiryId} and lower(field) = ${"service"}
        and superseded = false and status = ${"confirmed"}
      limit 1
    `;
    if (!confirmedService) {
      return {
        ok: false,
        reason: "service_unconfirmed",
        message: `Confirm the service for this enquiry before quoting it${
          enq.service_label ? ` - Enquiry has it as "${enq.service_label}"` : ""
        }.`,
      };
    }
  }

  const price = enq.price ?? null;
  if (!amountAgrees(input.body, price)) {
    return {
      ok: false,
      reason: "amount_mismatch",
      message:
        "The message names a different amount to the one Enquiry worked out. Change the price through the decision, or put the prepared figure back - a quote cannot be recorded saying two different things.",
    };
  }

  const body = normalizeBody(input.body);
  const hash = bodyHash(body);
  const recipient = resolveRecipient(input.channel, enq);

  // One row per (enquiry, decision revision, exact text). `on conflict` is what
  // makes preparing the same review twice - a refresh, a reopened dialog, a
  // retry - resolve to the SAME artefact rather than a second one.
  const [row] = await sql<{ id: string; consumed_at: string | null }>`
    insert into reviewed_send
      (enquiry_id, business_id, reviewed_by, decision_revision, action, channel,
       recipient, body, body_hash, price_kind, amount_minor, range_min_minor,
       range_max_minor, currency, service_label, reason, evaluators, engine_version)
    values (
      ${input.enquiryId}, ${input.businessId}, ${input.userId}, ${locked.decisionRevision},
      ${action}, ${input.channel}, ${recipient}, ${body}, ${hash},
      ${price?.kind ?? null},
      ${price?.kind === "EXACT" ? price.amountMinor : null},
      ${price?.kind === "RANGE" ? price.minMinor : null},
      ${price?.kind === "RANGE" ? price.maxMinor : null},
      ${price?.currency ?? null},
      ${enq.service_label ?? ""}, ${enq.reason ?? ""},
      ${enq.evaluators ? JSON.stringify(enq.evaluators) : null}::jsonb,
      ${enq.engine_version ?? "0"}
    )
    on conflict (enquiry_id, decision_revision, body_hash)
      do update set reviewed_by = excluded.reviewed_by
    returning id, consumed_at
  `;
  if (!row) throw new Error("Could not prepare that send for review.");

  return {
    ok: true,
    reviewedSendId: row.id,
    decisionRevision: locked.decisionRevision,
    recipient,
    channel: input.channel,
    action,
    body,
    amountMinor: price?.kind === "EXACT" ? price.amountMinor : null,
    currency: price?.currency ?? null,
    alreadyConfirmed: Boolean(row.consumed_at),
  };
}
