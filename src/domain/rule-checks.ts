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
export type RuleLine = { label: string; amountMinor: number; detail?: string; count?: string };

export type RuleCheck = {
  field: string;
  kind: "minimum" | "surcharge" | "fee" | "eligibility";
  /** One short sentence for the owner. */
  text: string;
  /** [value, button label] pairs, the rule's own way first. */
  choices: [RuleChoice, string][];
};

type Settled = Map<string, string>;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function slug(s: string): string {
  return norm(s)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 48);
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

function surchargeName(days: readonly number[]): string {
  return days.map((d) => WEEKDAYS[d]!).join(" or ");
}

/** Every rule that concerns these lines and is not yet settled or satisfied. */
export function ruleChecks(input: {
  details: readonly BusinessDetail[];
  lines: readonly RuleLine[];
  message: string;
  jobDates: readonly string[];
}): RuleCheck[] {
  const out: RuleCheck[] = [];
  for (const d of input.details) {
    if (d.kind === "minimum_charge") {
      const target = input.lines.filter((l) => concerns(l, d.service));
      const subtotal = sum(target);
      const minimum = Math.round(d.amount * 100);
      if (target.length === 0 || subtotal >= minimum) continue;
      const what = d.service ? `for ${d.service.toLowerCase()} ` : "";
      out.push({
        field: `${RULE_PREFIX}minimum:${slug(d.service ?? "any")}`,
        kind: "minimum",
        text: `Your minimum ${what}is ${formatMinorAud(minimum)} - this comes to ${formatMinorAud(subtotal)}`,
        choices: [
          [RULE_CHOICE.apply, `Apply ${formatMinorAud(minimum)} minimum`],
          [RULE_CHOICE.waive, "Doesn't apply here"],
        ],
      });
    }
    if (d.kind === "surcharge") {
      const day = input.jobDates.map(weekdayOf).find((w) => w !== undefined && d.days.includes(w));
      const target = input.lines.filter((l) => concerns(l, d.service));
      if (day === undefined || target.length === 0) continue;
      const extra = Math.round((sum(target) * d.percent) / 100);
      const name = WEEKDAYS[day]!;
      out.push({
        field: `${RULE_PREFIX}surcharge:${d.days.join("")}:${d.percent}`,
        kind: "surcharge",
        text: `They asked for a ${name} - your ${surchargeName(d.days)} rate is ${d.percent}% more`,
        choices: [
          [RULE_CHOICE.apply, `Add ${d.percent}% ${name} rate (${formatMinorAud(extra)})`],
          [RULE_CHOICE.waive, "Doesn't apply"],
        ],
      });
    }
    if (d.kind === "fee") {
      if (!input.lines.some((l) => concerns(l, d.service))) continue;
      out.push({
        field: `${RULE_PREFIX}fee:${slug(d.text)}`,
        kind: "fee",
        text: `Your ${d.label.toLowerCase()}: "${d.text}"`,
        choices: [
          [
            RULE_CHOICE.apply,
            `Add ${formatMinorAud(Math.round(d.amount * 100))} ${d.label.toLowerCase()}`,
          ],
          [RULE_CHOICE.waive, "Doesn't apply"],
        ],
      });
    }
    if (d.kind === "eligibility") {
      if (!input.lines.some((l) => concerns(l, d.service))) continue;
      const { read, why } = eligibilityRead(d.condition, input.message);
      if (read === "fits") continue;
      const field = `${RULE_PREFIX}only:${slug(d.service)}`;
      out.push(
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
            },
      );
    }
  }
  return out;
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

export type RulesApplied = {
  lines: RuleLine[];
  /** Checks still waiting on the owner. */
  open: RuleCheck[];
  /** Sentences the reply carries for a declined part ("Sorry, I only do ..."). */
  declined: string[];
  /** Every amount the applied rules put on the quote. */
  implied: number[];
};

/** "Sorry, I only do exterior painting if the house is single storey, so ..." */
function declineSentence(
  d: Extract<BusinessDetail, { kind: "eligibility" }>,
  all: boolean,
): string {
  const text = d.text.trim();
  const only = /^\s*(?:we|i)\s+only\b/i.test(text)
    ? text.replace(/^\s*we\b/i, "I").replace(/^\s*i\b/i, "I")
    : `I only do ${d.service.toLowerCase()} ${text.slice(text.search(/\bonly\b/i) + 5).trim()}`;
  const tail = all ? "so I can't quote this one" : "so I haven't included it";
  return `Sorry, ${only.replace(/[.!]+$/, "")}, ${tail}.`;
}

