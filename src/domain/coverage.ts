import type { BusinessDetail } from "./business-detail.ts";
import {
  WEEKDAYS,
  closedRangeCovers,
  describeDetail,
  spokenMonthDay,
} from "./business-detail.ts";
import { DECLINED, NOT_A_REQUEST, SERVICE_NOUNS } from "./extras.ts";
import { distinctiveStems, mentionsAny, namesService, stem, stemsOf } from "./service-words.ts";
import type { RuleCheck } from "./rule-checks.ts";

/**
 * What a price covers, confirmed by the owner before any reply may name it.
 *
 * Reading free text will always miss some phrasing: "deck staining" asked for
 * in a way the extras reader did not catch was dropped and the reply said
 * "$1,740 all up". So the structural rule is: a total is stated only after the
 * owner has seen every line (service x count = amount), anything the reader
 * noticed that is not on it, and answered "Did they ask for anything else?".
 *
 * The confirmation is stored as a `coverage` fact whose value is `key` - a
 * fingerprint of the lines, the flags and every fact the decision read. Any
 * change to those (a new count, a new extra, a new price, or a new message
 * that adds a flag) changes the key. The server also retires the stored
 * confirmation the moment the key moves (decision-apply.ts `writeDecision`),
 * so going A -> B -> A never revives a confirmation given for A. The
 * customer's name, phone and email are left out of the key because they
 * cannot change what a price covers.
 */

export const COVERAGE_FIELD = "coverage";

const NOT_IN_KEY = new Set([COVERAGE_FIELD, "name", "phone", "email"]);

export type CoverageLine = {
  label: string;
  amountMinor: number;
  /** "3 bedrooms", for a price per something. */
  quantity?: string;
  /** Asked for on the first visit only, on a recurring job. */
  firstVisit?: boolean;
  /** "minimum charge": why the amount is not the count times the rate. */
  note?: string;
};

export type CoverageFlag = {
  kind: "mention" | "note" | "closed_day" | "not_offered" | "recurring" | "rule" | "included";
  text: string;
  /** A rule of the owner's to apply or waive for this job (kind "rule"). */
  check?: RuleCheck;
  /**
   * Things they mention that are part of the quoted service ("walls",
   * "ceilings" for interior painting), folded into one line (kind "included").
   * Not blocking: the owner changes one only if it is not included.
   */
  things?: string[];
  /**
   * What was mentioned ("deck", "Fence painting", "mould removal"). Set on a
   * flag the owner must settle before confirming: add it, leave it out and
   * tell them, come back to them on it, or say they did not ask.
   */
  thing?: string;
};

export type Coverage = {
  key: string;
  confirmed: boolean;
  lines: CoverageLine[];
  flagged: CoverageFlag[];
  /** "every fortnight", "weekly", "regular": the price is per visit. */
  recurring: boolean;
};

type KeyFact = { field: string; value: string; status: string };

/** FNV-1a, 32 bit: a short stable fingerprint, the same in the browser and on the server. */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function coverageKey(input: {
  serviceLabel: string;
  lines: readonly CoverageLine[];
  flagged: readonly CoverageFlag[];
  facts: readonly KeyFact[];
}): string {
  const facts = input.facts
    .filter((f) => !NOT_IN_KEY.has(f.field.trim().toLowerCase()))
    .map((f) => `${f.field.trim().toLowerCase()}=${String(f.value ?? "").trim()}~${f.status}`)
    .sort();
  const lines = input.lines.map((l) => `${l.label}|${l.amountMinor}|${l.quantity ?? ""}`);
  const flags = input.flagged.map((f) => `${f.kind}:${f.text}`);
  const body = JSON.stringify([input.serviceLabel.trim().toLowerCase(), lines, flags, facts]);
  return `cv1-${fnv(body)}-${body.length}`;
}

/** The stored confirmation matches this exact coverage. */
export function coverageConfirmed(facts: readonly KeyFact[], key: string): boolean {
  return facts.some(
    (f) =>
      f.field.trim().toLowerCase() === COVERAGE_FIELD &&
      f.status === "confirmed" &&
      String(f.value ?? "").trim() === key,
  );
}

/**
 * How often they want it, only when they say a frequency: "every fortnight",
 * "weekly", "a regular clean every month". "Just a regular end of lease clean",
 * "we clean regularly ourselves" and "an ongoing issue with mould" are not.
 */
const FREQUENCY =
  /\b(?:every\s+(?:other\s+)?(?:\d+\s+|two\s+|three\s+|four\s+)?(?:week|fortnight|month)s?|weekly|fortnightly|monthly|once\s+a\s+(?:week|fortnight|month)|each\s+(?:week|fortnight|month))\b/i;

export function frequencyIn(message: string): string | undefined {
  return FREQUENCY.exec(message)?.[0]?.toLowerCase();
}

/** The owner's answer to "They want this every fortnight - correct?". */
export const RECURRING_FIELD = "recurring";

/** "first clean", "initial visit", "to start with": asked for once, not every visit. */
export function isFirstVisit(span: string): boolean {
  return /\b(?:first|initial|one[- ]off|to start(?: with)?|to begin)\b/i.test(span);
}

