import type { BusinessDetail } from "./business-detail.ts";

/**
 * Owner sentences that are rules about money or eligibility, read into rules a
 * quote can check: "minimum charge $450", "Saturday jobs cost 20% more",
 * "Travel fee $40 outside Brisbane northside", "Exterior painting only if
 * single storey", "Closed 24 Dec - 2 Jan".
 *
 * Only the unambiguous shapes are read. Anything looser returns null and is
 * offered as a note instead, exactly as before - a rule Enquiry misread would
 * change a customer's total, which is worse than a note it shows the owner.
 *
 * A line with a price and a minimum ("Interior painting is $32 per square
 * metre, minimum charge $450") comes back with `priceLine`: the caller reads
 * the price from it and ties the minimum to that price's service.
 */
export type RuleLineRead = {
  details: BusinessDetail[];
  priceLine?: string;
  /** Parts of the line that are not one of these rules, kept as a note, never dropped. */
  remainder?: string[];
  /** Why the line cannot be saved as it is written (a date and a weekday that disagree). */
  refuse?: string;
  /**
   * Why it is kept as a note rather than a rule ("Minimum job $600": for
   * every service, or one?). Offered to the owner as a note, never dropped.
   */
  note?: string;
};

/**
 * "Open through the Christmas break 20 Dec - 5 Jan", "Not closed ...", "No
 * Saturday surcharge", "except", "unless": the line says a rule does NOT apply
 * or only applies with a condition. Never read as the rule it names.
 */
const NEGATED =
  /\b(?:open|work(?:ing)?|available)\s+(?:right\s+)?(?:through|over|during)\b|\bnot\s+closed\b|\bno\s+(?:\w+\s+)?(?:surcharge|loading|extra|penalty)\b|\bexcept\b|\bunless\b|\bno\s+longer\b/i;

/** A condition a percentage rule cannot carry: "after 5pm", "public holidays". */
const TIME_CONDITION =
  /\b(?:after|before|from|until)\s+\d|\d\s*(?:am|pm)\b|\bpublic\s+holidays?\b|\bnights?\b|\bevenings?\b/i;

/** Work words: a service is named by one ("Exterior painting"); "Cash" is not a service. */
const WORK_NOUN =
  /(?:ing|clean|cleans|paint|repaint|repair|repairs|removal|wash|install|service|staining|mow|makeover|makeup|shoot|session)\b/i;

const AMOUNT = String.raw`\$\s?(\d[\d,]*(?:\.\d{1,2})?)`;
const ALL_AMOUNTS = /\$\s?\d/g;
const HAS_AMOUNT = /\$\s?\d/;
const MIN_WORD = String.raw`min(?:imum)?(?:\s+(?:charge|job|fee|call[- ]?out|callout|price))?`;

/** "..., minimum charge $450" after a price. */
const TRAILING_MIN = new RegExp(
  String.raw`^(.*\$\s?\d[^$]*?)[,;]?\s*(?:with\s+(?:a\s+)?|and\s+(?:a\s+)?|but\s+(?:a\s+)?)?${MIN_WORD}\s*(?:of|is|:|-)?\s*${AMOUNT}\s*[.!]?\s*$`,
  "i",
);
/** "Minimum charge for interior painting is $450", "Minimum call out $80". */
const MIN_FIRST = new RegExp(
  String.raw`^\s*(?:(?:our|a|the|my)\s+)?${MIN_WORD}\s*(?:(?:for|on)\s+(.+?))?\s*(?:is|of|:|-|=)?\s*${AMOUNT}\s*[.!]?\s*$`,
  "i",
);
/** "Interior painting minimum $450", "Oven clean $95 minimum". */
const MIN_AFTER_SERVICE = new RegExp(
  String.raw`^\s*(.+?)\s*[:-]?\s*(?:${MIN_WORD}\s*(?:is|of)?\s*${AMOUNT}|${AMOUNT}\s*${MIN_WORD})\s*[.!]?\s*$`,
  "i",
);

/** "on every job", "all jobs", "any booking": a minimum the owner means for everything. */
const EVERY_JOB =
  /\b(?:every|all|any|each)\s+(?:jobs?|bookings?|quotes?|services?|visits?)\b|\bper\s+(?:job|booking|visit)\b|\bon\s+everything\b/i;

