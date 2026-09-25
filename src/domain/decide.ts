import type { Enquiry, EnquiryFact, KnowledgeItem } from "./types";
import { parseBusinessRule, type BusinessRule } from "./business-rule.ts";
import {
  compilePrice,
  impliedAmountsMinor,
  matchRule,
  type CompilerFact,
  type PriceOutcome,
} from "./price-compiler.ts";
import { parseQuantity } from "./quantity.ts";
import {
  EXTRA_CHOICE,
  extraLabel,
  extraQuantityField,
  isExtraField,
  splitExtraQuantityField,
} from "./extras.ts";
import { formatMinorAud } from "./money-format.ts";
import { digitsForWrittenNumber } from "./number-words.ts";

/** One priced line of a quote with more than one thing on it. */
export type QuoteLine = { label: string; amountMinor: number; detail?: string };

/**
 * A second thing the customer asked for that the owner has not settled yet:
 * `check` when a saved price covers it (add it, or leave it out), `no_price`
 * when nothing does (add a price, or leave it out and tell them).
 */
export type ExtraPending = {
  /** The fact the owner's choice is recorded against. */
  field: string;
  label: string;
  kind: "check" | "no_price";
  amountMinor?: number;
  span?: string;
};

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
  blocker?: {
    field: string;
    reason: string;
    /**
     * What the customer already wrote for this fact, read but not confirmed.
     * The next step is then the owner checking it, never asking the customer
     * again for something they already said.
     */
    inferred?: { value: string; display: string };
  };
  /**
   * An amount Enquiry has calculated but is NOT authorised to quote, because
   * the premise it rests on - the service - was proposed by a model and never
   * confirmed by the owner. Deliberately separate from the decision's price so
   * that nothing downstream which reads a decided price can mistake it for one:
   * `confirmReviewedSendInTransaction` writes a quote row from the reviewed
   * artefact's frozen `price`, and a provisional figure must never reach it.
   */
  provisional?: { amountMinor: number; currency: "AUD"; service: string; workings: string };
  /**
   * The services or prices the owner must choose between when the request is
   * ambiguous. Surfaced so the desk can ask the smallest question rather than
   * showing a figure that array order happened to pick.
   */
  serviceChoices?: string[];
  /**
   * The owner has to tell Enquiry something before this enquiry can move:
   * `add_prices` when the business has no prices at all, `add_price` when none
   * of them covers this service. The next step is then the business screen,
   * never a disabled button on the enquiry.
   */
  setup?: "add_prices" | "add_price" | "choose_service";
  /** Every line of a quote with more than one thing on it, the main job first. */
  lines?: QuoteLine[];
  /** Extras the owner chose to leave out; the reply says so. */
  leftOut?: string[];
  /** The extra the owner decides next, when one is unsettled. */
  extraPending?: ExtraPending;
  /** The services this business prices, so a reading can tell them apart. */
  knownServices?: string[];
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

/** A read-but-unconfirmed value for the deciding field, if the message gave one. */
function inferredFor(
  facts: ReadonlyArray<Pick<EnquiryFact, "field" | "value" | "status"> & { displayValue?: string }>,
  field: string,
): { value: string; display: string } | undefined {
  const want = field.trim().toLowerCase();
  const fact = facts.find(
    (f) =>
      f.field.trim().toLowerCase() === want &&
      (f.status === "inferred" || f.status === "check_this") &&
      String(f.value ?? "").trim(),
  );
  if (!fact) return undefined;
  // Only a reading that is one usable number is something to check. A range
  // ("30-35") or a guess is still a question for the customer.
  if (!parseQuantity(String(fact.value)).ok) return undefined;
  return {
    value: String(fact.value).trim(),
    display: fact.displayValue?.trim() || String(fact.value),
  };
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
  const facts = (enquiry.facts ?? []) as DecideFact[];
  const primary = decidePrimary(rules, enquiry.serviceLabel ?? "", facts);
  const knownServices = [...new Set(rules.map((r) => r.service))];
  const decided = primary.price.kind === "EXACT" ? decideExtras(rules, primary, facts) : primary;
  return { ...decided, knownServices };
}

type DecideFact = Pick<EnquiryFact, "field" | "value" | "status"> & { displayValue?: string };

