import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import { wallNow } from "./format";

/**
 * The things almost every pasted enquiry states plainly: who is asking, how to
 * reach them and the day they want. Read with simple rules, no model.
 *
 * The model interpreter (ANTHROPIC_API_KEY) reads far more, but it is optional
 * and an unconfigured deployment gets nothing from it. Without this, a message
 * signed "Thanks, Karen" and asking for "the 10th of October" showed a blank
 * name and "Not set" on every row. These rules only take what is written in an
 * unambiguous form; anything looser ("next week", "before Christmas") is left
 * unknown rather than guessed. Everything read here is a reading the owner
 * checks, never a confirmed fact.
 */

export type JobDateRead = {
  /** yyyy-mm-dd. */
  iso: string;
  /** "Fri 10 Oct", for rows and headers. */
  label: string;
  /** The words it was read from, kept for the audit trail. */
  span: string;
  /**
   * The customer asked about the day ("Could you do Saturday 3 October?"),
   * rather than only mentioning it. The reply answers a question; it does not
   * volunteer a date nobody asked about.
   */
  asked: boolean;
};

/**
 * A written date that cannot be the job date as it stands. Never stored as the
 * job date and never echoed to the customer; the owner sees the note.
 *
 *  - `past`: the day has already gone ("I needed it by last Tuesday 22
 *    September"). Rolling it on a year told a customer who wanted it done
 *    last week that the owner would "confirm whether Wednesday 22 September
 *    works" - a date a year away that they never asked for.
 *  - `weekday_conflict`: the weekday and the date disagree ("Tuesday 8
 *    October" when the 8th is a Thursday). Enquiry does not pick one.
 */
export type DateIssue = {
  kind: "past" | "weekday_conflict" | "check_date";
  /** The customer's words, weekday included: "last Tuesday 22 September". */
  span: string;
  /** What a reply may quote back: "22 September", "Wednesday 8 October". */
  mention: string;
  /** One sentence for the owner. */
  note: string;
  /** For a weekday conflict: "the 8th is a Thursday". */
  actualDay?: string;
};

export type DateReading = {
  jobDate?: JobDateRead;
  issue?: DateIssue;
  /** Days the customer ruled out: "any day except Monday 5 October". */
  unavailable: JobDateRead[];
  /** "asap", "as soon as possible", "urgently". */
  asap: boolean;
};

/**
 * The sentence says the day does NOT work for them ("We're not available on
 * 3 October"): that is not a question to answer with the date.
 */
const DATE_NEGATED =
  /\b(?:not|never|unavailable|away|except|busy)\b|n't\b|\bcan ?not\b|\bcannot\b|\bno good\b/i;

/** Asking: "can you", "are you available", "free on that day", "does it suit". */
const DATE_ASKS =
  /\b(?:can|could|would|will)\s+(?:you|u|ya)\b|\bavailab|\bfree\s+(?:on|that|this)\b|\bsuits?\b/i;

/** Whether the sentence holding the date asks about it. */
export function asksAboutDate(text: string, index: number): boolean {
  const before = text.slice(0, index);
  const start =
    Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("\n")) + 1;
  const rest = text.slice(index);
  const endRel = rest.search(/[.!?\n]/);
  const end = endRel === -1 ? text.length : index + endRel;
  const sentence = text.slice(start, end);
  if (DATE_NEGATED.test(sentence)) return false;
  if (text[end] === "?") return true;
  return DATE_ASKS.test(sentence);
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const MONTH = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const DAY = String.raw`(\d{1,2})(?:st|nd|rd|th)?`;
const YEAR = String.raw`(?:,?\s+(\d{4}))?`;

/** "10th of October", "3 October 2026", "Fri 3 Oct". */
const DAY_MONTH = new RegExp(String.raw`\b${DAY}\s+(?:of\s+)?${MONTH}\b${YEAR}`, "gi");
/** "October 10", "Oct 10th, 2026". */
const MONTH_DAY = new RegExp(String.raw`\b${MONTH}\s+${DAY}\b${YEAR}`, "gi");
/** "10/10" or "3/10/2026" - Australian day first. "24/7" is not a date. */
const NUMERIC = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b(?<!\b24\/7)/g;

