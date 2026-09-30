import {
  distinctiveStems,
  mentionsAny,
  serviceWords,
  stem,
  stemsOf,
  withoutNegated,
} from "./service-words.ts";
import { fitsTrade } from "./trades.ts";

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
  /**
   * Something they asked for that the owner does not price yet: nothing goes
   * on the total, and the reply says "I'll come back to you on the deck
   * staining." Never a made-up price.
   */
  comeBack: "come_back",
  /** Already part of the job priced ("walls and ceilings" in a repaint): no line, nothing said. */
  covered: "covered",
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
/** "not sure of the size", "don't know how big": unsure, not a no. */
export const DECLINED =
  /\b(?:no(?!\s+idea)|not(?!\s+(?:sure|certain|exactly|too sure|100%?))|don'?t(?!\s+know)|do not(?!\s+know)|doesn'?t|without|except|skip|minus|fine|already)\b/i;
export const NOT_A_REQUEST =
  /\b(?:came|did|was|were|had|last (?:week|time|month|year)|yesterday|ago|already|previously|used to)\b/i;

// "+ oven + windows" is a list of things asked for, the same as "plus".
const CONNECTOR =
  /(?:\+|\b(?:plus|as well as|along with|and also|also\s+(?:clean|need|want|get|include|add|like|love|quote(?:\s+for)?)|(?:would|we'?d|i'?d)\s+also\s+like|also(?=,?\s+(?:the|a|an|my|our|some)\b),?|(?:can|could)\s+(?:you|u)\s+(?:also\s+)?(?:add|include|throw\s+in)))\s*(?:(?:the|a|an|my|our|your|some)\s+)?([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,2})/gi;

/** Words that describe, never the thing itself: "also a big thank you". */
const NOT_A_THING = new Set([
  "big",
  "small",
  "quick",
  "huge",
  "little",
  "good",
  "great",
  "nice",
  "lovely",
  "happy",
  "keen",
  "new",
  "old",
  "same",
  "other",
  "question",
  "thank",
  "thanks",
  "morning",
  "mornings",
  "afternoon",
  "arvo",
  "evening",
  "night",
  "weekend",
  "possible",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

/** "the deck, which needs staining": the work named for the thing itself. */
const NEAR_ACTIVITY =
  /^[^.!?\n]{0,40}?\b(stain|oil|sand|seal|clean|paint|wash|polish|repair|steam)(?:s|ed|ing)?\b/i;
const ACTIVITY_NOUN: Record<string, string> = {
  stain: "staining",
  oil: "oiling",
  sand: "sanding",
  seal: "sealing",
  clean: "cleaning",
  paint: "painting",
  wash: "washing",
  polish: "polishing",
  repair: "repairs",
  steam: "steam cleaning",
};

/**
 * What a real extra ends on: the end of the sentence, "please", "too", "as
 * well", a sign-off. "plus my partner will let you in" runs on into a verb and
 * is not a thing to price.
 */
const EXTRA_END =
  /^\s*(?:$|[.,!?;\n()+]|please\b|pls\b|too\b|as well\b|thanks?\b|thx\b|cheers\b|if (?:you|u) can\b|(?:in|for|on)\s+(?:the|my|our|a)\s+[a-z]+(?:\s+[a-z]+)?\s*(?:$|[.,!?;\n]))/i;

/**
 * Things a customer asks to have done on top of the main job. A phrase that
 * names none of these (and no saved service) is read as nothing, never as an
 * extra - "the kids", "us moving out", "Saturday morning".
 */
export const SERVICE_NOUNS = new Set([
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

/** Stems of the work words services share: never what tells one service from another. */
const WORK_STEMS = new Set(["clean", "paint", "servi", "wash", "repai", "insta", "remov", "polis"]);

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

/** "Extras: Oven, Carpets (2 rooms)", "Add-ons - windows & blinds": a form's list of extras. */
const FORM_EXTRAS =
  /^\s*(?:extras?|add[- ]?ons?|additional(?:\s+services?)?)\s*[:\-–]\s*(.+?)\s*$/im;

function formExtras(text: string): string[] {
  const list = FORM_EXTRAS.exec(text)?.[1];
  if (!list || /^(?:no|none|nil|n\/a|-)$/i.test(list.trim())) return [];
  return list
    .split(/\s*(?:,|;|&|\band\b|\+)\s*/i)
    .map((i) => i.replace(/\([^)]*\)/g, "").trim())
    .filter((i) => /[a-z]/i.test(i) && i.split(/\s+/).length <= 4);
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
  written: string,
  primary: string,
  services: readonly string[],
): ExtraRequest[] {
  // "Nothing bridal": what they turned down is never an extra they asked for.
  const text = written;
  // "Nothing bridal": what they turned down never names a service they asked for.
  const plain = withoutNegated(written);
  const main = primary.trim();
  if (!main || !text.trim()) return [];
  const mainKey = main.toLowerCase();
  const others = [
    ...new Set(services.map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== mainKey)),
  ];
  const out: ExtraRequest[] = [];
  const seen = new Set<string>();
  const said = new Set(stemsOf(plain));

  // 0. A form's own list: "Extras: Oven, Carpets (2 rooms)". Each item is a
  // thing they asked for, matched to a saved service by a word of its own.
  for (const item of formExtras(text)) {
    const stems = stemsOf(item).filter((s) => !WORK_STEMS.has(s));
    const named = others.filter((s) =>
      distinctiveStems(s, [main]).some((st) => !WORK_STEMS.has(st) && stems.includes(st)),
    );
    if (named.length === 1) {
      const service = named[0]!;
      if (seen.has(service.toLowerCase())) continue;
      seen.add(service.toLowerCase());
      out.push({ label: service, service, span: item });
      continue;
    }
    const head = item.toLowerCase().split(/\s+/).pop() ?? "";
    if (named.length === 0 && SERVICE_NOUNS.has(head) && !seen.has(item.toLowerCase())) {
      seen.add(item.toLowerCase());
      out.push({ label: item.toLowerCase(), span: item });
    }
  }

  // 1. Another saved service the message names in full, by words of its own.
  for (const service of others) {
    if (seen.has(service.toLowerCase())) continue;
    // "black mould on the ceiling, can u clean that": a cleaning message never
    // asks for the painting service "Ceilings".
    if (!fitsTrade(service, text)) continue;
    const need = [...new Set(stemsOf(service))];
    const loose = looselyNamed(service, main, text);
    if (loose !== undefined && !need.every((s) => said.has(s))) {
      if (DECLINED.test(loose) || NOT_A_REQUEST.test(loose)) continue;
      seen.add(service.toLowerCase());
      out.push({ label: service, service, span: loose });
      continue;
    }
    if (need.length === 0 || !need.every((s) => said.has(s))) continue;
    const own = distinctiveStems(service, [main]);
    if (own.length === 0 || !mentionsAny(plain, own)) continue;
    // Quote the sentence that names it by its own word ("18 windows"), never
    // one that only shares the work word ("the dog hair cleaned off").
    const telling = own.filter((s) => !WORK_STEMS.has(s));
    const at = mentionAt(text, telling.length && mentionsAny(text, telling) ? telling : own);
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
    // Anything else they ask for by name is an item the owner settles, even
    // with no saved price ("Also a feature wall in the bedroom"). Never a
    // word that only describes ("also a big thank you").
    const head = words[words.length - 1]!;
    if (NOT_A_THING.has(head) || /ly$/.test(head) || head.length < 3) continue;
    // A thing no business noun names needs more than one word, or a plain
    // "also a ..." before it: "as well as possible" is not something to price.
    const known = SERVICE_NOUNS.has(head) || SERVICE_NOUNS.has(thing);
    if (!known && words.length < 2 && !/^also\b/i.test(m[0].trim())) continue;
    // "plus a carpet steam clean. Do you do carpets?": their own question
    // already asks about it, so it is settled there, never twice.
    if (!known && askedAbout(text).some((w) => words.some((x) => stem(x) === stem(w)))) continue;
    const near = NEAR_ACTIVITY.exec(afterPhrase)?.[1]?.toLowerCase();
    const label = near
      ? `${thing} ${ACTIVITY_NOUN[near]}`
      : activity && !/ing$|s$/.test(head) && !WORK_STEMS.has(stem(head))
        ? `${thing} ${activity}`
        : thing;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, span: m[0].trim() });
  }

  return out;
}

