import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import { wallNow } from "./format.ts";

/**
 * Every day a message mentions, read without deciding what each day is for.
 *
 * The date reader (enquiry-basics.ts) sorts days into the job's day, a
 * deadline, an event or a day about something else, and each role is checked
 * its own way. A day it tagged "not the job date", or one it could not place
 * at all ("27th or 28th"), was never checked against the owner's closed days,
 * so "settlement 28/12 so need it done 27th or 28th" was quoted with "Just let
 * me know if you'd like to go ahead" to an owner closed 24 December to 4
 * January. This sweep reads every date-like fragment on its own, so a closed
 * day is always caught, and a fragment it cannot read is said, never skipped.
 *
 * Rules, stated once:
 *  - "this Thursday" / "coming Thursday" is the next Thursday after today;
 *    "next Thursday" is the Thursday of next week (on Wednesday 30 September
 *    2026, Thursday 1 October and Thursday 8 October; said on Thursday 1
 *    October, "next Thursday" is Thursday 8 October).
 *  - A bare weekday ("Sunday") is the next one after today.
 *  - "27th" with no month takes the month of the nearest date written with
 *    one ("settlement 28/12 ... 27th or 28th" is 27 December); with no month
 *    anywhere, the next time that day comes round. A fragment that still
 *    cannot be a day ("31/9", "Sat 4th" with no Saturday the 4th near) is not
 *    guessed: the owner is told Enquiry could not read it.
 *  - "the week of 9 Nov" is a week, never the 9th alone.
 *  - A day with no year is this year, or next year once it has passed (a day
 *    in the last 60 days is the one that just went, and is not checked).
 */

export type SweptDay = {
  /** yyyy-mm-dd; for a week, its first day. */
  iso: string;
  /** Their words: "27th or 28th", "Sunday 27 December", "the week of 9 Nov". */
  span: string;
  /** Said about something else: the lease ending, settlement, the keys. */
  context?: true;
  /** The last day of a week they named ("the week of 9 Nov"). */
  to?: string;
};

export type DateSweep = { days: SweptDay[]; unread: string[] };

/** The fact the sweep is kept in, read at arrival against the arrival clock. */
export const DATE_SWEEP_FIELD = "date_sweep";
/** The owner's word on a closed day the reply would otherwise not say: `closed_day:2026-12-27`. */
export const CLOSED_DAY_PREFIX = "closed_day:";
/** The owner's word on a fragment Enquiry could not read: `date_check:27th or 28th`. */
export const DATE_CHECK_PREFIX = "date_check:";
/** A day the owner says they mentioned, typed in "They asked for more": `date_added:27 December`. */
export const DATE_ADDED_PREFIX = "date_added:";
export const CLOSED_DAY_CHOICE = { notAvailable: "not_available", available: "available" } as const;

export function isDateAddedField(field: string): boolean {
  return field.trim().toLowerCase().startsWith(DATE_ADDED_PREFIX);
}
export function dateAddedText(field: string): string {
  return field.trim().slice(DATE_ADDED_PREFIX.length).trim();
}
export const DATE_CHECK_CHOICE = { confirm: "confirm", notADate: "not_a_date" } as const;

