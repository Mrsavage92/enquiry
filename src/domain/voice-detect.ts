import type { VoiceProfile } from "./types";
import { formatMinorAud } from "./money-format.ts";
import { NUMBER_PHRASE, wordsToNumber } from "./number-words.ts";

export type VoiceProposal = {
  patch: Partial<VoiceProfile>;
  from: string;
  to: string;
  reason: string;
};

/** `scale` is the multiplier written after it: 1000 for "$2k", 1000000 for "$20m". */
export type DollarMatch = { raw: string; amount: number; index: number; scale?: number };

/**
 * Every way a message can name money: "$3,000", "$ 3000", "A$3000", "AU$3000",
 * "AUD 3000", "3,000 dollars", "3k", "$3.6k". A kept edit that says the old
 * price in any of these forms must be caught, not only the "$3,000" shape.
 * "A$" and "AU$" are written with no space: "A $50 deposit" is the word "A".
 */
const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?`;
/** "$880", "A$880", "AUD 880", "USD 880", "$3.6k". */
const PREFIXED = new RegExp(
  String.raw`(?:\bAUD\s?\$|\bAU\$|\bA\$|\bUS\$|\bAUD\b|\bUSD\b|\$)\s?${AMOUNT}(\s?(?:k|thousand|m|mil|million|bn|b|billion)\b)?`,
  "gi",
);
/** "880 dollars", "880 AUD", "880AUD", "880$", "3k". */
const SUFFIXED = new RegExp(
  String.raw`\b${AMOUNT}\s?(k\b|dollars?\b|bucks\b|aud\b|usd\b|\$)`,
  "gi",
);
/** "That comes to 880.": a bare number where a total is said is money. */
const TOTAL_WORDS = new RegExp(
  String.raw`\b(?:comes?\s+to|came\s+to|total(?:\s+(?:of|is))?|all\s+up|price\s+(?:is|of)|costs?(?:\s+is)?|quote\s+(?:is|of))\s*:?\s*${AMOUNT}\b(?!\s*(?:%|per\b|x\b|hours?|hrs?|rooms?|bed|bath|sq|m2|metres?|meters?|people|guests|doors?|windows?|days?|weeks?|visits?|items?|k\b|dollars?|bucks|aud|usd|\$))`,
  "gi",
);
/** "eight hundred and eighty dollars". */
const WRITTEN = new RegExp(String.raw`(${NUMBER_PHRASE})\s+(?:dollars?|bucks|aud)\b`, "gi");

type Hit = DollarMatch & { end: number };

const SCALES: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mil: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
};

function scaleOf(suffix: string): number {
  return SCALES[suffix.trim().toLowerCase()] ?? 1;
}

function numberFrom(whole: string, cents: string | undefined, suffix: string): number {
  const base = Number(cents ? `${whole.replace(/,/g, "")}.${cents}` : whole.replace(/,/g, ""));
  // "$2k", "$1.5m", "$20m", "$90 million": read with their multiplier, never
  // as $2, $1.50, $20 or $90.
  const by = scaleOf(suffix);
  return by === 1 ? base : Math.round(base * by * 100) / 100;
}

function hitsOf(text: string): Hit[] {
  const hits: Hit[] = [];
  const push = (m: RegExpMatchArray, amount: number, suffix = "") => {
    const scale = scaleOf(suffix);
    hits.push({
      raw: m[0],
      amount,
      index: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      ...(scale > 1 ? { scale } : {}),
    });
  };
  for (const m of text.matchAll(PREFIXED)) {
    push(m, numberFrom(m[1]!, m[2], m[3] ?? ""), m[3] ?? "");
  }
  for (const m of text.matchAll(SUFFIXED)) {
    push(m, numberFrom(m[1]!, m[2], m[3] ?? ""), m[3] ?? "");
  }
  for (const m of text.matchAll(TOTAL_WORDS)) {
    const at = m[0].search(/\d/);
    hits.push({
      raw: m[0].slice(at),
      amount: numberFrom(m[1]!, m[2], ""),
      index: (m.index ?? 0) + at,
      end: (m.index ?? 0) + m[0].length,
    });
  }
  for (const m of text.matchAll(WRITTEN)) {
    const n = wordsToNumber(m[1]!);
    if (n !== null && n > 0) push(m, n);
  }
  return hits;
}

/**
 * Every way a message can name money: "$3,000", "$ 3000", "A$3000", "AU$3000",
 * "AUD 3000", "USD 880", "3,000 dollars", "880 AUD", "880$", "3k", "$3.6k",
 * "eight hundred and eighty dollars", and a bare number where a total is said
 * ("That comes to 880."). A kept edit that says the old price in any of these
 * forms must be caught. "A$" and "AU$" are written with no space: "A $50
 * deposit" is the word "A".
 */
export function dollarMatches(text: string): DollarMatch[] {
  const sorted = hitsOf(text).sort((a, b) => a.index - b.index || b.end - a.end);
  const out: Hit[] = [];
  for (const h of sorted) {
    const prev = out[out.length - 1];
    if (prev && h.index < prev.end) continue;
    out.push(h);
  }
  return out.map(({ raw, amount, index, scale }) => ({
    raw,
    amount,
    index,
    ...(scale ? { scale } : {}),
  }));
}

/** Said as a total: "comes to $2m", "total $1.5m", "that's $90 million all up". */
const TOTAL_BEFORE =
  /\b(?:comes?\s+to|came\s+to|total(?:\s+(?:of|is))?|price\s+(?:is|of)|costs?(?:\s+is)?|quote\s+(?:is|of)|that'?s|it'?s|will\s+be|would\s+be)\s*:?\s*$/i;
const TOTAL_AFTER = /^\s*(?:all\s+up|in\s+total|total|for\s+(?:the|this|that)\s+(?:job|lot))\b/i;
/** Insurance words right beside a figure: "$2k excess", "public liability of $20,000". */
const COVER_AFTER =
  /^\s*(?:of\s+)?(?:public\s+|product\s+)?(?:liability|cover|insurance|excess|indemnity)\b/i;
const COVER_BEFORE =
  /\b(?:liability|cover|insurance|insured|excess|indemnity)(?:\s+(?:of|up\s+to|to|for))?\s*:?\s*$/i;

/**
 * A figure the owner wrote that is not a price for the job: an insurance cover
 * ("$20m public liability", "$90 million cover", "$1.5m") or an excess ("$2k
 * excess"). A figure in the millions is never what a job costs; an amount beside
 * an insurance word is about the insurance. Either one said as the total ("that
 * comes to $2m") is still a price, and the send check compares it.
 */
export function isNonPriceFigure(text: string, m: DollarMatch): boolean {
  const before = text.slice(Math.max(0, m.index - 30), m.index);
  const after = text.slice(m.index + m.raw.length, m.index + m.raw.length + 40);
  if (TOTAL_BEFORE.test(before) || TOTAL_AFTER.test(after)) return false;
  if ((m.scale ?? 1) >= 1e6) return true;
  return COVER_AFTER.test(after) || COVER_BEFORE.test(before);
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
