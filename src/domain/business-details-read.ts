import { readDetailLine, type DetailRead } from "./business-detail.ts";
import { readPriceLine, splitLines, type PriceSentences } from "./price-sentence.ts";
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

export function readBusinessDetails(text: string): BusinessDetailsRead {
  const out: BusinessDetailsRead = { prices: [], unread: [], details: [] };
  for (const line of splitLines(text)) {
    // A minimum, surcharge, fee, "only if" or closed dates: a rule each quote
    // it concerns checks with one tap, not a note the owner has to remember.
    const rule = readRuleLine(line);
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