const EVERY_JOB_TAIL =
  /[,;]?\s*(?:on|for|per|across)?\s*(?:every|all|any|each)\s+(?:jobs?|bookings?|quotes?|services?|visits?)\s*[.!]?\s*$/i;

const DAY_WORDS: [RegExp, number][] = [
  [/\bsun(?:day)?s?\b/i, 0],
  [/\bmon(?:day)?s?\b/i, 1],
  [/\btue(?:s(?:day)?)?s?\b/i, 2],
  [/\bwed(?:nesday)?s?\b/i, 3],
  [/\bthu(?:r(?:s(?:day)?)?)?s?\b/i, 4],
  [/\bfri(?:day)?s?\b/i, 5],
  [/\bsat(?:urday)?s?\b/i, 6],
];

function daysIn(line: string): number[] {
  const days = new Set<number>();
  if (/\bweekends?\b/i.test(line)) [0, 6].forEach((d) => days.add(d));
  for (const [re, d] of DAY_WORDS) if (re.test(line)) days.add(d);
  return [...days].sort((a, b) => a - b);
}

const PERCENT = /(\d{1,3}(?:\.\d+)?)\s*%/;
const MORE = /\b(?:more|extra|surcharge|loading|on top|higher|dearer|adds?|added)\b|\+\s*\d/i;
const LESS = /\b(?:off|discount(?:ed)?|less|cheaper)\b/i;

const FEE_KINDS: [RegExp, string][] = [
  [/\btravel\b/i, "Travel fee"],
  [/\bcall[- ]?outs?\b|\bcallouts?\b/i, "Call-out fee"],
  [/\b(?:rubbish|tip|disposal)\b/i, "Disposal fee"],
  [/\bparking\b/i, "Parking fee"],
  [/\bbooking\b/i, "Booking fee"],
];
/** "extra $40 for ...", "$40 extra if ...": an amount added only in some cases. */
const EXTRA_FOR = new RegExp(
  String.raw`(?:\bextra\s+${AMOUNT}|${AMOUNT}\s+extra)\s+(?:for|if|when|outside|to|on)\b`,
  "i",
);

/** "We only do exterior painting on single storey homes". */
const ONLY_DO =
  /^\s*(?:we|i)\s+only\s+(?:do|offer|take on|paint)\s+(.+?)\s+(?:on|for|if|when|where)\s+(.+?)\s*[.!]*\s*$/i;