export function isClosedDayField(field: string): boolean {
  return field.trim().toLowerCase().startsWith(CLOSED_DAY_PREFIX);
}
export function isDateCheckField(field: string): boolean {
  return field.trim().toLowerCase().startsWith(DATE_CHECK_PREFIX);
}
export function closedDayIso(field: string): string {
  return field.trim().slice(CLOSED_DAY_PREFIX.length).trim();
}
export function dateCheckText(field: string): string {
  return field.trim().slice(DATE_CHECK_PREFIX.length).trim();
}
/** The owner's choices each field accepts, or null when the field is not one of these. */
export function sweepChoiceProblem(field: string, value: string): string | null {
  if (isClosedDayField(field)) {
    return Object.values(CLOSED_DAY_CHOICE).includes(value as never)
      ? null
      : "Choose whether the reply says you're not available that day.";
  }
  if (isDateCheckField(field)) {
    return Object.values(DATE_CHECK_CHOICE).includes(value as never)
      ? null
      : "Choose whether the reply says you'll confirm the day.";
  }
  return null;
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
const MONTH = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY = String.raw`(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)`;
const FULL_WEEKDAY = String.raw`(monday|tuesday|wednesday|thursday|friday|saturday|sunday)`;

const DAY_MONTH = new RegExp(
  String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\b(?:,?\s+(\d{4}))?`,
  "gi",
);
const MONTH_DAY = new RegExp(
  String.raw`\b${MONTH}\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?`,
  "gi",
);
const NUMERIC = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
const WEEKDAY_ORDINAL = new RegExp(
  String.raw`\b${WEEKDAY}\.?,?\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b(?!\s*(?:\/|of\b|${MONTH}))`,
  "gi",
);
const ORDINAL = /\b(\d{1,2})(st|nd|rd|th)\b/gi;
/** A weekday written just before a day and month: "Sunday 18 October", "Fri the 16th Oct". */
const WEEKDAY_LEAD = new RegExp(String.raw`\b${WEEKDAY}\.?,?\s+(?:the\s+)?$`, "i");
const THIS_NEXT = new RegExp(
  String.raw`\b(this|coming|next)\s+${WEEKDAY}\b(?![,.]?\s+(?:the\s+)?\d)`,
  "gi",
);
/** "between 12 and 16 October", "12-16 October": a stretch, never its last day alone. */
const WINDOW = new RegExp(
  String.raw`\b(?:(?:between|from)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:and|to|-|–|until|till)\s*|(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–)\s*)(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\b`,
  "gi",
);
const BARE_WEEKDAY = new RegExp(
  String.raw`\b${FULL_WEEKDAY}\b(?!s\b)(?![,.]?\s+(?:the\s+)?\d)(?!\s*(?:to|-|–|through|thru|till|until|or|\/)\s*${WEEKDAY})`,
  "gi",
);
/** "Monday to Friday", "Thursday or Friday": part of a stretch or a preference. */
const WEEKDAY_BEFORE_JOIN = new RegExp(
  String.raw`${WEEKDAY}\s*(?:to|-|–|through|thru|till|until|or|\/)\s*$`,
  "i",
);
/** A day ruled out, or their own week: never a day they asked for. */
const NOT_ASKED =
  /\b(?:not|never|except|away|busy|unavailable|every|each)\b|n't\b|\bcan ?not\b|\b(?:i|we)\s*(?:'m|am|are|'re)?\s*(?:work|working|home|at home|at work|off)\b/i;
const WEEK_OF =
  /\b(?:the\s+)?(?:week|w\/c)\s+(?:of|starting|beginning|commencing)\s+(?:the\s+)?$|\bw\/c\s+$/i;

/** "Unit 5/12", "5/12 Park Rd", "3/4 of the lawn", "24/7": never a date. */
const UNIT_BEFORE = /\b(?:unit|u|apt|apartment|flat|lot|shop|suite|villa|townhouse|no\.?)\s*$/i;
const STREET_AFTER =
  /^\s+(?:[A-Z][a-z]+\s+){1,3}(?:st|street|rd|road|ave|avenue|dr|drive|cres|crescent|ct|court|pl|place|pde|parade|tce|terrace|hwy|highway|way|lane|ln|cl|close|blvd|boulevard|gr|grove)\b/;
const FRACTION_AFTER =
  /^\s*(?:of|day|days|hr|hrs|hour|hours|tank|cup|inch|mm|cm|kg|litres?|price|off|full|size|done)\b/i;
/** "my daughter's 18th", "2nd coat", "3rd floor": an ordinal that is not a day. */
const NOT_A_DAY_BEFORE = /(?:\b(?:my|our|his|her|their)|'s)\s+$/i;
const NOT_A_DAY_AFTER =
  /^\s+(?:coat|coats|floor|storey|story|level|time|times|visit|clean|birthday|anniversary|place|row|bedroom|room|year|grade|attempt|quote|street|st|avenue|ave|road|rd|century)\b/i;
/** Around an ordinal, the words that make it a day of the month. */
const DAY_CUE_BEFORE =
  /(?:\b(?:the|on|by|before|after|until|till|from|or|and|to|for|between|done)\s+|[,(-]\s*)$/i;
const DAY_CUE_AFTER =
  /^\s*(?:$|[.,;!?)]|-|or\b|and\b|if\b|at\b|would\b|works?\b|suits?\b|please\b|pls\b|ok\b|okay\b|is\b|for\b)/i;

/** The words that say a day is about something else, as the date reader reads them. */
const CONTEXT_WORDS =
  /\b(inspection|inspect(?:ed|ing)?|moving out|move[sd]? out|moving|move in|keys?|handover|hand(?:ing)? over|settlement|settle|lease (?:ends?|finishes|is up)|vacat(?:e|ing)|open home|real estate)\b/gi;
/** After the context word, a request makes the day the job's own. */
const JOB_REQUEST =
  /\b(?:need|needs|needed|want|wants|book|booking|have it|get it|like it|would\s+(?:need|have|love|like)|love\s+to|like\s+to|has\s+to|must)\b/i;

type Token = {
  index: number;
  length: number;
  kind: "full" | "numeric" | "ordinal" | "weekday" | "week" | "window";
  /** For a stretch: its last day. */
  until?: Date;
  /** Resolved day, or undefined when it could not be read. */
  date?: Date;
  /** For an ordinal: the day of the month waiting on a month. */
  day?: number;
  past?: boolean;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function valid(y: number, m: number, d: number): boolean {
  if (d < 1 || m < 0 || m > 11) return false;
  return new Date(y, m + 1, 0).getDate() >= d;
}
function monthIndex(word: string): number | undefined {
  return MONTHS[word.slice(0, 4).toLowerCase()] ?? MONTHS[word.slice(0, 3).toLowerCase()];
}
function weekdayIndex(word: string): number {
  return WEEKDAYS.indexOf(word.slice(0, 3).toLowerCase());
}

const RECENT_PAST_DAYS = 60;

/** A day and month with or without a year: this year, next year once passed, or the one just gone. */
function resolveDayMonth(
  day: number,
  month: number,
  year: number | undefined,
  today: Date,
): { date?: Date; past?: boolean } {
  const y = year === undefined ? today.getFullYear() : year < 100 ? 2000 + year : year;
  if (!valid(y, month, day)) return {};
  const date = new Date(y, month, day);
  if (date >= today) return { date };
  if (year !== undefined) return { date, past: true };
  const ago = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (ago <= RECENT_PAST_DAYS) return { date, past: true };
  if (!valid(y + 1, month, day)) return {};
  return { date: new Date(y + 1, month, day) };
}

function plusDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** The next given weekday after today (1 to 7 days on). */
function upcoming(weekday: number, today: Date): Date {
  return plusDays(today, (weekday - today.getDay() + 7) % 7 || 7);
}

function covered(tokens: readonly Token[], index: number, length: number): boolean {
  return tokens.some((t) => index < t.index + t.length && t.index < index + length);
}

function collect(text: string, today: Date): Token[] {
  const tokens: Token[] = [];
  const add = (t: Token) => {
    if (!covered(tokens, t.index, t.length)) tokens.push(t);
  };
  // Longest, most certain shapes first; a later match inside one is the same day.
  for (const m of text.matchAll(WINDOW)) {
    const month = monthIndex(m[4]!);
    if (month === undefined) continue;
    const to = resolveDayMonth(Number(m[3]), month, undefined, today);
    const fromDay = Number(m[1] ?? m[2]);
    if (!to.date || to.past || !valid(to.date.getFullYear(), month, fromDay)) continue;
    const from = new Date(to.date.getFullYear(), month, fromDay);
    if (from > to.date) continue;
    add({ index: m.index ?? 0, length: m[0].length, kind: "window", date: from, until: to.date });
  }
  for (const m of text.matchAll(DAY_MONTH)) {
    const month = monthIndex(m[2]!);
    if (month === undefined) continue;
    const r = resolveDayMonth(Number(m[1]), month, m[3] ? Number(m[3]) : undefined, today);
    // "Sunday 18 October": their weekday is part of their words for the day.
    const at = m.index ?? 0;
    const lead = WEEKDAY_LEAD.exec(text.slice(Math.max(0, at - 16), at))?.[0].length ?? 0;
    add({ index: at - lead, length: m[0].length + lead, kind: "full", ...r });
  }
  for (const m of text.matchAll(MONTH_DAY)) {
    const month = monthIndex(m[1]!);
    if (month === undefined) continue;
    const r = resolveDayMonth(Number(m[2]), month, m[3] ? Number(m[3]) : undefined, today);
    add({ index: m.index ?? 0, length: m[0].length, kind: "full", ...r });
  }
  for (const m of text.matchAll(NUMERIC)) {
    const index = m.index ?? 0;
    if (m[0] === "24/7") continue;
    const after = text.slice(index + m[0].length);
    if (UNIT_BEFORE.test(text.slice(0, index)) || STREET_AFTER.test(after)) continue;
    if (!m[3] && FRACTION_AFTER.test(after)) continue;
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    // "50/50", "12/13": not a day and month at all.
    if (day < 1 || day > 31 || month < 0 || month > 11) continue;
    const r = resolveDayMonth(day, month, m[3] ? Number(m[3]) : undefined, today);
    add({ index, length: m[0].length, kind: "numeric", ...r });
  }
  for (const m of text.matchAll(THIS_NEXT)) {
    const weekday = weekdayIndex(m[2]!);
    if (weekday === -1) continue;
    // "next Thursday" is the Thursday of next week: a week today when said on a Thursday.
    const date =
      m[1]!.toLowerCase() === "next"
        ? plusDays(today, ((weekday - today.getDay() + 7) % 7) + 7)
        : upcoming(weekday, today);
    add({ index: m.index ?? 0, length: m[0].length, kind: "weekday", date });
  }
  for (const m of text.matchAll(WEEKDAY_ORDINAL)) {
    const weekday = weekdayIndex(m[1]!);
    const day = Number(m[2]);
    let date: Date | undefined;
    for (let i = 0; i <= 62 && !date; i += 1) {
      const d = plusDays(today, i);
      if (d.getDate() === day && d.getDay() === weekday) date = d;
    }
    add({ index: m.index ?? 0, length: m[0].length, kind: "full", ...(date ? { date } : {}) });
  }
  for (const m of text.matchAll(ORDINAL)) {
    const index = m.index ?? 0;
    if (covered(tokens, index, m[0].length)) continue;
    const before = text.slice(Math.max(0, index - 16), index);
    const after = text.slice(index + m[0].length, index + m[0].length + 20);
    if (NOT_A_DAY_BEFORE.test(before) || NOT_A_DAY_AFTER.test(after)) continue;
    if (!DAY_CUE_BEFORE.test(before) && !DAY_CUE_AFTER.test(after)) continue;
    const day = Number(m[1]);
    if (day < 1 || day > 31) continue;
    // "the 26th" keeps its "the" in their words.
    const lead = /\bthe\s+$/i.exec(before);
    const from = index - (lead?.[0].length ?? 0);
    add({ index: from, length: index + m[0].length - from, kind: "ordinal", day });
  }
  for (const m of text.matchAll(BARE_WEEKDAY)) {
    const index = m.index ?? 0;
    if (WEEKDAY_BEFORE_JOIN.test(text.slice(Math.max(0, index - 16), index))) continue;
    if (NOT_ASKED.test(sentenceAround(text, index))) continue;
    const weekday = weekdayIndex(m[1]!);
    add({
      index: m.index ?? 0,
      length: m[0].length,
      kind: "weekday",
      date: upcoming(weekday, today),
    });
  }
  return tokens.sort((a, b) => a.index - b.index);
}

/** "27th" takes the month of the nearest day written with one. */
function withMonths(tokens: Token[], today: Date): Token[] {
  const anchors = tokens.filter((t) => t.kind !== "ordinal" && t.kind !== "weekday" && t.date);
  return tokens.map((t): Token => {
    if (t.kind !== "ordinal" || t.day === undefined) return t;
    const near = [...anchors].sort(
      (a, b) => Math.abs(a.index - t.index) - Math.abs(b.index - t.index),
    )[0];
    if (near?.date) {
      const y = near.date.getFullYear();
      const mo = near.date.getMonth();
      return valid(y, mo, t.day) ? { ...t, date: new Date(y, mo, t.day) } : t;
    }
    // No month written anywhere: the next time that day comes round.
    for (let i = 0; i < 3; i += 1) {
      const y = today.getFullYear();
      const mo = today.getMonth() + i;
      const d: Date = new Date(y, mo, t.day);
      if (d.getDate() === t.day && d >= today) return { ...t, date: d };
    }
    return t;
  });
}

/** Two or more days written "X or Y", "X and Y", "X, Y": one run of their words. */
const JOINER = /^\s*(?:or|and|,|\/|&|or\s+the|and\s+the|,\s*or)\s*$/i;

function runs(text: string, tokens: readonly Token[]): Token[][] {
  const out: Token[][] = [];
  for (const t of tokens) {
    const last = out[out.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && JOINER.test(text.slice(prev.index + prev.length, t.index))) last!.push(t);
    else out.push([t]);
  }
  return out;
}

function sentenceStart(text: string, index: number): number {
  return (
    Math.max(
      text.lastIndexOf(".", index - 1),
      text.lastIndexOf("!", index - 1),
      text.lastIndexOf("?", index - 1),
      text.lastIndexOf("\n", index - 1),
    ) + 1
  );
}

function sentenceAround(text: string, index: number): string {
  const rest = text.slice(index);
  const end = rest.search(/[.!?\n]/);
  return text.slice(sentenceStart(text, index), end === -1 ? text.length : index + end);
}

function contextAt(text: string, index: number): boolean {
  const before = text.slice(sentenceStart(text, index), index);
  const hits = [...before.matchAll(new RegExp(CONTEXT_WORDS.source, "gi"))];
  const last = hits[hits.length - 1];
  if (!last) return false;
  return !JOB_REQUEST.test(before.slice((last.index ?? 0) + last[0].length));
}

function spanOf(text: string, run: readonly Token[]): string {
  const first = run[0]!;
  const last = run[run.length - 1]!;
  return text
    .slice(first.index, last.index + last.length)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every day the message mentions, and every date-like fragment it could not
 * read. `now` is the arrival clock (injected in tests), read in `tz`.
 */
export function sweepDates(
  written: string,
  now: Date = new Date(),
  tz = "Australia/Brisbane",
): DateSweep {
  const text = written.replace(/\bb4\b/gi, "before");
  const wall = wallNow(now, tz);
  const today = new Date(wall.getFullYear(), wall.getMonth(), wall.getDate());
  const tokens = withMonths(collect(text, today), today);
  const days: SweptDay[] = [];
  const unread: string[] = [];
  const seen = new Map<string, number>();
  for (const run of runs(text, tokens)) {
    const span = spanOf(text, run);
    if (run.some((t) => !t.date)) {
      // A day Enquiry cannot place is said to the owner, never guessed.
      if (!unread.includes(span)) unread.push(span);
      continue;
    }
    for (const t of run) {
      if (t.past) continue;
      const before = text.slice(Math.max(0, t.index - 40), t.index);
      const week = WEEK_OF.exec(before);
      const iso = isoOf(t.date!);
      if (t.until) {
        days.push({ iso, span, to: isoOf(t.until) });
        continue;
      }
      const day: SweptDay = week
        ? {
            iso,
            span: `${week[0].trim().replace(/^the\s+/i, "the ")} ${span}`.replace(/\s+/g, " "),
            to: isoOf(plusDays(t.date!, 6)),
          }
        : { iso, span, ...(contextAt(text, t.index) ? { context: true as const } : {}) };
      const at = seen.get(iso);
      if (at === undefined) {
        seen.set(iso, days.length);
        days.push(day);
      } else if (days[at]!.context && !day.context) {
        // Said twice, once as a day they need: the day they need wins.
        days[at] = day;
      }
    }
  }
  return { days: [...days].sort((a, b) => a.iso.localeCompare(b.iso)), unread };
}

/** "Sun 27 Dec". */
export function sweptLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return format(new Date(y, m - 1, d), "EEE d MMM", { locale: enAU });
}

/** The stored form: kept as one reading on the enquiry. */
export function sweepValue(sweep: DateSweep): string {
  return JSON.stringify(sweep);
}

/** A stored sweep, or an empty one for anything unreadable. */
export function readSweep(value: unknown): DateSweep {
  const raw = typeof value === "string" ? safeParse(value) : value;
  if (!raw || typeof raw !== "object") return { days: [], unread: [] };
  const r = raw as Partial<DateSweep>;
  const days = Array.isArray(r.days)
    ? r.days.filter(
        (d): d is SweptDay =>
          Boolean(d) && typeof d.iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.iso),
      )
    : [];
  const unread = Array.isArray(r.unread) ? r.unread.filter((u) => typeof u === "string") : [];
  return { days: [...days].sort((a, b) => a.iso.localeCompare(b.iso)), unread };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
