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
/**
 * A line Enquiry will not save as a price. `note` marks a price that only
 * applies in some cases (a condition, a fee, a minimum): the owner is offered
 * to keep it as a note Enquiry shows on the enquiries it concerns, never as a
 * price Enquiry adds by itself.
 */
export type UnreadLine = { line: string; reason: string; note?: true };
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

/**
 * "$120 if it is really dirty", "$40 per pet (dogs only)", "not available on
 * weekends", "outside Brisbane northside", "for jobs over $500": the price
 * holds only in some cases. Every one is refused the same way, with the words
 * quoted, and offered as a note.
 */
const CONDITIONAL =
  /\b(?:if|when|unless|depending|depends|provided|only|except|outside|not available|unavailable|weekends?|weekdays?|saturdays?|sundays?|after hours|public holidays?|surcharge|for jobs? (?:over|under|above|below|of)|on top)\b/i;

/** A fee or a minimum is added to a job in some cases; it is not a job itself. */
const FEE_SERVICE =
  /\b(?:fees?|call[- ]?outs?|surcharges?|minimum|min|travel|deposit|levy|booking charge)\b/i;

/** "65 dollars", "65 bucks", "AUD 65", "A$65": written as "$65" before reading. */
function dollarsWritten(line: string): string {
  return line
    .replace(/(\d[\d,]*(?:\.\d{1,2})?)\s*(?:dollars?|bucks|aud)\b/gi, "$$$1")
    .replace(/\b(?:aud|a\$)\s?(?=\d)/gi, "$$");
}

/** A bare "each" after the amount: "Doors $90 each". */
const EACH_ALONE = /^\s*(?:each|ea\.?|apiece|a piece)\b\s*(?:[.,;!)]|$)/i;

/** Words that name the work, not the thing counted: "Oven clean" counts ovens. */
const WORK_WORDS = new Set([
  "clean",
  "cleaning",
  "cleans",
  "paint",
  "painting",
  "wash",
  "washing",
  "repair",
  "repairs",
  "staining",
  "stain",
  "install",
  "installation",
  "service",
  "servicing",
  "polish",
  "replacement",
  "removal",
  "steam",
  "respray",
]);

function singular(word: string): string {
  const w = word.toLowerCase();
  if (/ies$/.test(w)) return `${w.slice(0, -3)}y`;
  if (/(?:ss|us)$/.test(w)) return w;
  if (/(?:ch|sh|x)es$/.test(w)) return w.slice(0, -2);
  return w.replace(/s$/, "");
}

/** "Doors" -> "door", "Oven clean" -> "oven": what a bare "each" counts. */
export function unitFromService(service: string): string {
  const words = service
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  const things = words.filter((w) => !WORK_WORDS.has(w));
  const last = things[things.length - 1];
  return last && last.length >= 3 ? singular(last) : "";
}

function conditionReason(word: string): string {
  return `It only applies in some cases ("${word} ..."), so it is a conditional price, not one set price. Enquiry will not quote it by itself. Save it as a note Enquiry shows you, and put the plain price on its own line if there is one.`;
}

const FEE_REASON =
  "A fee or a minimum is added to a job only in some cases, so Enquiry will not put it on a quote by itself. Save it as a note Enquiry shows you on each quote.";
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

export function splitLines(text: string): string[] {
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

export function readPriceLine(original: string): ReadPrice | UnreadLine {
  const line = dollarsWritten(original);
  const condition = CONDITIONAL.exec(line);
  if (condition && AMOUNT.test(line)) {
    const word = condition[0].replace(/[()]/g, "").trim().toLowerCase() || "only";
    return { line: original, reason: conditionReason(word), note: true };
  }
  for (const [pattern, reason] of NOT_A_SET_PRICE) {
    if (pattern.test(line)) return { line: original, reason };
  }
  const read = readSetPrice(line);
  if (!("rule" in read)) return { ...read, line: original };
  if (FEE_SERVICE.test(read.rule.service)) {
    return { line: original, reason: FEE_REASON, note: true };
  }
  // "minimum 3" belongs to a price per something; anywhere else it is a condition.
  if (read.rule.kind === "fixed_price" && /\bmin(?:imum)?\b/i.test(line)) {
    return { line: original, reason: conditionReason("minimum"), note: true };
  }
  return { line: original, rule: read.rule };
}

function readSetPrice(line: string): ReadPrice | UnreadLine {
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
  const each = !area && !per && EACH_ALONE.test(after);
  const unit = area ? "square metre" : each ? unitFromService(service) : unitWord(per?.[1] ?? "");
  if (each && !unit) {
    return { line, reason: `Say what "each" counts, for example: ${service} $${amount} per item.` };
  }
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
