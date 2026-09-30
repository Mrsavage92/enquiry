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
  /** What the day is for, when it is not a plain job day. */
  role?: DateRole;
  /** The event or deadline it is about: "wedding", "settlement". */
  what?: string;
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

/**
 * What a day is for. `job` is the day they want the work; `deadline` the day
 * it must be done by ("the day before settlement (29/10)", "fri 16th b4
 * inspection"); `event` a day that cannot move (the wedding the makeup is
 * for); `trial` a separate appointment before it; `context` a day about
 * something else (the inspection, settlement, the keys).
 */
export type DateRole = "job" | "deadline" | "event" | "trial" | "context";

/**
 * A day written beside a move-out, an inspection, the keys, a trial: never the
 * job date. `to` is set for a stretch ("a trial in December").
 */
export type ContextDate = JobDateRead & { what: string; role?: DateRole; to?: string };

export type DateReading = {
  jobDate?: JobDateRead;
  issue?: DateIssue;
  /**
   * They offered more than one day ("Sat 26 or Sun 27 Sep"). Neither is the
   * job date: the owner says which works.
   */
  options?: { days: JobDateRead[]; label: string; span: string };
  /** Dates about something else: the move-out, the inspection, the keys. */
  context: ContextDate[];
  /** Days the customer ruled out: "any day except Monday 5 October". */
  unavailable: JobDateRead[];
  /** "asap", "as soon as possible", "urgently". */
  asap: boolean;
  /**
   * A day of the week they prefer, not a date: "tuesdays pref", "Thursday or
   * Friday would suit best". Never turned into the next such date.
   */
  preference?: string;
  /**
   * A loose ask with no one date in it: "week of the 12th", "next fortnight".
   * Kept in their words and quoted back, never resolved.
   */
  approx?: { span: string };
  /**
   * "Any day between 12 and 16 October except Friday": a stretch they are
   * free, never one day in it. `except` holds weekdays ruled out (0 Sunday).
   */
  window?: { from: string; to: string; except: number[]; label: string; span: string };
  /** Weekdays they ruled out without a date: "except Friday", "not weekends". */
  exceptDays?: number[];
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
  /(?:\bexcept(?:\s+for)?|\bexcluding|\bother than|\bapart from|\bnot(?:\s+(?:available|free|around|home))?(?:\s+on)?|\bnever(?:\s+on)?|n't\s+(?:do|make|manage|come)(?:\s+it)?(?:\s+on)?|\bcan ?not\s+(?:do|make|come)(?:\s+it)?(?:\s+on)?|\bunavailable(?:\s+on)?|\baway(?:\s+on)?|\bbusy(?:\s+on)?|\bbooked(?:\s+up)?(?:\s+on)?)\s+(?:the\s+)?(?:(?:week|weekend|fortnight)\s+(?:of|starting|beginning|commencing)\s+(?:the\s+)?)?(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+(?:the\s+)?)?$/i;
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
  /\b(?:on|by|until|till|from|before|after|free|available|avail|date|move|moving|keys|book|booked|come|due|this|next|is|do|suit|suits|works?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;

/** "Unit 5/12", "apt 3/4": the slash is an address, never a date. */
const UNIT_BEFORE = /\b(?:unit|u|apt|apartment|flat|lot|shop|suite|villa|townhouse|no\.?)\s*$/i;
/** "5/12 Park Rd": a street after the number. */
const STREET_AFTER =
  /^\s+(?:[A-Z][a-z]+\s+){1,3}(?:st|street|rd|road|ave|avenue|dr|drive|cres|crescent|ct|court|pl|place|pde|parade|tce|terrace|hwy|highway|way|lane|ln|cl|close|blvd|boulevard|gr|grove)\b/;

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
  /** -1 when no month was written ("Sat 3rd"): resolved from the weekday. */
  month: number;
  year?: number;
  /** "Sat 3rd": the weekday written with a month-less day. */
  weekday?: number;
  /** "Sat 26 or Sun 27 Sep": the first of two days offered, same month. */
  option?: { day: number; weekday?: number };
  /** "Sunday 4th? or 20/10": a second day offered in its own words, the fallback. */
  alt?: DateHit;
};

const WEEKDAY_WORD = String.raw`(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)`;

/** "Sat 3rd", "Saturday the 3rd": a weekday and a day, no month. */
const WEEKDAY_DAY = new RegExp(
  String.raw`\b${WEEKDAY_WORD}\.?,?\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b(?!\s*(?:\/|of\b|-|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|am\b|pm\b|:|\.\d|hours?|hrs?|bed|room|window|door|sq|m2|metre|meter|people|guests))`,
  "gi",
);

/** "Sat 26 or Sun 27 Sep", "26th or 27th September": two days offered. */
const TWO_DAYS = new RegExp(
  String.raw`\b(?:${WEEKDAY_WORD}\.?,?\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:or|\/)\s*(?:${WEEKDAY_WORD}\.?,?\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\b${YEAR}`,
  "gi",
);

/** Dates about something other than the job. */
const CONTEXT_WORDS =
  /\b(inspection|inspect(?:ed|ing)?|moving out|move[sd]? out|moving|move in|keys?|handover|hand(?:ing)? over|settlement|lease (?:ends?|finishes|is up)|vacat(?:e|ing)|open home|real estate)\b/i;

/**
 * "Can you come Sunday?": a weekday written out in full with no date is the
 * next one. Full names only - "sat" and "sun" are also words.
 */
const WEEKDAY_ALONE =
  /\b(?:this\s+|next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(s?)\b(?![,.]?\s+(?:the\s+)?\d)(?!\s+(?:morning|arvo|afternoon|night|evening)s?\b)/gi;

const WEEKDAY_STEM = String.raw`(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*`;

/** "Monday to Wednesday", "Mon-Wed": a stretch of their week, never a date. */
const WEEKDAY_RANGE = new RegExp(
  String.raw`\b${WEEKDAY_STEM}\s*(?:to|-|–|through|thru|till|until)\s*${WEEKDAY_STEM}\b`,
  "gi",
);

/** "Thursday or Friday": either day of the week, a preference and not a date. */
const WEEKDAY_PAIR =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\s*(?:or|\/)\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b(?![,.]?\s+(?:the\s+)?\d)/gi;

/** "I work from home Monday", "I'm home Tuesday": their own week, not the job. */
const OWN_SCHEDULE =
  /\b(?:i|we)\s*(?:'m|am|are|'re)?\s*(?:work|working|home|at home|at work|off|in the office)\b/i;

/** Weekdays that are a preference or their own week: never read as a date. */
type WeekdayWords = { skip: Set<number>; preference?: string };

/** Where the sentence holding a position starts. */
function sentenceStartAt(text: string, index: number): number {
  const before = text.slice(0, index);
  return (
    Math.max(
      before.lastIndexOf("."),
      before.lastIndexOf("!"),
      before.lastIndexOf("?"),
      before.lastIndexOf("\n"),
    ) + 1
  );
}

/** The sentence holding a position. */
function sentenceAt(text: string, index: number): string {
  const before = text.slice(0, index);
  const start =
    Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("\n")) + 1;
  const rest = text.slice(index);
  const endRel = rest.search(/[.!?\n]/);
  return text.slice(start, endRel === -1 ? text.length : index + endRel);
}

function weekdayWords(text: string): WeekdayWords {
  const skip = new Set<number>();
  const cover = (from: number, length: number) => {
    for (let i = from; i < from + length; i += 1) skip.add(i);
  };
  let preference: string | undefined;
  for (const m of text.matchAll(WEEKDAY_RANGE)) cover(m.index ?? 0, m[0].length);
  for (const m of text.matchAll(WEEKDAY_PAIR)) {
    const at = m.index ?? 0;
    if (skip.has(at)) continue;
    cover(at, m[0].length);
    if (DATE_NEGATED.test(sentenceAt(text, at))) continue;
    preference ??= `${capitalise(m[1]!.toLowerCase())} or ${capitalise(m[2]!.toLowerCase())}`;
  }
  for (const m of text.matchAll(WEEKDAY_ALONE)) {
    const at = m.index ?? 0;
    if (skip.has(at)) continue;
    const sentence = sentenceAt(text, at);
    if (OWN_SCHEDULE.test(sentence) && !DATE_ASKS.test(sentence)) {
      cover(at, m[0].length);
      continue;
    }
    // "tuesdays pref": every Tuesday, a preference - never the next Tuesday.
    if (m[2]) {
      cover(at, m[0].length);
      if (!DATE_NEGATED.test(sentence)) preference ??= `${capitalise(m[1]!.toLowerCase())}s`;
    }
  }
  return { skip, ...(preference ? { preference } : {}) };
}

/**
 * A loose ask with no one date: quoted back in their words, never resolved.
 * "tomorrow" stays as words too - a message pasted a day late would make any
 * date worked out from it wrong.
 */
const APPROX = [
  /\b(?:the\s+)?week\s+(?:of|starting|beginning|commencing)\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\b/i,
  /\b(?:this|next)\s+(?:week(?:end)?|fortnight|month)\b/i,
  /\bthis\s+arvo\b/i,
  /\b(?:in\s+)?(?:the\s+)?next\s+(?:few\s+days|couple\s+(?:of\s+)?weeks|week\s+or\s+two)\b/i,
];

function approxAsk(text: string): { span: string } | undefined {
  for (const re of APPROX) {
    const m = re.exec(text);
    if (!m) continue;
    const { before, after } = clauseAround(text, m.index, m[0].length);
    if (contextOf(before, after) || HISTORY.test(before)) continue;
    if (DATE_NEGATED.test(sentenceAt(text, m.index))) continue;
    // "The week of the 12th" at the start of their sentence reads mid-sentence
    // in a reply: "You mentioned the week of the 12th".
    const span = m[0].trim();
    return { span: span.charAt(0).toLowerCase() + span.slice(1) };
  }
  return undefined;
}

/** "Sunday 4th? or 20/10", "the 3rd, otherwise the 10th": two days offered, first preferred. */
const OR_BETWEEN =
  /^\s*[?,]?\s*(?:or|otherwise|or else|failing that|else)\s+(?:on\s+|the\s+|maybe\s+)?(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+(?:the\s+)?)?$/i;

/** A clause about something already done: "last clean was on", "they came on". */
const HISTORY =
  /\b(?:last|previous|prior|our old)\s+(?:clean|cleaner|job|visit|service|time|quote|booking|paint|painter|one)\b|\b(?:was|were|came|did|had)\s+(?:done\s+)?(?:on|in)?\s*(?:the\s+)?$/i;

function monthlessHits(text: string, skip: Set<number> = new Set()): DateHit[] {
  const hits: DateHit[] = [];
  for (const m of text.matchAll(WEEKDAY_DAY)) {
    const weekday = weekdayIndex(m[1]!);
    if (weekday === undefined) continue;
    hits.push({ index: m.index ?? 0, length: m[0].length, day: Number(m[2]), month: -1, weekday });
  }
  for (const m of text.matchAll(WEEKDAY_ALONE)) {
    const weekday = weekdayIndex(m[1]!);
    if (weekday === undefined || skip.has(m.index ?? 0)) continue;
    hits.push({ index: m.index ?? 0, length: m[0].length, day: 0, month: -1, weekday });
  }
  return hits;
}

function optionHits(text: string): DateHit[] {
  const hits: DateHit[] = [];
  for (const m of text.matchAll(TWO_DAYS)) {
    const month = monthIndex(m[5]!);
    if (month === undefined) continue;
    const first = m[1] ? weekdayIndex(m[1]) : undefined;
    hits.push({
      index: m.index ?? 0,
      length: m[0].length,
      day: Number(m[4]),
      month,
      year: m[6] ? Number(m[6]) : undefined,
      option: { day: Number(m[2]), ...(first !== undefined ? { weekday: first } : {}) },
    });
  }
  return hits;
}

function collectHits(text: string, skip: Set<number> = new Set()): DateHit[] {
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
    // "Unit 5/12 Park Rd": an address, never 5 December.
    if (!m[3] && (UNIT_BEFORE.test(text.slice(0, index)) || STREET_AFTER.test(after))) continue;
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
  hits.push(...optionHits(text), ...monthlessHits(text, skip));
  // First written first; a hit inside an earlier one is the same date, and of
  // two starting together the longer ("Sat 26 or Sun 27 Sep") wins.
  const sorted = hits.sort((a, b) => a.index - b.index || b.length - a.length);
  const out: DateHit[] = [];
  for (const h of sorted) {
    const prev = out[out.length - 1];
    if (prev && h.index < prev.index + prev.length) continue;
    out.push(h);
  }
  return pairOffered(text, out);
}

/** Two days written "X or Y" become one offer: the first, or the second if not. */
function pairOffered(text: string, hits: DateHit[]): DateHit[] {
  const out: DateHit[] = [];
  for (let i = 0; i < hits.length; i += 1) {
    const a = hits[i]!;
    const b = hits[i + 1];
    const between = b ? text.slice(a.index + a.length, b.index) : "";
    if (b && !a.option && !b.option && OR_BETWEEN.test(between)) {
      out.push({ ...a, alt: b });
      i += 1;
      continue;
    }
    out.push(a);
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

/** "Sat 3rd": the next Saturday the 3rd, within about two months, or nothing. */
function resolveMonthless(hit: DateHit, today: Date): Resolved {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // A weekday alone: the next one after today.
  if (hit.day === 0) {
    const ahead = (hit.weekday! - start.getDay() + 7) % 7 || 7;
    return {
      kind: "date",
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + ahead),
    };
  }
  for (let i = 0; i <= 62; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (d.getDate() === hit.day && d.getDay() === hit.weekday) return { kind: "date", date: d };
  }
  return { kind: "invalid" };
}

function resolveHit(hit: DateHit, before: string, today: Date): Resolved {
  if (hit.month === -1) return resolveMonthless(hit, today);
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
/** Two days offered: both must be real future days, or neither is read. */
function readOptions(
  text: string,
  hit: DateHit,
  before: string,
  today: Date,
): DateReading["options"] | undefined {
  const second = resolveHit(hit, before, today);
  if (second.kind !== "date" || !hit.option) return undefined;
  const firstHit: DateHit = { ...hit, day: hit.option.day };
  const first = resolveHit(firstHit, "", today);
  if (first.kind !== "date") return undefined;
  if (hit.option.weekday !== undefined && first.date.getDay() !== hit.option.weekday) {
    return undefined;
  }
  const span = text
    .slice(hit.index, hit.index + hit.length)
    .replace(/\s+/g, " ")
    .trim();
  const asked = asksAboutDate(text, hit.index);
  const days = [readOf(first.date, span, asked), readOf(second.date, span, asked)];
  const label = `${format(first.date, "EEE d", { locale: enAU })} or ${format(second.date, "EEE d MMM", { locale: enAU })}`;
  return { days, label, span };
}

/**
 * "this Sunday 4th? or 20/10 if not": both must be real future days, or the
 * offer is not read as one. The first is what they want; the second is the
 * fallback, kept in that order.
 */
function readOffered(
  text: string,
  a: DateHit,
  b: DateHit,
  before: string,
  today: Date,
): DateReading["options"] | undefined {
  const first = resolveHit({ ...a, alt: undefined }, before, today);
  const second = resolveHit(b, text.slice(Math.max(0, b.index - 14), b.index), today);
  if (first.kind !== "date" || second.kind !== "date") return undefined;
  // Their words from the first weekday: "Sun 11 Oct or Sat 17 Oct".
  const lead = WEEKDAY_BEFORE.exec(text.slice(Math.max(0, a.index - 14), a.index));
  const from = a.index - (lead?.[0].length ?? 0);
  const span = text
    .slice(from, b.index + b.length)
    .replace(/\?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const asked = asksAboutDate(text, a.index) || asksAboutDate(text, b.index);
  const days = [readOf(first.date, span, asked), readOf(second.date, span, asked)];
  const sameMonth = first.date.getMonth() === second.date.getMonth();
  const label = `${format(first.date, sameMonth ? "EEE d" : "EEE d MMM", { locale: enAU })} or ${format(second.date, "EEE d MMM", { locale: enAU })}`;
  return { days, label, span };
}

/** The sentence around a date names a move-out, an inspection or the keys. */
/** "the week of 12 October": the whole week is ruled out, not only the day. */
const WEEK_OF_BEFORE =
  /\b(?:week|weekend|fortnight)\s+(?:of|starting|beginning|commencing)\s+(?:the\s+)?$/i;

/** "vacate clean", "move out clean": the job itself, never a day about something else. */
const CONTEXT_IS_THE_JOB = /^\s*(?:clean|cleaning|cleans)\b/i;
/** A request after the context word makes the day the job's own: "settlement is 30/10 so we need ...". */
const JOB_REQUEST = /\b(?:need|needs|want|wants|book|booking|have it|get it|like it)\b/i;
/** "... fri 16th before the inspection": the day is before the context, so it is the job's. */
const BEFORE_CONTEXT = /\b(?:before|prior to|ahead of)\s+(?:the\s+|my\s+|our\s+|their\s+)?$/i;

function contextOf(before: string, after: string): string | undefined {
  const all = [...before.matchAll(new RegExp(CONTEXT_WORDS.source, "gi"))].filter(
    (m) => !CONTEXT_IS_THE_JOB.test(before.slice((m.index ?? 0) + m[0].length)),
  );
  const last = all[all.length - 1];
  if (last) {
    const rest = before.slice((last.index ?? 0) + last[0].length);
    if (!JOB_REQUEST.test(rest)) return last[1]!.toLowerCase();
    return undefined;
  }
  const head = after.slice(0, 25);
  const ahead = CONTEXT_WORDS.exec(head);
  if (!ahead) return undefined;
  if (CONTEXT_IS_THE_JOB.test(head.slice(ahead.index + ahead[0].length))) return undefined;
  if (BEFORE_CONTEXT.test(head.slice(0, ahead.index))) return undefined;
  return ahead[1]!.toLowerCase();
}

/** "before inspection sat", "before the settlement on Friday": the context day after a job day. */
const FOLLOWING_CONTEXT = new RegExp(
  String.raw`^\s*[,(]?\s*(?:before|prior to|ahead of)\s+(?:the\s+|my\s+|our\s+|their\s+)?(${CONTEXT_WORDS.source.slice(3, -3)})(?:\s+(?:is\s+|on\s+)?(?:(?:this|next)\s+)?${WEEKDAY_WORD}\b)?`,
  "i",
);

/** "trial" in the words that govern the day: a separate appointment, never the job day. */
const TRIAL_WORD = /\btrials?\b/i;
/** "... 24 October for the trial": the trial named just after the day. */
const TRIAL_AFTER = /^\s*,?\s*(?:for|as)\s+(?:a|the|my|our)\s+(?:\w+\s+)?trials?\b/i;
/** "by", "before", "no later than": the job must be done by this day. */
const DEADLINE_CUE = /\b(?:by|before|no later than|prior to|ahead of)\s+(?:the\s+)?\(?\s*$/i;
/** "the day before (29/10)": the day in brackets is the day they want. */
const DAY_BEFORE_BRACKET = /\bthe\s+day\s+before\s*\(\s*$/i;
/** "the day before 30/10": the day they want is the one before the day written. */
const DAY_BEFORE = /\bthe\s+day\s+before\s*$/i;

/**
 * Event words, each about the day written just after it in the same clause:
 * "wedding on 8 Nov and engagement party on 22 Nov" gives each its own. Never
 * "bridal" or "bride": those name the service, not a fixed day.
 */
const EVENT_WORD =
  /\b((?:engagement|birthday|hens|bucks|christmas|farewell|retirement|work|surprise)\s+party|wedding|married|marrying|formal|birthday|party|funeral|memorial|christening|baptism|engagement|graduation|anniversary|hens|bucks|baby\s+shower|gala|ball|recital|photo\s*shoot|ceremony|reception)\b/gi;
/** "my daughter's 18th", "our 21st": a birthday by its number. */
const ORDINAL_BIRTHDAY = /\b(?:my|our|his|her|their|[a-z]+'s)\s+\d{1,2}(?:st|nd|rd|th)\b/i;
/** The event already happened: never the job's fixed day. */
const PAST_EVENT = /\b(?:was|were|went|had|last\s+(?:week|month|year|weekend)|ago)\b/i;

type Classified = { role: DateRole; what?: string; dayBefore?: "bracket" | "shift" };

/**
 * What a plain day is for, read only from the words that govern it - from
 * the start of its sentence or the day before it, whichever is nearer - and a
 * few words after it. A trial, the day before something, the day it must be
 * done by, a fixed event, or the job. When the enquiry's service is itself a
 * trial, a trial's day is the job's.
 */
function classify(
  text: string,
  hit: { index: number; length: number },
  governing: string,
  opts: { trialIsTheJob: boolean },
): Classified {
  const tail = text.slice(hit.index + hit.length, hit.index + hit.length + 60);
  // "done by Friday 23 October": the weekday is part of the day, not the words before it.
  const lead = governing.replace(WEEKDAY_BEFORE, "");
  if (DAY_BEFORE_BRACKET.test(lead))
    return { role: "job", what: "day before", dayBefore: "bracket" };
  if (DAY_BEFORE.test(lead)) return { role: "job", what: "day before", dayBefore: "shift" };
  if (!opts.trialIsTheJob && (TRIAL_WORD.test(lead) || TRIAL_AFTER.test(tail))) {
    return { role: "trial", what: "trial" };
  }
  if (DEADLINE_CUE.test(lead)) return { role: "deadline" };
  // "need it done fri 16th before inspection sat": the day before the context.
  const following = FOLLOWING_CONTEXT.exec(tail);
  if (following) return { role: "deadline", what: following[1]!.toLowerCase() };
  if (!PAST_EVENT.test(lead)) {
    const events = [...lead.matchAll(new RegExp(EVENT_WORD.source, "gi"))];
    const last = events[events.length - 1];
    if (last) {
      const word = last[1]!.toLowerCase().replace(/\s+/g, " ");
      return { role: "event", what: /^marr/.test(word) ? "wedding" : word };
    }
    if (ORDINAL_BIRTHDAY.test(lead)) return { role: "event", what: "birthday" };
  }
  return { role: "job" };
}

/** Words a day can be echoed back from: a month, a weekday, or a full numeric date. */
const SAYS_A_DAY =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/i;

/**
 * Whether a day read from their message may be said back to them: their own
 * words for it are in the message, and name a month, a weekday or a full date.
 * "5/12" beside an address is never echoed as "Saturday 5 December".
 */
export function echoable(span: string | null | undefined, message: string): boolean {
  const said = (span ?? "").trim();
  if (!said || !SAYS_A_DAY.test(said)) return false;
  const norm = (s: string) =>
    s
      .replace(/\bb4\b/gi, "before")
      .replace(/\s+/g, " ")
      .toLowerCase();
  return norm(message).includes(norm(said));
}

/** "a trial in December": a month governed by "trial", the next time it comes round. */
const TRIAL_MONTH = new RegExp(
  String.raw`\btrials?\b[^,.;!?\n]{0,25}?\b(?:in|during|early|mid|late|sometime in|around)\s+${MONTH}\b(?!\s*\d)`,
  "gi",
);

function trialMonths(text: string, today: Date, trialIsTheJob: boolean): ContextDate[] {
  const out: ContextDate[] = [];
  for (const m of text.matchAll(TRIAL_MONTH)) {
    const month = monthIndex(m[1]!);
    if (month === undefined) continue;
    const said = /\b(?:in|during|early|mid|late|sometime in|around)\s+\S+$/i.exec(m[0]);
    const index = (m.index ?? 0) + (said?.index ?? 0);
    const year = month >= today.getMonth() ? today.getFullYear() : today.getFullYear() + 1;
    const from = new Date(year, month, 1);
    const to = new Date(year, month + 1, 0);
    const read = readOf(from, (said?.[0] ?? m[0]).trim(), asksAboutDate(text, index));
    out.push({
      ...read,
      label: format(from, "MMMM", { locale: enAU }),
      to: readOf(to, "", false).iso,
      // A makeup trial booked for itself: that month is when the job is wanted.
      role: trialIsTheJob ? "job" : "trial",
      what: trialIsTheJob ? "" : "trial",
    });
  }
  return out;
}

/** A weekday written before a day in a stretch: "between Friday 16 and Sunday 18 October". */
const WD = String.raw`(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+(?:the\s+)?)?`;

/** "between 12 and 16 October", "from the 2nd to the 9th of November". */
const WINDOW_SAME_MONTH = new RegExp(
  String.raw`\b(?:between|from)\s+(?:the\s+)?${WD}(\d{1,2})(?:st|nd|rd|th)?\s*(?:and|to|-|–|until|till)\s*(?:the\s+)?${WD}(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\b`,
  "i",
);
/** "12-16 October": one month, two days, a dash between. */
const WINDOW_DASH = new RegExp(
  String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\b`,
  "i",
);
/** "between 28 October and 3 November". */
const WINDOW_TWO_MONTHS = new RegExp(
  String.raw`\b(?:between|from)\s+(?:the\s+)?${WD}(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\s*(?:and|to|-|–|until|till)\s*(?:the\s+)?${WD}(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\b`,
  "i",
);
/** "except Friday", "not weekends", "no Sundays": a weekday ruled out with no date. */
const EXCEPT_DAYS = new RegExp(
  String.raw`\b(?:except|excluding|other than|apart from|but not|not|no)\s+(?:on\s+)?(?:(?:a|the)\s+)?(weekends?|${WEEKDAY_WORD})s?\b(?![,.]?\s+(?:the\s+)?\d)`,
  "gi",
);
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function exceptDaysIn(text: string): number[] {
  const out = new Set<number>();
  for (const m of text.matchAll(EXCEPT_DAYS)) {
    const word = m[1]!.toLowerCase();
    if (word.startsWith("weekend")) [0, 6].forEach((d) => out.add(d));
    else {
      const d = weekdayIndex(word);
      if (d !== undefined) out.add(d);
    }
  }
  return [...out].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}

/** "not Fri", "not weekends". */
function exceptLabel(days: readonly number[]): string {
  if (days.length === 2 && days.includes(0) && days.includes(6)) return "not weekends";
  return `not ${days.map((d) => WEEKDAY_SHORT[d]).join(" or ")}`;
}

function exceptWords(days: readonly number[]): string {
  if (days.length === 2 && days.includes(0) && days.includes(6)) return "not weekends";
  return `not ${days.map((d) => `${capitalise(WEEKDAY_NAMES[d]!)}s`).join(" or ")}`;
}

type Taken = [number, number];

/**
 * "sometime between 2 and 9 November, not weekends": a stretch of days they
 * are free, read as one window. Never one day of it - the last day of a range
 * is not the day they asked for, and a weekday they ruled out is not a date.
 */
function readWindow(
  text: string,
  today: Date,
): { window: DateReading["window"]; at: Taken } | undefined {
  const two = WINDOW_TWO_MONTHS.exec(text);
  const same = two ? null : (WINDOW_SAME_MONTH.exec(text) ?? WINDOW_DASH.exec(text));
  const m = two ?? same;
  if (!m) return undefined;
  const index = m.index ?? 0;
  const { before, after } = clauseAround(text, index, m[0].length);
  if (contextOf(before, after) || HISTORY.test(before)) return undefined;
  if (/\b(?:away|not|busy|unavailable|except)\b|n't\b/i.test(before)) return undefined;
  const fromMonth = monthIndex(two ? m[2]! : m[3]!);
  const toMonth = monthIndex(two ? m[4]! : m[3]!);
  const fromDay = Number(m[1]);
  const toDay = Number(two ? m[3] : m[2]);
  if (fromMonth === undefined || toMonth === undefined) return undefined;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let year = today.getFullYear();
  let to = new Date(year, toMonth, toDay);
  if (to < start) {
    year += 1;
    to = new Date(year, toMonth, toDay);
  }
  const from = new Date(toMonth < fromMonth ? year - 1 : year, fromMonth, fromDay);
  if (
    !validDay(from.getFullYear(), fromMonth, fromDay) ||
    !validDay(to.getFullYear(), toMonth, toDay) ||
    from > to
  ) {
    return undefined;
  }
  const except = exceptDaysIn(text);
  const sameMonth = fromMonth === toMonth;
  const label = `${sameMonth ? from.getDate() : format(from, "d MMM", { locale: enAU })}-${format(to, "d MMM", { locale: enAU })}${except.length ? `, ${exceptLabel(except)}` : ""}`;
  const said = m[0].replace(/\s+/g, " ").trim();
  return {
    window: {
      from: readOf(from, said, true).iso,
      to: readOf(to, said, true).iso,
      except,
      label,
      span: except.length ? `${said} (${exceptWords(except)})` : said,
    },
    at: [index, index + m[0].length],
  };
}

/** "this sat or sun", "next tues", "this Saturday or Sunday": the coming days, as dates. */
const THIS_NEXT = new RegExp(
  String.raw`\b(?:this|next|coming)\s+${WEEKDAY_WORD}\b(?:\s*(?:or|\/|&)\s*(?:(?:this|next)\s+)?${WEEKDAY_WORD}\b)?(?![,.]?\s+(?:the\s+)?\d)(?!\s+(?:morning|arvo|afternoon|night|evening)s?\b)`,
  "i",
);

function readThisNext(
  text: string,
  today: Date,
): { one?: JobDateRead; two?: DateReading["options"]; at: Taken } | undefined {
  const m = THIS_NEXT.exec(text);
  if (!m) return undefined;
  const index = m.index ?? 0;
  if (DATE_NEGATED.test(sentenceAt(text, index))) return undefined;
  // "our lease ends this Thursday": about the lease, not the job's day.
  const around = clauseAround(text, index, m[0].length);
  if (contextOf(around.before, around.after)) return undefined;
  const first = weekdayIndex(m[1]!);
  if (first === undefined) return undefined;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const ahead = (first - start.getDay() + 7) % 7 || 7;
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate() + ahead);
  const span = m[0].replace(/\s+/g, " ").trim();
  const asked = asksAboutDate(text, index);
  const at: Taken = [index, index + m[0].length];
  const second = m[2] ? weekdayIndex(m[2]) : undefined;
  if (second === undefined) return { one: readOf(a, span, asked), at };
  const gap = (second - first + 7) % 7 || 7;
  const b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + gap);
  const sameMonth = a.getMonth() === b.getMonth();
  const label = `${format(a, sameMonth ? "EEE d" : "EEE d MMM", { locale: enAU })} or ${format(b, "EEE d MMM", { locale: enAU })}`;
  return { two: { days: [readOf(a, span, asked), readOf(b, span, asked)], label, span }, at };
}

/** "tmrw", "tomorrow arvo": tomorrow, as a date, with the day said in the reply. */
const TOMORROW =
  /\b(?:tomorrow|tmrw|tmr|tomoz|2moro)\b(?:\s+(morning|arvo|afternoon|evening|night|am|pm))?/i;

function readTomorrow(text: string, today: Date): JobDateRead | undefined {
  const m = TOMORROW.exec(text);
  if (!m) return undefined;
  const index = m.index ?? 0;
  const { before, after } = clauseAround(text, index, m[0].length);
  if (contextOf(before, after) || DATE_NEGATED.test(sentenceAt(text, index))) return undefined;
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  // Stored as the day itself, never "tomorrow": a reply sent after midnight
  // would otherwise name the wrong day.
  const part = m[1] ? DAY_PART[m[1].toLowerCase()] : undefined;
  const span = `${format(date, "EEEE d MMMM", { locale: enAU })}${part ? ` (${part})` : ""}`;
  return readOf(date, span, true);
}

const DAY_PART: Record<string, string> = {
  morning: "morning",
  am: "morning",
  arvo: "afternoon",
  afternoon: "afternoon",
  pm: "afternoon",
  evening: "evening",
  night: "evening",
};

/** "keys on the 1st": a day of the month beside a move or the keys, read in the window's month. */
const CONTEXT_DAY = new RegExp(
  String.raw`\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b(?!\s+(?:of\s+)?${MONTH})`,
  "gi",
);

function contextDays(text: string, today: Date, window: DateReading["window"]): ContextDate[] {
  const out: ContextDate[] = [];
  for (const m of text.matchAll(CONTEXT_DAY)) {
    const index = m.index ?? 0;
    const { before, after } = clauseAround(text, index, m[0].length);
    const what = contextOf(before, after);
    if (!what) continue;
    const day = Number(m[1]);
    const anchor = window ? new Date(`${window.from}T00:00:00`) : null;
    let date = anchor
      ? new Date(anchor.getFullYear(), anchor.getMonth(), day)
      : new Date(today.getFullYear(), today.getMonth(), day);
    if (!anchor && date <= today) date = new Date(today.getFullYear(), today.getMonth() + 1, day);
    if (date.getDate() !== day) continue;
    out.push({ ...readOf(date, m[0].trim(), false), what });
  }
  return out;
}

export function readDates(
  written: string,
  now = new Date(),
  tz = "Australia/Brisbane",
  opts: { service?: string } = {},
): DateReading {
  // "b4 inspection" is "before inspection": same words, read the same way.
  const text = written.replace(/\bb4\b/gi, "before");
  const today = wallNow(now, tz);
  // "could I book a makeup trial on Saturday 17 October": the trial is the job.
  const trialIsTheJob = TRIAL_WORD.test(opts.service ?? "");
  const reading: DateReading = { unavailable: [], context: [], asap: asksForAsap(text) };
  const plain: (JobDateRead & { dated: boolean; echo?: boolean })[] = [];
  const weekdays = weekdayWords(text);
  const window = readWindow(text, today);
  const soon = window ? undefined : readThisNext(text, today);
  const taken: Taken[] = [...(window ? [window.at] : []), ...(soon ? [soon.at] : [])];
  const inTaken = (i: number) => taken.some(([a, b]) => i >= a && i < b);
  if (window) {
    reading.window = window.window;
    reading.context.push(...contextDays(text, today, window.window));
  }
  if (soon?.two) reading.options = soon.two;
  if (soon?.one) plain.push({ ...soon.one, dated: true, echo: true });
  const exceptDays = exceptDaysIn(text);
  // One of two offered days that does not read as a future day leaves each
  // to be read on its own.
  const hits = collectHits(text, weekdays.skip)
    .filter((h) => !inTaken(h.index))
    .flatMap((h) => {
      if (!h.alt) return [h];
      const { before } = clauseAround(text, h.index, h.length);
      const offered = readOffered(text, h, h.alt, before, today);
      if (offered) {
        reading.options ??= offered;
        return [];
      }
      return [{ ...h, alt: undefined }, h.alt];
    });
  let prevEnd = 0;
  for (const hit of hits) {
    const { before, after } = clauseAround(text, hit.index, hit.length);
    // The words that govern this day: from the start of its sentence or the
    // end of the day before it, whichever is nearer.
    const lead = text.slice(Math.max(sentenceStartAt(text, hit.index), prevEnd), hit.index);
    prevEnd = hit.index + hit.length;
    if (hit.option) {
      const options = readOptions(text, hit, before, today);
      if (options) {
        reading.options ??= options;
        continue;
      }
      // One of the two has passed (or does not read): the day still asked
      // about is read on its own below, never dropped.
    }
    const resolved = resolveHit(hit, before, today);
    if (resolved.kind === "invalid") continue;
    const span = writtenSpan(text, hit, before);
    const written = text.slice(hit.index, hit.index + hit.length).trim();
    const boundary = BOUNDARY_BEFORE.test(before);
    const excluded = (EXCLUDE_BEFORE.test(before) || EXCLUDE_AFTER.test(after)) && !boundary;
    if (excluded) {
      // "except Friday" rules out a weekday, not the next Friday: it is kept
      // with the weekdays ruled out, never shown as a date they never wrote.
      if (hit.day === 0 && hit.month === -1) continue;
      // A day ruled out is never the job date. Recorded only when it is a real
      // future day that reads plainly; anything muddier is simply dropped.
      if (resolved.kind === "date") {
        const read = readOf(resolved.date, span, false);
        const week = WEEK_OF_BEFORE.exec(before);
        reading.unavailable.push(
          week ? { ...read, label: `${week[0].trim()} ${read.label}` } : read,
        );
      }
      continue;
    }
    // "away until 3 October": a boundary, not the day they want.
    if (boundary && /\b(?:away|not|busy|unavailable)\b|n't\b/i.test(before)) continue;
    // "we move out Mon 5 Oct", "inspection on the 7th": about something else.
    const context = contextOf(before, after);
    if (context && resolved.kind === "date") {
      reading.context.push({
        ...readOf(resolved.date, span, false),
        what: context,
        role: "context",
      });
      continue;
    }
    // "Last clean was on 3 Sept": history, not a request. It is never the job
    // date and never a problem line in the reply.
    if (HISTORY.test(before)) continue;
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
    const asked = asksAboutDate(text, hit.index);
    const kind = classify(text, hit, lead, { trialIsTheJob });
    // "Also can you do a trial on 24 October?": the trial's own day, never the job's.
    if (kind.role === "trial") {
      reading.context.push({ ...readOf(resolved.date, span, asked), what: "trial", role: "trial" });
      continue;
    }
    // "the day before 30/10": the day they want is the one before it.
    const day =
      kind.dayBefore === "shift"
        ? new Date(
            resolved.date.getFullYear(),
            resolved.date.getMonth(),
            resolved.date.getDate() - 1,
          )
        : resolved.date;
    const said = kind.dayBefore === "shift" ? `the day before ${written}` : span;
    plain.push({
      ...readOf(day, said, asked),
      ...(kind.role !== "job" ? { role: kind.role } : {}),
      ...(kind.what ? { what: kind.what } : {}),
      dated: hit.day > 0,
      echo: SAYS_A_DAY.test(said),
    });
    // "need it done fri 16th before inspection sat": the inspection is its own day.
    const following = FOLLOWING_CONTEXT.exec(after);
    if (following && kind.role === "deadline") {
      const weekday = following[2] ? weekdayIndex(following[2]) : undefined;
      if (weekday !== undefined) {
        const gap = (weekday - resolved.date.getDay() + 7) % 7 || 7;
        const next = new Date(
          resolved.date.getFullYear(),
          resolved.date.getMonth(),
          resolved.date.getDate() + gap,
        );
        reading.context.push({
          ...readOf(next, following[0].trim(), false),
          what: following[1]!.toLowerCase(),
          role: "context",
        });
      }
    }
  }
  // A day they asked to book always wins. Then the day it must be done by,
  // then the fixed event the job is for (the wedding) - but only when no
  // other day is given - then a written date over a bare weekday, then the
  // first plain date written. Two days offered means neither is the job date.
  const isJob = (d: { role?: DateRole }) => !d.role || d.role === "job";
  const pick =
    plain.find((d) => isJob(d) && d.asked && d.dated) ??
    plain.find((d) => isJob(d) && d.asked) ??
    plain.find((d) => d.role === "deadline") ??
    plain.find((d) => isJob(d) && d.dated) ??
    plain.find((d) => d.role === "event") ??
    plain.find(isJob) ??
    plain[0];
  // A window they are free in is the ask: no one day of it is the job date.
  if (!reading.options && !reading.window && pick) {
    const { dated: _dated, echo: _echo, ...jobDate } = pick;
    reading.jobDate = jobDate;
  }
  // Every other day they wrote is still said back, never silently dropped -
  // but only a day their own words name ("5/12" beside an address is not).
  for (const d of plain) {
    if (d === pick && reading.jobDate) continue;
    if (reading.jobDate?.iso === d.iso) continue;
    const { dated: _dated, echo, role, what, ...other } = d;
    if (!echo && !d.asked && (!role || role === "job")) continue;
    reading.context.push({ ...other, what: what ?? "", role: role ?? "job" });
  }
  // "the day before (29/10)" beside settlement: the row says what it is before.
  const job = reading.jobDate;
  if (job?.what === "day before") {
    const next = reading.context.find((d) => d.role === "context" && d.iso > job.iso);
    reading.jobDate = {
      ...job,
      label: `${job.label} (day before ${next?.what || format(new Date(`${job.iso}T00:00:00`).getTime() + 86_400_000, "EEE d MMM", { locale: enAU })})`,
    };
  }
  reading.context.push(...trialMonths(text, today, trialIsTheJob));
  if (weekdays.preference && !soon?.two) reading.preference = weekdays.preference;
  if (!reading.jobDate && !reading.options && !reading.window && !reading.issue) {
    const tomorrow = readTomorrow(text, today);
    if (tomorrow) reading.jobDate = tomorrow;
  }
  if (!reading.jobDate && !reading.options && !reading.window && !reading.issue) {
    const approx = approxAsk(text);
    if (approx) reading.approx = approx;
  }
  if (exceptDays.length) reading.exceptDays = exceptDays;
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
    // Not a person: "Urgent", "Mum", "No Name", "The Smiths".
    ...[
      "urgent",
      "important",
      "mum",
      "mom",
      "mummy",
      "dad",
      "nan",
      "nana",
      "gran",
      "grandma",
      "grandpa",
    ],
    ...["the", "no", "name", "unknown", "anonymous", "family", "hubby", "wife", "husband", "owner"],
    ...["tenant", "landlord", "customer", "client", "admin", "reception", "enquiry", "quote"],
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
/** "Priya Nair", or two first names joined as written: "Margaret & Tony", "Margaret and Tony". */
const NAME = String.raw`(${NAME_WORD}(?:\s+(?:&|and)\s+${NAME_WORD})?(?:\s+${NAME_WORD})?)`;
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
/** "Jen here" as an opening self-introduction, with no sign-off to override it. */
const HERE_INTRO = new RegExp(String.raw`^${NAME}${KISS}\s+here\b`);
/** A name line on its own, with an optional trailing company: "Mel Tran", "Priya x",
 * "Paul Nguyen, Nguyen Property Group". */
const NAME_LINE = new RegExp(String.raw`^${NAME}${KISS}${ROLE_TAIL}\s*[.!]?${CONTACT_TAIL}\s*$`);

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
  /**
   * Read from a sign-off line ("Thanks, Jan Whitfield"): a month that is also a
   * first name (Jan, May, June, April, August) is a name there.
   */
  signOff?: boolean;
};

/** Months that are also first names: names only on a sign-off line. */
const MONTH_NAMES_OK = new Set(["jan", "may", "june", "april", "august"]);

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

/** "&"/"and" joins two first names ("Margaret & Tony") - only when what follows
 * really is a name, not a pronoun, a contraction ("I've") or a stray word. */
function isJoinToNextName(word: string, next: string | undefined): boolean {
  if (!/^(?:&|and)$/i.test(word) || !next) return false;
  if (!/^[A-Z]/.test(next) || /^i['’]/i.test(next)) return false;
  return !NOT_A_NAME.has(next.toLowerCase());
}

function acceptName(raw: string | undefined, ctx: NameContext = {}): string | undefined {
  if (!raw) return undefined;
  // Case-insensitive patterns can run on into "Sam and"; a name is only the
  // capitalised words it starts with (plus an "&"/"and" that joins a second one).
  const tokens = raw.trim().split(/\s+/);
  const words: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const w = tokens[i]!;
    if (/^[A-Z]/.test(w)) {
      words.push(w);
      continue;
    }
    if (isJoinToNextName(w, tokens[i + 1])) {
      words.push(w);
      continue;
    }
    break;
  }
  if (words.length === 0) return undefined;
  const refused = (w: string) =>
    NOT_A_NAME.has(w.toLowerCase()) && !(ctx.signOff && MONTH_NAMES_OK.has(w.toLowerCase()));
  if (words.some(refused)) return undefined;
  const lower = words.map((w) => w.toLowerCase());
  if (lower.some((w) => TITLE_WORDS.has(w) || COMPANY_WORDS.has(w))) return undefined;
  if (isPlace(words, ctx)) return undefined;
  const name = words.join(" ");
  return name.length >= 2 ? name : undefined;
}

/** A trailing parenthetical - a phone number, suburb, role or aside - is never
 * part of the name: "Dave (0412 555 019)", "Sarah (Wooloowin)". */
function dropTrailingParen(s: string): string {
  return s.replace(/\s*\([^()]*\)\s*$/, "");
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
    const sign = { ...ctx, signOff: true };
    if (rest) return acceptName(NAME_LINE.exec(rest)?.[1], sign) ?? null;
    const next = lines[i + 1];
    if (!next || i + 1 >= end) return null;
    const name = acceptName(NAME_LINE.exec(next)?.[1], sign);
    if (!name) return null;
    const single = !name.includes(" ");
    if (single && i + 2 >= total && !MONTH_NAMES_OK.has(name.toLowerCase())) return null;
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
  if (!name) return undefined;
  // "Dave" above "Dave's Plumbing": one name, signed as their own business.
  const own = lines.slice(i + 1).some((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}'`));
  return name.includes(" ") || own ? name : undefined;
}

/**
 * What is not the message: emoji ("Thx, Priya 😊"), a phone's footer ("Sent
 * from my iPad"), and a one-line signature split by pipes ("Sarah Nguyen |
 * Office Manager | Acme | 07 3000 1234"), which reads like the lines it is.
 */
const DEVICE_FOOTER =
  /^\s*(?:sent from my\b.*|get outlook for\b.*|sent from (?:yahoo|mail|gmail|outlook)\b.*)$/gim;

function withoutNoise(text: string): string {
  return (
    text
      .replace(/[ \t]*(?:\p{Extended_Pictographic}|\u200d|\ufe0f)+[ \t]*/gu, "\n")
      .replace(DEVICE_FOOTER, "")
      .replace(/[ \t]*\|[ \t]*/g, "\n")
      // "- Dave" at the start of a signature line: the dash is not the name.
      .replace(/^[ \t]*(?:-{1,2}|–|\u2014|~)[ \t]*(?=[A-Z])/gm, "")
      .replace(/[ \t]+$/gm, "")
  );
}

/** A pasted form: "Name: Rachel Nguyen", "Full name - Rachel Nguyen". */
const FORM_NAME = new RegExp(
  String.raw`^\s*(?:full\s+|your\s+|first\s+)?name\s*[:\-–]\s*${NAME}\s*$`,
  "im",
);
/** Kisses before the name on the closing line: "xx Priya", "x Jo". */
const KISS_NAME = new RegExp(String.raw`(?:^|\n|[.!?]\s+)\s*x{1,4}\s+${NAME}\s*[.!]?\s*$`, "i");

export function readCustomerName(text: string, ctx: NameContext = {}): string | undefined {
  const trimmed = dropTrailingParen(withoutNoise(text).trim());
  const field = acceptName(FORM_NAME.exec(trimmed)?.[1], { ...ctx, signOff: true });
  if (field) return field;
  const kissed = acceptName(KISS_NAME.exec(trimmed)?.[1], { ...ctx, signOff: true });
  if (kissed) return kissed;
  const fromLines = nameFromSignOffLines(trimmed, ctx);
  if (fromLines) return fromLines;
  if (fromLines === null) return nameAboveRoleLines(trimmed, ctx);
  return (
    nameAboveRoleLines(trimmed, ctx) ??
    acceptName(SIGN_OFF.exec(trimmed)?.[1], ctx) ??
    acceptName(DASH_NAME.exec(trimmed)?.[1], ctx) ??
    acceptName(TRAILING_NAME.exec(trimmed)?.[1], ctx) ??
    nameBeforeCompany(trimmed, ctx) ??
    acceptName(INTRO.exec(trimmed)?.[1], ctx) ??
    acceptName(HERE_INTRO.exec(trimmed)?.[1], ctx)
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
  /** The service the owner typed, when there is one: a trial service books the trial's day. */
  service = "",
): EnquiryBasics {
  const dates = readDates(text, now, tz, { service });
  return {
    customerName: readCustomerName(text, ctx),
    jobDate: dates.jobDate,
    dates,
    contact: readContact(text),
  };
}

/**
 * "... would suit. Paul Nguyen, Nguyen Property Group" with no sign-off word:
 * a full name then a company or role after a comma, closing the message. Only
 * a two-word name, and only when the tail really is a company or a role.
 */
const NAME_THEN_TAIL = new RegExp(
  String.raw`(?:^|[.!?\n])\s*(${NAME_WORD}\s+${NAME_WORD})\s*,\s*([A-Z][A-Za-z&'.-]*(?:\s+[A-Za-z&'.-]+){0,4})\s*[.!]?\s*$`,
);

function nameBeforeCompany(text: string, ctx: NameContext): string | undefined {
  const m = NAME_THEN_TAIL.exec(text);
  if (!m) return undefined;
  const tail = m[2]!.toLowerCase().split(/\s+/);
  if (!tail.some((w) => COMPANY_WORDS.has(w) || TITLE_WORDS.has(w))) return undefined;
  return acceptName(m[1], ctx);
}
