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
 *  - one number, written as digits or as a word from one to twelve;
 *  - directly beside a word for the unit the price needs;
 *  - a range ("3-4 bedrooms", "3 or 4 bedrooms") or two different counts is
 *    no reading at all, never the nearer number;
 *  - an approximate marker ("roughly", "about", "~") is kept, so the owner
 *    sees exactly how the customer put it before confirming.
 */

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

const NUM = String.raw`(\d{1,6}(?:\.\d{1,2})?|${Object.keys(NUMBER_WORDS).join("|")})`;

const APPROX = String.raw`(?:roughly|about|around|approx(?:imately|\.)?|approximately|~|circa|nearly|almost|close to|maybe|give or take|just under|just over|over|under)`;

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
  { match: /^(rooms?)$/, words: String.raw`(?:rooms?)` },
  { match: /^(hours?|hrs?)$/, words: String.raw`(?:hours?|hrs?)` },
  {
    match: /^(guests?|people|persons?|person|pax|attendees?|heads?)$/,
    words: String.raw`(?:guests?|people|persons?|pax|attendees?|adults?)`,
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
  const lower = raw.toLowerCase();
  if (lower in NUMBER_WORDS) return NUMBER_WORDS[lower]!;
  const n = Number(lower);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A number just before the match that turns it into a range or a choice. */
const RANGE_BEFORE = new RegExp(
  String.raw`(?:\d|\b(?:${Object.keys(NUMBER_WORDS).join("|")}))\s*(?:-|–|to|or|\/)\s*$`,
  "i",
);

export function readQuantityFromMessage(
  text: string,
  field: string,
  unit = "",
): MessageQuantity | undefined {
  const words = unitWordsFor(field, unit);
  if (!words || !text.trim()) return undefined;

  // "roughly 120 square metres", "2 bed", "4 x bedrooms", "3-bedroom", "120m2".
  const forward = new RegExp(
    String.raw`(?:\b(${APPROX})\s+)?(?<![\w.$])${NUM}(ish)?\s*(?:x\s*)?-?\s*${words}(?![a-z])`,
    "gi",
  );
  // "bedrooms: 3", "bedrooms - 3".
  const labelled = new RegExp(
    String.raw`\b${words}\s*[:=]\s*(?:(${APPROX})\s+)?${NUM}(?!\w|\.\d)`,
    "gi",
  );

  const reads: MessageQuantity[] = [];
  let ranged = false;
  for (const m of text.matchAll(forward)) {
    const before = text.slice(0, m.index);
    if (RANGE_BEFORE.test(before)) {
      ranged = true;
      continue;
    }
    const n = toNumber(m[2]!);
    if (n === null) continue;
    reads.push({
      value: String(n),
      span: m[0].trim(),
      approximate: Boolean(m[1] || m[3]),
    });
  }
  for (const m of text.matchAll(labelled)) {
    const n = toNumber(m[2]!);
    if (n === null) continue;
    reads.push({ value: String(n), span: m[0].trim(), approximate: Boolean(m[1]) });
  }

  if (ranged) return undefined;
  const values = new Set(reads.map((r) => r.value));
  // Two different counts for the same thing: the customer has not said which.
  if (values.size !== 1) return undefined;
  return reads[0];
}
