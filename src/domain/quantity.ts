/**
 * The supported grammar for a billable quantity.
 *
 * This exists because the previous reader deleted every character that was not
 * a digit or a decimal point before calling `parseFloat`. Confirming the text
 * "5-6" therefore produced the number 56, and a rule of AUD 100 per person
 * turned a six-person maximum into an exact AUD 5,600 quote. "4 or 5" became
 * 45. "-5" became 5. The owner confirmed a meaning; the parser confirmed
 * whatever survived the deletion.
 *
 * So the grammar is now explicit and closed. One number, optionally followed by
 * the unit the owner writes it with, and nothing else. Anything carrying a
 * meaning a single number cannot represent - a range, alternatives, a negative,
 * two separate counts - is reported as unresolved with its original text
 * intact, so the desk can show the owner exactly what they confirmed and ask
 * the one question that settles it.
 *
 * This is deliberately NOT a natural-language quantity engine. Widening it is a
 * product decision, not a parsing convenience: every form accepted here becomes
 * a form that can silently produce money.
 */

/** Why a confirmed answer could not become a single billable quantity. */
export type QuantityProblem =
  "empty" | "range" | "alternatives" | "negative" | "multiple" | "zero" | "malformed" | "too_large";

export type QuantityParse =
  { ok: true; quantity: number } | { ok: false; problem: QuantityProblem; message: string };

/**
 * The largest quantity that may drive a price.
 *
 * Not a business limit - a safety bound. `amount * quantity * 100` must stay a
 * safe integer so a stored minor-unit amount is exact, and a typo of fifteen
 * digits must fail loudly rather than round into a plausible-looking number.
 */
export const MAX_QUANTITY = 100_000;

/** The largest minor-unit amount that may be produced or stored. */
export const MAX_AMOUNT_MINOR = 1_000_000_000_00;

/** At most four decimal places - beyond that is a typo, not a measurement. */
const SINGLE_NUMBER = /^\d{1,9}(?:\.\d{1,4})?$/;

/**
 * Unit prose the owner may write after the number: "4 people", "2.5 hours",
 * "40 square metres". Letters, spaces and a trailing full stop only - never
 * another digit, which is what separates "4 people" from "4 people 2 children".
 */
const TRAILING_UNIT = /^[a-z][a-z\s.'-]*$/;

/**
 * Text that means "more than one possible quantity" rather than a quantity.
 *
 * Open-ended forms belong here as much as two-ended ones: "4 plus", "5 max" and
 * "3 minimum" each describe a bound the owner has in mind, and reading them as
 * the bare number quietly discards the part that mattered. "up to 5" was caught
 * from the start and its siblings were not, which was an inconsistency rather
 * than a decision.
 */
const RANGE_MARKERS = [
  /\d\s*-\s*\d/,
  /\bto\b/,
  /\bbetween\b/,
  /–/,
  /—/,
  /\bup to\b/,
  /\bplus\b/,
  /\+/,
  /\bmax(imum)?\b/,
  /\bmin(imum)?\b/,
  /\bat least\b/,
  /\bat most\b/,
  /\bor more\b/,
  /\bor fewer\b/,
  /\bover\b/,
  /\bunder\b/,
];
const ALTERNATIVE_MARKERS = [
  /\bor\b/,
  /\//,
  /\bapprox\b/,
  /\baround\b/,
  /\bish\b/,
  /~/,
  /\bmaybe\b/,
  /\broughly\b/,
  /\babout\b/,
];

/**
 * Read one confirmed answer as a billable quantity, or explain why it is not
 * one. The message is written for the owner, not a log.
 */
export function parseQuantity(raw: string, unit = "", field = "answer"): QuantityParse {
  const text = String(raw ?? "").trim();
  if (!text) {
    return { ok: false, problem: "empty", message: `No ${field} was entered.` };
  }

  const lower = text.toLowerCase();

  // A leading minus is a negative, not a separator - check it before the range
  // markers, which would otherwise claim "-5" as a range.
  if (/^[-−]/.test(text)) {
    return {
      ok: false,
      problem: "negative",
      message: `"${text}" is a negative ${unit || field}. Enter the actual ${unit || field} count.`,
    };
  }

  if (RANGE_MARKERS.some((re) => re.test(lower))) {
    return {
      ok: false,
      problem: "range",
      message: `"${text}" is a range, so it does not settle the price. Enter the ${unit || field} you are quoting for, or ask them to confirm which.`,
    };
  }

  if (ALTERNATIVE_MARKERS.some((re) => re.test(lower))) {
    return {
      ok: false,
      problem: "alternatives",
      message: `"${text}" gives more than one possibility, so it does not settle the price. Enter the single ${unit || field} you are quoting for.`,
    };
  }

  // Split the number from any unit prose the owner wrote after it. Anything
  // that is not "<number>" or "<number> <words>" is not a supported quantity.
  const match = /^(\S+)(?:\s+(.*))?$/.exec(text);
  const head = match?.[1] ?? text;
  const tail = (match?.[2] ?? "").trim().toLowerCase();

  if (tail && !TRAILING_UNIT.test(tail)) {
    return {
      ok: false,
      problem: "multiple",
      message: `"${text}" reads as more than one quantity. Enter the single ${unit || field} that decides the price.`,
    };
  }

  if (!SINGLE_NUMBER.test(head)) {
    return {
      ok: false,
      problem: "malformed",
      message: `"${text}" is not a ${unit || field} Enquiry can price from. Enter a number, for example 4.`,
    };
  }

  const quantity = Number.parseFloat(head);
  if (!Number.isFinite(quantity)) {
    return {
      ok: false,
      problem: "malformed",
      message: `"${text}" is not a number Enquiry can price from.`,
    };
  }

  // Zero is deliberate, not a guess: a per-unit rule bills for units, and zero
  // units is either a mistake or a decision not to quote. Either way an owner
  // should say so rather than have Enquiry send an AUD 0 quote.
  if (quantity === 0) {
    return {
      ok: false,
      problem: "zero",
      message: `A ${unit || field} of zero cannot be priced. Enter the ${unit || field} being quoted for.`,
    };
  }

  if (quantity > MAX_QUANTITY) {
    return {
      ok: false,
      problem: "too_large",
      message: `"${text}" is larger than Enquiry will price automatically. Check the ${unit || field} and quote this one by hand.`,
    };
  }

  return { ok: true, quantity };
}

/**
 * Multiply a major-unit rate by a quantity into exact minor units, or null when
 * the result would leave the supported money range. Kept here so the bound is
 * enforced in one place rather than re-derived by each caller.
 */
export function amountMinorFor(amountMajor: number, quantity: number): number | null {
  if (!Number.isFinite(amountMajor) || !Number.isFinite(quantity)) return null;
  const minor = Math.round(amountMajor * quantity * 100);
  if (!Number.isSafeInteger(minor)) return null;
  if (minor < 0 || minor > MAX_AMOUNT_MINOR) return null;
  return minor;
}
