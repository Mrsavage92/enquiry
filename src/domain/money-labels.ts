import { stemsOf } from "./service-words.ts";
import { dollarMatches, sentenceAt, type DollarMatch } from "./voice-detect.ts";

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
 *
 * A figure with no line of its own (a "jobs over" threshold, the subtotal
 * before a discount, a rate) is never vouched for by another line's name: it
 * stands only in the words it was quoted in ("jobs over $600", "3 hours at
 * $55 each"), or as the subtotal beside a subtotal label.
 */

export type QuoteLineAmount = { label: string; amountMinor: number; detail?: string };

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

/**
 * The lines a sentence or bullet names by their own words. Only priced lines
 * have names: a discount line ("$300 off jobs over $600") has none, so its
 * words ("off", "over") never vouch for anything.
 */
function namedLines(sentence: string, lines: readonly QuoteLineAmount[]): QuoteLineAmount[] {
  const priced = lines.filter((l) => l.amountMinor > 0);
  const words = distinctive(priced);
  const said = new Set(stemsOf(sentence));
  return priced.filter((l) => [...(words.get(l.label) ?? [])].some((s) => said.has(s)));
}

/**
 * A sentence or bullet about one line, or some of them: never the place for a
 * figure of the whole quote (the amount off, the subtotal). Naming none of
 * the lines, or every one of them, is about the whole quote.
 */
function aboutSomeLines(
  named: readonly QuoteLineAmount[],
  lines: readonly QuoteLineAmount[],
): boolean {
  return named.length > 0 && named.length < lines.filter((l) => l.amountMinor > 0).length;
}

/** "-$300", "less $300", "minus $300", "save $300", "discount of $300". */
const AMOUNT_OFF_BEFORE = /(?:[-−]|\b(?:less|minus|save|saving|discount\s+of)\s*)$/i;
/** "$300 off", "$300 comes off", "$300 discount". */
const AMOUNT_OFF_AFTER = /^\s*(?:(?:comes?\s+)?off\b|discount\b)/i;

/** A figure written as an amount taken off, right beside it. */
function saidAsAmountOff(body: string, m: DollarMatch): boolean {
  return (
    AMOUNT_OFF_BEFORE.test(body.slice(Math.max(0, m.index - 14), m.index)) ||
    AMOUNT_OFF_AFTER.test(body.slice(m.index + m.raw.length, m.index + m.raw.length + 16))
  );
}

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
  // A line's amount: said as that line. A discount line ("$300 off jobs over
  // $600: -$300") has no name: its amount stands only written as an amount
  // off right beside it, and never in a sentence or bullet about other lines
  // ("- Oven clean: $300 (takes over 3 hours)" is the oven's price).
  const own = quote.lines.filter((l) => Math.abs(l.amountMinor) === amount);
  if (own.length === 0) return standsInOwnWords(body, m, amount, sentence, quote);
  const named = namedLines(sentence, quote.lines);
  return own.some((l) =>
    l.amountMinor > 0
      ? named.includes(l)
      : saidAsAmountOff(body, m) && !aboutSomeLines(named, quote.lines),
  );
}

/** "jobs over", "at", "comes to": the words a figure is said with, lower case. */
function lettersOf(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

/** "jobs" and "job" are one word when a figure's own wording is compared. */
function oneForm(word: string): string {
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
}

/**
 * Whether a figure is said in its own wording: the word just before it is the
 * home's ("over $600"), and the home's word before that ("jobs") is in the
 * sentence too ("Because the job is over $600", "Any job over $600").
 */
function saidInWording(head: readonly string[], before: readonly string[]): boolean {
  const said = head.map(oneForm);
  const want = before.map(oneForm);
  if (said.at(-1) !== want.at(-1)) return false;
  return want.slice(0, -1).every((w) => said.slice(0, -1).includes(w));
}

/** A rate said as a rate: "at $30", "$30 each", "$45 an hour", "$8 per window". */
function saidAsRate(text: string, index: number, length: number): boolean {
  const before = text.slice(Math.max(0, index - 6), index);
  const after = text.slice(index + length, index + length + 12);
  return (
    /\bat\s*$/i.test(before) || /^\s*(?:each|per\b|an?\s+(?:hour|person|room)|\/)/i.test(after)
  );
}

/**
 * A subtotal label just before the figure: "Subtotal $750", "sub-total: $750",
 * "The oven, fridge and windows come to $750".
 */
const SUBTOTAL_BEFORE =
  /(?:\bsub[\s-]?total\s*(?:is|of|was)?\s*[:=-]?|\b(?:comes?|came)\s+to)\s*$/i;
/** Or just after it: "$750 before the discount", "$750 subtotal". */
const SUBTOTAL_AFTER = /^\s*(?:sub[\s-]?total|before\s+(?:the\s+|any\s+)?discounts?)\b/i;

/**
 * A figure with no line of its own: allowed only in the words the quote says
 * it in. The texts that say it are the app's own reply and the quote's lines
 * (label and workings). Said there after "jobs over", it stands only after
 * "jobs over"; said there as a rate, only as a rate. The subtotal of the
 * lines stands only beside a subtotal label. Never vouched for by the name of
 * a line it does not belong to ("- Oven clean: $600" on a $250 oven clean).
 */
function standsInOwnWords(
  body: string,
  m: DollarMatch,
  amount: number,
  sentence: string,
  quote: { lines: readonly QuoteLineAmount[]; draft: string },
): boolean {
  const at = body.lastIndexOf(sentence, m.index);
  const from = at === -1 ? m.index : at;
  const head = lettersOf(body.slice(from, m.index));
  const tail = lettersOf(body.slice(m.index + m.raw.length, from + sentence.length));
  const homes = [
    ...sentencesOf(quote.draft),
    ...quote.lines.flatMap((l) => [l.label, l.detail ?? ""]),
  ].filter(Boolean);
  // On a bullet or sentence about one line, only that line's own figures: the
  // threshold is the discount's ("- Oven clean: jobs over $600" is not), and a
  // rate is the line whose workings say it.
  const named = namedLines(sentence, quote.lines);
  const owners = quote.lines.filter((l) =>
    [l.label, l.detail ?? ""].some((t) =>
      dollarMatches(t).some((h) => Math.round(h.amount * 100) === amount),
    ),
  );
  const onItsLine = !aboutSomeLines(named, quote.lines) || named.every((l) => owners.includes(l));
  const rate = saidAsRate(body, m.index, m.raw.length);
  for (const home of onItsLine ? homes : []) {
    for (const h of dollarMatches(home)) {
      if (h.foreign || Math.round(h.amount * 100) !== amount) continue;
      if (rate && saidAsRate(home, h.index, h.raw.length)) return true;
      const before = lettersOf(home.slice(0, h.index)).slice(-2);
      if (before.length > 0) {
        if (saidInWording(head, before)) return true;
        continue;
      }
      const after = lettersOf(home.slice(h.index + h.raw.length)).slice(0, 2);
      if (after.length > 0 && tail.slice(0, after.length).join(" ") === after.join(" ")) {
        return true;
      }
    }
  }
  const subtotal = quote.lines
    .filter((l) => l.amountMinor > 0)
    .reduce((sum, l) => sum + l.amountMinor, 0);
  // The subtotal is the whole quote's: never on a bullet or sentence about one line.
  if (amount !== subtotal || aboutSomeLines(namedLines(sentence, quote.lines), quote.lines)) {
    return false;
  }
  return (
    SUBTOTAL_BEFORE.test(body.slice(from, m.index)) ||
    SUBTOTAL_AFTER.test(body.slice(m.index + m.raw.length))
  );
}
