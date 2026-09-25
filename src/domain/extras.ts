import { distinctiveStems, mentionsAny, serviceWords, stem, stemsOf } from "./service-words.ts";

/**
 * A second thing the customer asked for, beside the main service.
 *
 * "End of lease clean for a four bedroom house ... plus oven please" used to
 * be quoted at $760 for the clean with the oven silently gone - a total that
 * told the customer something that was not true about what they had asked
 * for. Every extra read here is only a READING: it is stored as an `inferred`
 * fact and the owner either adds it to the quote or leaves it out and says
 * so. Nothing here prices anything.
 *
 * Two ways a message asks for more:
 *
 *  - it names another of the business's own services ("... and the ceilings");
 *  - it asks for something after "plus", "as well as", "also need" and so on
 *    that no service covers ("plus oven please" with no oven price).
 */

export const EXTRA_PREFIX = "extra:";

/** The owner's choice about one extra. */
export const EXTRA_CHOICE = {
  include: "include",
  leaveOut: "leave_out",
  /** Enquiry misread the message: nothing is added and the reply says nothing. */
  notAsked: "not_asked",
} as const;

export type ExtraRequest = {
  /** How it is named: the saved service ("Oven clean") or the customer's thing ("oven cleaning"). */
  label: string;
  /** Set when it is one of the business's saved services. */
  service?: string;
  /** The customer's own words it was read from. */
  span: string;
};

export function extraField(label: string): string {
  return `${EXTRA_PREFIX}${label}`;
}

export function isExtraField(field: string): boolean {
  return field.trim().toLowerCase().startsWith(EXTRA_PREFIX);
}

export function extraLabel(field: string): string {
  return field.trim().slice(EXTRA_PREFIX.length).trim();
}

/** The count a per-unit extra needs, kept apart from the main service's count. */
export function extraQuantityField(quantityField: string, service: string): string {
  return `${quantityField} for ${service.toLowerCase()}`;
}

/** "square metres for ceilings" -> { field: "square metres", service: "ceilings" }. */
export function splitExtraQuantityField(field: string): { field: string; service: string } | null {
  const m = /^(.+?)\s+for\s+(.+)$/i.exec(field.trim());
  return m ? { field: m[1]!, service: m[2]! } : null;
}

/**
 * A sentence that turns the thing down or talks about it rather than asking:
 * "The carpets are fine, no carpet clean needed", "don't need the oven",
 * "the window cleaner came last week".
 */
const DECLINED = /\b(?:no|not|don'?t|do not|doesn'?t|without|except|skip|minus|fine|already)\b/i;
const NOT_A_REQUEST =
  /\b(?:came|did|was|were|had|last (?:week|time|month|year)|yesterday|ago|already|previously|used to)\b/i;

const CONNECTOR =
  /\b(?:plus|as well as|along with|and also|also\s+(?:clean|need|want|get|include|add|quote(?:\s+for)?)|(?:can|could)\s+(?:you|u)\s+(?:also\s+)?(?:add|include|throw\s+in))\s+(?:(?:the|a|an|my|our|your|some)\s+)?([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,2})/gi;

/**
 * What a real extra ends on: the end of the sentence, "please", "too", "as
 * well", a sign-off. "plus my partner will let you in" runs on into a verb and
 * is not a thing to price.
 */
const EXTRA_END =
  /^\s*(?:$|[.,!?;\n)]|please\b|pls\b|too\b|as well\b|thanks?\b|thx\b|cheers\b|if (?:you|u) can\b)/i;

/**
 * Things a customer asks to have done on top of the main job. A phrase that
 * names none of these (and no saved service) is read as nothing, never as an
 * extra - "the kids", "us moving out", "Saturday morning".
 */
