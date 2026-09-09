import { pluraliseUnit, ruleFingerprint, type BusinessRule } from "./business-rule.ts";
import { amountMinorFor, parseQuantity, type QuantityProblem } from "./quantity.ts";

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
 *  - **Never change what was confirmed.** A confirmed answer keeps its meaning.
 *    "5-6" is a range, not the number 56, and it leaves the price unresolved
 *    rather than producing a different exact one. See `quantity.ts`.
 *  - **Never resolve ambiguity by accident.** Two services a request could
 *    plausibly mean, or two simultaneously Active prices for one service, are
 *    reported as a choice for the owner. Reordering the same rules cannot
 *    change the commercial answer.
 *  - **Never treat an unconfirmed premise as decided.** A service the model
 *    proposed and nobody confirmed yields a PROVISIONAL amount, never an EXACT
 *    one - the arithmetic is shown, the commercial decision is not made.
 *  - **The minimum blocker is one fact.** Not every empty field - only the fact
 *    that actually changes the outcome.
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

/** Why a request could not be resolved to one authoritative rule. */
export type AmbiguityReason = "multiple_services" | "conflicting_rules";

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
      /**
       * The arithmetic completed, but the premise it rests on is not confirmed:
       * a model read the service off the customer's message and no human has
       * agreed with it yet. Shown as a provisional figure, never as a decided
       * commercial outcome, and never authorised for sending until the owner
       * confirms the service.
       */
      kind: "PROVISIONAL";
      amountMinor: number;
      currency: "AUD";
      rule: BusinessRule;
      workings: string;
      premise: "service_unconfirmed";
      /** The unconfirmed service value, as the model proposed it. */
      service: string;
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
      /**
       * A confirmed answer exists for the deciding fact, but it does not mean a
       * single billable quantity - a range, alternatives, a negative, two
       * counts. The original text is carried through verbatim so the owner is
       * asked about what they actually confirmed.
       */
      kind: "UNRESOLVED_QUANTITY";
      field: string;
      value: string;
      problem: QuantityProblem;
      reason: string;
      rule: BusinessRule;
    }
  | {
      /**
       * The request plausibly names more than one service, or one service has
       * more than one simultaneously Active price. Either way the owner
       * chooses; array order never does.
       */
      kind: "AMBIGUOUS_SERVICE";
      service: string;
      reason: AmbiguityReason;
      choices: BusinessRule[];
      message: string;
    }
  | {
      kind: "NO_RULE";
      /** What the customer asked for that nothing prices. */
      service: string;
    };

const norm = (s: string): string => s.trim().toLowerCase();

/**
 * A total order over rules that does not depend on the array they arrived in.
 *
 * This is what makes reordering the same logical rule set produce the same
 * commercial answer. Without it, `selectRule` returned whichever match the
 * caller happened to list first, so the same business with the same prices
 * quoted AUD 190 or AUD 170 for the same request depending on row order.
 */
function compareRules(a: BusinessRule, b: BusinessRule): number {
  return ruleFingerprint(a).localeCompare(ruleFingerprint(b));
}

export type RuleMatch =
  | { kind: "one"; rule: BusinessRule }
  | { kind: "none" }
  | { kind: "ambiguous"; reason: AmbiguityReason; choices: BusinessRule[] };

/**
 * Resolve a request to exactly one authoritative rule, or say why it cannot be.
 *
 * Exact service match first, then a contains-match, so "makeup" finds "Group
 * makeup" without a business having to enumerate every phrasing a customer
 * might use. What changed: a contains-match that hits two different services is
 * no longer silently resolved to the first one, and two different Active prices
 * for the same service are a conflict rather than a race. Identical duplicates
 * are one rule, not a conflict - saving the same price twice is not a
 * disagreement about the price.
 */
