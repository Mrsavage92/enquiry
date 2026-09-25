import type {
  CompositeState,
  RecommendationAction,
  EvaluatorType,
  Enquiry,
  EnquiryFact,
  IntegrationHealth,
} from "./types";
import { isPricingStep, setupStep } from "./next-action.ts";
import { decidingPhrase } from "./price-compiler.ts";
import { firstName } from "./customer-name.ts";

/**
 * The one place a fact's status becomes reader-facing text.
 *
 * Text, not a colour swatch - `Badge` already carries its own tone, but the
 * label itself is what a screen reader announces and what survives someone
 * being colour-blind. Shared between `intelligence.tsx` and
 * `answer-blocker.tsx` so a fact read from the message reads the same wherever its
 * value is echoed.
 */
export function factStatusLabel(status: EnquiryFact["status"]): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "inferred":
      // Read from what the customer wrote, not yet checked by the owner.
      return "From their message";
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

/** Field names people read, capitalised: "bedrooms" -> "Bedrooms". */
const FIELD_NAMES: Record<string, string> = {
  date: "Job date",
  not_available: "Not available",
  name: "Name",
  phone: "Phone",
  email: "Email",
  service: "Service",
};

/**
 * A stored fact field as a label on screen: "bedrooms" -> "Bedrooms",
 * "extra:oven cleaning" -> "Also asked for oven cleaning", "not_available" ->
 * "Not available". Never a raw key.
 */
export function fieldLabel(field: string): string {
  const raw = field.trim();
  if (/^extra:/i.test(raw)) return `Also asked for ${raw.slice(6).trim().toLowerCase()}`;
  const known = FIELD_NAMES[raw.toLowerCase()];
  if (known) return known;
  const words = raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : raw;
}

/**
 * The one place an integration's connection status becomes reader-facing
 * text - `not_connected` was rendering raw on /trust (launch-audit run 29,
 * P0-6/P1-5, 2026-09-04). Shared between `TrustOverview` and `TrustAccess`
 * so the same status never reads two different ways on the same screen.
 */
export function integrationStatusLabel(status: IntegrationHealth["status"]): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Needs attention";
    case "not_connected":
    default:
      return "Not connected";
  }
}

/**
 * The owner-facing status vocabulary. One small plain set, and the only place
 * any of these words is written: every badge, filter and heading in the app
 * reads from here, and `status-vocabulary.test.ts` fails on a status word
 * hard-coded anywhere else.
 *
 * The promise itself is always Yes / No / Not yet (see PROMISE_WORDS). These
 * are the words for where an enquiry stands.
 */
export const STATUS = {
  reading: "Reading",
  needsDetail: "Needs a detail",
  yourCall: "Your call",
  replyReady: "Reply ready",
  waiting: "Waiting",
  followUp: "Follow up",
  later: "Later",
  // A quoted customer who has gone quiet. Was "Needs a look", which read as a
  // second "Needs you" queue beside the real one.
  goneQuiet: "Gone quiet",
  needsPrices: "Needs your prices",
  bookingToConfirm: "Booking to confirm",
  publicComment: "Public comment",
  booked: "Booked",
  declined: "Declined",
  lost: "Lost",
  cancelled: "Cancelled",
  open: "Open",
} as const;

export type StatusWord = (typeof STATUS)[keyof typeof STATUS];

/** Markers that sit beside a status, never replacing it. */
export const MARKERS = { practice: "Practice" } as const;

/** The three answers to "can I safely promise this?". */
export const PROMISE_WORDS = { yes: "Yes", no: "No", notYet: "Not yet" } as const;

export type PromiseWord = (typeof PROMISE_WORDS)[keyof typeof PROMISE_WORDS];

/**
 * The answer to "can I safely promise this?" for one enquiry, in the product's
 * three words, with the short reason. Derived only from the decision state, so
 * it can never say Yes over an enquiry that has nothing ready.
 */
