import type { Enquiry, EnquiryFact, KnowledgeItem } from "./types";
import { parseBusinessRule, type BusinessRule } from "./business-rule.ts";
import { compilePrice, matchRule, type CompilerFact, type PriceOutcome } from "./price-compiler.ts";
import { parseQuantity } from "./quantity.ts";

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
  /**
   * An amount Enquiry has calculated but is NOT authorised to quote, because
   * the premise it rests on - the service - was proposed by a model and never
   * confirmed by the owner. Deliberately separate from the decision's price so
   * that nothing downstream which reads a decided price can mistake it for one:
   * `recordSentReplyInTransaction` writes a quote row from the snapshot's
   * `price`, and a provisional figure must never reach it.
   */
  provisional?: { amountMinor: number; currency: "AUD"; service: string; workings: string };
  /**
   * The services or prices the owner must choose between when the request is
   * ambiguous. Surfaced so the desk can ask the smallest question rather than
   * showing a figure that array order happened to pick.
   */
  serviceChoices?: string[];
};

/**
 * The smallest thing that can carry a rule.
 *
 * Deliberately looser than `KnowledgeItem` so a server handler can pass rows
 * straight out of the database without inventing the display fields the desk
 * needs and this decision does not.
 */
export type RuleBearingKnowledge = { state?: string | null; rulePayload?: unknown };

/** Pull the confirmed, machine-usable rules out of a business's Brain. */
export function activeRules(business: {
  knowledge?: ReadonlyArray<RuleBearingKnowledge | KnowledgeItem> | null;
}): BusinessRule[] {
  const out: BusinessRule[] = [];
  for (const item of business.knowledge ?? []) {
    // Only Active knowledge may price anything. A Proposed rule is a suggestion
    // waiting on a human, and using it would make confirmation meaningless.
    if (item.state !== "Active") continue;
    const payload = (item as RuleBearingKnowledge).rulePayload;
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
  business: { knowledge?: ReadonlyArray<RuleBearingKnowledge | KnowledgeItem> | null },
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

  // A confirmed answer that does not mean one quantity. The enquiry is not
  // blocked on a MISSING fact - it is blocked on the answer already given, so
  // the question goes back to that same field with the owner's own words in it.
  if (price.kind === "UNRESOLVED_QUANTITY") {
    return {
      price,
      action: "REQUEST_INFORMATION",
      explanation: price.reason,
      blocker: { field: price.field, reason: price.reason },
    };
  }

  // Calculated, but resting on a service nobody confirmed. The figure is
  // carried as `provisional` so the desk can show it honestly; the action is
  // not a send, because the commercial premise has not been decided.
  if (price.kind === "PROVISIONAL") {
    return {
      price,
      action: "ESCALATE_HUMAN",
      explanation: `Enquiry read this as ${price.service} and has not been told that is right. Confirm the service and the price follows.`,
      provisional: {
        amountMinor: price.amountMinor,
        currency: price.currency,
        service: price.service,
        workings: price.workings,
      },
    };
  }

  // Several services, or several simultaneously Active prices for one service.
  // The owner chooses. Rule order is not a commercial policy.
  if (price.kind === "AMBIGUOUS_SERVICE") {
    return {
      price,
      action: "ESCALATE_HUMAN",
      explanation: price.message,
      serviceChoices: [...new Set(price.choices.map((c) => c.service))],
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

/**
 * Validate an owner's answer BEFORE it is stored as a confirmed fact.
 *
 * The compiler already refuses to turn "5-6" into a quantity, but a fact stored
 * as `confirmed` is the strongest statement this product makes about a
 * customer's request - it is the thing that earns the right to drive money -
 * and storing one whose value cannot mean what it claims to mean is a defect on
 * its own, whatever the compiler does with it afterwards. So the server checks
 * the answer against the rule that would consume it, and refuses rather than
 * recording a confirmation of something unusable.
 *
 * Only fields a rule actually reads as a quantity are checked. An answer to
 * "which room?" or "what date?" is free text and stays free text - this is not
 * a general input validator, and inventing one would block ordinary answers.
 *
 * Returns null when the answer is acceptable, or the sentence to show the owner.
 */
export function validateFactAnswer(
  business: { knowledge?: ReadonlyArray<RuleBearingKnowledge | KnowledgeItem> | null },
  serviceLabel: string,
  field: string,
  value: string,
): string | null {
  const rules = activeRules(business);
  const norm = (s: string) => s.trim().toLowerCase();
  // Every rule that reads this field as its quantity, not just the one that
  // currently prices this enquiry: the service can change after the answer is
  // stored, and a value that is unusable for any of them is unusable.
  const quantityRules = rules.filter(
    (r) => r.kind === "per_unit" && norm(r.quantityField) === norm(field),
  );
  if (quantityRules.length === 0) return null;

  const selected = matchRule(rules, serviceLabel);
  const rule =
    selected.kind === "one" && selected.rule.kind === "per_unit" &&
    norm(selected.rule.quantityField) === norm(field)
      ? selected.rule
      : quantityRules[0]!;
  if (rule.kind !== "per_unit") return null;

  const parsed = parseQuantity(value, rule.unit, field);
  return parsed.ok ? null : parsed.message;
}
