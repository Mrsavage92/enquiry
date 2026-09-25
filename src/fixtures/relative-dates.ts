/**
 * The sample workspace, moved to this week.
 *
 * The fixtures were written on 24 August 2026 and every date in them is fixed:
 * a month later the sample said "Waiting on you since 24 Aug" over jobs whose
 * dates had already passed. A calm first look cannot open on a backlog that
 * reads as weeks overdue, so the sample is shifted by whole days until its
 * newest moment sits just before now. Everything moves together - timestamps,
 * job dates, and the dates written in labels and messages - so a customer who
 * asked for "Saturday 19 September" still asks for the day their job is on.
 *
 * Pure and deterministic given `now`: tests pass a fixed date, and the raw
 * fixtures stay untouched for every test that reads them directly.
 */

const DAY_MS = 86_400_000;

const ISO_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const WEEKDAY = String.raw`mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?`;
const MONTH = String.raw`jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?`;

/**
 * One pass, three shapes, so no date is moved twice:
 *  - "Saturday 19 September 2026", "19 Sep", "the 10th of October", "Fri, 28 Aug";
 *  - "saturday 5th" - a weekday and an ordinal, the month implied;
 *  - "Start Sep 2026" - a month and a year.
 */
const DATE_WORDS = new RegExp(
  [
    String.raw`\b(?:(?<wd>${WEEKDAY})(?<comma>,?)\s+)?(?<the>the\s+)?(?<day>\d{1,2})(?<sfx>st|nd|rd|th)?\s+(?<of>of\s+)?(?<month>${MONTH})\b(?:\s+(?<year>\d{4}))?`,
    String.raw`\b(?<wd2>${WEEKDAY})\s+(?<the2>the\s+)?(?<day2>\d{1,2})(?:st|nd|rd|th)\b`,
    String.raw`\b(?<month3>${MONTH})\s+(?<year3>\d{4})\b`,
  ].join("|"),
  "gi",
);

type DateWordGroups = Partial<
  Record<
    | "wd"
    | "comma"
    | "the"
    | "day"
    | "sfx"
    | "of"
    | "month"
    | "year"
    | "wd2"
    | "the2"
    | "day2"
    | "month3"
    | "year3",
    string
  >
>;

function monthIndex(word: string): number {
  const w = word.slice(0, 3).toLowerCase();
  return MONTHS_SHORT.findIndex((m) => m.toLowerCase() === w);
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return "th";
  return n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
}

function styled(word: string, original: string): string {
  if (original === original.toLowerCase()) return word.toLowerCase();
  if (original === original.toUpperCase() && original.length > 1) return word.toUpperCase();
  return word;
}

function weekdayWord(date: Date, original: string): string {
  const names = original.length > 3 ? DAYS_LONG : DAYS_SHORT;
  return styled(names[date.getUTCDay()]!, original);
}

function monthWord(date: Date, original: string): string {
  const m = date.getUTCMonth();
  if (original.length === 4 && m === 8) return styled("Sept", original);
  const names = original.length > 4 ? MONTHS_LONG : MONTHS_SHORT;
  return styled(names[m]!, original);
}