/** "Exterior painting only if single storey", "... only for single-storey houses". */
const SERVICE_ONLY =
  /^\s*(.+?)\s+only\s+(?:if|for|on|when|where)\s+(?:(?:the|it'?s|it\s+is)\s+)?(?:(?:house|home|job|property|place)\s+(?:is|are)\s+)?(.+?)\s*[.!]*\s*$/i;
const PLACE_TAIL = /\s+(?:homes?|houses?|properties|property|jobs?|places?|buildings?)$/i;

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;
const MONTH = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const RANGE_WORDS = String.raw`\s*(?:-|–|to|until|till|through|thru)\s*`;
const WORDED_RANGE = new RegExp(
  String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}${RANGE_WORDS}(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}`,
  "i",
);
const NUMERIC_RANGE = new RegExp(
  String.raw`\b(\d{1,2})\/(\d{1,2})${RANGE_WORDS}(\d{1,2})\/(\d{1,2})\b`,
  "i",
);
const CLOSED_WORDS =
  /\b(?:closed|away|off|not working|on leave|on holidays?|holidays?|shut|no jobs?|break|not available|unavailable|booked(?:\s+out)?|not taking)\b/i;
/** Words that make a closed stretch one-off: the owner is away, not closed every year. */
const ONE_OFF_WORDS =
  /\b(?:away|not available|unavailable|on leave|booked(?:\s+out)?|not taking|this year|day off)\b/i;
/** Words that make it repeat: "every year", "always". */
const YEARLY_WORDS = /\b(?:every|each)\s+year\b|\bannually\b|\balways\b|\byearly\b/i;
/** Days named for what they are, the same date every year. */
const HOLIDAYS: [RegExp, string][] = [
  [/\b(?:christmas|xmas)\s+eve\b/i, "12-24"],
  [/\b(?:christmas|xmas)\s+day\b/i, "12-25"],
  [/\bboxing\s+day\b/i, "12-26"],
  [/\bnew\s+year'?s\s+eve\b/i, "12-31"],
  [/\bnew\s+year'?s(?:\s+day)?\b/i, "01-01"],
  [/\baustralia\s+day\b/i, "01-26"],
  [/\banzac\s+day\b/i, "04-25"],
];
const WEEKDAY_NAME = String.raw`(?:(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+(?:the\s+)?)?`;
/** "Saturday 10 October", "10th of Oct", "the 10th October". */
const ONE_DAY = new RegExp(
  String.raw`${WEEKDAY_NAME}(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\b`,
  "i",
);
/** "October 10", "Oct 10th". */
const ONE_DAY_MONTH_FIRST = new RegExp(
  String.raw`${WEEKDAY_NAME}${MONTH}\s+(\d{1,2})(?:st|nd|rd|th)?\b`,
  "i",
);
/** "20-27 Dec", "20 to 27 December": one month, two days. */
const SHORT_RANGE = new RegExp(
  String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–|to|until|till|through|thru)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\b`,
  "i",
);
/** "10/10": day first, one date. */
const ONE_NUMERIC = /\b(\d{1,2})\/(\d{1,2})\b/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthDay(month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null;
  if (day > new Date(2024, month, 0).getDate()) return null;
  return `${pad(month)}-${pad(day)}`;
}

function monthOf(word: string): number {
  return MONTHS.indexOf(word.slice(0, 3).toLowerCase() as (typeof MONTHS)[number]) + 1;
}

function amountOf(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

/** "interior painting" -> "Interior painting". */
function serviceName(raw: string | undefined): string | undefined {
  const s = (raw ?? "")
    .trim()
    .replace(/^(?:for|on|the|our|my)\s+/i, "")
    .replace(/\s+(?:is|are|jobs?)$/i, "")
    .replace(/[.,;:!-]+$/, "")
    .trim();
  if (!s || s.split(/\s+/).length > 5 || /\d|\$/.test(s)) return undefined;
  return s[0]!.toUpperCase() + s.slice(1);
}

function readMinimum(line: string): RuleLineRead | null {
  const amounts = (line.match(ALL_AMOUNTS) ?? []).length;
  if (!/\bmin(?:imum)?\b/i.test(line)) return null;
  if (amounts === 2) {
    const m = TRAILING_MIN.exec(line);
    if (!m) return null;
    return {
      details: [{ kind: "minimum_charge", amount: amountOf(m[2]!) }],
      priceLine: m[1]!.trim().replace(/[,;]+$/, ""),
    };
  }
  if (amounts !== 1) return null;
  // "Minimum $600 on every job": the scope said after the amount.
  const scoped = line.replace(EVERY_JOB_TAIL, "");
  const first = MIN_FIRST.exec(scoped);
  if (first) {
    const service = serviceName(first[1]);
    if (first[1] && !service) return null;
    // "Minimum job $600" said beside a painting price: a $55 manicure must
    // never be asked about it. Every job only when the owner says so.
    if (!service && !EVERY_JOB.test(line)) {
      return {
        details: [],
        note: `Enquiry doesn't know if this minimum is for every service or only one. It is kept as a note. To check it on every quote, write "Minimum $${amountOf(first[2]!)} on every job"; for one service, name it: "Interior painting minimum $${amountOf(first[2]!)}".`,
      };
    }
    return {
      details: [
        { kind: "minimum_charge", amount: amountOf(first[2]!), ...(service ? { service } : {}) },
      ],
    };
  }
  const after = MIN_AFTER_SERVICE.exec(line);
  const service = serviceName(after?.[1]);
  if (!after || !service) return null;
  return {
    details: [{ kind: "minimum_charge", amount: amountOf(after[2] ?? after[3]!), service }],
  };
}

function readSurcharge(line: string): RuleLineRead | null {
  const pct = PERCENT.exec(line);
  if (!pct || HAS_AMOUNT.test(line) || !MORE.test(line) || TIME_CONDITION.test(line)) return null;
  const days = daysIn(line);
  if (days.length === 0 || days.length === 7) return null;
  if (LESS.test(line)) return null;
  return { details: [{ kind: "surcharge", percent: Number(pct[1]), days }] };
}

const FREQUENCY_WORDS: [RegExp, "weekly" | "fortnightly" | "monthly" | "regular"][] = [
  [/\b(?:fortnightly|every\s+(?:two|2|other)\s+weeks?|every\s+fortnight)\b/i, "fortnightly"],
  [/\b(?:weekly|every\s+week)\b/i, "weekly"],
  [/\b(?:monthly|every\s+month)\b/i, "monthly"],
  [/\b(?:regular|recurring|repeat|ongoing)\b/i, "regular"],
];

/**
 * "Fortnightly cleans get 10% off", "10% discount for weekly cleans": a
 * percentage off a repeat job. Without a frequency ("10% off for pensioners")
 * it is a condition Enquiry cannot check, so it stays a note.
 */
function readDiscount(line: string): RuleLineRead | null {
  const pct = PERCENT.exec(line);
  if (!pct || HAS_AMOUNT.test(line) || !LESS.test(line) || MORE.test(line)) return null;
  if (TIME_CONDITION.test(line) || daysIn(line).length > 0) return null;
  const frequency = FREQUENCY_WORDS.find(([re]) => re.test(line))?.[1];
  const percent = Number(pct[1]);
  if (!(percent > 0 && percent < 100)) return null;
  if (frequency) return { details: [{ kind: "discount", percent, frequency }] };
  // "10% off for pensioners", "Pensioners get 10% off": a discount for some
  // customers, checked with one tap when a message mentions them.
  const who = (DISCOUNT_FOR.exec(line) ?? DISCOUNT_WHO_FIRST.exec(line))?.[1];
  if (!who) return null;
  const text = line.trim().replace(/[.;]+$/, "");
  return {
    details: [
      { kind: "discount", percent, condition: who.toLowerCase().replace(/\s+/g, " "), text },
    ],
  };
}

const WHO = String.raw`(pensioners?|seniors?|students?|veterans?|concession(?:\s+card)?\s+holders?|health\s*care\s+card\s+holders?|nurses|teachers|first\s+responders|locals?|returning\s+customers|repeat\s+customers|new\s+customers)`;
/** "10% off for pensioners", "10% discount to seniors". */
const DISCOUNT_FOR = new RegExp(String.raw`\b(?:for|to)\s+(?:all\s+)?${WHO}\b`, "i");
/** "Pensioners get 10% off". */
const DISCOUNT_WHO_FIRST = new RegExp(String.raw`^\s*${WHO}\s+(?:get|receive|save|pay)\b`, "i");

function readFee(line: string): RuleLineRead | null {
  if ((line.match(ALL_AMOUNTS) ?? []).length !== 1) return null;
  const amount = new RegExp(AMOUNT).exec(line);
  if (!amount) return null;
  // Only a line that says it is a fee or a charge: "Rubbish removal $150" and
  // "Tip run $120" are prices, and "End of lease clean $350 including
  // parking" is the price of the job.
  const saysFee = /\b(?:fees?|charges?|call[- ]?outs?|callouts?|surcharges?)\b/i.test(line);
  if (!saysFee && !EXTRA_FOR.test(line)) return null;
  if (/\b(?:incl(?:udes|uding)?|inclusive of)\b/i.test(line)) return null;
  const kind = FEE_KINDS.find(([re]) => re.test(line));
  if (/\bper\b|\/\s*[a-z]|\ban?\s+(?:hour|room|window|metre)/i.test(line)) return null;
  const text = line.trim().replace(/[.;]+$/, "");
  // "Weekend jobs have a $50 surcharge": only on those days, and named for them.
  const days = daysIn(line);
  const onDays = days.length > 0 && days.length < 7 ? days : [];
  const label = kind?.[1] ?? (onDays.length ? `${dayWord(onDays)} surcharge` : "Extra charge");
  // "Extra charge $50" says nothing about what it is for, and a customer can
  // never be told a charge with no reason.
  if (label === "Extra charge" && !feeReason(text)) {
    return {
      details: [],
      refuse: `It doesn't say what the $${amountOf(amount[1]!)} is for, and a customer is never charged something with no reason. Write what it's for, for example: Weekend surcharge $${amountOf(amount[1]!)}.`,
    };
  }
  return {
    details: [
      {
        kind: "fee",
        amount: amountOf(amount[1]!),
        label,
        text,
        ...(onDays.length ? { days: onDays } : {}),
      },
    ],
  };
}

/** "Weekend", "Saturday", "Sunday and public holiday". */
function dayWord(days: readonly number[]): string {
  if (days.length === 2 && days.includes(0) && days.includes(6)) return "Weekend";
  if (days.length === 1) return WEEKDAY_NAMES[days[0]!]!;
  return "Day";
}

/** What a fee is for, in the owner's words, with the amount and the fee words taken out. */
export function feeReason(text: string): string {
  return text
    .replace(/\$\s?\d[\d,]*(?:\.\d{1,2})?/g, " ")
    .replace(
      /\b(?:extra|an?|the|of|is|are|fees?|charges?|surcharges?|additional|cost|costs|flat|we|our|add|added|apply|applies|plus)\b/gi,
      " ",
    )
    .replace(/[^\p{L}\p{N}' ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readEligibility(line: string): RuleLineRead | null {
  if (HAS_AMOUNT.test(line) || !/\bonly\b/i.test(line)) return null;
  const m = ONLY_DO.exec(line) ?? SERVICE_ONLY.exec(line);
  if (!m) return null;
  const service = serviceName(m[1]!.replace(/^(?:we|i)\s+(?:do\s+)?/i, ""));
  if (!service || !WORK_NOUN.test(service)) return null;
  const condition = m[2]!.trim().replace(PLACE_TAIL, "").trim().toLowerCase();
  if (!service || !condition || condition.split(/\s+/).length > 6) return null;
  return {
    details: [{ kind: "eligibility", service, condition, text: line.trim().replace(/[.;]+$/, "") }],
  };
}

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_NAMES = [
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

/**
 * The year a one-off stretch falls in: the first whose END is today or later,
 * so "away 28 Dec to 3 Jan" read on 30 December is this 28 December, still
 * running, and a day already gone this year is next year's.
 */
function yearFor(from: string, to: string, now: Date): number {
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  for (const year of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
    const end = `${to < from ? year + 1 : year}-${to}`;
    if (end >= today) return year;
  }
  return now.getFullYear() + 1;
}

/** "11 October" said plainly: "11 October". */
function spokenMd(md: string): string {
  const [m, d] = md.split("-").map(Number) as [number, number];
  return `${d} ${MONTH_NAMES[m - 1]}`;
}

/** One closed stretch: every year, or only the next time it comes round. */
function closedStretch(
  from: string,
  to: string,
  now: Date,
  opts: { yearly: boolean; weekday?: number },
): RuleLineRead | null {
  if (opts.yearly) return { details: [{ kind: "closed_dates", from, to }] };
  const year = yearFor(from, to, now);
  if (opts.weekday !== undefined) {
    const [m, d] = from.split("-").map(Number) as [number, number];
    const actual = new Date(year, m - 1, d).getDay();
    if (actual !== opts.weekday) {
      // Never guess which of the two they meant: say what the date is.
      const thisYear = new Date(now.getFullYear(), m - 1, d);
      const passed = year !== now.getFullYear() && thisYear < now;
      const said = `${WEEKDAY_NAMES[opts.weekday]} ${spokenMd(from)}`;
      return {
        details: [],
        refuse: passed
          ? `${spokenMd(from)} this year has passed, and ${spokenMd(from)} ${year} is a ${WEEKDAY_NAMES[actual]}, not a ${WEEKDAY_NAMES[opts.weekday]}. Write the date you mean, with its year if it is next year.`
          : `"${said}": ${spokenMd(from)} ${year} is a ${WEEKDAY_NAMES[actual]}. Write the date with the right day, or leave the day out.`,
      };
    }
  }
  return { details: [{ kind: "closed_dates", from, to, year }] };
}

/**
 * A day or a stretch the owner does not work. A range they are "closed" for
 * ("Closed 24 December to 4 January") and a named holiday ("closed Christmas
 * Day") repeat every year; a date they are "not available" or "away" is that
 * one date only - never every Saturday because the date was a Saturday.
 */
function readClosedDates(line: string, now: Date): RuleLineRead | null {
  if (!CLOSED_WORDS.test(line) || HAS_AMOUNT.test(line)) return null;
  const oneOff = ONE_OFF_WORDS.test(line) && !YEARLY_WORDS.test(line);
  const worded = WORDED_RANGE.exec(line);
  if (worded) {
    const from = monthDay(monthOf(worded[2]!), Number(worded[1]));
    const to = monthDay(monthOf(worded[4]!), Number(worded[3]));
    return from && to ? closedStretch(from, to, now, { yearly: !oneOff }) : null;
  }
  const numeric = NUMERIC_RANGE.exec(line);
  if (numeric) {
    const from = monthDay(Number(numeric[2]), Number(numeric[1]));
    const to = monthDay(Number(numeric[4]), Number(numeric[3]));
    return from && to ? closedStretch(from, to, now, { yearly: !oneOff }) : null;
  }
  const short = SHORT_RANGE.exec(line);
  if (short) {
    const month = monthOf(short[3]!);
    const from = monthDay(month, Number(short[1]));
    const to = monthDay(month, Number(short[2]));
    if (!from || !to || to < from) return null;
    return closedStretch(from, to, now, { yearly: !oneOff });
  }
  const holiday = HOLIDAYS.find(([re]) => re.test(line));
  if (holiday) return { details: [{ kind: "closed_dates", from: holiday[1], to: holiday[1] }] };
  const day = ONE_DAY.exec(line);
  const dayFirst = ONE_DAY_MONTH_FIRST.exec(line);
  const numericDay = ONE_NUMERIC.exec(line);
  const read = day
    ? { weekday: day[1], day: Number(day[2]), month: monthOf(day[3]!) }
    : dayFirst
      ? { weekday: dayFirst[1], day: Number(dayFirst[3]), month: monthOf(dayFirst[2]!) }
      : numericDay
        ? { weekday: undefined, day: Number(numericDay[1]), month: Number(numericDay[2]) }
        : null;
  if (!read) return null;
  const md = monthDay(read.month, read.day);
  if (!md) return null;
  const weekday = read.weekday ? WEEKDAY_INDEX[read.weekday.slice(0, 3).toLowerCase()] : undefined;
  return closedStretch(md, md, now, {
    yearly: YEARLY_WORDS.test(line),
    ...(weekday !== undefined ? { weekday } : {}),
  });
}

/** Whether a line names a date, not only a weekday: "Saturday 10 October", "10/10", "Christmas Day". */
export function namesADate(line: string): boolean {
  return (
    ONE_DAY.test(line) ||
    ONE_DAY_MONTH_FIRST.test(line) ||
    HOLIDAYS.some(([re]) => re.test(line)) ||
    /\b\d{1,2}\/\d{1,2}\b/.test(line)
  );
}

function readOne(written: string, now: Date): RuleLineRead | null {
  if (NEGATED.test(written)) return null;
  return (
    readClosedDates(written, now) ??
    readMinimum(written) ??
    readSurcharge(written) ??
    readDiscount(written) ??
    readEligibility(written) ??
    readFee(written)
  );
}

/** How many separate rules a line seems to state: percentages and date ranges. */
function ruleSignals(line: string): number {
  const percents = (line.match(/\d\s*%/g) ?? []).length;
  const ranges =
    (line.match(new RegExp(WORDED_RANGE.source, "gi")) ?? []).length +
    (line.match(new RegExp(NUMERIC_RANGE.source, "gi")) ?? []).length;
  return percents + ranges;
}

/**
 * A rule about money or eligibility, when the line is one; null otherwise. A
 * line stating more than one ("Saturdays 20% more, 25/12 to 26/12 closed") is
 * split and each part read on its own; a part that is not a rule comes back as
 * `remainder` so it is kept as a note, never silently dropped.
 */
export function readRuleLine(line: string, now: Date = new Date()): RuleLineRead | null {
  const written = line
    .replace(/(\d[\d,]*(?:\.\d{1,2})?)\s*(?:dollars?|bucks|aud)\b/gi, "$$$1")
    .replace(/\b(?:aud|a\$)\s?(?=\d)/gi, "$$");
  if (NEGATED.test(written)) return null;
  if (ruleSignals(written) <= 1) return readOne(written, now);
  const parts = written
    .split(/[;.]\s+|,\s+|\s+and\s+(?=\w+days?\b)/i)
    .map((p) => p.trim().replace(/[.;,]+$/, ""))
    .filter(Boolean);
  const details: BusinessDetail[] = [];
  const remainder: string[] = [];
  for (const part of parts) {
    const read = readOne(part, now);
    // A part kept as a note, or one that cannot be saved as written, is kept
    // as a note too: never dropped because it shared a line with a rule.
    if (read && !read.priceLine && !read.note && !read.refuse) details.push(...read.details);
    else remainder.push(part);
  }
  if (details.length === 0) return null;
  return remainder.length ? { details, remainder } : { details };
}