/**
 * The message asks for this line on the first visit only: the clause that
 * names it says "first clean", "initial visit", "to start". Read from the
 * message itself, so it survives the owner confirming the line.
 */
export function askedForFirstVisit(message: string, label: string, others: string[]): boolean {
  const own = distinctiveStems(label, others);
  if (own.length === 0) return false;
  return message
    .split(/[.,;!?\n]/)
    .some((clause) => mentionsAny(clause, own) && isFirstVisit(clause));
}

/** Sentences that ask for something, not ones about the past. */
function askingSentences(message: string): string {
  return message
    .split(/(?<=[.!?\n])/)
    .filter((s) => !NOT_A_REQUEST.test(s) && !DECLINED.test(s))
    .join(" ");
}

/** Stems of the work words most services share. */
const GENERIC_WORK = new Set(["clean", "paint", "servi", "wash", "repai", "insta"]);

/**
 * Things that are part of one service's own work, not something extra: the
 * walls and ceilings of interior painting, the eaves of exterior painting, the
 * skirting and the hair of an end of lease clean. They fold into one
 * "Included in ..." line. Tied to the specific service: "walls" on a fence
 * quote, or "cupboards" on an oven clean, stay a flag the owner settles.
 */
const PART_OF: { work: RegExp; nouns: ReadonlySet<string>; notWith: RegExp }[] = [
  {
    work: /\b(?:interior|inside|internal|indoor)\b/i,
    nouns: new Set([
      "wall",
      "walls",
      "ceiling",
      "ceilings",
      "skirting",
      "skirtings",
      "trim",
      "architraves",
      "frames",
      "door",
      "doors",
    ]),
    notWith: /\b(?:outside|outdoors?|external|exterior|garage|fence|shed)\b/i,
  },
  {
    work: /\b(?:exterior|outside|external)\b/i,
    nouns: new Set(["eaves", "facade"]),
    notWith: /\b(?:inside|indoors?|internal|interior)\b/i,
  },
  {
    work: /\b(?:end of lease|bond|regular|house|deep|spring|general|move[- ]?out)\b[^,]*\bclean|\bclean\b[^,]*\b(?:lease|bond)\b/i,
    nouns: new Set([
      "hair",
      "skirting",
      "skirtings",
      "tracks",
      "cupboards",
      "cabinets",
      "wardrobes",
    ]),
    notWith: /(?!)/,
  },
];

/** Words that make a thing separate work, whatever it is: "also the eaves". */
const SEPARATE = /\b(?:also|as well|plus|extra|too|separately|another|additional)\b/i;

/** The clauses of a message that hold a word. */
function clausesWith(message: string, noun: string): string[] {
  const re = new RegExp(`\\b${noun}\\b`, "i");
  return message.split(/[.,;!?\n]|\s-\s|\s–\s/).filter((c) => re.test(c));
}

/**
 * The quoted service a thing belongs to, only when it is clearly part of that
 * service's own work: never when another of their saved services is about it,
 * and never when they say it separately ("also", "outside").
 */
function partOf(
  noun: string,
  covered: readonly string[],
  others: readonly string[],
  message: string,
): string | undefined {
  const s = stem(noun);
  if (others.some((o) => stemsOf(o).includes(s))) return undefined;
  const clauses = clausesWith(message, noun);
  return covered.find((c) =>
    PART_OF.some(
      (p) =>
        p.work.test(c) &&
        p.nouns.has(noun) &&
        clauses.length > 0 &&
        clauses.every((clause) => !SEPARATE.test(clause) && !p.notWith.test(clause)),
    ),
  );
}

/**
 * Things the message mentions that nothing on the quote covers: another saved
 * service, or a thing a business does ("deck", "gutters"). Shown to the owner
 * as flags; never priced, never assumed.
 */
function mentionFlags(
  message: string,
  covered: readonly string[],
  services: readonly string[],
): CoverageFlag[] {
  const text = askingSentences(message);
  if (!text.trim()) return [];
  const coveredStems = new Set(covered.flatMap(stemsOf));
  const out: CoverageFlag[] = [];
  const named = new Set<string>();
  for (const service of services) {
    if (covered.some((c) => c.trim().toLowerCase() === service.trim().toLowerCase())) continue;
    // Its own words, not the work word every service shares: "gutter cleaning"
    // does not mention the end of lease clean.
    const own = distinctiveStems(service, covered).filter((s) => !GENERIC_WORK.has(s));
    const said = new Set(stemsOf(text));
    if (own.length === 0 || !own.every((s) => said.has(s))) continue;
    own.forEach((s) => named.add(s));
    out.push({ kind: "mention", text: `They mention ${service.toLowerCase()}`, thing: service });
  }
  const words = new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
  const folded = new Map<string, string[]>();
  for (const noun of SERVICE_NOUNS) {
    if (noun.includes(" ") || !words.has(noun)) continue;
    const s = stem(noun);
    if (coveredStems.has(s) || named.has(s)) continue;
    named.add(s);
    const others = services.filter(
      (o) => !covered.some((c) => c.trim().toLowerCase() === o.trim().toLowerCase()),
    );
    const owner = partOf(noun, covered, others, text);
    if (owner) {
      folded.set(owner, [...(folded.get(owner) ?? []), noun]);
      continue;
    }
    out.push({ kind: "mention", text: `They mention the ${noun}`, thing: noun });
  }
  for (const [service, things] of folded) {
    out.push({
      kind: "included",
      text: `Included in ${service.toLowerCase()}: ${things.join(", ")}`,
      things,
    });
  }
  return out;
}

