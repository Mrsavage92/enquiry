import type {
  CompositeState,
  RecommendationAction,
  EvaluatorType,
  Enquiry,
  EnquiryFact,
} from "./types";

/**
 * The one place a fact's status becomes reader-facing text.
 *
 * Text, not a colour swatch - `Badge` already carries its own tone, but the
 * label itself is what a screen reader announces and what survives someone
 * being colour-blind. Shared between `intelligence.tsx` and
 * `answer-blocker.tsx` so an "Inferred" fact reads the same wherever its
 * value is echoed.
 */
export function factStatusLabel(status: EnquiryFact["status"]): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "inferred":
      return "Inferred";
    case "check_this":
      return "Check this";
    case "range":
      return "Range preserved";
    default:
      return "Unknown";
  }
}

/** The `Badge` tone that pairs with `factStatusLabel` - never the only signal. */
export function factStatusTone(status: EnquiryFact["status"]): "neutral" | "ok" | "warn" | "info" {
  switch (status) {
    case "confirmed":
      return "ok";
    case "check_this":
      return "warn";
    case "inferred":
      return "info";
    default:
      return "neutral";
  }
}

export function derivedLabel(state: CompositeState, enquiry?: Enquiry): string {
  if (state.lifecycle === "BOOKED") return "Booked";
  if (state.lifecycle === "LOST") return "Lost";
  if (state.lifecycle === "DECLINED") return "Declined";
  if (state.lifecycle === "CANCELLED") return "Cancelled";
  if (enquiry?.source === "comment" && state.lifecycle === "OPEN") return "Public comment";
  if (enquiry?.snoozedUntil && Date.parse(enquiry.snoozedUntil) > Date.now()) return "Snoozed";
  if (enquiry?.followUpDue) return "Follow-up ready";
  if (enquiry?.atRisk) return "At risk";
  if (state.decision === "EVALUATING") return "Reading";
  if (state.decision === "NEEDS_INFORMATION") return "Needs info";
  if (state.decision === "BOOKING_PENDING") return "Booking pending";
  if (
    state.decision === "WAITING_ON_CLIENT" &&
    (state.commercial === "QUOTED" || state.commercial === "ESTIMATED")
  ) {
    return "Sent";
  }
  if (state.decision === "WAITING_ON_CLIENT") return "Waiting on client";
  if (state.decision === "NEEDS_HUMAN") return "Needs you";
  if (
    state.decision === "ACTION_READY" &&
    enquiry?.decision.recommendation.action === "SEND_QUOTE"
  ) {
    return "Ready to quote";
  }
  if (state.decision === "ACTION_READY") return "Needs you";
  return "Open";
}

export function queueSection(enquiry: Enquiry): "needs_you" | "waiting" | "at_risk" | "recent" {
  if (enquiry.state.lifecycle !== "OPEN") return "recent";
  if (enquiry.snoozedUntil && Date.parse(enquiry.snoozedUntil) > Date.now()) return "waiting";
  if (enquiry.atRisk) return "at_risk";
  if (enquiry.followUpDue) return "at_risk";
  if (
    enquiry.state.decision === "WAITING_ON_CLIENT" &&
    enquiry.state.responsibility === "CUSTOMER"
  ) {
    return "waiting";
  }
  if (
    enquiry.state.decision === "NEEDS_HUMAN" ||
    enquiry.state.decision === "NEEDS_INFORMATION" ||
    enquiry.state.decision === "ACTION_READY" ||
    enquiry.state.decision === "EVALUATING" ||
    enquiry.state.decision === "BOOKING_PENDING"
  ) {
    return "needs_you";
  }
  return "recent";
}

export function nextNeedsYou(
  enquiries: Enquiry[],
  businessFilter: string,
  currentId: string,
): string | undefined {
  return enquiries.find(
    (e) =>
      e.id !== currentId &&
      (businessFilter === "all" || e.businessId === businessFilter) &&
      queueSection(e) === "needs_you",
  )?.id;
}

export const ACTION_LABELS: Record<RecommendationAction, string> = {
  ACKNOWLEDGE: "Send acknowledgement",
  REQUEST_INFORMATION: "Ask for missing information",
  SEND_QUALIFICATION_RESPONSE: "Send qualification reply",
  SEND_AVAILABILITY: "Send availability",
  SEND_ESTIMATE: "Send estimate",
  SEND_QUOTE: "Send quote",
  RECOMMEND_OFFER: "Recommend offer",
  ROUTE_ENQUIRY: "Route enquiry",
  OFFER_BOOKING: "Offer booking",
  HANDOFF_BOOKING: "Send booking link",
  FOLLOW_UP: "Send follow-up",
  WAIT: "Wait",
  DECLINE: "Decline enquiry",
  ESCALATE_HUMAN: "Needs you",
  NO_ACTION: "No action",
};

