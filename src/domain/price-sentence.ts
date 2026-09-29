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

export type ReadPrice = {
  line: string;
  rule: BusinessRule;
  /** What the owner said the price includes ("frame"), kept as a note. */
  note?: string;
};
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
    /\b(?:approx\.?|approximately|roughly|or so|give or take)(?![a-z])/i,
    "An approximate price is not a set price, so Enquiry cannot quote it.",
  ],
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
  return `It only applies in some cases ("${word} ..."), so it is a conditional price, not one set price. Put the plain price on its own line if there is one.`;
}

const FEE_REASON =
  "A fee or a minimum is added to a job only in some cases, so Enquiry will not put it on a quote by itself.";
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

/** "Oven clean $90 extra": an add-on price, the same as "Oven clean $90". */
const ADD_ON_TAIL = /\s+(?:extra|additional|add[- ]?on)\s*[.!]*\s*$/i;

/** "up to 3 bedrooms", "the first 3 bedrooms", "3 bedrooms or less". */
const UP_TO =
  /\b(?:(?:for\s+|covers\s+)?(?:up\s+to|the\s+first|first)\s+(\d{1,3})\s+([a-z]+)|(\d{1,3})\s+([a-z]+)\s+or\s+(?:less|fewer|under))\b/i;
/** "extra bedrooms", "each additional bedroom", "per extra bedroom". */
const EXTRA_UNIT = /\b(?:each\s+|every\s+|per\s+|an?\s+)?(?:extra|additional|more)\s+([a-z]+)/i;

/** "after the first 20 km": the price starts after a threshold, it is not a base price. */
const AFTER_FIRST = /\b(?:after|over|beyond|past|above)\s+(?:the\s+)?(?:first|up\s+to)\b/i;

function sameUnit(a: string, b: string): boolean {
  return singular(a) === singular(b) || singular(a).startsWith(singular(b).slice(0, 4));
}

/** The words for a count: "bed" and "bedrooms" are one unit, "bedroom". */
function unitNoun(word: string): string {
  const w = singular(word);
  return w === "bed" || w === "br" || w === "bdrm" ? "bedroom" : w === "bath" ? "bathroom" : w;
}

/**
 * "Regular house clean $160 for up to 3 bedrooms, extra bedrooms $35 each": a
 * price that covers the first few, and a price for each one after. Read as one
 * rule, so a 4 bedroom house is $195 - never $160 with the threshold dropped.
 * Returns null when the line is not this shape.
 */
export function readTieredLine(line: string): ReadPrice | UnreadLine | null {
  const amounts = [...line.matchAll(new RegExp(AMOUNT.source, "g"))];
  const upTo = UP_TO.exec(line);
  if (!upTo || amounts.length !== 2 || AFTER_FIRST.test(line)) return null;
  const extra = EXTRA_UNIT.exec(line);
  const count = Number(upTo[1] ?? upTo[3]);
  const unitWord = upTo[2] ?? upTo[4] ?? "";
  if (!extra || !sameUnit(extra[1]!, unitWord)) {
    return {
      line,
      reason: `It names two amounts but does not say which is for each ${unitNoun(unitWord)} after the first ${count}. Write it as, for example: House clean $160 for up to ${count} ${pluraliseUnit(unitNoun(unitWord), count)}, extra ${pluraliseUnit(unitNoun(unitWord), 2)} $35 each.`,
    };
  }
  // The amount nearest the "extra" words is the price of each one after.
  const extraAt = extra.index ?? 0;
  const [a, b] = amounts as [RegExpMatchArray, RegExpMatchArray];
  const distance = (m: RegExpMatchArray) => Math.abs((m.index ?? 0) - extraAt);
  const rate = distance(a) <= distance(b) ? a : b;
  const base = rate === a ? b : a;
  const service = cleanService(line.slice(0, Math.min(a.index ?? 0, upTo.index ?? 0)));
  if (!service) return { line, reason: "It does not say which service the price is for." };
  const unit = unitNoun(unitWord);
  const parsed = parseBusinessRule({
    kind: "per_unit",
    service,
    amount: Number(rate[1]!.replace(/,/g, "")),
    currency: "AUD",
    unit,
    quantityField: quantityFieldFor(unit),
    base: { amount: Number(base[1]!.replace(/,/g, "")), upTo: count },
  });
  if (!parsed.ok) return { line, reason: parsed.reason };
  return { line, rule: parsed.rule };
}

/** "Regular house clean $160 for up to 3 bedrooms" with nothing for the ones after. */
export function thresholdOnly(line: string): { count: number; unit: string } | null {
  const written = dollarsWritten(line);
  const upTo = UP_TO.exec(written);
  if (
    !upTo ||
    AFTER_FIRST.test(written) ||
    (written.match(ALL_AMOUNTS) ?? []).length !== 1 ||
    EXTRA_UNIT.test(written)
  ) {
    return null;
  }
  return { count: Number(upTo[1] ?? upTo[3]), unit: unitNoun(upTo[2] ?? upTo[4] ?? "") };
}

/** "Extra bedrooms $35 each", "Each additional bedroom $35": the price after a threshold. */
export function extraOnly(line: string): { amount: number; unit: string } | null {
  const written = dollarsWritten(line);
  const m = /^\s*(?:each\s+|every\s+|per\s+|an?\s+)?(?:extra|additional)\s+([a-z]+)\b/i.exec(
    written,
  );
  const amount = AMOUNT.exec(written);
  if (!m || !amount || (written.match(ALL_AMOUNTS) ?? []).length !== 1) return null;
  // "Extra oven clean $90" is its own service; only a counted unit ("extra
  // bedrooms", "each additional hour") follows a threshold.
  const unit = unitNoun(m[1]!);
  const counted = COUNTED_UNITS.has(unit) || /\b(?:each|per)\b/i.test(written);
  if (!counted) return null;
  return { amount: Number(amount[1]!.replace(/,/g, "")), unit };
}

