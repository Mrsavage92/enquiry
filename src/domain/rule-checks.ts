import type { BusinessDetail } from "./business-detail.ts";
import { WEEKDAYS } from "./business-detail.ts";
import { formatMinorAud } from "./money-format.ts";
import { namesService } from "./service-words.ts";

/**
 * The owner's own rules about money and eligibility, checked on each quote
 * they concern. A rule is never passive: while it is unsettled the price
 * cannot be confirmed, and once settled it is either on the total (a minimum
 * charge, a Saturday rate, a travel fee) or explicitly waived for this job.
 * Enquiry never applies one by itself - the owner taps "Apply" or "Doesn't
 * apply here" - and never lets one drop out of sight.
 *
 * The choice is stored as a confirmed fact `rule:<kind>:<key>` whose value is
 * one of RULE_CHOICE, written through the ordinary answer-fact server function.
 */

export const RULE_PREFIX = "rule:";

export const RULE_CHOICE = {
  apply: "apply",
  waive: "waive",
  quote: "quote",
  decline: "decline",
} as const;

export type RuleChoice = (typeof RULE_CHOICE)[keyof typeof RULE_CHOICE];

const CHOICES = new Set<string>(Object.values(RULE_CHOICE));

export function isRuleField(field: string): boolean {
  return field.trim().toLowerCase().startsWith(RULE_PREFIX);
}

export function isRuleChoice(value: string): value is RuleChoice {
  return CHOICES.has(value);
}

/** A line of a quote, as the rules see it. */
export type RuleLine = {
  label: string;
  amountMinor: number;
  detail?: string;
  count?: string;
  /** A rate, fee or top-up the owner's rule adds: priced, but not a job. */
  adjustment?: boolean;
};

export type RuleCheck = {
  field: string;
  kind: "minimum" | "surcharge" | "fee" | "eligibility" | "discount";
  /** One short sentence for the owner. */
  text: string;
  /** [value, button label] pairs, the rule's own way first. */
  choices: [RuleChoice, string][];
};

type Settled = Map<string, string>;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** A rule for "Interior painting" concerns the interior painting line, and no other. */
function concerns(line: RuleLine, service: string | undefined): boolean {
  if (!service) return true;
  return norm(line.label) === norm(service) || namesService(line.label, service);
}

function weekdayOf(iso: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
}

function sum(lines: readonly RuleLine[]): number {
  return lines.reduce((s, l) => s + l.amountMinor, 0);
}

/** "two storey", "double-storey", "2 storey", "multi storey". */
const MORE_STOREYS =
  /\b(?:two|double|2|three|3|multi|split)[\s-]*(?:level|storey|story|storeys|stories)\b/i;
const ONE_STOREY = /\b(?:single|one|1)[\s-]*(?:level|storey|story)\b|\blowset\b/i;

type EligibilityRead = "fits" | "conflict" | "unknown";

function eligibilityRead(
  condition: string,
  message: string,
): { read: EligibilityRead; why?: string } {
  if (ONE_STOREY.test(condition)) {
    const more = MORE_STOREYS.exec(message);
    if (more) return { read: "conflict", why: more[0] };
    if (ONE_STOREY.test(message)) return { read: "fits" };
  }
  return { read: "unknown" };
}