export function matchRule(rules: BusinessRule[], serviceLabel: string): RuleMatch {
  const want = norm(serviceLabel);
  if (!want) return { kind: "none" };

  const exact = rules.filter((r) => norm(r.service) === want);
  const candidates = exact.length
    ? exact
    : rules.filter((r) => want.includes(norm(r.service)) || norm(r.service).includes(want));

  if (candidates.length === 0) return { kind: "none" };

  // Collapse byte-identical rules: the same price stated twice is one price.
  const distinct: BusinessRule[] = [];
  const seen = new Set<string>();
  for (const rule of [...candidates].sort(compareRules)) {
    const key = ruleFingerprint(rule);
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(rule);
  }

  if (distinct.length === 1) return { kind: "one", rule: distinct[0]! };

  // More than one distinct rule survives. Two different prices for the SAME
  // service is a conflict in the Brain; rules for different services is an
  // ambiguous request. The owner resolves both, but the question differs.
  const services = new Set(distinct.map((r) => norm(r.service)));
  return {
    kind: "ambiguous",
    reason: services.size === 1 ? "conflicting_rules" : "multiple_services",
    choices: distinct,
  };
}

/**
 * The single authoritative rule for a request, when there is exactly one.
 *
 * Kept for callers that only need "is there one rule for this?" - it returns
 * `undefined` for both "nothing matches" and "several match", so it must never
 * be used to decide a price. `matchRule` is the one that tells those apart, and
 * `compilePrice` uses it.
 */
export function selectRule(rules: BusinessRule[], serviceLabel: string): BusinessRule | undefined {
  const match = matchRule(rules, serviceLabel);
  return match.kind === "one" ? match.rule : undefined;
}

/** Whether an explicit service fact says the premise is not yet confirmed. */
function serviceIsUnconfirmed(facts: CompilerFact[]): CompilerFact | undefined {
  const fact = facts.find((f) => norm(f.field) === "service");
  if (!fact) return undefined;
  return fact.status === "confirmed" ? undefined : fact;
}

/**
 * Read a usable numeric quantity from a fact.
 *
 * Three distinct answers, and the difference between them is the whole of
 * P1-01: no confirmed fact at all (ask for it), a confirmed fact that does not
 * mean one quantity (ask about the answer they gave), and a real quantity.
 */
type QuantityRead =
  | { kind: "missing" }
  | { kind: "unresolved"; value: string; problem: QuantityProblem; message: string }
  | { kind: "ok"; quantity: number };

function quantityFrom(facts: CompilerFact[], field: string, unit: string): QuantityRead {
  const fact = facts.find((f) => norm(f.field) === norm(field));
  if (!fact) return { kind: "missing" };
  // Only a confirmed fact may drive a price. An inferred "probably 4 people"
  // becoming a real invoiced number is precisely the fabricated confidence the
  // product refuses to produce.
  if (fact.status !== "confirmed") return { kind: "missing" };

  const parsed = parseQuantity(fact.value, unit, field);
  if (!parsed.ok) {
    return {
      kind: "unresolved",
      value: String(fact.value ?? ""),
      problem: parsed.problem,
      message: parsed.message,
    };
  }
  return { kind: "ok", quantity: parsed.quantity };
}

