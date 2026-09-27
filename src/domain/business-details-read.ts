import { readDetailLine, type DetailRead } from "./business-detail.ts";
import { readPriceLine, splitLines, type PriceSentences } from "./price-sentence.ts";

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
  "There is no price in it, and Enquiry did not read it as a day you don't work or a service you don't offer. Keep it as a note Enquiry shows you, or leave it out.";

export function readBusinessDetails(text: string): BusinessDetailsRead {
  const out: BusinessDetailsRead = { prices: [], unread: [], details: [] };
  for (const line of splitLines(text)) {
    const detail = readDetailLine(line);
    if (detail) {
      out.details.push({ line, detail });
      continue;
    }
    const read = readPriceLine(line);
    if ("rule" in read) out.prices.push(read);
    else if (HAS_AMOUNT.test(line)) out.unread.push(read);
    else out.unread.push({ line, reason: NOT_A_PRICE, note: true });
  }
  return out;
}
