import type { BusinessRule } from "./business-rule.ts";
import { formatMinorAud } from "./money-format.ts";
import { readQuantityFromMessage } from "./quantity-reader.ts";
import { tradeOf } from "./trades.ts";

/**
 * "could i book gel mani for me n my sister (2 ppl)" against "Gel manicure
 * $55": the price is per booking, but they asked for two. Quoting $55 told the
 * customer one price covered both. So a count of people beside a flat price
 * is never priced silently: the owner says how it is priced - per person (two
 * lots) or one price for the booking - with one tap. Only for a service booked
 * per person or per booking (makeup, nails, lashes): "4 of us live here" on
 * an end of lease clean is not a headcount.
 */

export const COUNT_PREFIX = "count:";

/**
 * The owner's choices, in the same words as a rule check so the coverage card
 * shows them as one: per person is the count applied, one price is it waived.
 */
export const COUNT_CHOICE = { each: "apply", one: "waive" } as const;

const CHOICES = new Set<string>(Object.values(COUNT_CHOICE));

export function isCountChoiceField(field: string): boolean {
  return field.trim().toLowerCase().startsWith(COUNT_PREFIX);
}

export function isCountChoice(value: string): boolean {
  return CHOICES.has(value.trim());
}

export function countChoiceField(service: string): string {
  return `${COUNT_PREFIX}${service.trim().toLowerCase()}`;
}

type Line = {
  label: string;
  amountMinor: number;
  detail?: string;
  count?: string;
  adjustment?: boolean;
};

export type HeadcountCheck = {
  field: string;
  people: number;
  text: string;
  /** [value, button label], the owner's choices. */
  choices: ["apply" | "waive", string][];
};

const SMALL: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };
/** "for 2", "for two": how many are booking, when nothing else is counted. */
const FOR_N =
  /\bfor\s+(\d{1,2}|two|three|four|five|six)\b(?!\s*(?:hours?|hrs?|h\b|rooms?|bed|bath|days?|weeks?|months?|m2|sqm|square|metres?|meters?|%|am\b|pm\b|:|\/|dollars?|bucks))/i;
/** "4 of us live here": who lives there, not who is booked. */
const LIVES_THERE = /^\s*(?:who\s+)?(?:live|living|stay|staying|in\s+the\s+house|here)\b/i;

/** How many people they said there are, when it is more than one. */
export function peopleIn(message: string): { n: number; span: string } | undefined {
  const read = readQuantityFromMessage(message, "people", "person");
  if (read) {
    const at = message.indexOf(read.span);
    const after = at === -1 ? "" : message.slice(at + read.span.length);
    const n = Number(read.value);
    if (LIVES_THERE.test(after)) return undefined;
    return Number.isInteger(n) && n >= 2 && n <= 50 ? { n, span: read.span } : undefined;
  }
  const m = FOR_N.exec(message);
  if (!m) return undefined;
  const n = SMALL[m[1]!.toLowerCase()] ?? Number(m[1]);
  return n >= 2 && n <= 20 ? { n, span: m[0] } : undefined;
}

/**
 * Each flat-priced job line, against the number of people they said: asked
 * about, or priced the way the owner chose. `notes` are reply lines for a
 * choice to come back on it.
 */
export function applyHeadcount<L extends Line>(input: {
  lines: readonly L[];
  rules: readonly BusinessRule[];
  message: string;
  facts: ReadonlyArray<{ field: string; value: unknown; status: string }>;
}): { lines: L[]; open: HeadcountCheck[]; notes: string[]; implied: number[] } {
  const people = peopleIn(input.message);
  const out = {
    lines: [...input.lines],
    open: [] as HeadcountCheck[],
    notes: [] as string[],
    implied: [] as number[],
  };
  if (!people) return out;
  const norm = (s: string) => s.trim().toLowerCase();
  out.lines = input.lines.map((line) => {
    if (line.adjustment || line.count) return line;
    const rule = input.rules.find((r) => norm(r.service) === norm(line.label));
    if (!rule || rule.kind !== "fixed_price") return line;
    // A clean or a paint job is priced for the place, never per person.
    const trade = tradeOf(rule.service);
    if (trade === "cleaning" || trade === "painting") return line;
    const field = countChoiceField(line.label);
    const chosen = input.facts.find(
      (f) => norm(f.field) === norm(field) && f.status === "confirmed",
    );
    const choice = String(chosen?.value ?? "").trim();
    const each = formatMinorAud(line.amountMinor);
    const label = line.label.toLowerCase();
    if (!chosen || !isCountChoice(choice)) {
      out.open.push({
        field,
        people: people.n,
        text: `They mention ${people.n} people - your ${label} price is per booking`,
        choices: [
          [COUNT_CHOICE.each, `${people.n} x ${each} (per person)`],
          [COUNT_CHOICE.one, `One ${each} for the booking`],
        ],
      });
      return line;
    }
    if (choice === COUNT_CHOICE.each) {
      out.implied.push(line.amountMinor);
      return {
        ...line,
        amountMinor: line.amountMinor * people.n,
        count: `${people.n} people`,
        detail: `${people.n} people at ${each} each`,
      };
    }
    return line;
  });
  return out;
}
