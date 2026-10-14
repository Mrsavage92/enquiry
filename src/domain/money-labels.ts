import { stemsOf } from "./service-words.ts";
import { sentenceAt, type DollarMatch } from "./voice-detect.ts";

/**
 * Where a quote's own amounts may stand in a reply.
 *
 * "Plus a $250 insurance fee for the wedding day." named the bridal makeup's
 * $250 as a fee that does not exist, and went out because $250 is an amount of
 * the quote. So a line's amount (or a rate the owner's rule implies) is allowed
 * only where it is said as that line: in a sentence of the app's own prepared
 * reply, unchanged, or in a sentence that names the line by a word of its own
 * ("Bridal makeup: $250", "Makeup trial $90" - never "Bridal makeup is $90",
 * which is the trial's figure). The total may stand in any sentence, unless a
 * fee, cover, levy, insurance or deposit word governs it ("Total with
 * insurance $340").
 */

export type QuoteLineAmount = { label: string; amountMinor: number };

/** Words that never name a line: work every service shares, and money words. */
const NEVER_A_LABEL = new Set(
  stemsOf(
    "clean cleaning makeup service services job work fee fees charge charges levy surcharge insurance cover deposit",
  ),
);

/** Words that, beside a figure, make it a charge or a cover of their own. */
const GOVERNING = new Set(
  stemsOf(
    "fee fees charge charges levy levies surcharge insurance insured cover covered deposit excess indemnity liability premium",
  ),
);

/** The words that tell each line apart: its own words, less any another line shares. */
function distinctive(lines: readonly QuoteLineAmount[]): Map<string, Set<string>> {
  const counts = new Map<string, number>();
  for (const l of lines) {
    for (const s of new Set(stemsOf(l.label))) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return new Map(
    lines.map((l) => [
      l.label,
      new Set(stemsOf(l.label).filter((s) => !NEVER_A_LABEL.has(s) && (counts.get(s) ?? 0) < 2)),
    ]),
  );
}

/** Words that say a figure is the amount taken off: a discount line's own. */
const DISCOUNT_WORDS = new Set(stemsOf("discount discounted off less minus saving"));

/** Every sentence of a text, as `sentenceAt` cuts them, trimmed. */
function sentencesOf(text: string): Set<string> {
  return new Set(
    text
      .split(/[!?\n]|\.(?!\d)/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** A figure's words just before and after it, in its own sentence. */
function nearWords(body: string, m: DollarMatch): string[] {
  const sentence = sentenceAt(body, m.index, m.index + m.raw.length);
  const at = body.lastIndexOf(sentence, m.index);
  const from = at === -1 ? 0 : m.index - at;
  const before = sentence.slice(0, Math.max(0, from)).split(/\s+/).filter(Boolean).slice(-4);
  const after = sentence
    .slice(Math.max(0, from) + m.raw.length)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return [...before, ...after];
}

/**
 * Whether one figure of the quote stands where it may. `amount` is the
 * figure in minor units; `totals` are the amounts the quote is recorded at.
 */
export function standsAsQuoted(
  body: string,
  m: DollarMatch,
  amount: number,
  quote: { totals: readonly number[]; lines: readonly QuoteLineAmount[]; draft: string },
): boolean {
  const sentence = sentenceAt(body, m.index, m.index + m.raw.length).trim();
  // A sentence of the app's own reply, unchanged: every figure in it is ours.
  if (quote.draft && sentencesOf(quote.draft).has(sentence)) return true;
  const labelWords = new Set(quote.lines.flatMap((l) => stemsOf(l.label)));
  const near = new Set(stemsOf(nearWords(body, m).join(" ")));
  const governed = [...near].some((s) => GOVERNING.has(s) && !labelWords.has(s));
  if (governed) return false;
  if (quote.totals.includes(amount)) return true;
  // A line's amount, or a rate with no line of its own: said as that line. A
  // discount line ("$300 off jobs over $600: -$300") is its amount off.
  const own = quote.lines.filter((l) => Math.abs(l.amountMinor) === amount);
  // A rate the owner's rule implies, said as a rate: "140 square metres at
  // $30 each", "$45 an hour". Its own workings name it.
  if (own.length === 0) {
    const before = body.slice(Math.max(0, m.index - 6), m.index);
    const after = body.slice(m.index + m.raw.length, m.index + m.raw.length + 12);
    if (
      /\bat\s*$/i.test(before) ||
      /^\s*(?:each|per\b|an?\s+(?:hour|person|room)|\/)/i.test(after)
    ) {
      return true;
    }
  }
  const candidates = own.length > 0 ? own : quote.lines;
  const words = distinctive(quote.lines);
  const said = new Set(stemsOf(sentence));
  return candidates.some(
    (l) =>
      [...(words.get(l.label) ?? [])].some((s) => said.has(s)) ||
      (own.includes(l) && l.amountMinor < 0 && [...said].some((s) => DISCOUNT_WORDS.has(s))),
  );
}