/** A fee, travel or minimum note concerns every quote. */
const EVERY_QUOTE = /\b(?:fees?|travel|call[- ]?outs?|minimum|min|surcharges?|deposit|gst)\b/i;

/**
 * Which quotes a note is shown on: the saved service it names; a fee or
 * minimum on every quote; otherwise only when the message mentions what the
 * note is about ("Windows inside only $8" when they mention windows).
 */
function noteConcerns(
  note: { text: string; service?: string },
  message: string,
  onQuote: (service: string) => boolean,
  services: readonly string[] = [],
): boolean {
  if (note.service) return onQuote(note.service);
  // A note that names another of their services is about that service: a
  // painting minimum never shows on a cleaning quote.
  const about = services.filter((s) => namesService(note.text, s));
  if (about.length > 0) return about.some(onQuote);
  const subject = note.text.split(/\$|\d/)[0] ?? note.text;
  if (EVERY_QUOTE.test(subject)) return true;
  return mentionsAny(message, stemsOf(subject));
}

function detailFlags(
  details: readonly BusinessDetail[],
  covered: readonly string[],
  message: string,
  jobDates: readonly string[] = [],
  services: readonly string[] = [],
): CoverageFlag[] {
  const onQuote = (service: string) =>
    covered.some((c) => c.trim().toLowerCase() === service.trim().toLowerCase());
  const out: CoverageFlag[] = [];
  for (const d of details) {
    if (d.kind === "note" && noteConcerns(d, message, onQuote, services)) {
      out.push({ kind: "note", text: `Your note: ${d.text}` });
    }
    if (d.kind === "not_offered" && namesService(message, d.service) && !onQuote(d.service)) {
      out.push({
        kind: "not_offered",
        text: `They mention ${d.service} - you don't offer it`,
        thing: d.service,
      });
    }
  }
  // Every day they offered is checked, not only the first.
  const closedDays = new Set(details.flatMap((d) => (d.kind === "closed_days" ? d.days : [])));
  const flaggedDays = new Set<number>();
  for (const iso of jobDates) {
    const day = weekdayOf(iso);
    if (day === undefined || !closedDays.has(day) || flaggedDays.has(day)) continue;
    flaggedDays.add(day);
    out.push({
      kind: "closed_day",
      text: `A day they mentioned is a ${WEEKDAYS[day]} - you don't work ${WEEKDAYS[day]}s, the reply says so`,
    });
  }
  const ranges = details.flatMap((d) => (d.kind === "closed_dates" ? [d] : []));
  const hit = ranges.find((r) => jobDates.some((iso) => closedRangeCovers(iso, r)));
  if (hit) {
    const own = describeDetail(hit);
    const said =
      hit.year === undefined && hit.from !== hit.to
        ? `${spokenMonthDay(hit.from)} to ${spokenMonthDay(hit.to)}`
        : `${own.charAt(0).toLowerCase()}${own.slice(1)}`;
    out.push({
      kind: "closed_day",
      text: `A day they mentioned is in your closed dates (${said}) - the reply says so`,
    });
  }
  return out;
}

function weekdayOf(iso: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
}

export function coverageFlags(input: {
  message: string;
  covered: readonly string[];
  services: readonly string[];
  details: readonly BusinessDetail[];
  jobDates?: readonly string[];
}): CoverageFlag[] {
  const details = detailFlags(
    input.details,
    input.covered,
    input.message,
    input.jobDates,
    input.services,
  );
  // "carpets" and "carpet cleaning - you don't offer it" are one thing: the
  // not-offered flag says it, the bare mention goes.
  const notOffered = details
    .filter((f) => f.kind === "not_offered")
    .flatMap((f) => stemsOf(f.thing ?? ""));
  const mentions = mentionFlags(input.message, input.covered, input.services).filter(
    (f) => f.kind !== "mention" || !stemsOf(f.thing ?? "").some((s) => notOffered.includes(s)),
  );
  return [...mentions, ...details];
}

/**
 * Facts that record an owner's step, not something about the job: never
 * listed as "What Enquiry understood", and never offered for correction.
 */
export function isInternalFact(field: string): boolean {
  const f = field.trim().toLowerCase();
  return f === COVERAGE_FIELD || f === "practice_price";
}

/** Flags the owner has to settle one by one before the price can be confirmed. */
export function unsettledFlags(flags: readonly CoverageFlag[]): CoverageFlag[] {
  return flags.filter((f) => Boolean(f.thing));
}
