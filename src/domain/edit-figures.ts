import { formatMinorAud } from "./money-format.ts";
import { dollarAmounts } from "./voice-detect.ts";

/**
 * The owner kept their own edit of a reply ("Hi Chloe," and their own words)
 * and then a price it names moved. Their words stay; only the figures the
 * decision owns are brought up to date, line by line, and every change is
 * listed so it can be shown to them: "Makeup trial $90 -> $95".
 *
 * Deliberately narrow. A figure is only changed where the edit still says it
 * the way the prepared reply did: a "- Label: $X" line whose label is a line
 * of the quote, and the total after "comes to" or "that's". Any other money
 * ("$20 million public liability") is theirs and is never touched.
 */

export type FigureChange = { label: string; fromMinor: number; toMinor: number };

export type PricedLine = { label: string; amountMinor: number; detail?: string };

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function minorOf(text: string): number | null {
  const [n] = dollarAmounts(text);
  return n === undefined ? null : Math.round(n * 100);
}

/** "- Makeup trial: $90", "- Bridal makeup: $720 (4 people at $180 each)". */
const LINE = /^(\s*-\s*)([^:\n]+?)(\s*:\s*)(\$\s?[\d,]+(?:\.\d{1,2})?)(\s*\([^)\n]*\))?(.*)$/;
/** "that comes to $885", "that's about $1,200 per visit". */
const TOTAL = /\b((?:comes\s+to|that'?s)\s+(?:about\s+)?)(\$\s?[\d,]+(?:\.\d{1,2})?)/i;

/**
 * The edit with the quote's current figures, and what changed. `total` is the
 * quote's total now; `lines` its priced lines.
 */
export function updateEditFigures(
  body: string,
  lines: readonly PricedLine[],
  totalMinor: number | null,
): { body: string; changes: FigureChange[] } {
  const changes: FigureChange[] = [];
  const byLabel = new Map(lines.map((l) => [norm(l.label), l]));
  const out = body.split("\n").map((row) => {
    const m = LINE.exec(row);
    if (!m) return row;
    const line = byLabel.get(norm(m[2]!));
    const was = minorOf(m[4]!);
    if (!line || was === null || was === line.amountMinor) return row;
    changes.push({ label: line.label, fromMinor: was, toMinor: line.amountMinor });
    const detail = line.detail ? ` (${line.detail})` : "";
    return `${m[1]}${m[2]}${m[3]}${formatMinorAud(line.amountMinor)}${m[5] !== undefined ? detail : ""}${m[6] ?? ""}`;
  });
  let text = out.join("\n");
  if (totalMinor !== null) {
    const t = TOTAL.exec(text);
    const was = t ? minorOf(t[2]!) : null;
    if (t && was !== null && was !== totalMinor) {
      changes.push({ label: "Total", fromMinor: was, toMinor: totalMinor });
      text = text.replace(TOTAL, `$1${formatMinorAud(totalMinor)}`);
    }
  }
  return { body: text, changes };
}

/** "Makeup trial $90 -> $95", for the owner. */
export function describeChange(c: FigureChange): string {
  return `${c.label} ${formatMinorAud(c.fromMinor)} -> ${formatMinorAud(c.toMinor)}`;
}

/**
 * What an edit names that the quote now says differently, without changing
 * the edit: for showing beside an out-of-date edit before the owner chooses.
 */
export function editFigureChanges(
  body: string,
  lines: readonly PricedLine[],
  totalMinor: number | null,
): FigureChange[] {
  return updateEditFigures(body, lines, totalMinor).changes;
}