export function promiseVerdict(enquiry: Enquiry): { word: PromiseWord; line: string } {
  const { lifecycle, decision, commercial } = enquiry.state;
  const v = (word: PromiseWord, reason: string) => ({ word, line: `${word} - ${reason}` });
  if (lifecycle === "BOOKED") return v(PROMISE_WORDS.yes, "booked");
  if (lifecycle === "DECLINED" || lifecycle === "LOST" || lifecycle === "CANCELLED") {
    return v(PROMISE_WORDS.no, "closed");
  }
  const rec = enquiry.decision?.recommendation;
  const ineligible = enquiry.decision?.evaluators?.some(
    (e) => e.type === "eligibility" && e.status === "FAIL",
  );
  if (rec?.action === "DECLINE" || ineligible) return v(PROMISE_WORDS.no, "outside what you offer");
  if (decision === "EVALUATING") return v(PROMISE_WORDS.notYet, "still reading it");
  if (decision === "WAITING_ON_CLIENT") {
    return commercial === "QUOTED" || commercial === "ESTIMATED" || commercial === "ACCEPTED"
      ? v(PROMISE_WORDS.yes, "your quote is with them")
      : v(PROMISE_WORDS.notYet, "waiting on their answer");
  }
  const extra = enquiry.decision?.extraPending;
  if (extra) return v(PROMISE_WORDS.notYet, `they also asked for ${extra.label.toLowerCase()}`);
  const blocking = enquiry.decision?.missing?.find((m) => m.blocking);
  if (blocking?.inferred) return v(PROMISE_WORDS.notYet, "check one detail they gave");
  if (decision === "NEEDS_INFORMATION") return v(PROMISE_WORDS.notYet, "one detail decides it");
  const setup = setupStep(enquiry);
  if (isPricingStep(setup)) return v(PROMISE_WORDS.notYet, "your prices decide it");
  if (setup || needsOneDetail(enquiry)) return v(PROMISE_WORDS.notYet, "say which service");
  if (decision === "ACTION_READY") {
    // The reply asks about a day that has passed or does not match its weekday.
    const dateToCheck = (enquiry.facts ?? []).some(
      (f) =>
        !f.superseded &&
        f.field.trim().toLowerCase() === "date" &&
        (f.status === "conflict" || f.status === "check_this"),
    );
    return v(PROMISE_WORDS.yes, dateToCheck ? "reply ready, one date to check" : "reply ready");
  }
  if (decision === "BOOKING_PENDING") return v(PROMISE_WORDS.yes, "confirm the booking");
  return v(PROMISE_WORDS.notYet, "your call");
}

/** Queue and tab names. "Needs you" is only ever the name of the queue, never a badge. */
export const QUEUE_NAMES = {
  needs_you: "Needs you",
  waiting: STATUS.waiting,
  at_risk: STATUS.goneQuiet,
  closed: "Closed",
  all: "All",
} as const;

export function derivedLabel(state: CompositeState, enquiry?: Enquiry): StatusWord {
  if (state.lifecycle === "BOOKED") return STATUS.booked;
  if (state.lifecycle === "LOST") return STATUS.lost;
  if (state.lifecycle === "DECLINED") return STATUS.declined;
  if (state.lifecycle === "CANCELLED") return STATUS.cancelled;
  if (enquiry?.source === "comment" && state.lifecycle === "OPEN") return STATUS.publicComment;
  if (enquiry?.snoozedUntil && Date.parse(enquiry.snoozedUntil) > Date.now()) return STATUS.later;
  if (enquiry?.followUpDue) return STATUS.followUp;
  if (enquiry?.atRisk) return STATUS.goneQuiet;
  if (state.decision === "EVALUATING") return STATUS.reading;
  if (state.decision === "NEEDS_INFORMATION") return STATUS.needsDetail;
  if (state.decision === "BOOKING_PENDING") return STATUS.bookingToConfirm;
  if (state.decision === "WAITING_ON_CLIENT") return STATUS.waiting;
  // The chip agrees with the next step: an enquiry waiting on the owner's
  // prices says so, rather than "Your call" beside "Add your prices".
  if (enquiry && isPricingStep(setupStep({ state, decision: enquiry.decision }))) {
    return STATUS.needsPrices;
  }
  // Saying which service it is, or choosing between two, is one detail the
  // owner supplies - the same kind of blocker as a missing count, so the same
  // word. "Your call" is kept for enquiries that need judgment, not a detail.
  if (state.decision === "NEEDS_HUMAN" && enquiry && needsOneDetail(enquiry)) {
    return STATUS.needsDetail;
  }
  if (state.decision === "NEEDS_HUMAN") return STATUS.yourCall;
  if (state.decision === "ACTION_READY") return STATUS.replyReady;
  return STATUS.open;
}

