import { stemsOf } from "./service-words.ts";

/**
 * Whether a sentence names one of the quote's priced lines by a word of its
 * own. The send gate never guesses which line a figure belongs to (money the
 * owner writes is listed for them to check, see `edit-warnings.ts`); this only
 * tells "That comes to $750" (the whole quote, a stated total) from "The oven
 * comes to $750" (one thing, the owner's own figure).
 */

export type QuoteLineAmount = { label: string; amountMinor: number; detail?: string };

/** Words that never name a line: work every service shares, and money words. */
const NEVER_A_LABEL = new Set(
  stemsOf(
    "clean cleaning makeup service services job work fee fees charge charges levy surcharge insurance cover deposit",
  ),
);

/** The words that tell each priced line apart: its own, less any another line shares. */
function distinctive(lines: readonly QuoteLineAmount[]): Set<string>[] {
  const counts = new Map<string, number>();
  for (const l of lines) {
    for (const s of new Set(stemsOf(l.label))) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return lines.map(
    (l) =>
      new Set(stemsOf(l.label).filter((s) => !NEVER_A_LABEL.has(s) && (counts.get(s) ?? 0) < 2)),
  );
}

/** Whether `sentence` names any priced line of the quote. */
export function namesAQuoteLine(sentence: string, lines: readonly QuoteLineAmount[]): boolean {
  const priced = lines.filter((l) => l.amountMinor > 0);
  const said = new Set(stemsOf(sentence));
  return distinctive(priced).some((words) => [...words].some((s) => said.has(s)));
}
