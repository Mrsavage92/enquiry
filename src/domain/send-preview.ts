import type { Business, DecisionSnapshot, Enquiry } from "./types";
import { channelLabel, replyChannel, replyTo } from "./channel";
import { formatAud } from "./labels";

/**
 * What the approval preview needs to render, computed once and shared by
 * every send surface (the main composer and the waiting-desk follow-up).
 *
 * `business` is part of the signature so every call site can pass what it
 * already has on hand without reshaping it first - this function does not
 * need it today, but the recipient/channel/amount all come from `enquiry`
 * and `decision` directly, never invented from `business`.
 */
export type SendPreviewInput = {
  enquiry: Enquiry;
  business?: Business;
  /** The text on screen right now - may differ from the prepared reply if the owner edited it. */
  draft: string;
  decision: DecisionSnapshot;
};

export type SendPreviewData = {
  channelLabel: string;
  /** Empty string means no recipient on file. Never invented - reuses replyTo()'s own fallbacks. */
  recipient: string;
  body: string;
  amountLabel: string | null;
  reason: string;
  /**
   * Whether `draft` differs from the reply Enquiry originally prepared.
   * `null` when the decision snapshot carries no prepared text to compare
   * against, rather than a false "unedited".
   */
  edited: boolean | null;
};

function amountLabelFor(enquiry: Enquiry, decision: DecisionSnapshot): string | null {
  const focusQuote =
    [...decision.quotes].reverse().find((q) => q.status === "draft" || q.status === "accepted") ??
    decision.quotes[decision.quotes.length - 1];
  const exact = enquiry.valueExact?.amount ?? focusQuote?.total?.amount;
  if (typeof exact === "number") return formatAud(exact);
  const range = enquiry.valueRange ?? focusQuote?.range;
  if (range) return `${formatAud(range.min)}–${formatAud(range.max)}`;
  return null;
}

export function previewFor(input: SendPreviewInput): SendPreviewData {
  const { enquiry, draft, decision } = input;
  const preparedText = decision.draft?.body ?? "";
  const edited = preparedText ? draft !== preparedText : null;
  return {
    channelLabel: channelLabel(replyChannel(enquiry)),
    recipient: replyTo(enquiry),
    body: draft,
    amountLabel: amountLabelFor(enquiry, decision),
    reason: decision.recommendation.reason,
    edited,
  };
}