/** Reason codes for an escalation whose way forward is one detail from the owner. */
const ONE_DETAIL_CODES = new Set([
  "CHOOSE_SERVICE",
  "CONFIRM_SERVICE",
  "CHOOSE_BETWEEN",
  "CHECK_EXTRA",
]);
const ONE_DETAIL_LABELS = new Set(["Confirm the service", "Choose the service"]);

/** Whether an escalation is waiting on one detail rather than on judgment. */
export function needsOneDetail(enquiry: Pick<Enquiry, "decision">): boolean {
  const rec = enquiry.decision?.recommendation;
  if (!rec) return false;
  return (
    (rec.reasonCodes ?? []).some((c) => ONE_DETAIL_CODES.has(c)) || ONE_DETAIL_LABELS.has(rec.label)
  );
}

/** What a waiting enquiry is waiting for, as the end of a sentence. */
export function waitingForPhrase(enquiry: Enquiry): string {
  const blocking = enquiry.decision?.missing?.find((m) => m.blocking);
  if (blocking) return decidingPhrase(blocking.label.toLowerCase());
  const quoted = enquiry.state.commercial === "QUOTED" || enquiry.state.commercial === "ESTIMATED";
  return quoted ? "their answer to your quote" : "their answer";
}

/** The amount of the quote they are answering, as sent: "$880". */
export function sentQuoteAmount(enquiry: Enquiry): string | null {
  const quoted = enquiry.state.commercial === "QUOTED" || enquiry.state.commercial === "ESTIMATED";
  if (!quoted) return null;
  const sentQuote = [...enquiry.decision.quotes].reverse().find((q) => q.sentAt);
  const total = enquiry.valueExact?.amount ?? sentQuote?.total?.amount;
  return typeof total === "number" ? formatAud(total) : null;
}

/**
 * The owner's next step for one enquiry, in their words: what they would do,
 * not what the customer said. Used to lead rows and the "Start here" card.
 */
export function nextStepLabel(enquiry: Enquiry): string {
  if (enquiry.state.lifecycle !== "OPEN") return "Nothing to do";
  if (enquiry.state.decision === "EVALUATING") return "Enquiry is reading it";
  if (enquiry.followUpDue) return "Decide whether to follow up";
  const extra = enquiry.decision?.extraPending;
  if (extra?.kind === "check") return `Add or leave out ${extra.label.toLowerCase()}`;
  const blocking = enquiry.decision?.missing?.find((m) => m.blocking);
  if (enquiry.state.decision === "NEEDS_INFORMATION" && blocking?.inferred) {
    // They already said it: the owner checks the reading, never asks again.
    return `Check ${decidingPhrase(blocking.label.toLowerCase())}`;
  }
  if (enquiry.state.decision === "NEEDS_INFORMATION" && blocking) {
    // What the owner does next is ask the customer; the phone card offers
    // typing it in as the second choice.
    return `Ask for ${decidingPhrase(blocking.label.toLowerCase())}`;
  }
  if (enquiry.state.decision === "WAITING_ON_CLIENT") {
    return `Waiting on ${firstName(enquiry)} - for ${waitingForPhrase(enquiry)}`;
  }
  const setup = setupStep(enquiry);
  if (setup) return setup.label;
  const label = enquiry.decision?.recommendation?.label?.trim();
  return label || "Open it and decide";
}

