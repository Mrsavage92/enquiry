import { formatMinorAud } from "./money-format.ts";
import { dollarAmounts } from "./voice-detect.ts";

/**
 * The owner kept their own edit of a reply ("Hi Chloe," and their own words)
 * and then a price it names moved. Their words stay; only the figures the
 * decision owns are brought up to date, and every change is listed so it can
 * be shown to them: "Makeup trial $90 -> $95".
 *
 * Deliberately narrow. A figure is only changed where the edit still says it
 * the way the prepared reply did: a "- Label: $X" line whose label is a line
 * of the quote, and the total, found by the prepared reply's own total
 * sentence ("For ..., that comes to $X") and then changed wherever that same
 * figure stands on its own. Money that is theirs is never touched: "$20
 * million public liability", "$20m", "a $50 deposit", "$45 per hour".
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
/** The prepared reply's total sentence: "For the ..., that comes to $885" / "that's $120 per visit". */
const TOTAL_SENTENCE =
  /\bFor\s+[^\n]{1,200}?,\s+that(?:\s+comes\s+to|'s)\s+(?:about\s+)?(\$\s?[\d,]+(?:\.\d{1,2})?)/;
/** Money that belongs to something else: "$20 million", "$20m", "$2k". */
const NOT_A_PRICE_AFTER = /^\s*(?:m\b|million\b|mil\b|k\b|bn\b|billion\b)/i;
/** "insured for $20", "cover of $10", "per $". */
const NOT_A_PRICE_BEFORE =
  /\b(?:insured|insurance|cover|covered|liability|deposit|excess|per|bond)\b[^$\n]{0,12}$/i;
/** "a $50 deposit": the word just after the figure. */
const DEPOSIT_AFTER = /^\s*(?:deposit|bond|excess)\b/i;

/** Lines a reply carries that an edit should not quietly lose. */
const WORTH_KEEPING =
  /^\s*(?:-\s|I haven't included|I'll come back|Just so you know|Sorry, I don't|Sorry, I only|That .* price is for|The first visit adds)/;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The edit with the quote's current figures, what changed, and which lines
 * the new prepared reply has that the edit lacks (a surcharge, a discount, a
 * come-back note) - said to the owner, never added to their words.
 */
export function updateEditFigures(
  body: string,
  lines: readonly PricedLine[],
  totalMinor: number | null,
  prepared = "",
): { body: string; changes: FigureChange[]; missing: string[] } {
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
  const total = TOTAL_SENTENCE.exec(text);
  const was = total ? minorOf(total[1]!) : null;
  if (totalMinor !== null && was !== null && was !== totalMinor) {
    const now = formatMinorAud(totalMinor);
    let replaced = 0;
    text = text.replace(
      new RegExp(`${escapeRe(formatMinorAud(was))}(?![\\d,]|\\.\\d)`, "g"),
      (hit: string, at: number, whole: string) => {
        const after = whole.slice(at + hit.length);
        const before = whole.slice(Math.max(0, at - 40), at);
        if (NOT_A_PRICE_AFTER.test(after) || DEPOSIT_AFTER.test(after)) return hit;
        if (NOT_A_PRICE_BEFORE.test(before)) return hit;
        replaced += 1;
        return now;
      },
    );
    if (replaced > 0) changes.push({ label: "Total", fromMinor: was, toMinor: totalMinor });
  }
  const rows = text.split("\n");
  const have = new Set(rows.map(norm));
  const labels = new Set(
    rows
      .map((l) => LINE.exec(l)?.[2])
      .filter((l): l is string => Boolean(l))
      .map(norm),
  );
  const missing = prepared
    .split("\n")
    .filter((l) => WORTH_KEEPING.test(l) && !have.has(norm(l)))
    .filter((l) => {
      const label = LINE.exec(l)?.[2];
      return !label || !labels.has(norm(label));
    })
    .map((l) => l.trim());
  return { body: text, changes, missing };
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