function ambiguityMessage(
  reason: AmbiguityReason,
  service: string,
  choices: BusinessRule[],
): string {
  const names = [...new Set(choices.map((c) => c.service))];
  if (reason === "conflicting_rules") {
    return `${names[0] ?? service} has more than one price marked Active right now, so Enquiry will not choose between them. Settle which price applies in the Brain.`;
  }
  return `"${service}" could be ${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}. Confirm which one they are asking for.`;
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
  const match = matchRule(rules, serviceLabel);
  if (match.kind === "none") return { kind: "NO_RULE", service: serviceLabel };
  if (match.kind === "ambiguous") {
    return {
      kind: "AMBIGUOUS_SERVICE",
      service: serviceLabel,
      reason: match.reason,
      choices: match.choices,
      message: ambiguityMessage(match.reason, serviceLabel, match.choices),
    };
  }

  const rule = match.rule;
  const unconfirmedService = serviceIsUnconfirmed(facts);

  /**
   * A completed calculation, presented as decided only when the premise it
   * rests on has actually been confirmed by a human.
   */
  const priced = (amountMinor: number, workings: string): PriceOutcome => {
    if (unconfirmedService) {
      return {
        kind: "PROVISIONAL",
        amountMinor,
        currency: "AUD",
        rule,
        workings,
        premise: "service_unconfirmed",
        service: unconfirmedService.value,
      };
    }
    return { kind: "EXACT", amountMinor, currency: "AUD", rule, workings };
  };

  if (rule.kind === "fixed_price") {
    const amountMinor = amountMinorFor(rule.amount, 1);
    if (amountMinor === null) {
      return {
        kind: "UNRESOLVED_QUANTITY",
        field: "amount",
        value: String(rule.amount),
        problem: "too_large",
        reason: `${rule.service} is priced at an amount Enquiry cannot represent exactly. Quote this one by hand.`,
        rule,
      };
    }
    return priced(amountMinor, `${rule.service} is a fixed $${rule.amount}.`);
  }

  const read = quantityFrom(facts, rule.quantityField, rule.unit);
  if (read.kind === "missing") {
    return {
      kind: "BLOCKED",
      missingField: rule.quantityField,
      reason: `${rule.service} is priced per ${rule.unit}, so the ${rule.quantityField} decides the price.`,
      rule,
    };
  }
  if (read.kind === "unresolved") {
    return {
      kind: "UNRESOLVED_QUANTITY",
      field: rule.quantityField,
      value: read.value,
      problem: read.problem,
      reason: read.message,
      rule,
    };
  }

  const quantity = read.quantity;
  // The minimum is a floor on what is billed, not a rejection of the enquiry.
  const billable = rule.minimumQuantity ? Math.max(quantity, rule.minimumQuantity) : quantity;
  const amountMinor = amountMinorFor(rule.amount, billable);
  if (amountMinor === null) {
    return {
      kind: "UNRESOLVED_QUANTITY",
      field: rule.quantityField,
      value: String(quantity),
      problem: "too_large",
      reason: `${billable} ${pluraliseUnit(rule.unit, billable)} at $${rule.amount} each is larger than Enquiry will price automatically. Quote this one by hand.`,
      rule,
    };
  }
  const appliedMinimum = rule.minimumQuantity && billable > quantity;

  return priced(
    amountMinor,
    appliedMinimum
      ? `${quantity} ${pluraliseUnit(rule.unit, quantity)}, billed at the ${rule.minimumQuantity} ${rule.unit} minimum, at $${rule.amount} each.`
      : `${billable} ${pluraliseUnit(rule.unit, billable)} at $${rule.amount} each.`,
  );
}

/**
 * Every amount a priced decision legitimately implies, in minor units.
 *
 * The reviewed message and the recorded quote must agree, but "agree" is not
 * "name exactly one number". `composeReply` writes the product's own draft as
 * "That comes to $580. 4 people at $145 each." - a total and the unit rate that
 * multiplies out to it. Comparing every figure in that sentence against the
 * total alone made the product's own unedited words unsendable on every
 * per-unit quote, which is the rule kind this whole slice was specified around.
 *
 * So the allowed set is derived from the STRUCTURED rule - the total, the unit
 * rate, and the minimum-billed total where one applies - never from parsing the
 * prose. A figure outside this set was not implied by the decision, and is the
 * disagreement the check exists to catch.
 */
export function impliedAmountsMinor(outcome: PriceOutcome): number[] {
  if (outcome.kind !== "EXACT" && outcome.kind !== "PROVISIONAL") return [];
  const rule = outcome.rule;
  const out = new Set<number>([outcome.amountMinor]);
  const rate = amountMinorFor(rule.amount, 1);
  if (rate !== null) out.add(rate);
  if (rule.kind === "per_unit" && rule.minimumQuantity) {
    const floor = amountMinorFor(rule.amount, rule.minimumQuantity);
    if (floor !== null) out.add(floor);
  }
  return [...out].sort((a, b) => a - b);
}