export const EVALUATOR_LABELS: Record<EvaluatorType, string> = {
  pricing: "Pricing",
  eligibility: "Eligibility",
  package_selection: "Package",
  availability: "Availability",
  capacity: "Capacity",
  location_travel: "Travel",
  qualification_routing: "Qualification",
  deposit_booking_readiness: "Booking readiness",
};

export type CommercialKind = "exact" | "estimate" | "not_ready" | "not_applicable";

export type CommercialValue = {
  kind: CommercialKind;
  /** Visible amount, or “Price not ready” when pricing applies but cannot be decided. Empty when not applicable. */
  amountLabel: string;
  /** Human caption - Exact quote / Estimate / why it is not ready. */
  caption: string;
};

export type PricingApplicability = "applicable" | "not_applicable";

/** Pricing is one evaluator family. Applicability comes from that result, not from whether an amount exists. */
export function pricingApplicability(enquiry: Enquiry): PricingApplicability {
  const pricing = enquiry.decision.evaluators.find((e) => e.type === "pricing");
  if (pricing) {
    return pricing.status === "NOT_APPLICABLE" ? "not_applicable" : "applicable";
  }
  // No pricing family selected - either still reading, or this enquiry does not use price.
  return "not_applicable";
}

export function commercialValue(enquiry: Enquiry): CommercialValue {
  if (pricingApplicability(enquiry) === "not_applicable") {
    return {
      kind: "not_applicable",
      amountLabel: "",
      caption: "",
    };
  }

  const pricing = enquiry.decision.evaluators.find((e) => e.type === "pricing");
  const status = pricing?.status;
  const blocking = enquiry.decision.missing.some((m) => m.blocking);
  const assumedExact = status === "EXACT" && Boolean(pricing?.assumptions?.length) && blocking;

  if (status === "RANGE" || (enquiry.valueRange && status !== "EXACT")) {
    const range = enquiry.valueRange ?? pricing?.range;
    return {
      kind: "estimate",
      amountLabel: range ? `${formatAud(range.min)}–${formatAud(range.max)}` : "Estimate",
      caption: "Estimate",
    };
  }

  if (assumedExact) {
    return {
      kind: "not_ready",
      amountLabel: "Price not ready",
      caption: pricing?.assumptions?.[0] ?? "Not locked until the missing fact is known.",
    };
  }

  if (status === "NOT_QUOTABLE" || status === "ERROR") {
    return {
      kind: "not_ready",
      amountLabel: "Price not ready",
      caption: pricing?.summary ?? "Not enough to quote.",
    };
  }

  if (status === "EXACT" && enquiry.valueExact) {
    const quoted = enquiry.state.commercial === "QUOTED" || enquiry.state.commercial === "ACCEPTED";
    return {
      kind: "exact",
      amountLabel: formatAud(enquiry.valueExact.amount),
      caption: quoted ? "Quoted" : "Exact quote",
    };
  }

  if (enquiry.valueExact) {
    return {
      kind: "exact",
      amountLabel: formatAud(enquiry.valueExact.amount),
      caption: "Exact quote",
    };
  }

  return {
    kind: "not_ready",
    amountLabel: "Price not ready",
    caption: "No commercial value yet.",
  };
}

export function valueLabel(enquiry: Enquiry): string {
  return commercialValue(enquiry).amountLabel;
}

export function formatAud(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function isExactValue(enquiry: Enquiry): boolean {
  return commercialValue(enquiry).kind === "exact";
}

export type QueueSummary = {
  needsYou: number;
  waiting: number;
  atRisk: number;
  open: number;
  exactCount: number;
  exactValue: number;
};

export function queueSummary(enquiries: Enquiry[]): QueueSummary {
  const open = enquiries.filter((e) => e.state.lifecycle === "OPEN");
  const exact = open.filter((e) => commercialValue(e).kind === "exact");
  return {
    needsYou: enquiries.filter((e) => queueSection(e) === "needs_you").length,
    waiting: enquiries.filter((e) => queueSection(e) === "waiting").length,
    atRisk: enquiries.filter((e) => queueSection(e) === "at_risk").length,
    open: open.length,
    exactCount: exact.length,
    exactValue: exact.reduce((sum, e) => sum + (e.valueExact?.amount ?? 0), 0),
  };
}

export function queueHeadline(summary: QueueSummary): string {
  return summary.needsYou === 0 ? "Caught up" : `${summary.needsYou} need you`;
}