const SERVICE_NOUNS = new Set([
  "oven",
  "ovens",
  "rangehood",
  "fridge",
  "fridges",
  "freezer",
  "microwave",
  "dishwasher",
  "carpet",
  "carpets",
  "rug",
  "rugs",
  "upholstery",
  "couch",
  "couches",
  "sofa",
  "mattress",
  "mattresses",
  "curtain",
  "curtains",
  "blind",
  "blinds",
  "window",
  "windows",
  "flyscreen",
  "flyscreens",
  "screens",
  "tracks",
  "wall",
  "walls",
  "ceiling",
  "ceilings",
  "skirting",
  "skirtings",
  "skirting boards",
  "trim",
  "doors",
  "door",
  "frames",
  "architraves",
  "deck",
  "decking",
  "fence",
  "fences",
  "gate",
  "eaves",
  "gutter",
  "gutters",
  "roof",
  "garage",
  "shed",
  "balcony",
  "patio",
  "driveway",
  "pavers",
  "tiles",
  "grout",
  "bbq",
  "barbecue",
  "pool",
  "lawn",
  "lawns",
  "hedge",
  "hedges",
  "garden",
  "gardens",
  "walls",
  "facade",
  "cabinets",
  "cupboards",
  "wardrobes",
  "vents",
  "fans",
  "lights",
  "brows",
  "lashes",
  "nails",
  "makeup",
  "hair",
  "tan",
  "trial",
]);

/** Where a thing asked for ends: "oven please", "carpets if you can". */
const STOP_WORDS = new Set([
  "please",
  "pls",
  "if",
  "for",
  "too",
  "thanks",
  "thank",
  "cheers",
  "as",
  "and",
  "on",
  "at",
  "in",
  "by",
  "while",
  "when",
  "can",
  "could",
  "would",
  "i",
  "we",
  "it",
  "is",
  "are",
  "that",
  "this",
  "with",
  "to",
  "of",
  "done",
  "cleaned",
  "painted",
  "also",
  "thx",
  "you",
  "u",
  "ya",
  "guys",
  "have",
  "has",
  "do",
  "does",
  "there",
  "any",
  "them",
  "those",
  "these",
  "get",
  "need",
  "want",
  "my",
  "our",
  "us",
  "me",
  "they",
  "he",
  "she",
  "will",
  "be",
  "let",
  "moving",
  "home",
  "who",
  "which",
  "was",
  "were",
  "had",
  "going",
  "coming",
  "leaving",
  "there",
  "here",
]);

/** Never a thing to price on its own: units, fees and filler. */
const NOT_AN_EXTRA = new Set([
  "gst",
  "tax",
  "travel",
  "fee",
  "fees",
  "cost",
  "costs",
  "price",
  "quote",
  "thing",
  "things",
  "stuff",
  "everything",
  "anything",
  "more",
  "extra",
  "extras",
  "bed",
  "beds",
  "bedroom",
  "bedrooms",
  "bath",
  "baths",
  "bathroom",
  "bathrooms",
  "room",
  "rooms",
  "sqm",
  "metres",
  "meters",
  "hours",
  "hour",
  "people",
  "guests",
  "day",
  "days",
  "week",
  "weeks",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
]);

/** "clean" -> "cleaning", for naming "oven cleaning" beside an end of lease clean. */
const ACTIVITIES: Record<string, string> = {
  clean: "cleaning",
  cleaning: "cleaning",
  paint: "painting",
  painting: "painting",
  wash: "washing",
  washing: "washing",
  polish: "polishing",
  polishing: "polishing",
  repair: "repairs",
  repairs: "repairs",
};

function activityOf(primary: string): string | undefined {
  for (const w of primary.toLowerCase().split(/[^a-z]+/)) {
    if (ACTIVITIES[w]) return ACTIVITIES[w];
  }
  return undefined;
}

function sentenceAround(text: string, index: number): string {
  const before = text.slice(0, index);
  const start = Math.max(...[".", "!", "?", "\n", ","].map((b) => before.lastIndexOf(b))) + 1;
  const rest = text.slice(index);
  const endRel = rest.search(/[.!?\n,]/);
  return text.slice(start, endRel === -1 ? text.length : index + endRel).trim();
}

