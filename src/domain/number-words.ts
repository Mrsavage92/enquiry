/**
 * Written numbers as a customer or an owner types them: "three", "twenty-five",
 * "one hundred and twenty", "a hundred", "two thousand five hundred".
 *
 * Deliberately closed: only whole numbers built from these words, and only
 * when every word in the phrase is part of the number. "one or two" and "a
 * few" are not numbers, and nothing here guesses at them.
 */

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const SCALES: Record<string, number> = { hundred: 100, thousand: 1000 };

const ALL_WORDS = [...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(SCALES)];

/**
 * A regex source matching one written number phrase, longest first:
 * "one hundred and twenty", "twenty-five", "a hundred", "three".
 */
const WORD = `(?:${[...ALL_WORDS].sort((a, b) => b.length - a.length).join("|")})(?![a-z])`;
export const NUMBER_PHRASE = String.raw`(?<![a-z])(?:(?:a|an)\s+(?:hundred|thousand)(?![a-z])|${WORD})(?:(?:\s*-\s*|\s+(?:and\s+)?)${WORD})*`;

/** The value of a written number phrase, or null when it is not one. */
export function wordsToNumber(raw: string): number | null {
  const tokens = raw
    .toLowerCase()
    .trim()
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((t) => t && t !== "and");
  if (tokens.length === 0) return null;
  let total = 0;
  let current = 0;
  let seen = false;
  let lastWasTens = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]!;
    if ((t === "a" || t === "an") && i === 0 && SCALES[tokens[1] ?? ""]) {
      current = 1;
      seen = true;
      continue;
    }
    if (t in UNITS) {
      // "twenty five" is 25; "five five" and "ten five" are not numbers.
      if (seen && current % 100 !== 0 && !lastWasTens) return null;
      if (lastWasTens && UNITS[t]! >= 10) return null;
      current += UNITS[t]!;
      lastWasTens = false;
    } else if (t in TENS) {
      if (seen && current % 100 !== 0) return null;
      current += TENS[t]!;
      lastWasTens = true;
    } else if (t === "hundred") {
      if (!seen || current === 0 || current >= 100) return null;
      current *= 100;
      lastWasTens = false;
    } else if (t === "thousand") {
      if (!seen || current === 0) return null;
      total += current * 1000;
      current = 0;
      lastWasTens = false;
    } else {
      return null;
    }
    seen = true;
  }
  return seen ? total + current : null;
}

/**
 * An owner's typed answer with any leading written number as digits:
 * "three" -> "3", "three bedrooms" -> "3 bedrooms". Anything else is returned
 * unchanged, so the quantity grammar still judges it.
 */
export function digitsForWrittenNumber(value: string): string {
  const text = value.trim();
  const m = new RegExp(String.raw`^(${NUMBER_PHRASE})(?=\s|$)(.*)$`, "i").exec(text);
  if (!m) return text;
  const n = wordsToNumber(m[1]!);
  if (n === null) return text;
  return `${n}${m[2] ?? ""}`.trim();
}
