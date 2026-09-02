import { pluraliseUnit, type BusinessRule } from "./business-rule.ts";

// Re-exported so callers reasoning about a priced line get it from one place.
export { pluraliseUnit };

/**
 * Compute a price from confirmed business rules and known enquiry facts.
 *
 * This is the product's actual promise, and until now it did not exist for real
 * enquiries: `reeval.ts` branched on fixture ids and everything else fell
 * through to a path that could only "unlock" a price already hand-written into
 * the fixture. A business's genuinely new enquiry could never be priced.
 *
 * The rules this enforces, in order of importance:
 *
 *  - **Never guess.** If the rule needs a quantity and no confirmed fact
 *    supplies it, the answer is NOT a price with an assumed quantity. It is
 *    "blocked, and here is the single fact that would unblock it".
 *  - **The minimum blocker is one fact.** Not every empty field - only the fact
 *    that actually changes the outcome. Asking for five things when one decides
 *    the price is how a business loses a customer to whoever replied first.
 *  - **Deterministic.** Given the same rules and facts, the same answer, every
 *    time. A model may propose facts; it never computes the number.
 */

/** A fact the compiler is allowed to rely on. */
export type CompilerFact = {
  field: string;
  value: string;
  /** Only confirmed facts may drive a price. Inferred ones can suggest. */
  status: "confirmed" | "inferred" | "check_this" | "unknown" | "conflict" | "range";
};

export type PriceOutcome =
  | {
      kind: "EXACT";
      amountMinor: number;
      currency: "AUD";
      rule: BusinessRule;
      /** How the number was reached, in the operator's language. */
      workings: string;
    }
  | {
      kind: "BLOCKED";
      /** The ONE fact that would unblock this. */
      missingField: string;
      /** Why this specific fact decides it. */
      reason: string;
      rule: BusinessRule;
    }
  | {
      kind: "NO_RULE";
      /** What the customer asked for that nothing prices. */
      service: string;
    };

const norm = (s: string): string => s.trim().toLowerCase();

/** Read a usable numeric quantity from a fact, or null. */
function quantityFrom(facts: CompilerFact[], field: string): number | null {
  const fact = facts.find((f) => norm(f.field) === norm(field));
  if (!fact) return null;
  // Only a confirmed fact may drive a price. An inferred "probably 4 people"
  // becoming a real invoiced number is precisely the fabricated confidence the
  // product refuses to produce.
  if (fact.status !== "confirmed") return null;
  const n = Number.parseFloat(String(fact.value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Choose the rule that prices this request.
 *
 * Exact service match first, then a contains-match, so "makeup" finds "Group
 * makeup" without a business having to enumerate every phrasing a customer
 * might use. Ambiguity resolves to the first Active rule rather than guessing
 * between two - and the operator can always correct it.
 */
export function selectRule(rules: BusinessRule[], serviceLabel: string): BusinessRule | undefined {
  const want = norm(serviceLabel);
  if (!want) return undefined;
  return (
    rules.find((r) => norm(r.service) === want) ??
    rules.find((r) => want.includes(norm(r.service)) || norm(r.service).includes(want))
  );
}

/**
 * Price one enquiry against one business's confirmed rules.
 *
 * Returns money in MINOR units so nothing downstream has to re-derive cents
 * from a float.
 */
export function compilePrice(
  rules: BusinessRule[],
  serviceLabel: string,
  facts: CompilerFact[],
): PriceOutcome {
  const rule = selectRule(rules, serviceLabel);
  if (!rule) return { kind: "NO_RULE", service: serviceLabel };

  if (rule.kind === "fixed_price") {
    return {
      kind: "EXACT",
      amountMinor: Math.round(rule.amount * 100),
      currency: "AUD",
      rule,
      workings: `${rule.service} is a fixed $${rule.amount}.`,
    };
  }

  const quantity = quantityFrom(facts, rule.quantityField);
  if (quantity === null) {
    return {
      kind: "BLOCKED",
      missingField: rule.quantityField,
      reason: `${rule.service} is priced per ${rule.unit}, so the ${rule.quantityField} decides the price.`,
      rule,
    };
  }

  // The minimum is a floor on what is billed, not a rejection of the enquiry.
  const billable = rule.minimumQuantity ? Math.max(quantity, rule.minimumQuantity) : quantity;
  const amountMinor = Math.round(rule.amount * billable * 100);
  const appliedMinimum = rule.minimumQuantity && billable > quantity;

  return {
    kind: "EXACT",
    amountMinor,
    currency: "AUD",
    rule,
    workings: appliedMinimum
      ? `${quantity} ${pluraliseUnit(rule.unit, quantity)}, billed at the ${rule.minimumQuantity} ${rule.unit} minimum, at $${rule.amount} each.`
      : `${billable} ${pluraliseUnit(rule.unit, billable)} at $${rule.amount} each.`,
  };
}