/** Things a price counts in whole units after a threshold. */
const COUNTED_UNITS = new Set([
  "bedroom",
  "bathroom",
  "room",
  "hour",
  "window",
  "person",
  "guest",
  "storey",
  "level",
  "door",
  "toilet",
  "car",
  "pet",
  "kid",
  "child",
]);

export function readPriceLine(original: string): ReadPrice | UnreadLine {
  const tiered = readTieredLine(dollarsWritten(original));
  if (tiered) return { ...tiered, line: original };
  const line = dollarsWritten(original).replace(ADD_ON_TAIL, "");
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
  return { ...read, line: original };
}

/** "(includes frame)", "incl frame", "including the frame": what the price covers. */
const INCLUDES =
  /[,;]?\s*\(?\b(?:incl(?:\.|udes|uding)?|inc\.|inclusive of)\s+([^)]+?)\)?\s*[.;!]?\s*$/i;
/** "2 hr min", "3 hour minimum", "min 2": a minimum count after the unit. */
const MIN_AFTER =
  /(\d+)\s*(?:[a-z]+\s*)?min(?:imum)?\b\.?|\b(?:minimum(?:\s+of)?|min\.?|at least)\s+(\d+)(?:\s*[a-z]+)?/i;

type Priced = { service: string; unit: string; note?: string; min?: number; rest: string };

/** "Each door $90", "Doors each $90": the count named before the price. */
function eachBefore(before: string): { service: string; unit: string } | null {
  const lead = /^\s*each\s+(.+?)\s*[-:=]?\s*$/i.exec(before);
  if (lead) {
    const unit = unitFromService(lead[1]!);
    if (!unit) return null;
    return { service: cleanService(pluraliseUnit(unit, 2)), unit };
  }
  const tail = /^(.+?)\s+each\s*[-:=]?\s*$/i.exec(before);
  if (!tail) return null;
  const service = cleanService(tail[1]!);
  const unit = unitFromService(service);
  return service && unit ? { service, unit } : null;
}

/** The unit, the minimum and a covered-by note, and whatever words are left. */
function unitAndRest(after: string, service: string): Priced {
  let rest = after;
  let note: string | undefined;
  const inc = INCLUDES.exec(rest);
  if (inc) {
    note = inc[1]!.trim();
    rest = rest.slice(0, inc.index);
  }
  const area = PER_AREA.exec(rest);
  const per = area ? null : PER.exec(rest);
  const each = !area && !per ? EACH_ALONE.exec(rest) : null;
  const unit = area
    ? "square metre"
    : each
      ? unitFromService(service)
      : per
        ? unitWord(per[1] ?? "")
        : "";
  const used = area ?? per ?? each;
  if (used) rest = rest.slice((used.index ?? 0) + used[0].length);
  const min = MIN_AFTER.exec(rest);
  if (min && unit) rest = rest.slice(0, min.index) + rest.slice((min.index ?? 0) + min[0].length);
  return {
    service,
    unit,
    ...(note ? { note } : {}),
    ...(min && unit ? { min: Number(min[1] ?? min[2]) } : {}),
    rest,
  };
}

function readSetPrice(line: string): ReadPrice | UnreadLine {
  if ((line.match(ALL_AMOUNTS) ?? []).length > 1) {
    return { line, reason: "It names more than one amount. Put each price on its own line." };
  }
  const amountMatch = AMOUNT.exec(line);
  if (!amountMatch) return { line, reason: "There is no dollar amount in it." };
  const amount = Number(amountMatch[1]!.replace(/,/g, ""));
  const before = line.slice(0, amountMatch.index);
  let after = line.slice(amountMatch.index + amountMatch[0].length);

  const lead = eachBefore(before);
  // "$190 per bedroom for end of lease clean" names the service after the price.
  const forMatch = /\bfor\s+(?:an?\s+|the\s+)?([^,.;]+)/i.exec(after);
  let service = lead?.service || cleanService(before);
  if (!service && forMatch) {
    service = cleanService(forMatch[1] ?? "");
    after = after.slice(0, forMatch.index) + after.slice(forMatch.index + forMatch[0].length);
  }
  if (!service) return { line, reason: "It does not say which service the price is for." };

  const read = lead ? { service, unit: lead.unit, rest: after } : unitAndRest(after, service);
  if (/\beach\b/i.test(after) && !read.unit) {
    return { line, reason: `Say what "each" counts, for example: ${service} $${amount} per item.` };
  }
  // Anything left over is a condition ("for single storey", "homes only"):
  // never dropped, never quietly part of one set price.
  const left = read.rest.replace(/[\s.,;:!()-]+/g, " ").trim();
  if (/[a-z]/i.test(left)) {
    return {
      line,
      reason: `It says "${left}" as well as the price, so it only applies in some cases. To quote it, write it as its own service (for example "${service} (${left})").`,
      note: true,
    };
  }
  const raw = read.unit
    ? {
        kind: "per_unit",
        service,
        amount,
        currency: "AUD",
        unit: read.unit,
        quantityField: quantityFieldFor(read.unit),
        minimumQuantity: "min" in read ? read.min : undefined,
      }
    : { kind: "fixed_price", service, amount, currency: "AUD" };
  const parsed = parseBusinessRule(raw);
  if (!parsed.ok) return { line, reason: parsed.reason };
  return { line, rule: parsed.rule, ...("note" in read && read.note ? { note: read.note } : {}) };
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