export function queueSection(enquiry: Enquiry): "needs_you" | "waiting" | "at_risk" | "recent" {
  if (enquiry.state.lifecycle !== "OPEN") return "recent";
  if (enquiry.snoozedUntil && Date.parse(enquiry.snoozedUntil) > Date.now()) return "waiting";
  // A follow-up that has come due is a decision due now, with its reason on
  // the row: it belongs with everything else that needs the owner.
  if (enquiry.followUpDue) return "needs_you";
  if (enquiry.atRisk) return "at_risk";
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

/**
 * "closed" is deliberately a raw lifecycle check, not `queueSection` - a
 * closed enquiry (declined, lost, booked, cancelled) has left every
 * attention-based section by definition, so this is the one filter that
 * reads `state.lifecycle` directly rather than routing through it.
 */
function matchesQueueFilter(enquiry: Enquiry, queueFilter: string): boolean {
  if (queueFilter === "all") return true;
  if (queueFilter === "closed") return enquiry.state.lifecycle !== "OPEN";
  return queueSection(enquiry) === queueFilter;
}

/**
 * The queue's own filter logic, kept here (not in `queue.tsx`) so it is a
 * pure function reachable from a plain unit test - `queue.tsx` is a React
 * component file (JSX), and the test runner's type-stripping mode cannot
 * parse JSX, so nothing in this codebase's test suite has ever imported a
 * `.tsx` file directly.
 */
export function filteredEnquiries(
  enquiries: Enquiry[],
  businessFilter: string,
  queueFilter: string,
  activeId?: string,
): Enquiry[] {
  return enquiries.filter((e) => {
    if (businessFilter !== "all" && e.businessId !== businessFilter) return false;
    if (activeId && e.id === activeId) return true;
    return matchesQueueFilter(e, queueFilter);
  });
}

/**
 * Whether any enquiry genuinely belongs in this filter - the same test
 * `filteredEnquiries` applies, minus its `activeId` pin.
 *
 * `filteredEnquiries` always keeps the open enquiry in its result so a queue
 * list never silently drops the card someone is looking at (tested above:
 * "the closed filter still surfaces the active enquiry even when it is
 * open" - `activeId` always wins). That pin is right for navigation - the
 * open enquiry has to stay reachable - but it means `filteredEnquiries`'s
 * result can be non-empty purely because of the pin, with nothing in it that
 * actually matches the filter. A caller that renders a per-filter empty
 * state (the queue's "Nobody is waiting") needs to ask this question
 * instead of checking the pinned list's length, or the pinned row silently
 * suppresses the empty state it should be showing.
 */
export function queueFilterHasMatch(
  enquiries: Enquiry[],
  businessFilter: string,
  queueFilter: string,
): boolean {
  return enquiries.some(
    (e) =>
      (businessFilter === "all" || e.businessId === businessFilter) &&
      matchesQueueFilter(e, queueFilter),
  );
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
  ESCALATE_HUMAN: "Your call",
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
  // A live (non-fixture) enquiry's decision snapshot never populates
  // `evaluators` - only hand-authored fixtures do. A structurally recorded
  // figure on the enquiry itself (written from a real quote_version row) is
  // just as valid a signal that pricing applies here, read from data rather
  // than guessed - without this, a real sent quote's amount would compute
  // correctly everywhere except the one place a business scans first.
  if (enquiry.valueExact || enquiry.valueRange) return "applicable";
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
    // Whole dollars stay whole; cents always show two places ("$4.50").
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
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

export function queueSummary(all: Enquiry[]): QueueSummary {
  // A practice enquiry never counts: not in "needs you", not in any figure.
  const enquiries = all.filter((e) => !e.practice);
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

/**
 * What an empty tab says when nothing was searched for. Each tab says what is
 * true of that tab; "No enquiries match" is only ever the answer to a search.
 */
export function emptyTabMessage(queueFilter: string): string {
  switch (queueFilter) {
    case "needs_you":
      return "Nothing needs you right now.";
    case "waiting":
      return "You are not waiting on anyone.";
    case "at_risk":
      return "No quiet enquiries.";
    case "closed":
      return "Nothing closed yet.";
    default:
      return "No enquiries yet.";
  }
}

/** The queue's heading. Words, not a large number: what is next, not what is behind. */
export function queueHeadline(summary: QueueSummary): string {
  return summary.needsYou === 0 ? "Caught up" : QUEUE_NAMES.needs_you;
}

/** One plain sentence with the count only for what needs action today. */
export function needsYouSentence(count: number): string {
  if (count === 0) return "Nothing needs you right now.";
  return count === 1 ? "1 enquiry needs you today." : `${count} enquiries need you today.`;
}
