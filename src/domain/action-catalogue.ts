import type { ActionPolicy, AutomationGate, RecommendationAction, RiskClass } from "./types";

/**
 * The canonical catalogue of action classes Enquiry can be permitted to perform.
 *
 * This is product definition, so it lives in the domain. Live provisioning used
 * to derive it by importing fixture `BUSINESSES`, which meant production server
 * code could not answer "which actions exist" without loading demo tenants, and
 * a change to a demo business would silently change what a real business could
 * be granted.
 *
 * Fixtures may reuse or override this catalogue for demonstrations. Nothing here
 * depends on fixtures.
 *
 * Autonomy is EARNED per action class (AGENTS.project.md s6), so the catalogue
 * carries the action, its human label and its risk class - never a mode that
 * grants anything. `initialActionPolicies()` is the only starting state a real
 * tenant gets, and it grants nothing.
 */

export type ActionCatalogueEntry = {
  action: RecommendationAction;
  /** What the operator sees when deciding whether to permit it. */
  label: string;
  risk: RiskClass;
  /**
   * True when this class may never become automatic, regardless of evidence.
   * Declining work is a commercial judgement about a relationship; a machine
   * that gets it wrong loses a customer permanently and silently.
   */
  neverAutomatic?: boolean;
};

/**
 * Ordered for display: the safest and most frequent first, so the trust screen
 * reads as a ladder rather than a list.
 */
export const ACTION_CATALOGUE: readonly ActionCatalogueEntry[] = [
  { action: "REQUEST_INFORMATION", label: "Ask one missing-info question", risk: "LOW" },
  { action: "SEND_ESTIMATE", label: "Send estimate", risk: "MEDIUM" },
  { action: "SEND_QUOTE", label: "Send exact quote", risk: "MEDIUM" },
  { action: "FOLLOW_UP", label: "Send normal follow-up", risk: "MEDIUM" },
  { action: "HANDOFF_BOOKING", label: "Send booking link", risk: "MEDIUM" },
  { action: "DECLINE", label: "Decline an enquiry", risk: "HIGH", neverAutomatic: true },
] as const;

/**
 * The gates an action must pass before it could be performed automatically.
 *
 * All start failing-or-ungranted for a new tenant. `send` is explicitly false
 * because permission has not been given; the rest are false because no enquiry
 * has been processed yet, so there is nothing to have passed.
 */
export function initialGates(): AutomationGate[] {
  return [
    { id: "classification", label: "Enquiry classified with high confidence", passing: false },
    { id: "risk", label: "No high-risk flags", passing: false },
    { id: "send", label: "Send permission granted", passing: false },
    { id: "grounding", label: "Draft grounding validator passes", passing: false },
  ];
}

/**
 * The action policies a brand new tenant starts with.
 *
 * Everything is "Ask every time" except classes marked never-automatic, which
 * start at "Never". Nothing starts automatic, and no evidence is fabricated:
 * `evidence` is deliberately omitted rather than seeded with comparable counts,
 * because a new business has approved nothing and synthetic history would let
 * an action graduate on the strength of a demo (AGENTS.project.md s3, R2A s3).
 */
export function initialActionPolicies(): ActionPolicy[] {
  return ACTION_CATALOGUE.map((entry) => ({
    action: entry.action,
    label: entry.label,
    mode: entry.neverAutomatic ? "Never" : "Ask every time",
    risk: entry.risk,
    gates: initialGates(),
  }));
}
