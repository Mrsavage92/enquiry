import type { Business, DecisionSnapshot, Enquiry } from "./types";
import { channelLabel, replyChannel } from "./channel";
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
  /**
   * Empty string means no recipient on file. Never invented - mirrors
   * `resolveToAddr()` in `lib/repo/sent-reply-core.ts` exactly, so the
   * preview shown before a send and the audit line written after it always
   * agree on who it went to.
   */
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
  // Before a send, no quote_version row exists yet and enquiry.valueExact is
  // still unset - the decision snapshot's own computed price (set the moment
  // the enquiry was decided) is the only place the figure lives. Reading it
  // here is what makes the preview show a real number instead of staying
  // blank for a live enquiry that has simply never been sent yet.
  if (decision.price?.kind === "EXACT") return formatAud(decision.price.amountMinor / 100);
  if (decision.price?.kind === "RANGE") {
    return `${formatAud(decision.price.minMinor / 100)}–${formatAud(decision.price.maxMinor / 100)}`;
  }
  return null;
}

/**
 * Deliberately separate from `channel.ts`'s `replyTo()`, which also falls
 * back to `customerName` for a channel with no native address - a name is
 * never a real address, and `resolveToAddr()` server-side never emits one.
 * Kept in lock-step with `resolveToAddr()` in `lib/repo/sent-reply-core.ts`:
 * same channel-native mapping for email/sms/instagram/facebook, same
 * email-then-phone-then-handle fallback for every other channel (manual,
 * forward, comment, form - a manual send is the owner copying the prepared
 * text and sending it by hand, which is every first-beta send), same ""
 * when nothing is on file.
 */
function recipientFor(enquiry: Enquiry): string {
  const channel = replyChannel(enquiry);
  if (channel === "email") return enquiry.customerEmail;
  if (channel === "sms") return enquiry.customerPhone || "";
  if (channel === "instagram" || channel === "facebook") return enquiry.customerHandle || "";
  return enquiry.customerEmail || enquiry.customerPhone || enquiry.customerHandle || "";
}

export function previewFor(input: SendPreviewInput): SendPreviewData {
  const { enquiry, draft, decision } = input;
  const preparedText = decision.draft?.body ?? "";
  const edited = preparedText ? draft !== preparedText : null;
  return {
    channelLabel: channelLabel(replyChannel(enquiry)),
    recipient: recipientFor(enquiry),
    body: draft,
    amountLabel: amountLabelFor(enquiry, decision),
    reason: decision.recommendation.reason,
    edited,
  };
}