/**
 * Put the owner's settled choices on the lines: a minimum lifts its line (or
 * tops up the total), a surcharge or fee is its own line, a declined service
 * comes off the quote with a kind sentence. Unsettled checks are returned so
 * the coverage step can ask; a stale choice for a rule that no longer applies
 * (the count went over the minimum) is simply ignored.
 */
export function applyRules(input: {
  details: readonly BusinessDetail[];
  lines: readonly RuleLine[];
  message: string;
  jobDates: readonly string[];
  facts: ReadonlyArray<{ field: string; value: unknown; status: string }>;
}): RulesApplied {
  const settled = settledRules(input.facts);
  const declined: string[] = [];
  const implied: number[] = [];
  let lines: RuleLine[] = [...input.lines];
  // Eligibility first: a declined service takes no minimum, rate or fee.
  for (const d of input.details) {
    if (d.kind !== "eligibility") continue;
    const check = ruleChecks({ ...input, details: [d], lines }).at(0);
    if (!check || settled.get(norm(check.field)) !== RULE_CHOICE.decline) continue;
    const kept = lines.filter((l) => !concerns(l, d.service));
    declined.push(declineSentence(d, kept.length === 0));
    lines = kept;
  }
  const checks = ruleChecks({ ...input, lines });
  const open: RuleCheck[] = [];
  const base = [...lines];
  for (const check of checks) {
    const choice = settled.get(norm(check.field));
    if (!choice) {
      open.push(check);
      continue;
    }
    if (choice !== RULE_CHOICE.apply) continue;
    const detail = input.details.find((d) => matches(check, d));
    if (!detail) continue;
    lines = applyOne(lines, base, detail, input.jobDates, implied);
  }
  return { lines, open, declined, implied };
}

function matches(check: RuleCheck, d: BusinessDetail): boolean {
  if (check.kind === "minimum" && d.kind === "minimum_charge") {
    return check.field === `${RULE_PREFIX}minimum:${slug(d.service ?? "any")}`;
  }
  if (check.kind === "surcharge" && d.kind === "surcharge") {
    return check.field === `${RULE_PREFIX}surcharge:${d.days.join("")}:${d.percent}`;
  }
  if (check.kind === "fee" && d.kind === "fee") {
    return check.field === `${RULE_PREFIX}fee:${slug(d.text)}`;
  }
  return false;
}

function applyOne(
  lines: RuleLine[],
  base: readonly RuleLine[],
  d: BusinessDetail,
  jobDates: readonly string[],
  implied: number[],
): RuleLine[] {
  if (d.kind === "minimum_charge") {
    const minimum = Math.round(d.amount * 100);
    const target = lines.filter((l) => concerns(l, d.service));
    const subtotal = sum(target);
    implied.push(minimum, subtotal);
    if (target.length === 1) {
      const line = target[0]!;
      const workings = line.detail ? `${line.detail} comes to ` : "";
      return lines.map((l) =>
        l === line
          ? {
              ...l,
              amountMinor: minimum,
              detail: `minimum charge - ${workings}${formatMinorAud(subtotal)}`,
            }
          : l,
      );
    }
    implied.push(minimum - subtotal);
    return [...lines, { label: "Minimum charge top-up", amountMinor: minimum - subtotal }];
  }
  if (d.kind === "surcharge") {
    const day = jobDates.map(weekdayOf).find((w) => w !== undefined && d.days.includes(w));
    const extra = Math.round((sum(base.filter((l) => concerns(l, d.service))) * d.percent) / 100);
    implied.push(extra);
    return [
      ...lines,
      { label: `${WEEKDAYS[day ?? d.days[0]!]} rate (${d.percent}% more)`, amountMinor: extra },
    ];
  }
  if (d.kind === "fee") {
    const amount = Math.round(d.amount * 100);
    implied.push(amount);
    return [...lines, { label: d.label, amountMinor: amount }];
  }
  return lines;
}