/** "Tuesday ", "Tue, ", "Tuesday the " written just before the day. */
const WEEKDAY_BEFORE =
  /\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\.?,?\s+(?:the\s+)?$/i;

/** Words that put the day behind them: "last Tuesday", "needed it by", "was". */
const PAST_MARKER =
  /\b(?:last|past|already|was|were|yesterday|ago|previous|previously|needed|had|missed|gone)\b/i;

/**
 * Ruling a day out, directly before it: "except 5 October", "not on the 5th",
 * "can't do Monday 5 October", "we're away 3 October". The negation has to
 * govern the date itself - "I'm not fussy about times but could you do 5
 * October?" is a request for the 5th, not a refusal of it.
 */
const EXCLUDE_BEFORE =
  /(?:\bexcept(?:\s+for)?|\bexcluding|\bother than|\bapart from|\bnot(?:\s+(?:available|free|around|home))?(?:\s+on)?|\bnever(?:\s+on)?|n't\s+(?:do|make|manage|come)(?:\s+it)?(?:\s+on)?|\bcan ?not\s+(?:do|make|come)(?:\s+it)?(?:\s+on)?|\bunavailable(?:\s+on)?|\baway(?:\s+on)?|\bbusy(?:\s+on)?|\bbooked(?:\s+up)?(?:\s+on)?)\s+(?:the\s+)?(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+(?:the\s+)?)?$/i;
/** Ruling a day out, directly after it: "5 October - that day is no good", "3 October won't work". */
const EXCLUDE_AFTER =
  /^\s*(?:[,–-]\s*)?(?:(?:that|this)(?:\s+day)?\s+|which\s+|it\s+)?(?:(?:is|'s)\s+(?:no good|out|not good|not possible|booked|no)\b|isn'?t\s+(?:good|possible)\b|(?:won'?t|will not|doesn'?t|does not|don'?t|do not)\s+(?:work|suit)\b|(?:is\s+)?no good\b)/i;
/** A boundary rather than an exclusion: "away until 3 October" means free from then. */
const BOUNDARY_BEFORE =
  /\b(?:until|till|til|after|from|since|before|back|returning)\b[^,;.!?\n]*$/i;

const ASAP =
  /\b(?:asap|a\.s\.a\.p|as soon as (?:possible|you can|poss)|urgent(?:ly)?|straight away|right away|soonest)\b/gi;
/** "not urgent", "no rush, not asap", "nothing urgent": the opposite of asap. */
const ASAP_NEGATED = /\b(?:not|no|isn'?t|nothing|never|non)[\s-]+(?:\w+\s+)?$/i;

/** Whether they asked for it as soon as possible, not "it's not urgent". */
export function asksForAsap(text: string): boolean {
  for (const m of text.matchAll(ASAP)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 20), m.index ?? 0);
    if (!ASAP_NEGATED.test(before)) return true;
  }
  return false;
}

/**
 * A slash date needs a reason to be a date: "Is 14/11 free?", "moving on
 * 30/9". "3/4 of the lawn", "1/2 day clean" and "a 1/2 tank" are fractions.
 */
const SLASH_FRACTION_AFTER =
  /^\s*(?:of|day|days|hr|hrs|hour|hours|the|tank|tanks|cup|cups|inch|inches|in|mm|cm|m|kg|l|litre|litres|a|an|price|off|full|size|done)\b/i;
const SLASH_DATE_CUE =
  /\b(?:on|by|until|till|from|before|after|free|available|avail|date|move|moving|keys|book|booked|come|due|this|next|is|do|suit|suits|works?)\b/i;

/** "3 may need a bath": "may" as a verb, not the month. */
const MAY_AS_VERB =
  /^\s+(?:i|we|you|he|she|they|it|need|be|have|want|not|also|take|get|require|come|go|like|do|just|still|or|want|well|as|help|able)\b/i;

/** A date rolled into next year this far out is doubtful, not a job date. */
const FAR_FUTURE_DAYS = 183;

/**
 * Past days within this many days are the day that just went, not the same day
 * next year. "the 2nd of March" written in September is next March; "22
 * September" written on the 26th is the one four days ago.
 */
const RECENT_PAST_DAYS = 60;

function monthIndex(word: string): number | undefined {
  return MONTHS[word.slice(0, 4).toLowerCase()] ?? MONTHS[word.slice(0, 3).toLowerCase()];
}

function weekdayIndex(word: string): number | undefined {
  const w = word.toLowerCase().slice(0, 3);
  const i = WEEKDAY_NAMES.findIndex((d) => d.startsWith(w));
  return i === -1 ? undefined : i;
}

function validDay(year: number, month: number, day: number): boolean {
  if (day < 1 || month < 0 || month > 11) return false;
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate() >= day;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The clause holding the date, split around it. */
function clauseAround(
  text: string,
  index: number,
  length: number,
): { before: string; after: string } {
  const before = text.slice(0, index);
  const cut = Math.max(
    ...[".", "!", "?", "\n", ";", ",", " - ", " – "].map((b) => {
      const at = before.lastIndexOf(b);
      return at === -1 ? -1 : at + b.length;
    }),
    0,
  );
  const rest = text.slice(index + length);
  const endRel = rest.search(/[.!?\n]/);
  return { before: before.slice(cut), after: endRel === -1 ? rest : rest.slice(0, endRel) };
}

type DateHit = {
  index: number;
  length: number;
  day: number;
  month: number;
  year?: number;
};

function collectHits(text: string): DateHit[] {
  const hits: DateHit[] = [];
  for (const m of text.matchAll(DAY_MONTH)) {
    const month = monthIndex(m[2]!);
    if (month === undefined) continue;
    const at = (m.index ?? 0) + m[0].length;
    if (/^may$/i.test(m[2]!) && !m[3] && MAY_AS_VERB.test(text.slice(at))) continue;
    const year = m[3] ? Number(m[3]) : undefined;
    hits.push({ index: m.index ?? 0, length: m[0].length, day: Number(m[1]), month, year });
  }
  for (const m of text.matchAll(MONTH_DAY)) {
    const month = monthIndex(m[1]!);
    if (month === undefined) continue;
    const year = m[3] ? Number(m[3]) : undefined;
    hits.push({ index: m.index ?? 0, length: m[0].length, day: Number(m[2]), month, year });
  }
  for (const m of text.matchAll(NUMERIC)) {
    const index = m.index ?? 0;
    const after = text.slice(index + m[0].length);
    if (!m[3] && SLASH_FRACTION_AFTER.test(after)) continue;
    const near = `${text.slice(Math.max(0, index - 30), index)} ${after.slice(0, 20)}`;
    if (!m[3] && !SLASH_DATE_CUE.test(near)) continue;
    const year = m[3] ? Number(m[3]) : undefined;
    hits.push({
      index,
      length: m[0].length,
      day: Number(m[1]),
      month: Number(m[2]) - 1,
      year,
    });
  }
  // First written first; a hit inside an earlier one is the same date.
  const sorted = hits.sort((a, b) => a.index - b.index);
  const out: DateHit[] = [];
  for (const h of sorted) {
    const prev = out[out.length - 1];
    if (prev && h.index < prev.index + prev.length) continue;
    out.push(h);
  }
  return out;
}

function readOf(date: Date, span: string, asked: boolean): JobDateRead {
  return {
    iso: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    label: format(date, "EEE d MMM", { locale: enAU }),
    span: span.trim(),
    asked,
  };
}

type Resolved =
  | { kind: "date"; date: Date }
  | { kind: "past"; date: Date }
  | { kind: "far"; date: Date }
  | { kind: "conflict"; date: Date; weekdayWritten: number }
  | { kind: "invalid" };

function resolveHit(hit: DateHit, before: string, today: Date): Resolved {
  let y = hit.year ?? today.getFullYear();
  if (y < 100) y += 2000;
  if (!validDay(y, hit.month, hit.day)) return { kind: "invalid" };
  const weekdayMatch = WEEKDAY_BEFORE.exec(before);
  const weekdayWritten = weekdayMatch ? weekdayIndex(weekdayMatch[1]!) : undefined;
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let date = new Date(y, hit.month, hit.day);
  let rolled = false;
  if (date < startToday) {
    if (hit.year !== undefined) return { kind: "past", date };
    const daysAgo = Math.round((startToday.getTime() - date.getTime()) / 86_400_000);
    const saysPast =
      PAST_MARKER.test(before) ||
      daysAgo <= RECENT_PAST_DAYS ||
      (weekdayWritten !== undefined && weekdayWritten === date.getDay());
    if (saysPast) return { kind: "past", date };
    // No year and long gone: the next time that day comes round.
    if (!validDay(y + 1, hit.month, hit.day)) return { kind: "invalid" };
    date = new Date(y + 1, hit.month, hit.day);
    rolled = true;
  }
  if (weekdayWritten !== undefined && weekdayWritten !== date.getDay()) {
    return { kind: "conflict", date, weekdayWritten };
  }
  // Rolled into next year and still months away: probably not what they
  // meant ("the 2nd of March" in September). The owner checks it.
  const daysAway = Math.round((date.getTime() - startToday.getTime()) / 86_400_000);
  if (rolled && daysAway > FAR_FUTURE_DAYS) return { kind: "far", date };
  return { kind: "date", date };
}

/** The customer's words for the day, weekday and "last" included. */
function writtenSpan(text: string, hit: DateHit, before: string): string {
  const weekday = WEEKDAY_BEFORE.exec(before);
  const head = before.slice(0, before.length - (weekday?.[0].length ?? 0));
  const lead = /\blast\s+$/i.test(head) ? "last " : "";
  return `${lead}${weekday ? weekday[0] : ""}${text.slice(hit.index, hit.index + hit.length)}`
    .replace(/\s+/g, " ")
    .trim();
}

/** "8" -> "8th", "22" -> "22nd". */
function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
}

/** Every date in the message, sorted into the job date, a problem, and days ruled out. */
export function readDates(text: string, now = new Date(), tz = "Australia/Brisbane"): DateReading {
  const today = wallNow(now, tz);
  const reading: DateReading = { unavailable: [], asap: asksForAsap(text) };
  for (const hit of collectHits(text)) {
    const { before, after } = clauseAround(text, hit.index, hit.length);
    const resolved = resolveHit(hit, before, today);
    if (resolved.kind === "invalid") continue;
    const span = writtenSpan(text, hit, before);
    const written = text.slice(hit.index, hit.index + hit.length).trim();
    const boundary = BOUNDARY_BEFORE.test(before);
    const excluded = (EXCLUDE_BEFORE.test(before) || EXCLUDE_AFTER.test(after)) && !boundary;
    if (excluded) {
      // A day ruled out is never the job date. Recorded only when it is a real
      // future day that reads plainly; anything muddier is simply dropped.
      if (resolved.kind === "date") reading.unavailable.push(readOf(resolved.date, span, false));
      continue;
    }
    // "away until 3 October": a boundary, not the day they want.
    if (boundary && /\b(?:away|not|busy|unavailable)\b|n't\b/i.test(before)) continue;
    if (resolved.kind === "past") {
      reading.issue ??= {
        kind: "past",
        span,
        mention: written,
        note: `They wrote "${span}" - that day has already passed.`,
      };
      continue;
    }
    if (resolved.kind === "far") {
      reading.issue ??= {
        kind: "check_date",
        span,
        mention: span,
        note: `They wrote "${span}" - Enquiry reads that as ${format(resolved.date, "EEE d MMM yyyy", { locale: enAU })}, months away. Check the date with them.`,
      };
      continue;
    }
    if (resolved.kind === "conflict") {
      const actual = WEEKDAY_NAMES[resolved.date.getDay()]!;
      const writtenDay = WEEKDAY_NAMES[resolved.weekdayWritten]!;
      const day = format(resolved.date, "d MMMM", { locale: enAU });
      reading.issue ??= {
        kind: "weekday_conflict",
        span,
        mention: span,
        note: `They wrote ${capitalise(writtenDay)} ${day} - that date is a ${capitalise(actual)}.`,
        actualDay: `the ${ordinal(resolved.date.getDate())} is a ${capitalise(actual)}`,
      };
      continue;
    }
    // The first plain date written is the one the customer led with.
    reading.jobDate ??= readOf(resolved.date, span, asksAboutDate(text, hit.index));
  }
  // A date problem makes the day doubtful; the owner settles it rather than
  // Enquiry picking one.
  if (reading.issue && reading.issue.kind !== "past") delete reading.jobDate;
  return reading;
}

/**
 * The one line a reply may say about a doubtful day, quoting the customer and
 * asking - never stating a date Enquiry worked out on its own.
 */
export function dateQuestion(
  issue: Pick<DateIssue, "kind" | "mention" | "actualDay">,
  asap = false,
): string {
  if (issue.kind === "weekday_conflict") {
    return `You mentioned ${issue.mention} - ${issue.actualDay ?? "that date and day do not match"}. Which day did you mean?`;
  }
  if (issue.kind === "past") {
    return asap
      ? `You mentioned ${issue.mention}, which has passed - I'll let you know the soonest day I can do it.`
      : `You mentioned ${issue.mention}, which has passed - what day suits you?`;
  }
  return `You mentioned ${issue.mention} - can you confirm the date you mean?`;
}

export function readJobDate(
  text: string,
  now = new Date(),
  tz = "Australia/Brisbane",
): JobDateRead | undefined {
  return readDates(text, now, tz).jobDate;
}

/** Words that can sit where a sign-off name sits but are never one. */
const NOT_A_NAME = new Set(
  [
    "thanks",
    "thank",
    "thx",
    "you",
    "cheers",
    "regards",
    "kind",
    "best",
    "hi",
    "hello",
    "hey",
    "please",
    "sorry",
    "ta",
    "asap",
    "heaps",
    "mate",
    "team",
    "guys",
    "all",
    "there",
    "i",
    "christmas",
    "easter",
    "today",
    "tomorrow",
    ...WEEKDAY_NAMES,
    ...Object.keys(MONTHS),
    "january",
    "february",
    "march",
    "april",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].map((w) => w.toLowerCase()),
);

/** "Mel", "O'Connor", "Smith-Jones", "McDonald". */
const NAME_WORD = String.raw`[A-Z][a-z]*(?:['’-]?[A-Z][a-z]+|['’-][a-z]+)*`;
const NAME = String.raw`(${NAME_WORD}(?:\s+${NAME_WORD})?)`;
const PHONE = String.raw`\+?\d[\d\s()-]{6,}\d`;
const EMAIL = String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+`;
const CONTACT_TAIL = String.raw`(?:[\s,|]+(?:${PHONE}|${EMAIL}))*`;
/** A kiss after a name: "Priya x", "Jo xx". */
const KISS = String.raw`(?:\s+x{1,3})?`;
/** A role or business after the name: "Priya Shah, Office Manager, Northside Dental". */
const ROLE_TAIL = String.raw`(?:\s*,\s*[A-Z][A-Za-z&'.-]*(?:\s+[A-Za-z&'.-]+){0,4}){0,3}`;

const SIGN_OFF_WORDS = String.raw`(?:many thanks|thank you|thanks|thanx|thx|ta|cheers|kind regards|warm regards|best regards|regards|best wishes|all the best|best|speak soon|talk soon)`;
const SIGN_OFF_EXTRA = String.raw`(?:\s+(?:heaps|so much|again|a lot|mate|in advance))?`;

/** "Thanks, Karen" / "Cheers Tom" / "thx Dave" at the very end. */
const SIGN_OFF = new RegExp(
  String.raw`\b${SIGN_OFF_WORDS}${SIGN_OFF_EXTRA}[,!.]?\s+${NAME}${KISS}${ROLE_TAIL}\s*[.!]?${CONTACT_TAIL}\s*$`,
  "i",
);
/** A line that is only a sign-off, or a sign-off and a name: "cheers", "Thanks heaps,". */
const SIGN_OFF_LINE = new RegExp(
  String.raw`^${SIGN_OFF_WORDS}${SIGN_OFF_EXTRA}(?![a-z])[,!.]*\s*(.*)$`,
  "i",
);
/** A line holding only a way to reach them: "0412 555 019", "Mob: 0412...", an email. */
const CONTACT_LINE = new RegExp(
  String.raw`^(?:(?:ph(?:one)?|mob(?:ile)?|m|p|e|email|tel)\s*[:.-]?\s*)?(?:${PHONE}|${EMAIL})\s*$`,
  "i",
);
/** A bare name (and perhaps a phone number) after the last sentence: "... October. Tom" */
const TRAILING_NAME = new RegExp(
  String.raw`(?:^|[.!?\n])\s*${NAME}${KISS}\s*[.!]?${CONTACT_TAIL}\s*$`,
);
/** "... can u do the 1st? - Priya", "-- Priya", "~ Priya", an en or em dash too. */
const DASH_NAME = new RegExp(
  String.raw`(?:^|\s)(?:-{1,2}|–|\u2014|~)\s*${NAME}${KISS}\s*[.!]?${CONTACT_TAIL}\s*$`,
);
/** "My name is Sam", "this is Sam from ...". */
const INTRO = new RegExp(String.raw`\b(?:my name is|my name's|this is)\s+${NAME}`, "i");
/** A name line on its own: "Mel Tran", "Liam O'Connor", "Priya x". */
const NAME_LINE = new RegExp(String.raw`^${NAME}${KISS}\s*[.!]?${CONTACT_TAIL}\s*$`);

/** Job titles: "Office Manager" is who they are, not their name. */
const TITLE_WORDS = new Set([
  "manager",
  "director",
  "owner",
  "admin",
  "administrator",
  "coordinator",
  "co-ordinator",
  "assistant",
  "officer",
  "reception",
  "receptionist",
  "secretary",
  "supervisor",
  "president",
  "ceo",
  "cfo",
  "founder",
  "partner",
  "principal",
  "agent",
  "landlord",
  "tenant",
  "property",
  "team",
  "lead",
  "head",
  "executive",
  "accounts",
  "office",
]);

/** Business words: "Best Cleaning Co", "Acme Pty Ltd". */
const COMPANY_WORDS = new Set([
  "co",
  "company",
  "pty",
  "ltd",
  "limited",
  "inc",
  "group",
  "services",
  "service",
  "cleaning",
  "painting",
  "solutions",
  "realty",
  "real",
  "estate",
  "dental",
  "clinic",
  "studio",
  "salon",
  "cafe",
  "store",
  "shop",
  "centre",
  "center",
  "trust",
  "holdings",
  "enterprises",
  "construction",
  "builders",
  "plumbing",
  "electrical",
]);

/** The first word of many place names: "Mount Gravatt", "North Lakes". */
const PLACE_PREFIX = new Set([
  "mount",
  "mt",
  "port",
  "point",
  "pt",
  "north",
  "south",
  "east",
  "west",
  "upper",
  "lower",
  "new",
  "fortitude",
  "surfers",
  "gold",
  "sunshine",
]);

/** Common Australian cities and suburbs that turn up alone on a sign-off line. */
const PLACES = new Set(
  [
    "brisbane",
    "sydney",
    "melbourne",
    "perth",
    "adelaide",
    "hobart",
    "darwin",
    "canberra",
    "cairns",
    "townsville",
    "toowoomba",
    "ipswich",
    "logan",
    "redcliffe",
    "caboolture",
    "newcastle",
    "wollongong",
    "geelong",
    "ballarat",
    "bendigo",
    "launceston",
    "chermside",
    "paddington",
    "kedron",
    "nundah",
    "toowong",
    "indooroopilly",
    "bulimba",
    "carindale",
    "ascot",
    "hamilton",
    "clayfield",
    "wilston",
    "windsor",
    "lutwyche",
    "aspley",
    "stafford",
    "everton",
    "ashgrove",
    "bardon",
    "auchenflower",
    "milton",
    "woolloongabba",
    "annerley",
    "yeronga",
    "sherwood",
    "graceville",
    "corinda",
    "kenmore",
    "chapel",
    "springwood",
    "capalaba",
    "cleveland",
    "wynnum",
    "manly",
    "sandgate",
    "redbank",
    "forest",
    "parramatta",
    "bondi",
    "newtown",
    "chatswood",
    "mosman",
    "randwick",
    "coogee",
    "richmond",
    "fitzroy",
    "carlton",
    "brunswick",
    "hawthorn",
    "prahran",
    "subiaco",
    "fremantle",
    "glenelg",
    "noosa",
    "maroochydore",
    "caloundra",
    "southport",
    "robina",
    "nerang",
  ].map((w) => w.toLowerCase()),
);

export type NameContext = {
  /** The business's own base location, so its suburb is never a customer name. */
  place?: string;
};

function isPlace(words: string[], ctx: NameContext): boolean {
  const lower = words.map((w) => w.toLowerCase());
  const own = (ctx.place ?? "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3);
  if (lower.some((w) => own.includes(w))) return true;
  if (PLACE_PREFIX.has(lower[0]!)) return true;
  return lower.length === 1 && PLACES.has(lower[0]!);
}

/** A line that says who they are or where from, not their name. */
function isRoleOrPlaceLine(line: string, ctx: NameContext): boolean {
  const words = line.replace(/[,.]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const lower = words.map((w) => w.toLowerCase());
  return (
    lower.some((w) => TITLE_WORDS.has(w) || COMPANY_WORDS.has(w)) ||
    isPlace(words, ctx) ||
    /\b(?:qld|nsw|vic|wa|sa|tas|act|nt)\b|\b\d{4}\b/i.test(line)
  );
}

function acceptName(raw: string | undefined, ctx: NameContext = {}): string | undefined {
  if (!raw) return undefined;
  // Case-insensitive patterns can run on into "Sam and"; a name is only the
  // capitalised words it starts with.
  const words: string[] = [];
  for (const w of raw.trim().split(/\s+/)) {
    if (!/^[A-Z]/.test(w)) break;
    words.push(w);
  }
  if (words.length === 0) return undefined;
  if (words.some((w) => NOT_A_NAME.has(w.toLowerCase()))) return undefined;
  const lower = words.map((w) => w.toLowerCase());
  if (lower.some((w) => TITLE_WORDS.has(w) || COMPANY_WORDS.has(w))) return undefined;
  if (isPlace(words, ctx)) return undefined;
  const name = words.join(" ");
  return name.length >= 2 ? name : undefined;
}

/**
 * A sign-off laid out over lines, read down from the sign-off:
 *
 *   cheers
 *
 *   Mel Tran
 *   0412 555 019
 *
 * The name is the line straight after the sign-off, not the last line of the
 * message - that can be a suburb ("Chermside") or a business name. A single
 * word alone on the last line is not enough to be sure of ("Thanks\nKedron"):
 * it is only taken when something follows it, or it is two words.
 */
function nameFromSignOffLines(text: string, ctx: NameContext): string | null | undefined {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const total = lines.length;
  let end = total;
  while (end > 0 && CONTACT_LINE.test(lines[end - 1]!)) end -= 1;
  for (let i = end - 1; i >= Math.max(0, end - 4); i -= 1) {
    const m = SIGN_OFF_LINE.exec(lines[i]!);
    if (!m) continue;
    const rest = (m[1] ?? "").trim();
    // "Thanks for getting back to me." is a sentence, not a sign-off.
    if (rest && !NAME_LINE.test(rest)) continue;
    // A sign-off line settles it: whatever it gives (or does not) is final.
    if (rest) return acceptName(NAME_LINE.exec(rest)?.[1], ctx) ?? null;
    const next = lines[i + 1];
    if (!next || i + 1 >= end) return null;
    const name = acceptName(NAME_LINE.exec(next)?.[1], ctx);
    if (!name) return null;
    const single = !name.includes(" ");
    if (single && i + 2 >= total) return null;
    return name;
  }
  return undefined;
}

/**
 * "Priya Shah\nOffice Manager\nNorthside Dental": the name is the line above
 * the role and business lines, not the last line.
 */
function nameAboveRoleLines(text: string, ctx: NameContext): string | undefined {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let i = lines.length - 1;
  while (i >= 0 && CONTACT_LINE.test(lines[i]!)) i -= 1;
  let skipped = 0;
  while (i >= 0 && isRoleOrPlaceLine(lines[i]!, ctx)) {
    i -= 1;
    skipped += 1;
  }
  if (skipped === 0 || i < 0) return undefined;
  const m = NAME_LINE.exec(lines[i]!);
  const name = acceptName(m?.[1], ctx);
  return name && name.includes(" ") ? name : undefined;
}

export function readCustomerName(text: string, ctx: NameContext = {}): string | undefined {
  const trimmed = text.trim();
  const fromLines = nameFromSignOffLines(trimmed, ctx);
  if (fromLines) return fromLines;
  if (fromLines === null) return nameAboveRoleLines(trimmed, ctx);
  return (
    nameAboveRoleLines(trimmed, ctx) ??
    acceptName(SIGN_OFF.exec(trimmed)?.[1], ctx) ??
    acceptName(DASH_NAME.exec(trimmed)?.[1], ctx) ??
    acceptName(TRAILING_NAME.exec(trimmed)?.[1], ctx) ??
    acceptName(INTRO.exec(trimmed)?.[1], ctx)
  );
}

/** An Australian phone number: "0412 555 019", "+61 412 555 019", "(07) 3123 4567". */
const AU_PHONE = /(?<![\d+])(?:\+?61[\s-]?|\(?0)[2-478]\)?(?:[\s-]?\d){8}(?!\d)/;
const EMAIL_ANYWHERE = new RegExp(String.raw`(?<![\w.+-])${EMAIL}`, "i");

export type ContactRead = { phone?: string; email?: string };

/** A phone number or email the customer wrote, exactly as written. */
export function readContact(text: string): ContactRead {
  const phone = AU_PHONE.exec(text)?.[0]?.trim();
  const email = EMAIL_ANYWHERE.exec(text)?.[0]?.replace(/[.,;]+$/, "");
  return { ...(phone ? { phone } : {}), ...(email ? { email } : {}) };
}

export type EnquiryBasics = {
  customerName?: string;
  jobDate?: JobDateRead;
  dates: DateReading;
  contact: ContactRead;
};

export function readEnquiryBasics(
  text: string,
  now = new Date(),
  tz = "Australia/Brisbane",
  ctx: NameContext = {},
): EnquiryBasics {
  const dates = readDates(text, now, tz);
  return {
    customerName: readCustomerName(text, ctx),
    jobDate: dates.jobDate,
    dates,
    contact: readContact(text),
  };
}
