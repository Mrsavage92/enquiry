import type { BusinessRule } from "./business-rule.ts";
import { formatMinorAud } from "./money-format.ts";
import { readQuantityFromMessage } from "./quantity-reader.ts";

/**
 * "could i book gel mani for me n my sister (2 ppl)" against "Gel manicure
 * $55": the price is per booking, but they asked for two. Quoting $55 told the
 * customer one price covered both. So a count of people beside a flat price
 * is never priced silently: the owner says how it is priced - per person (two
 * lots), one price for the booking, or they come back on it - with one tap.
 */

export const COUNT_PREFIX = "count:";

export const COUNT_CHOICE = { each: "each", one: "one", later: "later" } as const;

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
  choices: [string, string][];
};

/** How many people they said there are, when it is more than one. */
export function peopleIn(message: string): { n: number; span: string } | undefined {
  const read = readQuantityFromMessage(message, "people", "person");
  const n = read ? Number(read.value) : NaN;
  return Number.isInteger(n) && n >= 2 && n <= 50 ? { n, span: read!.span } : undefined;
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
          [COUNT_CHOICE.later, "Come back to them on it"],
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
    if (choice === COUNT_CHOICE.later) {
      out.notes.push(
        `That ${label} price is for one person - I'll come back to you on the price for ${people.n}.`,
      );
    }
    return line;
  });
  return out;
}
