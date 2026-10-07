import type { Business, Enquiry, RiskClass } from "./types.ts";
import { ACTION_CATALOGUE } from "./action-catalogue.ts";
import { enquirySituation, isSendableAction, outboundBlocked } from "./situation.ts";
import { isPricingStep, setupStep } from "./next-action.ts";
import { needsServiceConfirmation } from "./service-authority.ts";
import { serviceNeedsOwner } from "./service-match.ts";
import { isOwnerEstimate } from "./count-phrase.ts";
import { holdingItems } from "./asked.ts";
import { savedPriceFor } from "./asked-view.ts";
import type { CoverageFlag } from "./coverage.ts";
import { preparedBody } from "./labels.ts";
import { coversLabel } from "./coverage-fold.ts";
import { formatMinorAud } from "./money-format.ts";
import { quantityPhrase } from "./compose-reply.ts";

/**
 * The laser-focus enquiry screen, as one pure reading of an enquiry (research
 * doc 50 section 6). The screen and its tests read the same answer: what the
 * one next step is, the label of its one filled button, and whether the reply
 * may be copied. Nothing here decides anything about the enquiry; it only says
 * which of the existing controls is the owner's next tap.
 */

/** The owner decisions a Q row can be (doc 50 section 6, "Q"). */
export type DecisionKind =
  | "stale_edit"
  | "situation"
  | "choose_service"
  | "confirm_service"
  | "question_service"
  | "question_availability"
  | "question_ask"
  | "extra"
  | "rule"
  | "flag"
  | "asked"
  | "coverage"
  | "reading"
  | "estimate"
  | "booking";

export type LaserNext =
  | { kind: "reading" }
  | { kind: "closed" }
  | { kind: "waiting" }
  | { kind: "decide"; decision: DecisionKind; primary: string | null }
  | { kind: "prices"; label: string; practice: boolean }
  | { kind: "send"; label: string; review: boolean; followUp: boolean; fold: boolean }
  | { kind: "blocked"; reason: string }
  | { kind: "your_call" };

export type LaserContext = {
  business?: Business;
  demoMode?: boolean;
  offline?: boolean;
  /** An edit made before the facts moved, not yet kept or dropped. */
  staleEdit?: boolean;
};

const RISK_ORDER: Record<RiskClass, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, PROHIBITED_AUTO: 3 };

/**
 * The higher of the action catalogue's risk and the decision's own (doc 50
 * 7.1). Live snapshots default the decision's to MEDIUM, so the catalogue is
 * what makes a kind no HIGH in production.
 */
export function sendRisk(enquiry: Pick<Enquiry, "decision">): RiskClass {
  const action = enquiry.decision.recommendation.action;
  const catalogue = ACTION_CATALOGUE.find((a) => a.action === action)?.risk ?? "MEDIUM";
  const own = enquiry.decision.risk ?? "MEDIUM";
  return RISK_ORDER[own] > RISK_ORDER[catalogue] ? own : catalogue;
}

export function isHighRisk(enquiry: Pick<Enquiry, "decision">): boolean {
  return RISK_ORDER[sendRisk(enquiry)] >= RISK_ORDER.HIGH;
}

/** The coverage tap is folded into Copy for this enquiry right now. */
export function folding(enquiry: Pick<Enquiry, "decision">): boolean {
  const d = enquiry.decision;
  return Boolean(d.fold && d.coverage && !d.coverage.confirmed);
}

function questionPrimary(enquiry: Enquiry): { decision: DecisionKind; primary: string | null } {
  const q = enquiry.decision.questionPending!;
  if (q.kind === "availability") return { decision: "question_availability", primary: null };
  if (q.kind === "ask") {
    return { decision: "question_ask", primary: q.saved ? "Use this answer" : null };
  }
  return {
    decision: "question_service",
    primary: q.readAs === "no" ? `No, I don't do ${q.thing}` : `Yes, I do ${q.thing}`,
  };
}

function extraPrimary(enquiry: Enquiry): string | null {
  const extra = enquiry.decision.extraPending!;
  if (extra.kind !== "check") return null;
  const price = typeof extra.amountMinor === "number" ? formatMinorAud(extra.amountMinor) : null;
  return price ? `Add your ${price} ${extra.label.toLowerCase()}` : "Add it to the quote";
}

/** The coverage card's next tap: a rule, a flag, something they asked, then "That's everything". */
function coverageStep(
  enquiry: Enquiry,
  business: Business | undefined,
): { decision: DecisionKind; primary: string | null } {
  const coverage = enquiry.decision.coverage!;
  const flag = coverage.flagged.find((f) => f.thing);
  if (flag?.kind === "rule" && flag.check) {
    return { decision: "rule", primary: flag.check.choices[0]?.[1] ?? null };
  }
  if (flag) return { decision: "flag", primary: flagPrimary(flag) };
  const asked = askedStep(enquiry, business);
  if (asked) return asked;
  return { decision: "coverage", primary: "That's everything" };
}

/**
 * The next thing they asked that is still to settle, asked on its own (go-live
 * review B2): never left in a collapsed row while Copy is offered. Its filled
 * button is "Add it" when one of the owner's saved prices covers it.
 */
function askedStep(
  enquiry: Enquiry,
  business: Business | undefined,
): { decision: DecisionKind; primary: string | null } | null {
  const item = holdingItems(enquiry.decision.asked ?? [])[0];
  if (!item) return null;
  const priced = savedPriceFor(item, enquiry, business);
  return { decision: "asked", primary: priced ? `Add it - ${priced}` : null };
}

