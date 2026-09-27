import type { Enquiry, EnquiryFact, KnowledgeItem } from "./types";
import { parseBusinessRule, type BusinessRule } from "./business-rule.ts";
import {
  blockedReason,
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
import { activeDetails, describeDetail, type BusinessDetail } from "./business-detail.ts";
import {
  COVERAGE_FIELD,
  coverageConfirmed,
  coverageFlags,
  coverageKey,
  askedForFirstVisit,
  isFirstVisit,
  frequencyIn,
  RECURRING_FIELD,
  unsettledFlags,
  type Coverage,
} from "./coverage.ts";
import {
  QUESTION_ANSWER,
  isQuestionField,
  questionReplyLine,
  questionThing,
} from "./service-questions.ts";
import { applyRules } from "./rule-checks.ts";
import { mentionsAny, namesService, stemsOf } from "./service-words.ts";

/** One priced line of a quote with more than one thing on it. */
export type QuoteLine = {
  label: string;
  amountMinor: number;
  detail?: string;
  /** "3 bedrooms", for a price per something. */
  count?: string;
  /** Asked for on the first visit only, on a recurring job. */
  firstVisit?: boolean;
  /** A rate, fee or top-up from the owner's own rule, not a job they asked for. */
  adjustment?: boolean;
};

/** A "do you do X?" the owner has not answered yet. */
export type QuestionPending = {
  field: string;
  thing: string;
  span?: string;
  /** Read as "No" from the owner's own "we don't do ..." rule, not yet confirmed. */
  readAs?: "no";
  /** That rule in the owner's words: "You don't paint roofs". */
  said?: string;
};

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
  action: "SEND_QUOTE" | "REQUEST_INFORMATION" | "ESCALATE_HUMAN" | "DECLINE";
  /**
   * The owner declined it kindly (a "No" to a question-only enquiry, or a job
   * outside their own "only if" rule): the reply says so and names no price.
   */
  declined?: string[];
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
  /**
   * What the price covers, and whether the owner has confirmed it for exactly
   * these facts. A reply may only name the total once `confirmed` is true.
   */
  coverage?: Coverage;
  /** A question the customer asked that the owner has to answer Yes or No. */
  questionPending?: QuestionPending;
  /** Lines the reply must carry: answered questions, things to come back on. */
  replyNotes?: string[];
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
  enquiry: Pick<Enquiry, "serviceLabel" | "facts"> & {
    /** Everything the customer wrote, for what the price does not cover. */
    messageText?: string;
    /** Every service the business prices or lists. */
    services?: readonly string[];
  },
): Decision {
  const rules = activeRules(business);
  const details = activeDetails(business as { knowledge?: ReadonlyArray<RuleBearingKnowledge> });
  const facts = (enquiry.facts ?? []) as DecideFact[];
  const serviceLabel = enquiry.serviceLabel ?? "";
  const primary = decidePrimary(rules, serviceLabel, facts);
  const knownServices = [...new Set(rules.map((r) => r.service))];
  const decided = primary.price.kind === "EXACT" ? decideExtras(rules, primary, facts) : primary;
  const notes = replyNotesFrom(facts);
  const withNotes = notes.length ? { ...decided, replyNotes: notes } : decided;
  const pending = pendingQuestion(facts);
  const rule = pending?.readAs
    ? details.find((d) => d.kind === "not_offered" && namesService(pending.thing, d.service))
    : undefined;
  const question = pending && rule ? { ...pending, said: describeDetail(rule) } : pending;
  if (question) {
    return {
      ...withNotes,
      action: "ESCALATE_HUMAN",
      explanation: `They asked if you do ${question.thing}. Say yes or no and the reply answers it.`,
      questionPending: question,
      knownServices,
    };
  }
  // "Do you do pressure washing?" answered No, and nothing else asked: the kind
  // "Sorry, I don't do ..." reply is ready now - no service to choose first.
  const noOnly = questionOnlyNo(facts, primary, details, {
    message: enquiry.messageText ?? "",
    services: [...knownServices, ...(enquiry.services ?? [])],
  });
  if (noOnly) return { ...declineDecision(withNotes, noOnly), knownServices };
  const gated =
    withNotes.action === "SEND_QUOTE"
      ? gateCoverage(withNotes, {
          serviceLabel,
          facts,
          details,
          message: enquiry.messageText ?? "",
          services: [...new Set([...knownServices, ...(enquiry.services ?? [])])],
        })
      : withNotes;
  return { ...gated, knownServices };
}

