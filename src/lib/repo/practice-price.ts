import { parseBusinessRule, type BusinessRule } from "../../domain/business-rule.ts";
import { tradeExamples } from "../../domain/trade-examples.ts";

/** The fact holding a practice-only sample price. Never a business rule. */
export const PRACTICE_PRICE_FIELD = "practice_price";

/**
 * A sample price in the owner's trade ("End of lease clean $190 per bedroom"),
 * for the practice enquiry only: it lets a new owner reach a prepared reply in
 * a few taps before they have written their own prices.
 */
export function samplePriceFor(industry = ""): BusinessRule {
  const p = tradeExamples(industry).price;
  const parsed = parseBusinessRule({
    kind: p.unit ? "per_unit" : "fixed_price",
    service: p.service,
    amount: Number(p.amount),
    currency: "AUD",
    ...(p.unit ? { unit: p.unit, quantityField: p.field } : {}),
  });
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.rule;
}

/** The sample price this practice enquiry uses, when the owner chose one. */
export function practicePriceFrom(
  facts: ReadonlyArray<{ field: string; value: string; status: string }>,
): BusinessRule | null {
  const fact = facts.find(
    (f) => f.field.trim().toLowerCase() === PRACTICE_PRICE_FIELD && f.status === "confirmed",
  );
  if (!fact) return null;
  try {
    const parsed = parseBusinessRule(JSON.parse(String(fact.value)));
    return parsed.ok ? parsed.rule : null;
  } catch {
    // A malformed payload prices nothing: the practice enquiry stays unpriced.
    return null;
  }
}
