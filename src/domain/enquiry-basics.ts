import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import { wallNow } from "./format";

/**
 * The two things almost every pasted enquiry states plainly: who is asking and
 * the day they want. Read with simple rules, no model.
 *
 * The model interpreter (ANTHROPIC_API_KEY) reads far more, but it is optional
 * and an unconfigured deployment gets nothing from it. Without this, a message
 * signed "Thanks, Karen" and asking for "the 10th of October" showed a blank
 * name and "Not set" on every row. These rules only take what is written in an
 * unambiguous form; anything looser ("next week", "before Christmas") is left
 * unknown rather than guessed.
 */

export type JobDateRead = {
  /** yyyy-mm-dd, the next time that day falls on or after today. */
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

export type EnquiryBasics = { customerName?: string; jobDate?: JobDateRead };

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
const DAY = String.raw`(\d{1,2})(?:st|nd|rd|th)?`;
const YEAR = String.raw`(?:,?\s+(\d{4}))?`;

/** "10th of October", "3 October 2026", "Fri 3 Oct". */
const DAY_MONTH = new RegExp(String.raw`\b${DAY}\s+(?:of\s+)?${MONTH}\b${YEAR}`, "i");
/** "October 10", "Oct 10th, 2026". */
const MONTH_DAY = new RegExp(String.raw`\b${MONTH}\s+${DAY}\b${YEAR}`, "i");
/** "10/10" or "3/10/2026" - Australian day first. */
const NUMERIC = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;

function monthIndex(word: string): number | undefined {
  return MONTHS[word.slice(0, 4).toLowerCase()] ?? MONTHS[word.slice(0, 3).toLowerCase()];
}

function validDay(year: number, month: number, day: number): boolean {
  if (day < 1 || month < 0 || month > 11) return false;
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate() >= day;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function build(
  day: number,
  month: number,
  year: number | undefined,
  today: Date,
  span: string,
  asked = false,
): JobDateRead | undefined {
  let y = year ?? today.getFullYear();
  if (y < 100) y += 2000;
  if (!validDay(y, month, day)) return undefined;
  if (year === undefined) {
    // No year written: the next time that day comes round. A day already past
    // this year is next year's, never a date in the past.
    const candidate = new Date(y, month, day);
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (candidate < startToday) y += 1;
    if (!validDay(y, month, day)) return undefined;
  }
  const date = new Date(y, month, day);
  return {
    iso: `${y}-${pad(month + 1)}-${pad(day)}`,
    label: format(date, "EEE d MMM", { locale: enAU }),
    span: span.trim(),
    asked,
  };
}

export function readJobDate(
  text: string,
  now = new Date(),
  tz = "Australia/Brisbane",
): JobDateRead | undefined {
  const today = wallNow(now, tz);
  const hits: { index: number; read: JobDateRead | undefined }[] = [];
  const dm = DAY_MONTH.exec(text);
  if (dm) {
    const month = monthIndex(dm[2]!);
    if (month !== undefined) {
      hits.push({
        index: dm.index,
        read: build(
          Number(dm[1]),
          month,
          dm[3] ? Number(dm[3]) : undefined,
          today,
          dm[0],
          asksAboutDate(text, dm.index),
        ),
      });
    }
  }
  const md = MONTH_DAY.exec(text);
  if (md) {
    const month = monthIndex(md[1]!);
    if (month !== undefined) {
      hits.push({
        index: md.index,
        read: build(
          Number(md[2]),
          month,
          md[3] ? Number(md[3]) : undefined,
          today,
          md[0],
          asksAboutDate(text, md.index),
        ),
      });
    }
  }
  const nu = NUMERIC.exec(text);
  if (nu) {
    hits.push({
      index: nu.index,
      read: build(
        Number(nu[1]),
        Number(nu[2]) - 1,
        nu[3] ? Number(nu[3]) : undefined,
        today,
        nu[0],
        asksAboutDate(text, nu.index),
      ),
    });
  }
  // The first date written is the one the customer led with.
  return hits
    .filter((h) => h.read)
    .sort((a, b) => a.index - b.index)
    .map((h) => h.read)[0];
}

/** Words that can sit where a sign-off name sits but are never one. */
const NOT_A_NAME = new Set(
  [
    "thanks",
    "thank",
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
    "christmas",
    "easter",
    "today",
    "tomorrow",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
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

const NAME_WORD = String.raw`[A-Z][a-z'-]+`;
const NAME = String.raw`(${NAME_WORD}(?:\s+${NAME_WORD})?)`;
const PHONE_TAIL = String.raw`(?:[\s,]+(?:\+?\d[\d\s()-]{6,}\d))?`;
/** A kiss after a name: "Priya x", "Jo xx". */
const KISS = String.raw`(?:\s+x{1,3})?`;

/** "Thanks, Karen" / "Cheers Tom" / "Kind regards, Priya Nair" at the very end. */
const SIGN_OFF = new RegExp(
  String.raw`(?:thanks|thank you|cheers|regards|kind regards|best|ta)[,!.]?\s+${NAME}${KISS}\s*[.!]?${PHONE_TAIL}\s*$`,
  "i",
);
/** A bare name (and perhaps a phone number) after the last sentence: "... October. Tom" */
const TRAILING_NAME = new RegExp(
  String.raw`(?:^|[.!?\n])\s*${NAME}${KISS}\s*[.!]?${PHONE_TAIL}\s*$`,
);
/** "... can u do the 1st? - Priya", "-- Priya", "~ Priya", an en or em dash too. */
const DASH_NAME = new RegExp(
  String.raw`(?:^|\s)(?:-{1,2}|\u2013|\u2014|~)\s*${NAME}${KISS}\s*[.!]?${PHONE_TAIL}\s*$`,
);
/** "My name is Sam", "this is Sam from ...". */
const INTRO = new RegExp(String.raw`\b(?:my name is|my name's|this is)\s+${NAME}`, "i");

function acceptName(raw: string | undefined): string | undefined {
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
  return words.join(" ");
}

export function readCustomerName(text: string): string | undefined {
  const trimmed = text.trim();
  return (
    acceptName(SIGN_OFF.exec(trimmed)?.[1]) ??
    acceptName(DASH_NAME.exec(trimmed)?.[1]) ??
    acceptName(TRAILING_NAME.exec(trimmed)?.[1]) ??
    acceptName(INTRO.exec(trimmed)?.[1])
  );
}

export function readEnquiryBasics(
  text: string,
  now = new Date(),
  tz = "Australia/Brisbane",
): EnquiryBasics {
  return { customerName: readCustomerName(text), jobDate: readJobDate(text, now, tz) };
}
