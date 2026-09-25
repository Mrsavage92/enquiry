import { parseBusinessRule, pluraliseUnit, type BusinessRule } from "./business-rule.ts";

/**
 * Turn an owner's own sentence about a price into a rule they can confirm.
 *
 * "Add business detail" used to hand the text to a matcher that only knew the
 * sample businesses' prices. A real owner with no prices typed "Exterior
 * repaint will be $5,500." and pressed Preview; nothing happened, because the
 * matcher found nothing to change and returned without a word. This reads the
 * two shapes the pricing screen supports - one flat price, or a price per
 * something - and names every line it could not read, so the owner is never
 * left wondering whether the button worked.
 *
 * Deliberately strict: "from $300" and "$300-$500" are not prices Enquiry can
 * quote, so they are reported as unread with the reason, never rounded into one.
 */

export type ReadPrice = { line: string; rule: BusinessRule };
export type UnreadLine = { line: string; reason: string };
export type PriceSentences = { prices: ReadPrice[]; unread: UnreadLine[] };

export const PRICE_EXAMPLE = "End of lease clean $190 per bedroom";
export const FLAT_EXAMPLE = "Exterior repaint $5,500";

const AMOUNT = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)(?!\s*(?:-|–|to)\s*\$?\d)/;
const RANGE = /\$\s?\d[\d,]*(?:\.\d{1,2})?\s*(?:-|–|to)\s*\$?\s?\d/;
const PER = /^\s*(?:per|a|an|each|every|\/)\s*([a-z][a-z-]*(?:\s+metres?|\s+meters?|\s+feet)?)/i;
const MINIMUM = /(?:minimum(?:\s+of)?|min\.?|at least)\s+(\d+)/i;
const FROM = /\b(?:from|starting at|starts at|start at)\s*\$/i;

const LEAD_FILLER = /^(?:and\s+|also\s+|our\s+|my\s+|the\s+|a\s+|an\s+)+/i;
const TRAIL_FILLER =
  /\s*(?:will be|would be|is|are|costs?|charged at|priced at|at|for|=|:|-|–)\s*$/i;

/** What Enquiry must learn from an enquiry to count the unit. */
export function quantityFieldFor(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u === "person" || u === "people") return "people";
  return pluraliseUnit(u, 2);
}

function cleanService(raw: string): string {
  let s = raw.trim().replace(/[.,;!]+$/, "");
  s = s.replace(LEAD_FILLER, "");
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(TRAIL_FILLER, "").trim();
  }
  return s ? s[0]!.toUpperCase() + s.slice(1) : "";
}

function splitLines(text: string): string[] {
  return text
    .split(/\n+|(?<=[.;!])\s+(?=[A-Z$])/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function readPriceLine(line: string): ReadPrice | UnreadLine {
  if (FROM.test(line)) {
    return { line, reason: 'A "from" price is not a set price, so Enquiry cannot quote it.' };
  }
  if (RANGE.test(line)) {
    return { line, reason: "A price range is not a set price, so Enquiry cannot quote it." };
  }
  const amountMatch = AMOUNT.exec(line);
  if (!amountMatch) return { line, reason: "There is no dollar amount in it." };
  const amount = Number(amountMatch[1]!.replace(/,/g, ""));
  const before = line.slice(0, amountMatch.index);
  const after = line.slice(amountMatch.index + amountMatch[0].length);

  // "$190 per bedroom for end of lease clean" names the service after the price.
  const forService = /\bfor\s+(?:an?\s+|the\s+)?([^,.;]+)/i.exec(after)?.[1] ?? "";
  const service = cleanService(before) || cleanService(forService);
  if (!service) return { line, reason: "It does not say which service the price is for." };

  const per = PER.exec(after);
  const raw = per
    ? {
        kind: "per_unit",
        service,
        amount,
        currency: "AUD",
        unit: per[1]!.trim().toLowerCase(),
        quantityField: quantityFieldFor(per[1]!),
        minimumQuantity: MINIMUM.exec(after) ? Number(MINIMUM.exec(after)![1]) : undefined,
      }
    : { kind: "fixed_price", service, amount, currency: "AUD" };
  const parsed = parseBusinessRule(raw);
  return parsed.ok ? { line, rule: parsed.rule } : { line, reason: parsed.reason };
}

export function readPriceSentences(text: string): PriceSentences {
  const prices: ReadPrice[] = [];
  const unread: UnreadLine[] = [];
  for (const line of splitLines(text)) {
    const read = readPriceLine(line);
    if ("rule" in read) prices.push(read);
    else unread.push(read);
  }
  return { prices, unread };
}