/**
 * The sentences of a kind no, when the enquiry was only a question the owner
 * answered No: no service chosen, at least one No, no Yes. A referral line is
 * added only when the owner saved one for that thing ("For pressure washing I
 * recommend ...").
 */
function questionOnlyNo(
  facts: ReadonlyArray<DecideFact>,
  primary: Decision,
  details: readonly BusinessDetail[],
  asked: { message: string; services: readonly string[] },
): string[] | undefined {
  if (primary.setup !== "choose_service") return undefined;
  // Only a message that is nothing but the question: "paint the inside ...
  // Do you paint roofs?" also asks for painting, and that is never dropped.
  const rest = asked.message
    .split(/(?<=[.!?\n])/)
    .filter((sentence) => !sentence.includes("?"))
    .join(" ");
  if (mentionsAny(rest, [...new Set(asked.services.flatMap(stemsOf))])) return undefined;
  const answered = facts.filter((f) => isQuestionField(f.field) && f.status === "confirmed");
  const noes = answered.filter((f) => String(f.value) === QUESTION_ANSWER.no);
  if (noes.length === 0 || noes.length !== answered.length) return undefined;
  return noes.flatMap((f) => {
    const thing = questionThing(f.field);
    const line = questionReplyLine(thing, QUESTION_ANSWER.no);
    const referral = details.find(
      (d) =>
        d.kind === "note" &&
        /\b(?:recommend|refer|suggest|try)\b/i.test(d.text) &&
        namesService(d.text, thing),
    );
    const said = referral && referral.kind === "note" ? referral.text.replace(/[.!]*$/, ".") : null;
    return [line, said].filter((x): x is string => Boolean(x));
  });
}

/** The first question they asked that the owner has not answered. */
function pendingQuestion(facts: ReadonlyArray<DecideFact>): QuestionPending | undefined {
  const open = facts.find(
    (f) =>
      isQuestionField(f.field) &&
      !(
        f.status === "confirmed" &&
        (f.value === QUESTION_ANSWER.yes || f.value === QUESTION_ANSWER.no)
      ),
  );
  if (!open) return undefined;
  return {
    field: open.field,
    thing: questionThing(open.field),
    ...(open.displayValue ? { span: open.displayValue } : {}),
    ...(String(open.value) === QUESTION_ANSWER.no ? { readAs: "no" as const } : {}),
  };
}

/** Answered questions and things the owner will come back on, in the order asked. */
function replyNotesFrom(facts: ReadonlyArray<DecideFact>): string[] {
  const out: string[] = [];
  for (const f of facts) {
    if (f.status !== "confirmed") continue;
    if (isQuestionField(f.field)) {
      const line = questionReplyLine(questionThing(f.field), String(f.value));
      if (line) out.push(line);
    }
    if (isExtraField(f.field) && String(f.value) === EXTRA_CHOICE.comeBack) {
      out.push(`I'll come back to you on the ${extraLabel(f.field).toLowerCase()}.`);
    }
  }
  return out;
}

/** Every day asked about, read or confirmed, as yyyy-mm-dd: one, or each of two offered. */
function jobDatesOf(facts: ReadonlyArray<DecideFact>): string[] {
  const date = facts.find((f) => f.field.trim().toLowerCase() === "date");
  return String(date?.value ?? "")
    .split("|")
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
}

type CoverageContext = {
  serviceLabel: string;
  facts: ReadonlyArray<DecideFact>;
  details: BusinessDetail[];
  message: string;
  services: string[];
};

function linesOf(decided: Decision): QuoteLine[] {
  if (decided.price.kind !== "EXACT") return [];
  if (decided.lines?.length) return decided.lines;
  return [
    {
      label: decided.price.rule.service,
      amountMinor: decided.price.amountMinor,
      detail: lineDetail(decided.price.rule, decided.price.workings),
      ...(decided.price.count ? { count: decided.price.count } : {}),
    },
  ];
}

