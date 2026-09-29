import { readDetailLine, type DetailRead } from "./business-detail.ts";
import {
  extraOnly,
  readPriceLine,
  splitLines,
  thresholdOnly,
  type PriceSentences,
  type UnreadLine,
} from "./price-sentence.ts";
import { pluraliseUnit } from "./business-rule.ts";
import { readRuleLine } from "./business-rules-read.ts";

/**
 * Everything an owner wrote in "Add a business detail", sorted: prices it can
 * quote, rules that are not prices ("We don't work Sundays", "We don't do
 * mould removal"), and lines it will not save as a price, each with the reason
 * (a conditional price or fee carries `note` so it can be kept as a note).
 */
export type BusinessDetailsRead = PriceSentences & { details: DetailRead[] };

/** A dollar amount written as "$65" or "65 dollars". */
const HAS_AMOUNT = /\$\s?\d|\d\s*(?:dollars?|bucks)\b/i;

const NOT_A_PRICE =
  "There is no price in it, and Enquiry did not read it as a rule it can check on a quote.";

/**
 * "Regular house clean $160 for up to 3 bedrooms" on one line and "Extra
 * bedrooms $35 each" on the next are one price: joined, so the threshold is
 * never dropped. A threshold with nothing for the ones after it, or an "extra"
 * price with no threshold to follow, is refused with the reason - saving
 * either alone would under-quote the bigger job.
 */
function joinTiers(lines: string[]): { lines: string[]; refused: UnreadLine[] } {
  const out: string[] = [];
  const refused: UnreadLine[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const threshold = thresholdOnly(line);
    const next = lines[i + 1];
    const extra = next ? extraOnly(next) : null;
    if (threshold && extra && extra.unit === threshold.unit) {
      out.push(
        `${line.replace(/[.;,]+\s*$/, "")}, extra ${pluraliseUnit(extra.unit, 2)} $${extra.amount} each`,
      );
      i += 1;
      continue;
    }
    if (threshold) {
      refused.push({
        line,
        reason: `It covers up to ${threshold.count} ${pluraliseUnit(threshold.unit, threshold.count)}, but not what each ${threshold.unit} after that costs, so a bigger job would be under-quoted. Add it to the same line, for example: ${TIER_EXAMPLE}.`,
      });
      continue;
    }
    const alone = extraOnly(line);
    if (alone) {
      const before = out.length ? out[out.length - 1] : undefined;
      if (before && HAS_AMOUNT.test(before) && !readRuleLine(before)) {
        out.pop();
        refused.push({
          line: before,
          reason: `The next line adds a price for extra ${pluraliseUnit(alone.unit, 2)}, but this one does not say how many ${pluraliseUnit(alone.unit, 2)} it covers. Write both on one line, for example: ${TIER_EXAMPLE}.`,
        });
      }
      refused.push({
        line,
        reason: `It is a price for extra ${pluraliseUnit(alone.unit, 2)}, but no price says how many ${pluraliseUnit(alone.unit, 2)} come before the extra ones. Write both on one line, for example: ${TIER_EXAMPLE}.`,
      });
      continue;
    }
    out.push(line);
  }
  return { lines: out, refused };
}

const TIER_EXAMPLE = "House clean $160 for up to 3 bedrooms, extra bedrooms $35 each";

export function readBusinessDetails(text: string, now: Date = new Date()): BusinessDetailsRead {
  const out: BusinessDetailsRead = { prices: [], unread: [], details: [] };
  const joined = joinTiers(splitLines(text));
  out.unread.push(...joined.refused);
  for (const line of joined.lines) {
    // A minimum, surcharge, fee, "only if" or closed dates: a rule each quote
    // it concerns checks with one tap, not a note the owner has to remember.
    const rule = readRuleLine(line, now);
    if (rule) {
      const price = rule.priceLine ? readPriceLine(rule.priceLine) : null;
      if (price && !("rule" in price)) {
        out.unread.push({ ...price, line });
        continue;
      }
      const service = price && "rule" in price ? price.rule.service : undefined;
      if (price && "rule" in price) out.prices.push({ ...price, line });
      for (const part of rule.remainder ?? []) {
        out.unread.push({ line: part, reason: NOT_A_PRICE, note: true });
      }
      for (const detail of rule.details) {
        const tied =
          detail.kind === "minimum_charge" && !detail.service && service
            ? { ...detail, service }
            : detail;
        out.details.push({ line, detail: tied });
      }
      continue;
    }
    const detail = readDetailLine(line);
    if (detail && "refuse" in detail) {
      out.unread.push({ line, reason: detail.refuse });
      continue;
    }
    if (detail) {
      out.details.push({ line, detail });
      continue;
    }
    const read = readPriceLine(line);
    if ("rule" in read) {
      out.prices.push(read);
      // "Doors $90 each (includes frame)": the price, and a note on what it covers.
      if (read.note) {
        const service = read.rule.service;
        out.details.push({
          line,
          detail: { kind: "note", text: `${service} includes ${read.note}`, service },
        });
      }
    } else if (HAS_AMOUNT.test(line)) out.unread.push(read);
    else out.unread.push({ line, reason: NOT_A_PRICE, note: true });
  }
  return out;
}