function capitalise(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** FNV-1a: a short stable id for a rule's own words, never a truncated slug. */
function idOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

type Eligibility = Extract<BusinessDetail, { kind: "eligibility" }>;
type Minimum = Extract<BusinessDetail, { kind: "minimum_charge" }>;
type Fee = Extract<BusinessDetail, { kind: "fee" }>;

/** The job lines: what they asked for, never a rate, fee or top-up. */
function jobLines(lines: readonly RuleLine[]): RuleLine[] {
  return lines.filter((l) => !l.adjustment);
}

function eligibilityCheck(d: Eligibility, lines: readonly RuleLine[], message: string) {
  if (!lines.some((l) => concerns(l, d.service))) return undefined;
  const { read, why } = eligibilityRead(d.condition, message);
  if (read === "fits") return undefined;
  const field = `${RULE_PREFIX}only:${idOf(norm(d.service))}`;
  const check: RuleCheck =
    read === "conflict"
      ? {
          field,
          kind: "eligibility",
          text: `${capitalise(why!.toLowerCase())} - you said ${d.service.toLowerCase()} only if ${d.condition}`,
          choices: [
            [RULE_CHOICE.decline, "Decline kindly"],
            [RULE_CHOICE.quote, "Quote anyway"],
          ],
        }
      : {
          field,
          kind: "eligibility",
          text: `You do ${d.service.toLowerCase()} only if ${d.condition} - does this job fit?`,
          choices: [
            [RULE_CHOICE.quote, "It fits - quote it"],
            [RULE_CHOICE.decline, "Decline kindly"],
          ],
        };
  return check;
}

/**
 * One minimum per scope (a service, or every job), the highest when the owner
 * saved two, service minimums before a minimum on every job. Two minimums
 * never share one tap.
 */
function minimumsInOrder(details: readonly BusinessDetail[]): Minimum[] {
  const byScope = new Map<string, Minimum>();
  for (const d of details) {
    if (d.kind !== "minimum_charge") continue;
    const scope = norm(d.service ?? "");
    const have = byScope.get(scope);
    if (!have || d.amount > have.amount) byScope.set(scope, d);
  }
  return [...byScope.values()].sort((a, b) => Number(!a.service) - Number(!b.service));
}

/** "Sunday or Saturday", "Saturdays". */
function daysWord(days: readonly number[]): string {
  return days.map((d) => `${WEEKDAYS[d]!}s`).join(" and ");
}

/**
 * Lift the one job line to the minimum, or add a top-up for the difference.
 * Worked out from the same lines the owner was shown; never a line of $0 or less.
 */
function liftToMinimum(
  lines: RuleLine[],
  target: readonly RuleLine[],
  minimum: number,
  implied: number[],
): RuleLine[] {
  const subtotal = sum(target);
  const gap = minimum - subtotal;
  if (gap <= 0) return lines;
  implied.push(minimum, subtotal);
  const only = target.length === 1 ? target[0]! : undefined;
  if (only && !only.detail?.startsWith("minimum charge")) {
    const workings = only.detail ? `${only.detail} comes to` : "the work comes to";
    return lines.map((l) =>
      l === only
        ? {
            ...l,
            amountMinor: minimum,
            detail: `minimum charge - ${workings} ${formatMinorAud(subtotal)}`,
          }
        : l,
    );
  }
  implied.push(gap);
  return [...lines, { label: "Minimum charge top-up", amountMinor: gap, adjustment: true }];
}

export type RulesApplied = {
  lines: RuleLine[];
  /** Checks still waiting on the owner. */
  open: RuleCheck[];
  /** Sentences the reply carries for a declined part ("Sorry, I only do ..."). */
  declined: string[];
  /** Sentences the reply carries about a rule it could not price ("Saturdays are 20% more."). */
  notes: string[];
  /** Every amount the applied rules put on the quote, all above zero. */
  implied: number[];
};

/** "Sorry, I only do exterior painting if the house is single storey, so ..." */
function declineSentence(d: Eligibility, all: boolean): string {
  const text = d.text.trim();
  const only = /^\s*(?:we|i)\s+only\b/i.test(text)
    ? text.replace(/^\s*we\b/i, "I").replace(/^\s*i\b/i, "I")
    : `I only do ${d.service.toLowerCase()} ${text.slice(text.search(/\bonly\b/i) + 5).trim()}`;
  const tail = all ? "so I can't quote this one" : "so I haven't included it";
  return `Sorry, ${only.replace(/[.!]+$/, "")}, ${tail}.`;
}

type Ctx = {
  details: readonly BusinessDetail[];
  message: string;
  jobDates: readonly string[];
  settled: Settled;
  open: RuleCheck[];
  implied: number[];
  /** How often the owner confirmed the job repeats ("fortnightly"), when it does. */
  recurring?: string;
};

/** Ask, or apply what the owner chose. Returns the lines after the choice. */
function settle(ctx: Ctx, check: RuleCheck, onApply: () => RuleLine[], lines: RuleLine[]) {
  const choice = ctx.settled.get(norm(check.field));
  if (!choice) {
    ctx.open.push(check);
    return lines;
  }
  return choice === RULE_CHOICE.apply ? onApply() : lines;
}

function applyMinimums(ctx: Ctx, start: RuleLine[]): RuleLine[] {
  let lines = start;
  for (const m of minimumsInOrder(ctx.details)) {
    const target = jobLines(lines).filter((l) => concerns(l, m.service));
    const subtotal = sum(target);
    const minimum = Math.round(m.amount * 100);
    if (target.length === 0 || subtotal >= minimum) continue;
    const what = m.service ? `for ${m.service.toLowerCase()} ` : "";
    const check: RuleCheck = {
      field: `${RULE_PREFIX}minimum:${m.service ? idOf(norm(m.service)) : "any"}:${minimum}`,
      kind: "minimum",
      text: `Your minimum ${what}is ${formatMinorAud(minimum)} - this comes to ${formatMinorAud(subtotal)}`,
      choices: [
        [RULE_CHOICE.apply, `Apply ${formatMinorAud(minimum)} minimum`],
        [RULE_CHOICE.waive, "Doesn't apply here"],
      ],
    };
    lines = settle(ctx, check, () => liftToMinimum(lines, target, minimum, ctx.implied), lines);
  }
  return lines;
}

/**
 * A surcharge applies to the job price after any minimum, and only when one
 * day was asked for and it is that day. Several days offered, one of them a
 * surcharge day: the reply says the rate plainly, the total does not guess.
 */
function applySurcharges(ctx: Ctx, start: RuleLine[], notes: string[]): RuleLine[] {
  let lines = start;
  const days = ctx.jobDates.map(weekdayOf).filter((d): d is number => d !== undefined);
  for (const s of ctx.details) {
    if (s.kind !== "surcharge") continue;
    // A rule for no one service concerns every job on the quote.
    const target = jobLines(lines).filter((l) => concerns(l, s.service));
    if (target.length === 0 || !days.some((d) => s.days.includes(d))) continue;
    // Every day they offered carries the rate ("this sat or sun" and a
    // weekend rate): it applies whichever day it is. Some do, some don't: the
    // reply says the rate plainly and the total does not guess.
    if (!days.every((d) => s.days.includes(d))) {
      notes.push(`Just so you know, ${daysWord(s.days)} are ${s.percent}% more.`);
      continue;
    }
    const base = sum(target);
    const extra = Math.round((base * s.percent) / 100);
    if (extra <= 0) continue;
    const unique = [...new Set(days)];
    const name =
      unique.length === 1
        ? WEEKDAYS[unique[0]!]!
        : unique.every((d) => d === 0 || d === 6)
          ? "weekend"
          : unique.map((d) => WEEKDAYS[d]!).join(" or ");
    const check: RuleCheck = {
      field: `${RULE_PREFIX}surcharge:${s.days.join("")}:${s.percent}`,
      kind: "surcharge",
      text: `They asked for a ${name} - your ${name} rate is ${s.percent}% more (${s.percent}% of ${formatMinorAud(base)} is ${formatMinorAud(extra)})`,
      choices: [
        [RULE_CHOICE.apply, `Add ${s.percent}% ${name} rate (${formatMinorAud(extra)})`],
        [RULE_CHOICE.waive, "Doesn't apply"],
      ],
    };
    const line: RuleLine = {
      label: `${capitalise(name)} rate (${s.percent}% of ${formatMinorAud(base)})`,
      amountMinor: extra,
      adjustment: true,
    };
    lines = settle(
      ctx,
      check,
      () => {
        ctx.implied.push(extra);
        return [...lines, line];
      },
      lines,
    );
  }
  return lines;
}

type Discount = Extract<BusinessDetail, { kind: "discount" }>;

/** "fortnightly" from "every fortnight", "every two weeks". */
function frequencyWord(said: string): Discount["frequency"] | undefined {
  if (/fortnight|two weeks|2 weeks|other week/i.test(said)) return "fortnightly";
  if (/week/i.test(said)) return "weekly";
  if (/month/i.test(said)) return "monthly";
  return undefined;
}

/**
 * "Fortnightly cleans get 10% off", once the owner has confirmed the job
 * repeats that often: one tap takes it off each job line it concerns, and the
 * line says so ("10% fortnightly discount on $160").
 */
function applyDiscounts(ctx: Ctx, start: RuleLine[]): RuleLine[] {
  let lines = start;
  if (!ctx.recurring) return lines;
  const often = frequencyWord(ctx.recurring);
  for (const d of ctx.details) {
    if (d.kind !== "discount") continue;
    if (d.frequency !== "regular" && d.frequency !== often) continue;
    const target = jobLines(lines).filter((l) => concerns(l, d.service));
    if (target.length === 0) continue;
    const base = sum(target);
    const after = target.reduce(
      (s, l) => s + Math.round((l.amountMinor * (100 - d.percent)) / 100),
      0,
    );
    if (after <= 0 || after >= base) continue;
    const how = d.frequency === "regular" ? "regular" : d.frequency;
    const check: RuleCheck = {
      field: `${RULE_PREFIX}discount:${d.frequency}:${d.percent}`,
      kind: "discount",
      text: `They want it ${ctx.recurring} - your ${how} discount is ${d.percent}% off (${formatMinorAud(base)} becomes ${formatMinorAud(after)})`,
      choices: [
        [RULE_CHOICE.apply, `Apply ${d.percent}% ${how} discount (${formatMinorAud(after)})`],
        [RULE_CHOICE.waive, "Doesn't apply"],
      ],
    };
    lines = settle(
      ctx,
      check,
      () =>
        lines.map((l) => {
          if (!target.includes(l)) return l;
          const amountMinor = Math.round((l.amountMinor * (100 - d.percent)) / 100);
          ctx.implied.push(l.amountMinor, amountMinor, l.amountMinor - amountMinor);
          const off = `${d.percent}% ${how} discount on ${formatMinorAud(l.amountMinor)}`;
          return { ...l, amountMinor, detail: l.detail ? `${l.detail}, ${off}` : off };
        }),
      lines,
    );
  }
  return lines;
}

function applyFees(ctx: Ctx, start: RuleLine[]): RuleLine[] {
  let lines = start;
  for (const f of ctx.details) {
    if (f.kind !== "fee" || !jobLines(lines).some((l) => concerns(l, (f as Fee).service))) continue;
    const amount = Math.round(f.amount * 100);
    if (amount <= 0) continue;
    const check: RuleCheck = {
      field: `${RULE_PREFIX}fee:${idOf(norm(f.text))}`,
      kind: "fee",
      text: `Your ${f.label.toLowerCase()}: "${f.text}"`,
      choices: [
        [RULE_CHOICE.apply, `Add ${formatMinorAud(amount)} ${f.label.toLowerCase()}`],
        [RULE_CHOICE.waive, "Doesn't apply"],
      ],
    };
    lines = settle(
      ctx,
      check,
      () => {
        ctx.implied.push(amount);
        return [...lines, { label: f.label, amountMinor: amount, adjustment: true }];
      },
      lines,
    );
  }
  return lines;
}

/**
 * The owner's rules on the lines, always in the same order whatever order
 * they were saved in: "only if" first (a declined service takes nothing
 * else), then minimums against the job lines, then a day rate on the job
 * price after the minimum, then fees. Unsettled checks are returned so the
 * coverage step can ask; a stale choice for a rule that no longer applies is
 * ignored.
 */
export function applyRules(input: {
  details: readonly BusinessDetail[];
  lines: readonly RuleLine[];
  message: string;
  jobDates: readonly string[];
  facts: ReadonlyArray<{ field: string; value: unknown; status: string }>;
  /** How often the owner confirmed the job repeats, when it does. */
  recurring?: string;
}): RulesApplied {
  const ctx: Ctx = {
    details: input.details,
    message: input.message,
    jobDates: input.jobDates,
    settled: settledRules(input.facts),
    open: [],
    implied: [],
    ...(input.recurring ? { recurring: input.recurring } : {}),
  };
  const declined: string[] = [];
  const notes: string[] = [];
  let lines: RuleLine[] = [...input.lines];
  for (const d of input.details) {
    if (d.kind !== "eligibility") continue;
    const check = eligibilityCheck(d, lines, input.message);
    if (!check) continue;
    const choice = ctx.settled.get(norm(check.field));
    if (!choice) {
      ctx.open.push(check);
      continue;
    }
    if (choice !== RULE_CHOICE.decline) continue;
    const kept = lines.filter((l) => !concerns(l, d.service));
    declined.push(declineSentence(d, kept.length === 0));
    lines = kept;
  }
  lines = applyMinimums(ctx, lines);
  lines = applyDiscounts(ctx, lines);
  lines = applySurcharges(ctx, lines, notes);
  lines = applyFees(ctx, lines);
  return {
    lines,
    open: ctx.open,
    declined,
    notes,
    implied: [...new Set(ctx.implied.filter((n) => n > 0))],
  };
}

/** The owner's settled choices, by field. */
export function settledRules(
  facts: ReadonlyArray<{ field: string; value: unknown; status: string }>,
): Settled {
  const out: Settled = new Map();
  for (const f of facts) {
    if (!isRuleField(f.field) || f.status !== "confirmed") continue;
    const value = String(f.value ?? "");
    if (isRuleChoice(value)) out.set(norm(f.field), value);
  }
  return out;
}
