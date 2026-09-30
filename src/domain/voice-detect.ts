import type { VoiceProfile } from "./types";
import { formatMinorAud } from "./money-format.ts";
import { NUMBER_PHRASE, wordsToNumber } from "./number-words.ts";

export type VoiceProposal = {
  patch: Partial<VoiceProfile>;
  from: string;
  to: string;
  reason: string;
};

/**
 * `scale` is the multiplier written after it: 1000 for "$2k", 1000000 for
 * "$20m". `foreign` is money in another currency ("£500", "€500"): never the
 * quote's own figure, whatever the number.
 */
export type DollarMatch = {
  raw: string;
  amount: number;
  index: number;
  scale?: number;
  foreign?: true;
};

/**
 * Every way a message can name money: "$3,000", "$ 3000", "A$3000", "AU$3000",
 * "AUD 3000", "AUD250", "3,000 dollars", "3k", "$3.6k", "5 grand". A kept edit
 * that says the old price in any of these forms must be caught, not only the
 * "$3,000" shape. "A$" and "AU$" are written with no space: "A $50 deposit" is
 * the word "A".
 */
const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?`;
const SCALE = String.raw`(\s?(?:k|thousand|grand|m|mil|million|bn|b|billion)\b)?`;
/** "$880", "A$880", "AUD 880", "AUD250", "$3.6k". */
const PREFIXED = new RegExp(
  String.raw`(?:\bAUD\s?\$|\bAU\$|\bA\$|\bAUD\s?|(?<![A-Za-z])\$)\s?${AMOUNT}${SCALE}`,
  "gi",
);
/**
 * Money in another currency: "£500", "€500", "US$340", "NZ$340", "USD 340",
 * "NZD 340", "GBP 500", "EUR 500", "500 euros", "340 NZD". Never the quote's own
 * figure, whatever the number.
 */
const FOREIGN = new RegExp(
  String.raw`(?:£|€|\bUS\$|\bNZ\$|\bUSD\s?|\bNZD\s?|\bGBP\s?|\bEUR\s?)\s?${AMOUNT}${SCALE}`,
  "gi",
);
const FOREIGN_SUFFIXED = new RegExp(
  String.raw`\b${AMOUNT}${SCALE}\s?(?:euros?|pounds?(?:\s+sterling)?|usd|nzd|gbp|eur|us\s+dollars?|nz\s+dollars?)\b`,
  "gi",
);
/** "880 dollars", "880 AUD", "880AUD", "880$", "3k", "2 thousand dollars", "5 grand". */
const SUFFIXED = new RegExp(
  String.raw`\b${AMOUNT}\s?(k\b|grand\b|(?:thousand|million)\s+(?:dollars?|bucks|aud)\b|dollars?\b|bucks\b|aud\b|\$)`,
  "gi",
);
/**
 * A number said the way a price is said: after "Price:", "Quote:", "Total:",
 * "comes to", "all up", "that'll be", "is", "costs" ("Bridal makeup is 250"),
 * or before "all up" / "in total" ("5,000 all up"). Never a count, a date, a
 * time, a phone number or an ABN: those are followed by their own words or by
 * more digits.
 */
const CUE = String.raw`\b(?:comes?\s+to|came\s+to|total(?:\s+(?:of|is))?|all\s+up|price(?:\s+(?:is|of))?|quote(?:d)?(?:\s+(?:is|of|at))?|costs?(?:\s+is)?|charge(?:\s+is)?|fee(?:\s+is)?|that'?ll\s+be|that\s+will\s+be|that'?s|it'?s|is|are|will\s+be|would\s+be|you'?ll\s+pay|pay)\s*[:=-]?\s*(?:about|around|approx(?:imately)?|roughly|just|only)?\s*`;
const NOT_MONEY_AFTER = String.raw`(?!\s*(?:%|per\b|x\b|hours?\b|hrs?\b|h\b|mins?\b|minutes?\b|rooms?\b|bed|bath|sq|m2|metres?|meters?|people|persons?|guests|ppl|doors?|windows?|days?\b|weeks?\b|months?\b|years?\b|yrs?\b|visits?|items?|of\s+(?:us|them)|kids|adults|bridesmaids|am\b|pm\b|o'?clock|st\b|nd\b|rd\b|th\b|jan|feb|mar|apr|may\b|jun|jul|aug|sep|oct|nov|dec|[/:.]\d|,?\s?\d|-\d|k\b|thousand|grand|million|mil\b|m\b|bn\b|billion|dollars?|bucks|aud|usd|nzd|euros?|pounds?|\$))`;
const CUED = new RegExp(
  String.raw`${CUE}(?!0\d)${AMOUNT}\b(\s?(?:thousand|million|mil|m|bn|billion)\b)?${NOT_MONEY_AFTER}`,
  "gi",
);
const ALL_UP_AFTER = new RegExp(
  String.raw`\b(?!0\d)${AMOUNT}${SCALE}(?=\s+(?:all\s+up|in\s+total|total|inc(?:l(?:uding|\.)?)?\s+gst)\b)`,
  "gi",
);
/** "eight hundred and eighty dollars", "five grand". */
const WRITTEN = new RegExp(
  String.raw`(${NUMBER_PHRASE})\s+(dollars?|bucks|aud|grand|euros?|pounds?)\b`,
  "gi",
);

type Hit = DollarMatch & { end: number };

const SCALES: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  grand: 1e3,
  m: 1e6,
  mil: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
};

/** "k", "million", "thousand dollars": the multiplier is the first word. */
function scaleOf(suffix: string): number {
  return SCALES[suffix.trim().toLowerCase().split(/\s+/)[0] ?? ""] ?? 1;
}

function numberFrom(whole: string, cents: string | undefined, suffix: string): number {
  const base = Number(cents ? `${whole.replace(/,/g, "")}.${cents}` : whole.replace(/,/g, ""));
  // "$2k", "$1.5m", "$20m", "$90 million", "5 grand": read with their
  // multiplier, never as $2, $1.50, $20, $90 or $5.
  const by = scaleOf(suffix);
  return by === 1 ? base : Math.round(base * by * 100) / 100;
}

function hitsOf(text: string): Hit[] {
  const hits: Hit[] = [];
  const push = (raw: string, index: number, amount: number, suffix = "", foreign = false) => {
    const scale = scaleOf(suffix);
    hits.push({
      raw,
      amount,
      index,
      end: index + raw.length,
      ...(scale > 1 ? { scale } : {}),
      ...(foreign ? { foreign: true as const } : {}),
    });
  };
  const each = (re: RegExp, foreign = false) => {
    for (const m of text.matchAll(re)) {
      // A cue word is not part of the figure: the hit starts at its digits.
      const at = re === CUED ? m[0].search(/\d/) : 0;
      push(
        m[0].slice(at),
        (m.index ?? 0) + at,
        numberFrom(m[1]!, m[2], m[3] ?? ""),
        m[3] ?? "",
        foreign,
      );
    }
  };
  each(FOREIGN, true);
  each(FOREIGN_SUFFIXED, true);
  each(PREFIXED);
  each(SUFFIXED);
  each(CUED);
  each(ALL_UP_AFTER);
  for (const m of text.matchAll(WRITTEN)) {
    const n = wordsToNumber(m[1]!);
    const word = m[2]!.toLowerCase();
    const foreign = /^(?:euros?|pounds?)$/.test(word);
    if (n !== null && n > 0) push(m[0], m.index ?? 0, word === "grand" ? n * 1000 : n, "", foreign);
  }
  return hits;
}

/**
 * Every way a message can name money: "$3,000", "$ 3000", "A$3000", "AU$3000",
 * "AUD 3000", "3,000 dollars", "880 AUD", "880$", "3k", "$3.6k", "5 grand",
 * "eight hundred and eighty dollars", a bare number said as a price ("That
 * comes to 880.", "Price: 5000", "Bridal makeup is 250"), and money in another
 * currency ("US$340", "500 euros"), marked `foreign`. A kept edit that says the
 * old price in any of these forms must be caught. Where two readings overlap,
 * the first and longest wins, and a foreign reading wins over a local one.
 */
export function dollarMatches(text: string): DollarMatch[] {
  const sorted = hitsOf(text).sort(
    (a, b) =>
      a.index - b.index || b.end - a.end || Number(Boolean(b.foreign)) - Number(Boolean(a.foreign)),
  );
  const out: Hit[] = [];
  for (const h of sorted) {
    const prev = out[out.length - 1];
    if (prev && h.index < prev.end) continue;
    out.push(h);
  }
  return out.map(({ raw, amount, index, scale, foreign }) => ({
    raw,
    amount,
    index,
    ...(scale ? { scale } : {}),
    ...(foreign ? { foreign } : {}),
  }));
}

/** Insurance words: a figure beside one is never trusted as written unless it is a saved answer. */
export const INSURANCE_WORDS =
  /\b(?:insur\w*|liability|indemnity|cover(?:ed|age)?|excess|policy|underwrit\w*)\b/i;

/** The sentence around a position, to the nearest . ! ? or new line. */
export function sentenceAt(text: string, from: number, to: number): string {
  const before = text.slice(0, from);
  const start =
    Math.max(...["!", "?", "\n"].map((b) => before.lastIndexOf(b)), lastStop(before)) + 1;
  const rest = text.slice(to);
  const stop = rest.search(/[!?\n]|\.(?!\d)/);
  return text.slice(start, stop === -1 ? text.length : to + stop);
}

/** The last full stop that ends a sentence, never a decimal point. */
function lastStop(text: string): number {
  for (let i = text.length - 1; i >= 0; i -= 1) {
    if (text[i] === "." && !/\d/.test(text[i + 1] ?? "")) return i;
  }
  return -1;
}

/**
 * Money words ("dollars", "bucks", "AUD") that no readable amount goes with:
 * "about nine-ish hundred dollars". Enquiry cannot check an amount it cannot
 * read, so the owner is asked to write it in numbers.
 */
export function unreadableMoney(text: string): boolean {
  const covered = hitsOf(text);
  for (const m of text.matchAll(/\b(?:dollars?|bucks|aud|usd)\b/gi)) {
    const at = m.index ?? 0;
    if (!covered.some((h) => at >= h.index && at < h.end)) return true;
  }
  return false;
}

/** A figure about something else: a deposit, last year's price, a rate. */
const OTHER_MONEY =
  /\b(?:deposit|deposits|last\s+(?:year|time|month)|per|each|an?\s+hour|hourly|a\s+day|p\/h|ph)\b|\/\s*h(?:ou)?r/i;

/**
 * Put the quote total back where the owner typed a different figure - only
 * when that is unambiguous: exactly one figure differs from the quote, and
 * none of its mentions sits beside "deposit", "last year", "per", "each" or
 * an hourly rate. Replaced by position, last first, so "$76 ... $76" never
 * becomes "$7600". Anything less certain returns null, and the caller puts the
 * prepared reply back instead.
 */
export function replaceAmounts(text: string, fromMinor: number[], toMinor: number): string | null {
  const wrong = new Set(fromMinor);
  if (wrong.size !== 1) return null;
  const hits = dollarMatches(text).filter((m) => wrong.has(Math.round(m.amount * 100)));
  if (hits.length === 0) return null;
  for (const m of hits) {
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    const after = text.slice(m.index + m.raw.length, m.index + m.raw.length + 24);
    if (OTHER_MONEY.test(before) || OTHER_MONEY.test(after)) return null;
  }
  let next = text;
  for (const m of [...hits].sort((a, b) => b.index - a.index)) {
    next = `${next.slice(0, m.index)}${formatMinorAud(toMinor)}${next.slice(m.index + m.raw.length)}`;
  }
  return next;
}

export function dollarAmounts(text: string): number[] {
  return dollarMatches(text).map((m) => m.amount);
}

function fmtDollar(n: number): string {
  return formatMinorAud(Math.round(n * 100));
}

/**
 * The edited reply names money the prepared one did not. `from` is the quote
 * on file (the decision's own total), never "none": the old version reported
 * the figures the edit removed, so an edit that only ADDED "$120 ... $880"
 * over a $760 quote read "The quote on file is still none".
 */
export function detectPriceDrift(
  original: string,
  edited: string,
  quoteTotal?: number | null,
): { from: string | null; to: string } | null {
  const a = dollarAmounts(original);
  const b = dollarAmounts(edited);
  if (a.join(",") === b.join(",")) return null;
  const to = b.filter((n) => !a.includes(n));
  const removed = a.filter((n) => !b.includes(n));
  if (to.length === 0 && removed.length === 0) return null;
  const from =
    typeof quoteTotal === "number"
      ? fmtDollar(quoteTotal)
      : removed.length
        ? removed.map(fmtDollar).join(", ")
        : null;
  return { from, to: to.map(fmtDollar).join(", ") || "no amount" };
}

/** True when the letter almost-but-not names the sheet figure (the $187 / $188 bug). */
export function detectSheetLetterMismatch(
  letter: string,
  sheet: { total?: number; hold?: number },
): { sheet: string; letter: string } | null {
  const dollars = dollarAmounts(letter);
  if (dollars.length === 0) return null;
  const near = (target?: number) =>
    target == null ? undefined : dollars.find((d) => d !== target && Math.abs(d - target) <= 5);
  const holdMiss = near(sheet.hold);
  if (holdMiss != null && sheet.hold != null) {
    return { sheet: fmtDollar(sheet.hold), letter: fmtDollar(holdMiss) };
  }
  const totalMiss = near(sheet.total);
  if (totalMiss != null && sheet.total != null) {
    return { sheet: fmtDollar(sheet.total), letter: fmtDollar(totalMiss) };
  }
  return null;
}

export function alignLetterToSheet(
  letter: string,
  sheet: { total?: number; hold?: number },
): string {
  let next = letter;
  for (const m of dollarMatches(letter)) {
    const target =
      sheet.hold != null && m.amount !== sheet.hold && Math.abs(m.amount - sheet.hold) <= 5
        ? sheet.hold
        : sheet.total != null && m.amount !== sheet.total && Math.abs(m.amount - sheet.total) <= 5
          ? sheet.total
          : null;
    if (target == null) continue;
    next = next.replace(m.raw, fmtDollar(target));
  }
  return next;
}

function firstLine(body: string) {
  return body.trimStart().split("\n")[0]?.trim() ?? "";
}

function extractSignOff(body: string): string {
  const lines = body.replace(/\s+$/, "").split("\n");
  let lastBody = lines.length - 1;
  while (
    lastBody >= 1 &&
    lines[lastBody]!.trim().length > 0 &&
    lines[lastBody]!.length < 48 &&
    !/[.?!]$/.test(lines[lastBody]!.trim())
  ) {
    lastBody -= 1;
  }
  return lines
    .slice(lastBody + 1)
    .join("\n")
    .trim();
}

function greetingTemplate(
  line: string,
  firstName: string,
): { greeting: string; warmth?: string } | null {
  if (!line || line.length > 60) return null;
  const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = new RegExp(escaped, "i");
  const templated = line.replace(nameRe, "{name}");
  if (/^hello\b/i.test(line)) {
    return {
      greeting: templated.includes("{name}") ? templated : "Hello {name},",
      warmth: "Reserved",
    };
  }
  if (/^hi\b/i.test(line)) {
    return { greeting: templated.includes("{name}") ? templated : "Hi {name},", warmth: "Warm" };
  }
  if (/^hey\b/i.test(line)) {
    return { greeting: templated.includes("{name}") ? templated : "Hey {name},", warmth: "Warm" };
  }
  if (nameRe.test(line)) {
    return { greeting: templated, warmth: "Reserved" };
  }
  return null;
}

export function detectVoiceEdit(
  original: string,
  edited: string,
  voice: VoiceProfile,
  firstName: string,
): VoiceProposal | null {
  if (original.trim() === edited.trim()) return null;

  const origG = firstLine(original);
  const newG = firstLine(edited);
  const origS = extractSignOff(original);
  const newS = extractSignOff(edited);

  const patch: Partial<VoiceProfile> = {};
  const bits: string[] = [];
  let from = "";
  let to = "";

  if (origG !== newG) {
    const parsed = greetingTemplate(newG, firstName);
    if (parsed && parsed.greeting !== voice.greeting) {
      patch.greeting = parsed.greeting;
      if (parsed.warmth && parsed.warmth !== voice.warmth) patch.warmth = parsed.warmth;
      bits.push("greeting");
      from = origG;
      to = newG;
    }
  }

  if (newS && newS !== origS && newS !== voice.signOff) {
    patch.signOff = newS;
    bits.push("sign-off");
    if (!from) {
      from = origS;
      to = newS;
    } else {
      from = `${from} · ${origS}`;
      to = `${to} · ${newS}`;
    }
  }

  if (bits.length === 0) return null;

  return {
    patch,
    from,
    to,
    reason:
      bits.length === 2
        ? "You changed the greeting and sign-off."
        : bits[0] === "greeting"
          ? "You changed the greeting."
          : "You changed the sign-off.",
  };
}
