import type { AutomatedSend, Business, Channel, Enquiry, QuoteVersion, RecommendationAction } from "./types";
import { formatAud } from "./labels";
import { isSendableAction, outboundBlocked } from "./situation";
import { isShortChannel, replyChannel } from "./channel";

export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

export function defaultHold(total?: number): { amount: number; currency: "AUD"; label: string } | undefined {
  if (!total || total < 100) return undefined;
  const raw = total * 0.3;
  const amount = Math.max(50, Math.round(raw / 5) * 5);
  return { amount, currency: "AUD", label: "To hold the date" };
}

export function resolvedHold(quote?: {
  hold?: { amount: number; currency: "AUD"; label?: string };
  total?: { amount: number };
  range?: { min: number; max: number };
}): { amount: number; currency: "AUD"; label: string } | undefined {
  if (!quote) return undefined;
  if (quote.hold) {
    return {
      amount: quote.hold.amount,
      currency: quote.hold.currency ?? "AUD",
      label: quote.hold.label ?? "To hold the date",
    };
  }
  if (quote.range && !quote.total) return undefined;
  return defaultHold(quote.total?.amount);
}

export function enableFollowUp(enquiry: Enquiry): Enquiry {
  const next = structuredClone(enquiry);
  next.followUpDue = true;
  next.atRisk = true;
  next.snoozedUntil = undefined;
  next.followUpReason = "No reply since the quote went out. Silence is not a decline.";
  next.state.decision = "WAITING_ON_CLIENT";
  next.state.responsibility = "CUSTOMER";
  next.decision.recommendation = {
    ...next.decision.recommendation,
    action: "FOLLOW_UP",
    label: "Send follow-up",
    reason: next.followUpReason,
    primaryEnabled: true,
    requiredApproval: true,
    reasonCodes: ["FOLLOW_UP"],
    blockedReason: undefined,
  };
  const name = firstName(enquiry.customerName);
  next.decision.draft = {
    ...next.decision.draft,
    action: "FOLLOW_UP",
    body: `Hi ${name},\n\nJust checking you still want this - the quote already sent stays as written. Happy to hold the date if so.\n\n`,
  };
  return next;
}

export function proposeRevision(enquiry: Enquiry): Enquiry {
  const next = structuredClone(enquiry);
  const latest = [...next.decision.quotes].sort((a, b) => b.version - a.version)[0];
  if (!latest) return next;
  const version = latest.version + 1;
  next.decision.quotes = next.decision.quotes.map((q) =>
    q.status === "draft" ? { ...q, status: "superseded" as const } : q,
  );
  const draft: QuoteVersion = {
    id: `${enquiry.id}-q${version}`,
    version,
    status: "draft",
    total: latest.total,
    range: latest.range,
    lineItems: latest.lineItems.map((li) => ({ ...li, id: `${li.id}-v${version}` })),
    assumptions: [
      ...(latest.assumptions ?? []),
      "Date change requested - price holds unless the work changes",
    ],
    ruleSetVersion: latest.ruleSetVersion,
    hold: latest.hold ?? defaultHold(latest.total?.amount),
  };
  next.decision.quotes = [...next.decision.quotes, draft];
  next.state.decision = "ACTION_READY";
  next.state.responsibility = "BUSINESS";
  next.followUpDue = false;
  next.atRisk = false;
  next.decision.recommendation = {
    ...next.decision.recommendation,
    action: "SEND_QUOTE",
    label: "Send revised quote",
    reason:
      "They asked a new question. The sent sheet stays on file. This is a new version, not a rewrite.",
    primaryEnabled: true,
    requiredApproval: true,
    reasonCodes: ["SEND_QUOTE"],
    blockedReason: undefined,
  };
  const amount = draft.total
    ? formatAud(draft.total.amount)
    : draft.range
      ? `${formatAud(draft.range.min)}–${formatAud(draft.range.max)}`
      : "the figure already sent";
  next.decision.draft = {
    ...next.decision.draft,
    action: "SEND_QUOTE",
    body: `Hi ${firstName(enquiry.customerName)},\n\nThe previous quote stays as written. If the date moves and the work is the same, the figure is still ${amount}.\n\n`,
  };
  next.decision.changeDiff = [
    {
      factLabel: "Quote",
      from: `Version ${latest.version} on file`,
      to: `Version ${version} proposed`,
    },
  ];
  return next;
}

export function snoozeEnquiry(enquiry: Enquiry, untilIso: string): Enquiry {
  const next = structuredClone(enquiry);
  next.snoozedUntil = untilIso;
  next.atRisk = false;
  next.followUpDue = false;
  return next;
}

