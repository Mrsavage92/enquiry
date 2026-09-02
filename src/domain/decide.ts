import type { Business, Enquiry, EnquiryFact, KnowledgeItem } from "./types";
import { parseBusinessRule, type BusinessRule } from "./business-rule.ts";
import { compilePrice, type CompilerFact, type PriceOutcome } from "./price-compiler.ts";

/**
 * Decide a real enquiry from a real business's confirmed rules.
 *
 * The live counterpart to `reeval.ts`, which branches on fixture ids (f03, f09,
 * f15, f17) and can only "unlock" a price that was hand-written into a fixture
 * ahead of time. That is fine for a demo and useless to a business: a genuinely
 * new enquiry had no path to a computed price at all.
 *
 * Everything here is derived, deterministic and explainable. Nothing is
 * fabricated: when the answer is unknown, the outcome says so and names the one
 * fact that would change it.
 */

export type Decision = {
  /** The computed price, or why there isn't one. */
  price: PriceOutcome;
  /** What the operator should do next, in the product's action vocabulary. */
  action: "SEND_QUOTE" | "REQUEST_INFORMATION" | "ESCALATE_HUMAN";
  /** One sentence the operator can read and check. */
  explanation: string;
  /** The single decision-critical missing fact, when there is one. */
  blocker?: { field: string; reason: string };
};

/** Pull the confirmed, machine-usable rules out of a business's Brain. */
export function activeRules(business: Pick<Business, "knowledge">): BusinessRule[] {
  const out: BusinessRule[] = [];
  for (const item of business.knowledge ?? []) {
    // Only Active knowledge may price anything. A Proposed rule is a suggestion
    // waiting on a human, and using it would make confirmation meaningless.
    if (item.state !== "Active") continue;
    const payload = (item as KnowledgeItem & { rulePayload?: unknown }).rulePayload;
    if (payload === undefined || payload === null) continue;
    const parsed = parseBusinessRule(payload);
    if (parsed.ok) out.push(parsed.rule);
  }
  return out;
}

/** The compiler only trusts confirmed facts, so hand it exactly what it needs. */
export function toCompilerFacts(facts: EnquiryFact[]): CompilerFact[] {
  return (facts ?? []).map((f) => ({
    field: f.field,
    value: f.value,
    status: f.status,
  }));
}

/**
 * Decide one enquiry.
 *
 * Three outcomes, and the difference between them is the whole product:
 *
 *  - priced      -> send the quote;
 *  - blocked     -> ask for ONE fact, the one that decides it;
 *  - unpriceable -> a human judges it, and Enquiry says why rather than
 *                   inventing a number.
 */
export function decideEnquiry(
  business: Pick<Business, "knowledge">,
  enquiry: Pick<Enquiry, "serviceLabel" | "facts">,
): Decision {
  const rules = activeRules(business);
  const price = compilePrice(
    rules,
    enquiry.serviceLabel ?? "",
    toCompilerFacts(enquiry.facts ?? []),
  );

  if (price.kind === "EXACT") {
    return {
      price,
      action: "SEND_QUOTE",
      explanation: price.workings,
    };
  }

  if (price.kind === "BLOCKED") {
    return {
      price,
      action: "REQUEST_INFORMATION",
      explanation: price.reason,
      blocker: { field: price.missingField, reason: price.reason },
    };
  }

  return {
    price,
    action: "ESCALATE_HUMAN",
    explanation:
      rules.length === 0
        ? "No pricing rules are set up yet, so Enquiry cannot price this."
        : `Nothing in this business's pricing covers "${price.service}".`,
  };
}
