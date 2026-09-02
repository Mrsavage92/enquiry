import type { Decision } from "./decide.ts";
import type { CommercialState, DecisionSnapshot, DecisionState, Recommendation, Responsibility } from "./types";

/**
 * A structurally complete decision snapshot for an enquiry that has no stored
 * one yet.
 *
 * `toEnquiry` used to cast a missing `decision_snapshot` straight to
 * `DecisionSnapshot`. TypeScript believed it; the browser did not. The first
 * real enquiry a business added crashed the desk on
 * `enquiry.decision.evaluators.filter(...)`, because the row genuinely had no
 * evaluators and the cast asserted otherwise.
 *
 * So: every array the desk reads exists here, and the default recommendation
 * says the honest thing - a human should look at this - rather than implying a
 * decision that was never made.
 */
export function emptyDecisionSnapshot(): DecisionSnapshot {
  return {
    evaluators: [],
    missing: [],
    conflicts: [],
    recommendation: {
      action: "ESCALATE_HUMAN",
      label: "Read this one",
      reason: "Enquiry has not worked this one out yet.",
      requiredApproval: true,
      reasonCodes: [],
      primaryEnabled: false,
    },
    explanation: "Enquiry has not worked this one out yet.",
    why: [],
    confidence: "Low",
    risk: "MEDIUM",
    draft: { id: "", action: "ESCALATE_HUMAN", body: "", groundedFacts: [], voiceVersion: "" },
    quotes: [],
    automationEligible: false,
    failedGates: [],
    serviceComposition: [],
  };
}

/** How a live `Decision` reads in the desk's own vocabulary. */
export function snapshotFromDecision(decision: Decision): DecisionSnapshot {
  const base = emptyDecisionSnapshot();
  const recommendation: Recommendation = {
    action: decision.action,
    label:
      decision.action === "SEND_QUOTE"
        ? "Send the quote"
        : decision.action === "REQUEST_INFORMATION"
          ? "Ask for what's missing"
          : "Read this one",
    reason: decision.explanation,
    // Nothing is ever sent without the owner, so approval is always required.
    requiredApproval: true,
    reasonCodes: [],
    primaryEnabled: decision.action !== "ESCALATE_HUMAN",
  };
  return {
    ...base,
    recommendation,
    explanation: decision.explanation,
    missing: decision.blocker
      ? [
          {
            factField: decision.blocker.field,
            label: decision.blocker.field,
            reason: decision.blocker.reason,
            blocking: true,
            unlocks: "the price",
          },
        ]
      : [],
    draft: { ...base.draft, action: decision.action },
  };
}

/**
 * The composite state a decision puts the enquiry into.
 *
 * Stored alongside the snapshot because the desk reads the columns, not the
 * snapshot, to decide what to show. Leaving a decided enquiry on EVALUATING
 * showed "Wait until Enquiry finishes reading" over an enquiry that had
 * already been read - waiting on nothing, forever.
 */
export function stateFromDecision(decision: Decision): {
  decisionState: DecisionState;
  commercialState: CommercialState;
  responsibility: Responsibility;
} {
  if (decision.action === "SEND_QUOTE") {
    // Priced and ready for the owner to send. The ball is theirs.
    return {
      decisionState: "ACTION_READY",
      commercialState: "QUOTABLE",
      responsibility: "BUSINESS",
    };
  }
  if (decision.action === "REQUEST_INFORMATION") {
    return {
      decisionState: "NEEDS_INFORMATION",
      commercialState: "UNASSESSED",
      responsibility: "BUSINESS",
    };
  }
  return {
    decisionState: "NEEDS_HUMAN",
    commercialState: "UNASSESSED",
    responsibility: "BUSINESS",
  };
}