export function declineWithLetter(
  enquiry: Enquiry,
  letter: { body: string; from: string; to: string },
): Enquiry {
  const next = structuredClone(enquiry);
  const channel: Channel = replyChannel(enquiry);
  next.conversation = [
    ...next.conversation,
    {
      id: `${enquiry.id}-out-decline-${Date.now()}`,
      direction: "outbound",
      channel,
      at: new Date().toISOString(),
      from: letter.from,
      to: letter.to,
      subject: isShortChannel(channel) ? undefined : next.decision.draft.subject,
      body: letter.body,
    },
  ];
  next.state = {
    lifecycle: "DECLINED",
    decision: "NONE",
    commercial: next.state.commercial,
    responsibility: "NONE",
  };
  next.followUpDue = false;
  next.atRisk = false;
  next.snoozedUntil = undefined;
  return next;
}

export function defaultDeclineBody(enquiry: Enquiry, ownerFirst: string): string {
  const first = firstName(enquiry.customerName);
  if (isShortChannel(replyChannel(enquiry))) {
    return `Hi ${first} - I’m not the right fit for this one. Thank you for writing.`;
  }
  return `Hi ${first},\n\nI'm not the right fit for this one. Thank you for writing - I didn't want to leave you waiting.\n\n${ownerFirst}`;
}

export function autopilotEligible(
  enquiry: Enquiry,
  business: Business,
  action: string,
): boolean {
  if (enquiry.state.lifecycle !== "OPEN") return false;
  if (!enquiry.decision.automationEligible) return false;
  if (enquiry.decision.recommendation.action !== action) return false;
  if (!enquiry.decision.recommendation.primaryEnabled) return false;
  if (enquiry.decision.risk === "PROHIBITED_AUTO" || enquiry.decision.risk === "HIGH") return false;
  if (business.paused) return false;
  const policy = business.actionPolicies.find((p) => p.action === action);
  if (!policy || policy.mode !== "Automatic when safe") return false;
  if (policy.risk === "HIGH" || policy.risk === "PROHIBITED_AUTO") return false;
  return true;
}

export function canAutopilotSend(enquiry: Enquiry, business: Business | undefined, offline: boolean) {
  if (!business) return false;
  if (outboundBlocked(business, offline, enquiry)) return false;
  return autopilotEligible(enquiry, business, enquiry.decision.recommendation.action);
}

/**
 * Whether an action class writes a real outbound record when its primary
 * button is clicked - `firstBeta.recordSent` live, the demo `approve()` in
 * demo mode. Every such action must open the approval preview first; there is
 * no other kind of "send".
 *
 * The floor used to be `needsSendConfirm`, gated to `SEND_QUOTE` /
 * `SEND_ESTIMATE` only. That left every other sendable action - ACKNOWLEDGE,
 * REQUEST_INFORMATION, HANDOFF_BOOKING, FOLLOW_UP, DECLINE and the rest -
 * going straight from a single click to a persisted send with nothing shown
 * first, non-commercial replies included. `ACTION_CATALOGUE` is the product's
 * own list of action classes a business can be granted, and every entry in it
 * is, by definition, a customer-facing send (verified in
 * `commercial.test.ts`); `isSendableAction` is the wider set that also
 * includes the action classes not yet promoted into the catalogue
 * (ACKNOWLEDGE, SEND_QUALIFICATION_RESPONSE, SEND_AVAILABILITY,
 * RECOMMEND_OFFER, OFFER_BOOKING) but which reach the exact same primary
 * button and the exact same `commitSend`/`recordSent` call. `needsSendConfirm`
 * stays for whatever extra commercial friction (amount, risk) the UI layers
 * on top of the floor - it no longer decides whether the floor exists.
 */
export function isCustomerFacingSend(action: RecommendationAction): boolean {
  return isSendableAction(action);
}

/**
 * Every commercial send gets an approval preview - the channel, the exact
 * recipient, the exact text, the amount and the reason - before the record is
 * written. Risk and amount used to gate whether the owner saw any of that at
 * all: a $40 makeup quote went out on a single undifferentiated click. The
 * floor is now unconditional; risk and amount are free to change how much
 * friction sits on top of it, never whether a preview exists at all.
 */
export function needsSendConfirm(enquiry: Enquiry): boolean {
  const action = enquiry.decision.recommendation.action;
  return action === "SEND_QUOTE" || action === "SEND_ESTIMATE";
}

export function recordAutomatedSend(
  enquiry: Enquiry,
  business: Business,
): AutomatedSend {
  return {
    enquiryId: enquiry.id,
    customerName: enquiry.customerName,
    businessId: business.id,
    action: enquiry.decision.recommendation.action,
    at: new Date().toISOString(),
    reason: `Allowed for ${enquiry.decision.recommendation.label.toLowerCase()}. Runtime still passed facts, risk and send permission.`,
  };
}

export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export function isSnoozed(enquiry: Enquiry, now = Date.now()): boolean {
  if (!enquiry.snoozedUntil) return false;
  const t = Date.parse(enquiry.snoozedUntil);
  return Number.isFinite(t) && t > now;
}
