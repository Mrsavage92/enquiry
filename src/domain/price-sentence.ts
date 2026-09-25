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

const AMOUNT = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)/;
const ALL_AMOUNTS = /\$\s?\d/g;
// A word boundary after the word, so "an hour" is not read as the unit "n".
const PER =
  /^\s*(?:(?:per|a|an|each|every)\b|\/)\s*([a-z][a-z-]*(?:\s+metres?|\s+meters?|\s+feet)?)/i;
const MINIMUM = /(?:minimum(?:\s+of)?|min\.?|at least)\s+(\d+)/i;
/**
 * Area written the ways owners write it: "per sqm", "/m2", "per m²", "per
 * sq m", "per square meter". All of it is one unit, "square metre", so the
 * question to the customer reads "the number of square metres", never "the
 * number of sqms" or "ms".
 */
const PER_AREA =
  /^\s*(?:(?:per|a|an|each|every)\b|\/)\s*(?:m²|m2\b|sq\.?\s*m(?:s|etres?|eters?)?\b|sqms?\b|square\s+(?:metre|meter)s?\b|(?:metre|meter)s?\s+squared\b)/i;

/**
 * Wording that makes the amount something other than one set price. Each is
 * refused with its reason rather than read as the nearest number: a price the
 * owner did not mean is worse than no price.
 */
const NOT_A_SET_PRICE: [RegExp, string][] = [
  [
    /\b(?:from|starting at|starts at|start at)\s*\$/i,
    'A "from" price is not a set price, so Enquiry cannot quote it.',
  ],
  [
    /\b(?:about|around|approx(?:imately)?|roughly|up to|between|under|over)\s*\$|~\s*\$/i,
    "An approximate price is not a set price, so Enquiry cannot quote it.",
  ],
  [
    /\$\s?\d[\d,.]*\s?(?:k\b|ish\b)/i,
    "Write the full amount (like $1,500), not a short or rough one.",
  ],
  [/\bGST\b/i, "GST wording makes the amount unclear. Write the one amount you quote."],
  [
    /\$\s?\d[\d,]*(?:\.\d{1,2})?\s*(?:-|–|to)\s*\$?\s?\d/,
    "A price range is not a set price, so Enquiry cannot quote it.",
  ],
  [
    /\+|\bplus\b|\bor\b/i,
    "It adds another amount or offers a choice. Put each price on its own line.",
  ],
];

const LEAD_FILLER =
  /^(?:and\s+|also\s+|our\s+|my\s+|the\s+|a\s+|an\s+|fixed price\s+|fixed\s+|flat rate\s+|flat fee\s+|flat\s+)+/i;

/** "$120 if it is really dirty", "$40 per pet (dogs only)": a price with a condition. */
const CONDITIONAL = /\b(?:if|when|unless|depending|depends|provided|only|except)\b/i;
// Whole words only: "flat" is not "fl" + "at".
const TRAIL_FILLER =
  /(?:(?:^|\s+)(?:will be|would be|is|are|costs?|charged at|priced at|at|for|flat rate|flat fee|flat|fixed price|fixed)|\s*(?:=|:|-|–))\s*$/i;

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

/** Short unit spellings as a customer would read them back: "m" is "metre". */
const UNIT_WORDS: Record<string, string> = {
  m: "metre",
  lm: "linear metre",
  hr: "hour",
  hrs: "hour",
  h: "hour",
  rm: "room",
};

function unitWord(raw: string): string {
  const u = raw.trim().toLowerCase();
  return UNIT_WORDS[u] ?? u;
}

export function readPriceLine(line: string): ReadPrice | UnreadLine {
  const condition = CONDITIONAL.exec(line);
  if (condition) {
    const word = condition[0].replace(/[()]/g, "").trim().toLowerCase() || "only";
    return {
      line,
      reason: `It only applies in some cases ("${word} ..."), so it is a conditional price, not one set price. Save the plain price on its own line and handle the condition yourself.`,
    };
  }
  for (const [pattern, reason] of NOT_A_SET_PRICE) {
    if (pattern.test(line)) return { line, reason };
  }
  if ((line.match(ALL_AMOUNTS) ?? []).length > 1) {
    return { line, reason: "It names more than one amount. Put each price on its own line." };
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

  const area = PER_AREA.test(after);
  const per = area ? null : PER.exec(after);
  const unit = area ? "square metre" : unitWord(per?.[1] ?? "");
  const raw = unit
    ? {
        kind: "per_unit",
        service,
        amount,
        currency: "AUD",
        unit,
        quantityField: quantityFieldFor(unit),
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