/**
 * A priced decision becomes "reply ready" only once the owner has confirmed
 * what it covers, for exactly these facts. Until then the price is shown to the
 * owner as lines, and the reply names no total.
 */
/**
 * A kind no: the reply declines in the owner's own terms and names no price.
 * Nothing is sent until they send it.
 */
export function declineDecision(decided: Decision, sentences: string[]): Decision {
  return {
    ...decided,
    action: "DECLINE",
    explanation: "You said this job is outside what you do. The reply declines it kindly.",
    declined: sentences,
    lines: undefined,
    coverage: undefined,
  };
}

/** The quote after the owner's rules: new lines, total and every amount they imply. */
function withRuledLines(
  decided: Decision,
  before: readonly QuoteLine[],
  after: QuoteLine[],
  implied: number[],
  declined: string[],
): Decision {
  const same =
    before.length === after.length &&
    before.every((l, i) => l.amountMinor === after[i]?.amountMinor && l.label === after[i]?.label);
  const notes = declined.length ? { replyNotes: [...(decided.replyNotes ?? []), ...declined] } : {};
  if (same || decided.price.kind !== "EXACT") return { ...decided, ...notes };
  const total = after.reduce((sum, l) => sum + l.amountMinor, 0);
  const workings = after
    .map((l) => `${l.label}: ${formatMinorAud(l.amountMinor)}${l.detail ? ` (${l.detail})` : ""}.`)
    .join(" ");
  return {
    ...decided,
    ...notes,
    price: {
      ...decided.price,
      amountMinor: total,
      workings,
      lines: after,
      alsoImplied: [...impliedAmountsMinor(decided.price), ...implied],
    },
    explanation: workings,
    lines: after,
  };
}

function gateCoverage(decided: Decision, ctx: CoverageContext): Decision {
  if (decided.price.kind !== "EXACT") return decided;
  // How often is a reading: shown as its own line to confirm, never assumed.
  const frequency = frequencyIn(ctx.message);
  const recurringAnswer = ctx.facts.find(
    (f) => f.field.trim().toLowerCase() === RECURRING_FIELD && f.status === "confirmed",
  );
  const recurring = String(recurringAnswer?.value ?? "") === "yes";
  const unruled = linesOf(decided);
  // The owner's own rules (minimum charge, Saturday rate, travel fee, "only
  // if single storey"): each is applied, waived or still to ask, never passive.
  const ruled = applyRules({
    details: ctx.details,
    lines: unruled,
    message: ctx.message,
    jobDates: jobDatesOf(ctx.facts),
    facts: ctx.facts,
  });
  if (ruled.lines.length === 0 && ruled.declined.length > 0) {
    return declineDecision(decided, ruled.declined);
  }
  const lines = ruled.lines as QuoteLine[];
  decided = withRuledLines(decided, unruled, lines, ruled.implied, ruled.declined);
  const handled = ctx.facts
    .filter((f) => isExtraField(f.field) && f.status === "confirmed")
    .map((f) => extraLabel(f.field))
    // A question they asked and the owner answered is settled, not a gap.
    .concat(
      ctx.facts
        .filter((f) => isQuestionField(f.field) && f.status === "confirmed")
        .map((f) => questionThing(f.field)),
    );
  const flagged = coverageFlags({
    message: ctx.message,
    covered: [ctx.serviceLabel, ...lines.map((l) => l.label), ...handled],
    services: ctx.services,
    details: ctx.details,
    jobDates: jobDatesOf(ctx.facts),
  });
  flagged.push(
    ...ruled.open.map((check) => ({
      kind: "rule" as const,
      text: check.text,
      thing: check.field,
      check,
    })),
  );
  const firstVisit = (l: QuoteLine, i: number) =>
    i > 0 &&
    (Boolean(l.firstVisit) ||
      askedForFirstVisit(ctx.message, l.label, [ctx.serviceLabel, lines[0]!.label]));
  if (frequency && !recurringAnswer) {
    flagged.push({
      kind: "recurring",
      text: `They want this ${frequency} - correct?`,
      thing: frequency,
    });
  }
  const coverageLines = lines.map((l, i) => ({
    label: l.label,
    amountMinor: l.amountMinor,
    ...(l.count ? { quantity: l.count } : {}),
    ...(l.detail?.startsWith("minimum charge") ? { note: "minimum charge" } : {}),
    ...(recurring && firstVisit(l, i) ? { firstVisit: true } : {}),
  }));
  const keyFacts = ctx.facts.map((f) => ({
    field: f.field,
    value: String(f.value ?? ""),
    status: f.status,
  }));
  const key = coverageKey({
    serviceLabel: ctx.serviceLabel,
    lines: coverageLines,
    flagged,
    facts: keyFacts,
  });
  // Every flag has to be settled first: a confirmation over an open flag
  // would let "That's everything" silently drop the garage and the deck.
  const confirmed = coverageConfirmed(keyFacts, key) && unsettledFlags(flagged).length === 0;
  const coverage: Coverage = { key, confirmed, lines: coverageLines, flagged, recurring };
  const marked = decided.lines?.length
    ? {
        ...decided,
        lines: decided.lines.map((l, i) => ({
          ...l,
          firstVisit: Boolean(coverageLines[i]?.firstVisit),
        })),
      }
    : decided;
  const perVisit = recurring ? perVisitPrice(marked, coverageLines) : marked;
  if (confirmed) return { ...perVisit, coverage };
  return {
    ...perVisit,
    action: "ESCALATE_HUMAN",
    explanation: "Check what this price covers before the reply names it.",
    coverage,
  };
}