function utcDay(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Every moment in the sample moves the same number of whole days. */
export function shiftIso(value: string, days: number): string {
  const dt = ISO_DATETIME.exec(value);
  if (dt) {
    const [, y, mo, d, h, mi, s, frac, zone] = dt;
    const moved = utcDay(Number(y), Number(mo) - 1, Number(d) + days);
    const date = `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
    const time = `${h}:${mi}${s !== undefined ? `:${s}` : ""}${frac !== undefined ? `.${frac}` : ""}`;
    return `${date}T${time}${zone}`;
  }
  const dd = ISO_DATE.exec(value);
  if (dd) {
    const moved = utcDay(Number(dd[1]), Number(dd[2]) - 1, Number(dd[3]) + days);
    return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
  }
  return value;
}

/** Dates written as words move too, keeping the way they were written. */
/** The day the sample was written, 24 August 2026. */
export const SAMPLE_WRITTEN = new Date(Date.UTC(2026, 7, 24));

export function shiftDateWords(text: string, days: number, written = SAMPLE_WRITTEN): string {
  const anchorYear = written.getUTCFullYear();
  return text.replace(DATE_WORDS, (match: string, ...rest: unknown[]) => {
    const g = rest[rest.length - 1] as DateWordGroups;
    if (g.month && g.day) {
      const m = monthIndex(g.month);
      if (m < 0) return match;
      const moved = utcDay(g.year ? Number(g.year) : anchorYear, m, Number(g.day) + days);
      const n = moved.getUTCDate();
      const lead = g.wd ? `${weekdayWord(moved, g.wd)}${g.comma ?? ""} ` : "";
      const tail = g.year ? ` ${moved.getUTCFullYear()}` : "";
      return `${lead}${g.the ?? ""}${n}${g.sfx ? ordinal(n) : ""} ${g.of ?? ""}${monthWord(moved, g.month)}${tail}`;
    }
    if (g.wd2 && g.day2) {
      // The month is implied: the next time that day of the month comes round
      // from the day the sample was written.
      let probe = utcDay(anchorYear, written.getUTCMonth(), Number(g.day2));
      if (probe < written) probe = utcDay(anchorYear, written.getUTCMonth() + 1, Number(g.day2));
      const moved = utcDay(probe.getUTCFullYear(), probe.getUTCMonth(), probe.getUTCDate() + days);
      const n = moved.getUTCDate();
      return `${weekdayWord(moved, g.wd2)} ${g.the2 ?? ""}${n}${ordinal(n)}`;
    }
    if (g.month3 && g.year3) {
      const m = monthIndex(g.month3);
      if (m < 0) return match;
      const moved = utcDay(Number(g.year3), m, 15 + days);
      return `${monthWord(moved, g.month3)} ${moved.getUTCFullYear()}`;
    }
    return match;
  });
}

function walk<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => walk(v, fn)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = walk(v, fn);
    return out as T;
  }
  return value;
}

/**
 * The newest thing that has already happened in the sample: when an enquiry
 * arrived, was updated, or a message was sent. Future-dated fields (a quote's
 * expiry, a booking) are deliberately not counted - they are meant to be ahead.
 */
function latestHappened(enquiries: readonly SampleEnquiry[]): number {
  let latest = Number.NEGATIVE_INFINITY;
  const see = (iso: string | undefined) => {
    const t = iso ? Date.parse(iso) : Number.NaN;
    if (Number.isFinite(t)) latest = Math.max(latest, t);
  };
  for (const e of enquiries) {
    see(e.receivedAt);
    see(e.updatedAt);
    for (const m of e.conversation ?? []) see(m.at);
  }
  return latest;
}

type SampleEnquiry = { receivedAt?: string; updatedAt?: string; conversation?: { at?: string }[] };

/**
 * Whole days to move the sample so its newest arrival is as recent as it can be
 * without being in the future.
 */
export function sampleShiftDays(enquiries: readonly SampleEnquiry[], now: Date): number {
  const latest = latestHappened(enquiries);
  if (!Number.isFinite(latest)) return 0;
  const days = Math.floor((now.getTime() - latest) / DAY_MS);
  return Math.max(0, days);
}

export function shiftSample<T>(value: T, days: number, written = SAMPLE_WRITTEN): T {
  if (days === 0) return value;
  return walk(value, (s) =>
    ISO_DATETIME.test(s) || ISO_DATE.test(s) ? shiftIso(s, days) : shiftDateWords(s, days, written),
  );
}

/**
 * The whole sample workspace, as of `now`. Each enquiry moves by its own number
 * of days, because the sample was not all written on one day; a booking moves
 * with the enquiry it belongs to.
 */
export function relativeSample<
  E extends SampleEnquiry & { id: string },
  B extends { enquiryId?: string },
>(enquiries: readonly E[], bookings: readonly B[], now: Date): { enquiries: E[]; bookings: B[] } {
  const daysById = new Map<string, number>();
  const moved = enquiries.map((e) => {
    const days = sampleShiftDays([e], now);
    daysById.set(e.id, days);
    const latest = latestHappened([e]);
    const d = new Date(latest);
    const written = Number.isFinite(latest)
      ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      : SAMPLE_WRITTEN;
    return shiftSample(e, days, written);
  });
  const fallback = Math.max(0, ...daysById.values());
  const movedBookings = bookings.map((b) =>
    shiftSample(b, (b.enquiryId ? daysById.get(b.enquiryId) : undefined) ?? fallback),
  );
  return { enquiries: moved, bookings: movedBookings };
}
