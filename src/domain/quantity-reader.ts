/**
 * Read a count the customer already gave: "roughly 120 square metres",
 * "2 bed", "two bedrooms", "4 x bedrooms".
 *
 * A price per square metre used to end on "Ask for the number of square
 * metres" over a message that said "roughly 120 square metres". Asking a
 * customer for something they already wrote is the fastest way to look like
 * nobody read their message.
 *
 * What this returns is only ever a READING. It is stored as `inferred` and
 * shown to the owner as "From their message: ... Correct?"; the price
 * compiler refuses it until the owner confirms (`price-compiler.ts`,
 * `quantityFrom`). Deliberately narrow and deterministic, no model:
 *
 *  - one number, written as digits or in words ("one hundred and twenty");
 *  - directly beside a word for the unit the price needs;
 *  - a range ("3-4 bedrooms", "3 or 4 bedrooms") or two different counts is
 *    no reading at all, never the nearer number;
 *  - an approximate marker ("roughly", "about", "~") is kept, so the owner
 *    sees exactly how the customer put it before confirming.
 */

import { NUMBER_PHRASE, wordsToNumber } from "./number-words.ts";
import { distinctiveStems, mentionsAny, namesService } from "./service-words.ts";

export type MessageQuantity = {
  /** Digits only, ready to confirm: "120", "2". */
  value: string;
  /** The customer's own words, as written: "roughly 120 square metres". */
  span: string;
  /** The customer hedged it ("roughly", "about", "~", "ish"). */
  approximate: boolean;
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const WORD_NUMBERS = Object.keys(NUMBER_WORDS).join("|");

/**
 * One number: "1,200", "12,000", "1 200", "120", "2.5", or a word from one to
 * twelve. Grouped thousands come first so "1,200" is never read as its last
 * three digits.
 */
const NUM_RAW = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{1,3}(?: \d{3})+(?![\d,])|\d{1,6}(?:\.\d{1,2})?|${NUMBER_PHRASE}`;
const NUM = `(${NUM_RAW})`;

/** "12 Bedroom St" is an address, not twelve bedrooms. */
/**
 * "12 Bedroom St" is an address: a street word after a Capitalised unit
 * word. "our 3 bedroom place" is a count - the unit word is not a name.
 */
const STREET_AFTER =
  /^\s+(?:st|street|rd|road|ave|avenue|court|ct|place|pl|lane|ln|drive|dr|cres|crescent|way|parade|pde|close|cl|tce|terrace|blvd|boulevard|hwy|highway|grove|gr)\b/i;

function isStreet(matched: string, after: string): boolean {
  return STREET_AFTER.test(after) && /\d\s*-?\s*[A-Z]/.test(matched);
}

/** Hedges: the customer means about this many. Kept and shown, never dropped. */
const APPROX = String.raw`(?:roughly|about|around|approximately|approx\.?|~|circa|nearly|almost|close to|maybe|probably|prob|give or take)`;

/**
 * Bounds: "up to 5", "at least 3", "over 100". A bound is not a count, so it
 * is no reading at all rather than a number marked exact.
 */
const BOUND_BEFORE = new RegExp(
  String.raw`\b(?:up to|less than|more than|fewer than|no more than|no less than|not more than|at least|at most|over|under|below|above|min(?:imum)?|max(?:imum)?|just over|just under)\s*$`,
  "i",
);

/** "not 3 bedrooms" is not a count of 3. */
const NEGATED_BEFORE = /\bnot\s+$/i;

/** "2 rooms each 3 metres squared": a per-item size, not the job size. */
const EACH_BEFORE = /\b(?:each|per|every)\s+$/i;
const EACH_AFTER =
  /^\s*(?:each(?!\s+(?:time|visit|clean|week|fortnight|month|session|booking))|apiece|per\b|a piece)/i;
/** "4 hrs prob", "3 hours or so": a hedge after the count. */
const APPROX_AFTER =
  /^\s*(?:prob(?:ably)?\b|or so\b|give or take\b|roughly\b|approx(?:imately)?\b)/i;

/** "3-4", "3 or 4", "between 3 and 4", "4 and 5" before the counted number. */
const RANGE_BEFORE = new RegExp(
  String.raw`(?:\d|\b(?:${WORD_NUMBERS}))\s*(?:-|–|to|or|and|\/)\s*$`,
  "i",
);

/** "one hour or two", "3 bedrooms - 4", after the unit. */
// "3 doors and 2 rooms" is two counts of two things, not a range: after
// "and", a range's second number has no word of its own.
const RANGE_AFTER = new RegExp(
  String.raw`^\s*(?:(?:or|-|–|to|\/)\s*(?:${NUM_RAW})|and\s*(?:${NUM_RAW})(?!\s*(?:x\s*)?[a-z]))`,
  "i",
);

/**
 * A correction just after the count: "not 3 bedrooms, 4", "3 bedrooms, sorry
 * I mean 4". A bare number (no unit of its own) soon after a comma or a
 * "sorry / I mean / actually" is the customer changing their answer.
 */
const CORRECTION_AFTER = new RegExp(
  String.raw`^[^.!?\n]{0,20}?(?:,|;|\bi mean\b|\bsorry\b|\bactually\b|\bmake that\b)\s*(?:(?:sorry|i mean|actually|make that|no)[,\s]*)*(?:${NUM_RAW})\s*(?=$|[.,!?;)]|\binstead\b)`,
  "i",
);

/**
 * Families of words a customer uses for one unit. Matched against the field
 * name the price reads ("square metres") and the unit it is priced per
 * ("square metre"), so an owner's own wording finds the customer's.
 */
const FAMILIES: { match: RegExp; words: string }[] = [
  {
    match: /^(bed|beds|bedroom|bedrooms|bdrm|bdrms|br)$/,
    words: String.raw`(?:bed(?:room)?s?|bdrms?|brs?)`,
  },
  {
    match: /^(bath|baths|bathroom|bathrooms)$/,
    words: String.raw`(?:bath(?:room)?s?)`,
  },
  {
    match: /^(square metres?|square meters?|sqm|m2|m²|sq m|square)$/,
    words: String.raw`(?:square\s*met(?:re|er)s?|sq\.?\s*m(?:et(?:re|er)s?)?|sqm|m2|m²|met(?:re|er)s?\s*squared)`,
  },
  // "3 bedrooms" to paint is three rooms: a reading the owner confirms.
  { match: /^(rooms?)$/, words: String.raw`(?:(?:bed)?rooms?)` },
  { match: /^(hours?|hrs?)$/, words: String.raw`(?:hours?|hrs?)` },
  {
    match: /^(guests?|people|persons?|person|pax|attendees?|heads?)$/,
    // "4 of us", "2 ppl": how people say how many of them there are.
    words: String.raw`(?:guests?|people|persons?|pax|attendees?|adults?|ppl|of\s+us)`,
  },
];

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The alternation of unit words for a field, or null when nothing names it. */
export function unitWordsFor(field: string, unit = ""): string | null {
  const keys = [field, unit].map((k) => k.trim().toLowerCase().replace(/_/g, " ")).filter(Boolean);
  for (const key of keys) {
    const family = FAMILIES.find((f) => f.match.test(key));
    if (family) return family.words;
  }
  const key = keys[0];
  if (!key || key.length < 3) return null;
  // The owner's own word, singular or plural: "windows" finds "6 windows".
  const stem = key.endsWith("s") ? key.slice(0, -1) : key;
  return String.raw`(?:${escape(stem).replace(/\s+/g, String.raw`\s+`)}s?)`;
}

function toNumber(raw: string): number | null {
  const lower = raw.toLowerCase().trim();
  if (lower in NUMBER_WORDS) return NUMBER_WORDS[lower]!;
  if (/^[a-z]/.test(lower)) {
    const n = wordsToNumber(lower);
    return n !== null && n > 0 ? n : null;
  }
  // Thousands separators are grouping, not decimals: "1,200" and "1 200" are 1200.
  const n = Number(lower.replace(/[, ]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Which service a count belongs to, when the message asks for more than one
 * priced by the same unit: "120 square metres of wall, plus the ceilings in
 * the lounge, about 45 sqm". A count belongs to the service named in its own
 * clause, or failing that in the nearest clause before it in the same
 * sentence ("plus the ceilings ..., about 45 sqm").
 */
export type QuantityContext = {
  /** The service this count is being read for. */
  service: string;
  /** Other services the message asks for, priced by the same kind of count. */
  others: readonly string[];
};

type Tie = "this" | "other" | "both" | "none";

const CLAUSE_BREAK = /[,;]|\s-\s|\s–\s|\bplus\b|\bas well as\b|\balso\b|\balong with\b/gi;

function clausesBefore(text: string, index: number): string[] {
  const start =
    Math.max(
      text.lastIndexOf(".", index - 1),
      text.lastIndexOf("!", index - 1),
      text.lastIndexOf("?", index - 1),
      text.lastIndexOf("\n", index - 1),
    ) + 1;
  const endRel = text.slice(index).search(/[.!?\n](?!\d)/);
  const end = endRel === -1 ? text.length : index + endRel;
  const sentence = text.slice(start, end);
  const at = index - start;
  const cuts = [0];
  for (const m of sentence.matchAll(CLAUSE_BREAK)) cuts.push(m.index ?? 0);
  cuts.push(sentence.length);
  const clauses: { from: number; to: number }[] = [];
  for (let i = 0; i < cuts.length - 1; i += 1) clauses.push({ from: cuts[i]!, to: cuts[i + 1]! });
  const own = clauses.findIndex((c) => at >= c.from && at < c.to);
  // Own clause first, then the ones before it, nearest first.
  return clauses
    .slice(0, own + 1)
    .reverse()
    .map((c) => sentence.slice(c.from, c.to));
}

function tieOf(text: string, index: number, spanLength: number, context: QuantityContext): Tie {
  const mine = distinctiveStems(context.service, context.others);
  const theirs = context.others.map((o) =>
    distinctiveStems(o, [context.service, ...context.others.filter((x) => x !== o)]),
  );
  const clauses = clausesBefore(text, index);
  // The clause the number sits in also runs on after it: "45 sqm of ceiling".
  // It stops at the end of its own sentence: "Ceilings 45 sqm. Walls 120 sqm".
  const sentenceTail = text.slice(index + spanLength).split(/[.!?\n]/)[0] ?? "";
  const tail = sentenceTail.split(CLAUSE_BREAK)[0] ?? "";
  if (clauses[0] !== undefined) clauses[0] = `${clauses[0]}${tail}`;
  for (const clause of clauses) {
    const isMine = mentionsAny(clause, mine);
    const isTheirs = theirs.some((stems) => mentionsAny(clause, stems));
    if (isMine && isTheirs) return "both";
    if (isMine) return "this";
    if (isTheirs) return "other";
  }
  return "none";
}

/**
 * Whether two prices read the same kind of count from a message: "3 bedrooms"
 * could be an end of lease clean's bedrooms or a carpet clean's rooms, while
 * an hourly price never competes with a price per square metre.
 */
export function sameCountWords(
  a: { field: string; unit?: string },
  b: { field: string; unit?: string },
): boolean {
  const wa = unitWordsFor(a.field.replace(/\s+for\s+.*$/i, ""), a.unit ?? "");
  const wb = unitWordsFor(b.field.replace(/\s+for\s+.*$/i, ""), b.unit ?? "");
  if (!wa || !wb) return false;
  const rooms = (w: string) => /bed|room/.test(w);
  return wa === wb || (rooms(wa) && rooms(wb));
}

/** One person named: "bride", "mum", "me", "my sister", "the flower girl". */
const ONE_PERSON =
  /^(?:(?:my|the|our|her|his)\s+)?(?:me|myself|bride|groom|mum|mom|mother|dad|father|sister|brother|daughter|son|aunt|auntie|grandma|nan|nanna|friend|partner|husband|wife|flower\s+girl|maid\s+of\s+honou?r|mother\s+of\s+the\s+(?:bride|groom)|mil|mob|mog)$/i;
/** Several named by a number: "2 bridesmaids", "three friends". */
const SEVERAL =
  /^(\d{1,2}|two|three|four|five|six|seven|eight|nine|ten)\s+(?:bridesmaids?|sisters?|friends?|girls?|kids?|children|daughters?|flower\s+girls?|guests?|people|others?|more)$/i;
/** "for bride + mum + 2 bridesmaids", "for me, mum and 3 bridesmaids". */
const PEOPLE_LIST =
  /\bfor\s+((?:[a-z0-9]+(?:\s+[a-z]+){0,3})(?:\s*(?:\+|,|&|\band\b|\bplus\b|\bn\b)\s*(?:[a-z0-9]+(?:\s+[a-z]+){0,3}))+)/i;

/**
 * The people a message lists by who they are, added up: "bride + mum + 2
 * bridesmaids" is 4. Only when every part of the list is a person, so "for me
 * and the kitchen" is never read as a count.
 */
function peopleListed(text: string): MessageQuantity | undefined {
  const m = PEOPLE_LIST.exec(text);
  if (!m) return undefined;
  const parts = m[1]!
    .split(/\s*(?:\+|,|&|\band\b|\bplus\b|\bn\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  let total = 0;
  for (const part of parts) {
    if (ONE_PERSON.test(part)) {
      total += 1;
      continue;
    }
    const several = SEVERAL.exec(part);
    const n = several ? toNumber(several[1]!) : null;
    if (n === null) return undefined;
    total += n;
  }
  return parts.length >= 2 && total >= 2
    ? { value: String(total), span: m[1]!.trim(), approximate: false }
    : undefined;
}

/** Units that measure an amount rather than count things. */
const MEASURE_UNIT = /metre|meter|sq|m2|m²|hour|hr|day|minute|kg|litre|people|person|guest/i;

export function readQuantityFromMessage(
  text: string,
  field: string,
  unit = "",
  context?: QuantityContext,
): MessageQuantity | undefined {
  // "square metres for ceilings" is the count for one of several services;
  // the unit words are the same as for "square metres".
  const words = unitWordsFor(field.replace(/\s+for\s+.*$/i, ""), unit);
  if (!words || !text.trim()) return undefined;

  // "roughly 120 square metres", "2 bed", "4 x bedrooms", "3-bedroom", "120m2".
  // Not after a word character, a decimal point, a dollar sign, a thousands
  // comma or a digit and space, so no number is ever read from its own tail.
  const forward = new RegExp(
    String.raw`(?:\b(${APPROX})\s+)?(?<![\w.$,])(?<!\d )${NUM}(ish)?\s*(?:x\s*)?-?\s*${words}(?![a-z])`,
    "gi",
  );
  // "bedrooms: 3", "bedrooms - 3", "windows x12", "x12 windows".
  const labelled = new RegExp(
    String.raw`\b${words}\s*(?:[:=]|x(?=\s*\d))\s*(?:(${APPROX})\s+)?${NUM}(?!\w|\.\d|,\d)`,
    "gi",
  );
  const timesFirst = new RegExp(String.raw`\bx\s*(\d{1,4})\s+${words}(?![a-z])`, "gi");

  const reads: (MessageQuantity & { index: number; length: number })[] = [];
  let ranged = false;
  for (const m of text.matchAll(forward)) {
    const index = m.index ?? 0;
    const before = text.slice(0, index);
    const after = text.slice(index + m[0].length);
    if (isStreet(m[0], after)) continue;
    if (
      RANGE_BEFORE.test(before) ||
      BOUND_BEFORE.test(before) ||
      NEGATED_BEFORE.test(before) ||
      EACH_BEFORE.test(before) ||
      EACH_AFTER.test(after) ||
      RANGE_AFTER.test(after) ||
      CORRECTION_AFTER.test(after)
    ) {
      ranged = true;
      continue;
    }
    const n = toNumber(m[2]!);
    if (n === null) continue;
    const hedge = APPROX_AFTER.exec(after)?.[0].trim();
    reads.push({
      value: String(n),
      // Exactly what the customer wrote, so the owner confirms their words:
      // "4 hrs prob" keeps its "prob".
      span: hedge ? `${m[0].trim()} ${hedge}` : m[0].trim(),
      approximate: Boolean(m[1] || m[3] || hedge),
      index,
      length: m[0].length,
    });
  }
  for (const m of text.matchAll(timesFirst)) {
    const n = toNumber(m[1]!);
    if (n === null) continue;
    reads.push({
      value: String(n),
      span: m[0].trim(),
      approximate: false,
      index: m.index ?? 0,
      length: m[0].length,
    });
  }
  for (const m of text.matchAll(labelled)) {
    const n = toNumber(m[2]!);
    if (n === null) continue;
    reads.push({
      value: String(n),
      span: m[0].trim(),
      approximate: Boolean(m[1]),
      index: m.index ?? 0,
      length: m[0].length,
    });
  }

  // "can you clean my windows? Only 3 small ones": the count stands in for
  // the thing just named, so it is read when the unit word is in the message.
  if (reads.length === 0 && new RegExp(String.raw`\b${words}(?![a-z])`, "i").test(text)) {
    const ones = new RegExp(
      String.raw`(?:\b(${APPROX})\s+)?(?<![\w.$,])${NUM}\s+(?:(?:small|big|large|little|tiny|medium|normal|standard)\s+)?ones\b`,
      "gi",
    );
    for (const m of text.matchAll(ones)) {
      const n = toNumber(m[2]!);
      if (n === null) continue;
      reads.push({
        value: String(n),
        span: m[0].trim(),
        approximate: Boolean(m[1]),
        index: m.index ?? 0,
        length: m[0].length,
      });
    }
  }
  // "for bride + mum + 2 bridesmaids": the people listed, added up.
  if (reads.length === 0 && /people|guest|person/.test(words)) {
    const listed = peopleListed(text);
    if (listed) reads.push({ ...listed, index: 0, length: 0 });
  }
  if (ranged) return undefined;
  let candidates = reads;
  if (context && context.others.length > 0) {
    // Several services priced by this unit: a count counts only when it is
    // tied to this one. Anything untied or tied to both is a question.
    const ties = reads.map((r) => tieOf(text, r.index, r.length, context));
    // "feature wall + ceiling in 1 room": a count of things (rooms, doors)
    // written for both services belongs to both. A measure (square metres,
    // hours) written once for two services is never split or doubled.
    const shared = !MEASURE_UNIT.test(`${unit} ${field}`);
    if (ties.some((t) => t === "both") && !shared) return undefined;
    candidates = reads.filter((_, i) => ties[i] === "this" || ties[i] === "both");
    // "House is 5 bedrooms ... carpets in the 4 bedrooms upstairs": the other
    // service has its own count, so the one tied to neither is this job's.
    if (candidates.length === 0 && ties.includes("other")) {
      candidates = reads.filter((_, i) => ties[i] === "none");
    }
  }
  const values = new Set(candidates.map((r) => r.value));
  // Two different counts for the same thing: the customer has not said which.
  if (values.size !== 1) return undefined;
  const { value, span, approximate } = candidates[0]!;
  return { value, span, approximate };
}

/**
 * The tie context for reading one service's count: only the other services
 * this message actually names count as competitors. A message that names
 * none of them reads exactly as before.
 */
export function quantityContextFor(
  text: string,
  service: string,
  knownServices: readonly string[],
): QuantityContext | undefined {
  const main = service.trim();
  if (!main) return undefined;
  const others = [
    ...new Set(
      knownServices.map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== main.toLowerCase()),
    ),
    // Named, not just one shared word: "our house" does not ask for the
    // regular house clean, so it does not compete for a painting count.
  ].filter((o) => namesService(text, o) && mentionsAny(text, distinctiveStems(o, [main])));
  return others.length ? { service: main, others } : undefined;
}
