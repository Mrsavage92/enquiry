/**
 * The typed, machine-usable half of a Business Brain rule.
 *
 * A rule that only exists as prose can be shown to an operator but cannot be
 * transacted against: "$145 per person, minimum 3" is a sentence. Before this
 * existed, `reeval.ts` branched on fixture ids (f03, f09, f15, f17) and a
 * genuinely new enquiry had no path to a computed price at all - the product's
 * headline promise worked only for the twenty pre-written demos.
 *
 * Deliberately small. This is not a workflow builder and not a rules engine.
 * Two kinds cover the overwhelming majority of what a service business quotes
 * on, and a third kind should only be added when a real business's real enquiry
 * cannot be priced without it.
 *
 * The readable half still governs authority: a payload is inert until its
 * knowledge item is Active, exactly like the prose.
 */

/** A fixed price for a service, regardless of quantity. */
export type FixedPriceRule = {
  kind: "fixed_price";
  /** What the customer asked for, in the business's own words. */
  service: string;
  /** Major units, e.g. 450 means $450. */
  amount: number;
  currency: "AUD";
};

/** A price per unit, with an optional minimum billable quantity. */
export type PerUnitRule = {
  kind: "per_unit";
  service: string;
  /** Major units per unit, e.g. 145 means $145 each. */
  amount: number;
  currency: "AUD";
  /** What is being counted: "person", "hour", "room", "square metre". */
  unit: string;
  /** The fact whose value supplies the quantity, e.g. "guests". */
  quantityField: string;
  /** Below this the business still charges for this many. */
  minimumQuantity?: number;
};

export type BusinessRule = FixedPriceRule | PerUnitRule;

export const RULE_KINDS = ["fixed_price", "per_unit"] as const;

/**
 * Validate an untrusted payload into a rule, or explain why it is not one.
 *
 * Untrusted because a payload may have been proposed by a model. A model may
 * suggest a rule; it may never be the authority for a price, so everything it
 * proposes passes through here and then through human confirmation.
 */
export function parseBusinessRule(
  raw: unknown,
): { ok: true; rule: BusinessRule } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Not a rule object." };
  const r = raw as Record<string, unknown>;
  const kind = r.kind;

  const service = typeof r.service === "string" ? r.service.trim() : "";
  if (!service) return { ok: false, reason: "A rule must name the service it prices." };

  const amount = typeof r.amount === "number" ? r.amount : Number.NaN;
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, reason: "A rule needs a real, non-negative amount." };
  }

  // AUD-only while Money.currency is the literal "AUD". Accepting anything else
  // would store a code every evaluator and formatter ignores.
  const currency = typeof r.currency === "string" ? r.currency.toUpperCase() : "AUD";
  if (currency !== "AUD") {
    return { ok: false, reason: "Only AUD is supported in this beta." };
  }

  if (kind === "fixed_price") {
    return { ok: true, rule: { kind, service, amount, currency: "AUD" } };
  }

  if (kind === "per_unit") {
    const unit = typeof r.unit === "string" ? r.unit.trim() : "";
    if (!unit) return { ok: false, reason: "A per-unit rule must say what it counts." };
    const quantityField = typeof r.quantityField === "string" ? r.quantityField.trim() : "";
    if (!quantityField) {
      return { ok: false, reason: "A per-unit rule must name the fact holding the quantity." };
    }
    const min = r.minimumQuantity;
    let minimumQuantity: number | undefined;
    if (min !== undefined && min !== null) {
      if (typeof min !== "number" || !Number.isFinite(min) || min < 1) {
        return { ok: false, reason: "A minimum quantity must be at least 1." };
      }
      minimumQuantity = Math.floor(min);
    }
    return {
      ok: true,
      rule: { kind, service, amount, currency: "AUD", unit, quantityField, minimumQuantity },
    };
  }

  return { ok: false, reason: `Unknown rule kind: ${String(kind)}` };
}

/** A short human sentence for a rule, so the operator sees what they confirmed. */
export function describeRule(rule: BusinessRule): string {
  if (rule.kind === "fixed_price") {
    return `${rule.service}: $${rule.amount}`;
  }
  const min = rule.minimumQuantity
    ? `, minimum ${rule.minimumQuantity} ${rule.unit}${rule.minimumQuantity === 1 ? "" : "s"}`
    : "";
  return `${rule.service}: $${rule.amount} per ${rule.unit}${min}`;
}