/** "Add your $60 oven clean" when one of the owner's saved prices covers it; else no filled button. */
function flagPrimary(flag: CoverageFlag): string | null {
  if (!flag.offer) return null;
  const service = flag.offer.service.toLowerCase();
  return typeof flag.offer.amountMinor === "number"
    ? `Add your ${formatMinorAud(flag.offer.amountMinor)} ${service}`
    : `Add your ${service}`;
}

function readingPrimary(enquiry: Enquiry): string {
  const missing = enquiry.decision.missing.find((m) => m.blocking)!;
  const reading = missing.inferred!;
  const said = reading.display || reading.value;
  const about = /\b(?:about|roughly|around|approx|maybe|nearly|almost|ish)\b|~/i.test(said);
  return `Yes, ${about ? "about " : ""}${quantityPhrase(reading.value, missing.label)}`;
}

function sendStep(enquiry: Enquiry): LaserNext {
  const followUp = enquiry.decision.recommendation.action === "FOLLOW_UP";
  const fold = folding(enquiry);
  const label = fold
    ? coversLabel(enquiry.decision.fold!.items)
    : followUp
      ? "Copy follow-up"
      : "Copy reply";
  return { kind: "send", label, review: isHighRisk(enquiry), followUp, fold };
}

/** Waiting on the customer, with nothing prepared to send. */
function waitingOnThem(enquiry: Enquiry): boolean {
  const s = enquiry.state;
  if (s.lifecycle === "BOOKED") return true;
  if (s.decision !== "WAITING_ON_CLIENT") return false;
  const rec = enquiry.decision.recommendation;
  return !(enquiry.followUpDue && rec.action === "FOLLOW_UP" && rec.primaryEnabled);
}

/**
 * The one next step on this enquiry. In order: what blocks reading it at all,
 * then the owner's open decisions one at a time, then the send.
 */
export function laserNext(enquiry: Enquiry, ctx: LaserContext = {}): LaserNext {
  const d = enquiry.decision;
  const rec = d.recommendation;
  if (enquiry.state.lifecycle !== "OPEN" && enquiry.state.lifecycle !== "BOOKED") {
    return { kind: "closed" };
  }
  if (enquiry.state.decision === "EVALUATING") return { kind: "reading" };
  if (waitingOnThem(enquiry)) return { kind: "waiting" };
  if (ctx.demoMode) {
    return isSendableAction(rec.action) && rec.primaryEnabled
      ? sendStep(enquiry)
      : { kind: "your_call" };
  }
  if (ctx.staleEdit) return { kind: "decide", decision: "stale_edit", primary: "Use new reply" };
  const situation = enquirySituation(enquiry, ctx.business);
  if (situation && situation.kind !== "calendar_down") {
    return { kind: "decide", decision: "situation", primary: null };
  }
  if (d.questionPending) return { kind: "decide", ...questionPrimary(enquiry) };
  // A thing they asked for that nothing prices: the card wins over the pricing link.
  if (d.extraPending) return { kind: "decide", decision: "extra", primary: extraPrimary(enquiry) };
  const setup = setupStep(enquiry);
  if (setup && isPricingStep(setup)) {
    return {
      kind: "prices",
      label: setup.label,
      practice: Boolean(enquiry.practice) && setup.kind === "add_prices",
    };
  }
  if (setup?.kind === "choose_service" && serviceNeedsOwner(enquiry)) {
    return { kind: "decide", decision: "choose_service", primary: null };
  }
  const commercial = rec.action === "SEND_QUOTE" || rec.action === "SEND_ESTIMATE";
  if (needsServiceConfirmation(enquiry) && (commercial || folding(enquiry))) {
    return { kind: "decide", decision: "confirm_service", primary: null };
  }
  if (d.coverage && !d.coverage.confirmed && !folding(enquiry)) {
    return { kind: "decide", ...coverageStep(enquiry, ctx.business) };
  }
  const blocking = d.missing.find((m) => m.blocking);
  if (blocking?.inferred) {
    return { kind: "decide", decision: "reading", primary: readingPrimary(enquiry) };
  }
  if (blocking && isOwnerEstimate(blocking.factField)) {
    return { kind: "decide", decision: "estimate", primary: "Confirm" };
  }
  if (enquiry.state.decision === "BOOKING_PENDING") {
    return { kind: "decide", decision: "booking", primary: null };
  }
  const blocked = outboundBlocked(ctx.business, Boolean(ctx.offline), enquiry);
  const stillAsked = askedStep(enquiry, ctx.business);
  if (stillAsked) return { kind: "decide", ...stillAsked };
  const sendable =
    (isSendableAction(rec.action) && rec.primaryEnabled) ||
    (folding(enquiry) && !rec.blockedReason);
  if (sendable && rec.blockedReason) return { kind: "blocked", reason: rec.blockedReason };
  if (sendable && blocked) return { kind: "blocked", reason: blocked };
  if (sendable) return sendStep(enquiry);
  return { kind: "your_call" };
}

/**
 * Whether the send check may run before the tap (doc 50 7.1): only on a send
 * step, never for practice or demo, which use the client-only path.
 */
export function precheckEligible(next: LaserNext, enquiry: Enquiry, ctx: LaserContext): boolean {
  return next.kind === "send" && !enquiry.practice && !ctx.demoMode && !ctx.offline;
}

/** The text the screen shows as the reply: the owner's edit, or the prepared one. */
export function replyText(enquiry: Enquiry, ownEdit: string | undefined): string {
  return ownEdit ?? preparedBody(enquiry);
}

/** An edit is the owner's own when it differs from the prepared reply. */
export function isOwnEdit(enquiry: Enquiry, ownEdit: string | undefined): boolean {
  return ownEdit !== undefined && ownEdit !== preparedBody(enquiry);
}