/**
 * A recurring job is priced per visit: anything asked for on the first visit
 * only is said separately ("the first visit adds $95"), never folded into a
 * per-visit total.
 */
function perVisitPrice(decided: Decision, lines: Coverage["lines"]): Decision {
  if (decided.price.kind !== "EXACT" || !lines.some((l) => l.firstVisit)) return decided;
  const perVisit = lines.filter((l) => !l.firstVisit).reduce((s, l) => s + l.amountMinor, 0);
  return { ...decided, price: { ...decided.price, amountMinor: perVisit } };
}

export { COVERAGE_FIELD };

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
      ...(primary.price.count ? { count: primary.price.count } : {}),
    },
  ];
  const implied: number[] = [];
  const leftOut: { label: string; service?: string }[] = [];
  const key = (service: string) => service.trim().toLowerCase();
  const lined = () => new Set(lines.map((l) => key(l.label)));
  for (const extra of extras) {
    // "They didn't ask for this": Enquiry misread it. No line, no reply line.
    if (
      extra.confirmed &&
      (extra.choice === EXTRA_CHOICE.notAsked || extra.choice === EXTRA_CHOICE.covered)
    )
      continue;
    const match = matchRule(rules, extra.label);
    const rule = match.kind === "one" ? match.rule : undefined;
    if (extra.confirmed && extra.choice === EXTRA_CHOICE.leaveOut) {
      leftOut.push({ label: extra.label, ...(rule ? { service: rule.service } : {}) });
      continue;
    }
    // Nothing they asked for goes on the total without a price: the reply
    // says the owner will come back on it.
    if (extra.confirmed && extra.choice === EXTRA_CHOICE.comeBack) continue;
    // The main job asked for twice, or one priced thing recorded under two
    // names, is one line - never a duplicate $120.
    if (rule && lined().has(key(rule.service))) continue;
    if (!rule) {
      return {
        ...primary,
        action: "ESCALATE_HUMAN",
        explanation: `They also asked for ${extra.label.toLowerCase()}, and none of your prices covers it. Add a price, or leave it out and tell them.`,
        setup: "add_price",
        extraPending: {
          field: extra.field,
          label: extra.label,
          kind: "no_price",
          span: extra.span,
        },
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
      const reason = blockedReason(rule.service, rule.unit, field, true);
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
      ...(line.count ? { count: line.count } : {}),
      ...(isFirstVisit(extra.span) ? { firstVisit: true } : {}),
    });
    implied.push(...impliedAmountsMinor(line));
  }
  // Left out, then added after all (under another name): it is on the quote,
  // so the reply must not also say it was left out.
  const onQuote = lined();
  const stillOut = leftOut
    .filter((l) => !(l.service && onQuote.has(key(l.service))))
    .map((l) => l.label);
  if (lines.length === 1) return stillOut.length ? { ...primary, leftOut: stillOut } : primary;
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
    ...(stillOut.length ? { leftOut: stillOut } : {}),
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