function decidePrimary(
  rules: BusinessRule[],
  serviceLabel: string,
  allFacts: ReadonlyArray<DecideFact>,
): Decision {
  // Extras and their counts are decided line by line below, never as the
  // main job's facts.
  const facts = allFacts.filter(
    (f) => !isExtraField(f.field) && !isExtraQuantityFor(rules, f.field),
  ) as EnquiryFact[];
  const price = compilePrice(rules, serviceLabel, toCompilerFacts(facts));
  const enquiry = { facts };

  if (price.kind === "EXACT") {
    return {
      price,
      action: "SEND_QUOTE",
      explanation: price.workings,
    };
  }

  if (price.kind === "BLOCKED") {
    const inferred = inferredFor(enquiry.facts ?? [], price.missingField);
    return {
      price,
      action: "REQUEST_INFORMATION",
      explanation: price.reason,
      blocker: {
        field: price.missingField,
        reason: price.reason,
        ...(inferred ? { inferred } : {}),
      },
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
        ? "You have not added any prices yet, so Enquiry cannot work out a price for this. Add what you charge and this enquiry updates."
        : !price.service.trim()
          ? "Enquiry does not know which of your services this is yet. Say which one and the price follows."
          : `None of your prices covers "${price.service}" yet. Add a price for it and this enquiry updates.`,
    setup:
      rules.length === 0 ? "add_prices" : !price.service.trim() ? "choose_service" : "add_price",
  };
}

/** Whether a field is the count of one of the business's services as an extra. */
function isExtraQuantityFor(rules: BusinessRule[], field: string): boolean {
  const split = splitExtraQuantityField(field);
  if (!split) return false;
  return rules.some((r) => extraCountMatches(r, split));
}

function extraCountMatches(rule: BusinessRule, split: { field: string; service: string }): boolean {
  const n = (s: string) => s.trim().toLowerCase();
  return (
    rule.kind === "per_unit" &&
    n(rule.quantityField) === n(split.field) &&
    n(rule.service) === n(split.service)
  );
}

type ExtraFact = {
  field: string;
  label: string;
  choice: string;
  confirmed: boolean;
  span: string;
};

function extraFactsOf(facts: ReadonlyArray<DecideFact>): ExtraFact[] {
  return facts
    .filter((f) => isExtraField(f.field) && extraLabel(f.field))
    .map((f) => ({
      field: f.field,
      label: extraLabel(f.field),
      choice: String(f.value ?? "")
        .trim()
        .toLowerCase(),
      confirmed: f.status === "confirmed",
      span: f.displayValue?.trim() ?? "",
    }));
}

/** "4 bedrooms at $190 each" beside a line's amount; nothing for a fixed price. */
function lineDetail(rule: BusinessRule, workings: string): string | undefined {
  return rule.kind === "per_unit" ? workings.replace(/\.$/, "") : undefined;
}

/** The count facts for one extra, renamed to the field its rule reads. */
function extraCountFacts(rule: BusinessRule, facts: ReadonlyArray<DecideFact>): CompilerFact[] {
  if (rule.kind !== "per_unit") return [];
  return facts
    .filter((f) => {
      const split = splitExtraQuantityField(f.field);
      return split !== null && extraCountMatches(rule, split);
    })
    .map((f) => ({ field: rule.quantityField, value: String(f.value), status: f.status }));
}

/**
 * Add what else the customer asked for to a priced main job, or stop on the
 * first extra the owner has to settle. A total is only ever EXACT when every
 * requested thing is either on it or deliberately left out.
 */
function decideExtras(
  rules: BusinessRule[],
  primary: Decision,
  facts: ReadonlyArray<DecideFact>,
): Decision {
  if (primary.price.kind !== "EXACT") return primary;
  const extras = extraFactsOf(facts);
  if (extras.length === 0) return primary;
  const mainRule = primary.price.rule;
  const lines: QuoteLine[] = [
    {
      label: mainRule.service,
      amountMinor: primary.price.amountMinor,
      detail: lineDetail(mainRule, primary.price.workings),
    },
  ];
  const implied: number[] = [];
  const leftOut: string[] = [];
  for (const extra of extras) {
    if (extra.confirmed && extra.choice === EXTRA_CHOICE.leaveOut) {
      leftOut.push(extra.label);
      continue;
    }
    const match = matchRule(rules, extra.label);
    const rule = match.kind === "one" ? match.rule : undefined;
    // The main job asked for twice is not a second line.
    if (rule && rule.service.trim().toLowerCase() === mainRule.service.trim().toLowerCase()) {
      continue;
    }
    if (!rule) {
      return {
        ...primary,
        action: "ESCALATE_HUMAN",
        explanation: `They also asked for ${extra.label.toLowerCase()}, and none of your prices covers it. Add a price, or leave it out and tell them.`,
        setup: "add_price",
        extraPending: { field: extra.field, label: extra.label, kind: "no_price", span: extra.span },
      };
    }
    const line = compilePrice([rule], rule.service, [
      { field: "service", value: rule.service, status: "confirmed" },
      ...extraCountFacts(rule, facts),
    ]);
    if (!extra.confirmed) {
      // Read from their message: the owner adds it or leaves it out. Never
      // quietly on the total, never quietly off it.
      return {
        ...primary,
        action: "ESCALATE_HUMAN",
        explanation: `They also asked for ${rule.service.toLowerCase()}. Add it to the quote, or leave it out and tell them.`,
        extraPending: {
          field: extra.field,
          label: rule.service,
          kind: "check",
          ...(rule.kind === "fixed_price" && line.kind === "EXACT"
            ? { amountMinor: line.amountMinor }
            : {}),
          span: extra.span,
        },
      };
    }
    if (line.kind === "BLOCKED" && rule.kind === "per_unit") {
      const field = extraQuantityField(rule.quantityField, rule.service);
      const inferred = inferredFor(facts, field);
      const reason = `${rule.service} is priced per ${rule.unit}, so ${decidingPhraseFor(field)} decides that part of the price.`;
      return {
        price: { ...line, missingField: field, reason },
        action: "REQUEST_INFORMATION",
        explanation: reason,
        blocker: { field, reason, ...(inferred ? { inferred } : {}) },
      };
    }
    if (line.kind !== "EXACT") {
      return {
        ...primary,
        action: "ESCALATE_HUMAN",
        explanation: `Enquiry could not price ${rule.service.toLowerCase()} from what is recorded. Check the count, or leave it out and tell them.`,
        extraPending: { field: extra.field, label: rule.service, kind: "check", span: extra.span },
      };
    }
    lines.push({
      label: rule.service,
      amountMinor: line.amountMinor,
      detail: lineDetail(rule, line.workings),
    });
    implied.push(...impliedAmountsMinor(line));
  }
  if (lines.length === 1) return leftOut.length ? { ...primary, leftOut } : primary;
  const total = lines.reduce((sum, l) => sum + l.amountMinor, 0);
  const workings = lines
    .map((l) => `${l.label}: ${formatMinorAud(l.amountMinor)}${l.detail ? ` (${l.detail})` : ""}.`)
    .join(" ");
  return {
    ...primary,
    price: {
      ...primary.price,
      amountMinor: total,
      workings,
      lines,
      alsoImplied: [...impliedAmountsMinor(primary.price), ...implied],
    },
    explanation: workings,
    lines,
    ...(leftOut.length ? { leftOut } : {}),
  };
}

/** "the number of square metres for ceilings". */
function decidingPhraseFor(field: string): string {
  const split = splitExtraQuantityField(field);
  return split ? `the number of ${split.field} for ${split.service}` : `the ${field}`;
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
  // The count for an extra line ("square metres for ceilings") is checked
  // against that extra's own rule.
  const split = splitExtraQuantityField(field);
  const extraRule = split ? rules.find((r) => extraCountMatches(r, split)) : undefined;
  if (extraRule && extraRule.kind === "per_unit") {
    const parsed = parseQuantity(value, extraRule.unit, split!.field);
    return parsed.ok ? null : parsed.message;
  }
  // Every rule that reads this field as its quantity, not just the one that
  // currently prices this enquiry: the service can change after the answer is
  // stored, and a value that is unusable for any of them is unusable.
  const quantityRules = rules.filter(
    (r) => r.kind === "per_unit" && norm(r.quantityField) === norm(field),
  );
  if (quantityRules.length === 0) return null;

  const selected = matchRule(rules, serviceLabel);
  const rule =
    selected.kind === "one" &&
    selected.rule.kind === "per_unit" &&
    norm(selected.rule.quantityField) === norm(field)
      ? selected.rule
      : quantityRules[0]!;
  if (rule.kind !== "per_unit") return null;

  const parsed = parseQuantity(value, rule.unit, field);
  return parsed.ok ? null : parsed.message;
}

/**
 * An owner's answer as it is stored: a written count ("three", "one hundred
 * and twenty") becomes digits when the field is a count a price reads, so the
 * answer box accepts the way people actually type. Anything else is kept
 * exactly as typed.
 */
export function normaliseFactAnswer(
  business: { knowledge?: ReadonlyArray<RuleBearingKnowledge | KnowledgeItem> | null },
  field: string,
  value: string,
): string {
  const rules = activeRules(business);
  const norm = (s: string) => s.trim().toLowerCase();
  const split = splitExtraQuantityField(field);
  const isCount =
    (split !== null && rules.some((r) => extraCountMatches(r, split))) ||
    rules.some((r) => r.kind === "per_unit" && norm(r.quantityField) === norm(field));
  return isCount ? digitsForWrittenNumber(value) : value.trim();
}