/** The whole sentence (to . ! ? or a new line) around an index. */
function wholeSentence(text: string, index: number): string {
  const before = text.slice(0, index);
  const start = Math.max(...[".", "!", "?", "\n"].map((b) => before.lastIndexOf(b))) + 1;
  const rest = text.slice(index);
  const endRel = rest.search(/[.!?\n]/);
  return text.slice(start, endRel === -1 ? text.length : index + endRel);
}

/** The clause holding the first mention of one of these stems. */
function mentionAt(text: string, stems: readonly string[]): number {
  const re = /[a-z]+/gi;
  for (const m of text.matchAll(re)) {
    if (stems.includes(stem(m[0].toLowerCase()))) return m.index ?? 0;
  }
  return -1;
}

/**
 * Other things this message asks for beside `primary`, in the order written.
 * `services` is every service the business prices or lists.
 */
export function readExtraRequests(
  text: string,
  primary: string,
  services: readonly string[],
): ExtraRequest[] {
  const main = primary.trim();
  if (!main || !text.trim()) return [];
  const mainKey = main.toLowerCase();
  const others = [
    ...new Set(services.map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== mainKey)),
  ];
  const out: ExtraRequest[] = [];
  const seen = new Set<string>();
  const said = new Set(stemsOf(text));

  // 1. Another saved service the message names in full, by words of its own.
  for (const service of others) {
    const need = [...new Set(stemsOf(service))];
    if (need.length === 0 || !need.every((s) => said.has(s))) continue;
    const own = distinctiveStems(service, [main]);
    if (own.length === 0 || !mentionsAny(text, own)) continue;
    const at = mentionAt(text, own);
    const clause = sentenceAround(text, at);
    const sentence = wholeSentence(text, at);
    if (DECLINED.test(sentence) || NOT_A_REQUEST.test(sentence)) continue;
    // A service whose name sits inside the main one ("Clean" beside "End of
    // lease clean") is the main job, not a second one.
    if (own.every((s) => stemsOf(main).includes(s))) continue;
    seen.add(service.toLowerCase());
    out.push({ label: service, service, span: clause });
  }

  // 2. Something asked for after "plus" / "as well as" that no service names.
  const activity = activityOf(main);
  const mainStems = new Set(stemsOf(main));
  for (const m of text.matchAll(CONNECTOR)) {
    const raw = (m[1] ?? "").toLowerCase();
    const words: string[] = [];
    for (const w of raw.split(/\s+/)) {
      if (!w || STOP_WORDS.has(w)) break;
      words.push(w);
    }
    if (words.length === 0) continue;
    if (words.some((w) => NOT_AN_EXTRA.has(w) || /^\d/.test(w))) continue;
    const thing = words.join(" ");
    // The phrase has to end where a request ends, not run on into a verb.
    const phraseAt = (m.index ?? 0) + m[0].length - raw.length;
    const afterPhrase = text.slice(phraseAt + thing.length);
    if (!EXTRA_END.test(afterPhrase)) continue;
    const sentence = wholeSentence(text, m.index ?? 0);
    if (NOT_A_REQUEST.test(sentence)) continue;
    // The main job again ("plus the clean"): not an extra.
    if (serviceWords(thing).every((w) => mainStems.has(stem(w)))) continue;
    // Already found as a saved service.
    const named = others.find((s) =>
      distinctiveStems(s, [main]).some((st) => serviceWords(thing).map(stem).includes(st)),
    );
    if (named) {
      if (!seen.has(named.toLowerCase())) {
        seen.add(named.toLowerCase());
        out.push({ label: named, service: named, span: m[0].trim() });
      }
      continue;
    }
    // Only something a business does: never "the kids" or "Saturday morning".
    const head = words[words.length - 1]!;
    if (!SERVICE_NOUNS.has(head) && !SERVICE_NOUNS.has(thing)) continue;
    const label = activity && !/ing$|s$/.test(head) ? `${thing} ${activity}` : thing;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, span: m[0].trim() });
  }
  return out;
}