/** The words of their "do you do X?" questions. */
function askedAbout(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(
    /\b(?:do|would|could|can|will)\s+(?:you|u|ya)\s+(?:guys\s+)?(?:also\s+)?(?:do|offer|provide)\s+([^?.!\n]+)\?/gi,
  )) {
    out.push(...(m[1]!.toLowerCase().match(/[a-z]{3,}/g) ?? []));
  }
  return out;
}

/**
 * A saved service named loosely: "a regular clean" for "Regular house clean".
 * Every word that tells it apart but one is written, beside its own work word
 * in the same clause.
 */
function looselyNamed(service: string, main: string, text: string): string | undefined {
  const own = distinctiveStems(service, [main]);
  const telling = own.filter((s) => !WORK_STEMS.has(s) && !/^\d/.test(s));
  const work = stemsOf(service).filter((s) => WORK_STEMS.has(s));
  if (telling.length < 2 || work.length === 0) return undefined;
  for (const clause of text.split(/[.!?\n,;]/)) {
    // "no carpet steam clean needed" turns it down: never read loosely as asked.
    if (DECLINED.test(clause) || NOT_A_REQUEST.test(clause)) continue;
    const said = new Set(stemsOf(withoutNegated(clause)));
    const hits = telling.filter((s) => said.has(s));
    if (hits.length === 0 || hits.length < telling.length - 1) continue;
    // Said as one thing: "a regular clean", never "we clean regularly".
    const words = clause.toLowerCase().match(/[a-z]+/g) ?? [];
    const together = words.some(
      (w, i) =>
        telling.includes(stem(w)) &&
        words.slice(i + 1, i + 3).some((next) => work.includes(stem(next))),
    );
    if (together) return clause.trim();
  }
  return undefined;
}
