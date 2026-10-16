import { WORKING_DAY_CHOICES } from "./workspace-prefs.ts";

/**
 * Business details that are not prices: a note the owner wants shown on the
 * enquiries it concerns ("Travel fee $40 outside Brisbane northside"), a
 * service the business does not offer ("We don't do mould removal"), and the
 * days it does not work ("We don't work Sundays").
 *
 * Stored in the same `knowledge_item.rule_payload` column as a price, with
 * their own `kind`, so no schema change is needed and `parseBusinessRule`
 * (which only accepts prices) can never mistake one for a price. Like a price,
 * a detail is inert until its knowledge item is Active.
 */

export type NoteDetail = {
  kind: "note";
  /** The owner's own words, shown back exactly as written. */
  text: string;
  /** The saved service it is about, when it names one. */
  service?: string;
};

/** `verb` keeps the owner's own verb: "We don't paint roofs" reads back "You don't paint roofs". */
export type NotOfferedDetail = { kind: "not_offered"; service: string; verb?: string };

/** 0 is Sunday, 6 is Saturday. */
export type ClosedDaysDetail = { kind: "closed_days"; days: number[] };

/*
 * Rules the owner states about money or eligibility that change what a quote
 * may say. Each is checked on the quotes it concerns with one tap - applied,
 * or waived for that job - never silently added and never silently ignored.
 */
/** "minimum charge $450": a job on this service never comes to less. */
export type MinimumChargeDetail = { kind: "minimum_charge"; amount: number; service?: string };
/** "Saturday jobs cost 20% more": a percentage on jobs on these weekdays. */
export type SurchargeDetail = {
  kind: "surcharge";
  percent: number;
  days: number[];
  service?: string;
};
/** "Travel fee $40 outside Brisbane northside": an amount added when it applies. */
export type FeeDetail = {
  kind: "fee";
  amount: number;
  /** "Travel fee", "Call-out fee", "Extra charge". */
  label: string;
  /** The owner's own words, shown back exactly. */
  text: string;
  service?: string;
  /**
   * "Weekend jobs have a $50 surcharge": only on these weekdays (0 is
   * Sunday). Without it the fee concerns every quote.
   */
  days?: number[];
};
/** "Exterior painting only if single storey": when a job qualifies at all. */
export type EligibilityDetail = {
  kind: "eligibility";
  service: string;
  /** "single storey". */
  condition: string;
  text: string;
};
/**
 * "Closed 24 Dec - 2 Jan": month-day, every year; `to` may wrap into January.
 * With `year` it is one stretch only ("Not available Saturday 10 October",
 * "away 20-27 Dec"): `from` falls in `year`, and a `to` before it in the next.
 */
export type ClosedDatesDetail = { kind: "closed_dates"; from: string; to: string; year?: number };

/**
 * "Fortnightly cleans get 10% off": a percentage off a repeat job. Checked with
 * one tap only once the owner has confirmed the job repeats that often.
 * `frequency` "regular" means any repeat.
 */
export type DiscountDetail = {
  kind: "discount";
  percent: number;
  /** A repeat-job discount: how often the job repeats. */
  frequency?: "weekly" | "fortnightly" | "monthly" | "regular";
  /**
   * A discount for some customers ("pensioners"): checked with one tap on a
   * quote whose message mentions them, never applied by itself.
   */
  condition?: string;
  /** The owner's own words for a discount with a condition. */
  text?: string;
  service?: string;
  /**
   * "Jobs over $2000 get $100 off": offered, one tap, only on a quote whose
   * total is over this many dollars.
   */
  over?: number;
  /** A dollar amount off instead of a percentage: "$100 off". */
  amountOff?: number;
};

/**
 * The owner's own answer to a question customers ask ("Are you insured?"),
 * saved the first time they type it and offered again, never sent unasked.
 */
export type AnswerDetail = { kind: "answer"; topic: string; question: string; text: string };

/**
 * "Mon-Sat 7am-5pm": the owner's working hours. Never kept as a business
 * fact: saving it sets the hours in Settings, the one place they live, so the
 * two can never disagree.
 */
export type WorkingHoursDetail = {
  kind: "working_hours";
  /** One of Settings' own choices: "Monday to Saturday". */
  workingDays: string;
  /** "07:00". */
  hoursStart: string;
  /** "17:00". */
  hoursEnd: string;
};

export const FREQUENCIES = ["weekly", "fortnightly", "monthly", "regular"] as const;

export type BusinessDetail =
  | NoteDetail
  | DiscountDetail
  | AnswerDetail
  | NotOfferedDetail
  | ClosedDaysDetail
  | MinimumChargeDetail
  | SurchargeDetail
  | FeeDetail
  | EligibilityDetail
  | ClosedDatesDetail
  | WorkingHoursDetail;

export const DETAIL_KINDS = [
  "note",
  "not_offered",
  "closed_days",
  "minimum_charge",
  "surcharge",
  "fee",
  "eligibility",
  "closed_dates",
  "discount",
  "answer",
  "working_hours",
] as const;

const MONTH_DAY = /^(\d{2})-(\d{2})$/;

function validMonthDay(md: string): boolean {
  const m = MONTH_DAY.exec(md);
  if (!m) return false;
  const month = Number(m[1]);
  const day = Number(m[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(2024, month, 0).getDate();
}

function money(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1_000_000 ? v : null;
}

const MAX_TEXT = 300;

export function parseBusinessDetail(
  raw: unknown,
): { ok: true; detail: BusinessDetail } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Not a business detail." };
  const r = raw as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "");
  if (r.kind === "note") {
    const body = text(r.text);
    if (!body) return { ok: false, reason: "A note needs some words." };
    const service = text(r.service);
    return { ok: true, detail: { kind: "note", text: body, ...(service ? { service } : {}) } };
  }
  if (r.kind === "not_offered") {
    const service = text(r.service);
    if (!service) return { ok: false, reason: "Say which service you do not offer." };
    const verb = text(r.verb).toLowerCase();
    const ownVerb = /^[a-z]{3,12}$/.test(verb) && !GENERIC_VERBS.has(verb) ? { verb } : {};
    return { ok: true, detail: { kind: "not_offered", service, ...ownVerb } };
  }
  if (r.kind === "closed_days") {
    const days = Array.isArray(r.days) ? r.days : [];
    const valid = [...new Set(days)].filter(
      (d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6,
    );
    if (valid.length === 0 || valid.length !== days.length) {
      return { ok: false, reason: "Closed days must be days of the week." };
    }
    if (valid.length === 7) return { ok: false, reason: "A business open no days cannot quote." };
    return { ok: true, detail: { kind: "closed_days", days: valid.sort((a, b) => a - b) } };
  }
  return parseMoneyRule(r, text);
}

/** The rules that change a quote: minimums, surcharges, fees, eligibility, closed dates. */
function parseMoneyRule(
  r: Record<string, unknown>,
  text: (v: unknown) => string,
): { ok: true; detail: BusinessDetail } | { ok: false; reason: string } {
  const service = text(r.service);
  const withService = service ? { service } : {};
  if (r.kind === "minimum_charge") {
    const amount = money(r.amount);
    if (amount === null) return { ok: false, reason: "A minimum charge needs an amount." };
    return { ok: true, detail: { kind: "minimum_charge", amount, ...withService } };
  }
  if (r.kind === "surcharge") {
    const percent = typeof r.percent === "number" ? r.percent : Number.NaN;
    const days = Array.isArray(r.days) ? r.days : [];
    const valid = [...new Set(days)].filter(
      (d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6,
    );
    if (!(percent > 0 && percent <= 200)) {
      return { ok: false, reason: "A surcharge needs a percentage." };
    }
    if (valid.length === 0 || valid.length !== days.length) {
      return { ok: false, reason: "Say which days the surcharge is for." };
    }
    return {
      ok: true,
      detail: { kind: "surcharge", percent, days: valid.sort((a, b) => a - b), ...withService },
    };
  }
  if (r.kind === "fee") {
    const amount = money(r.amount);
    const label = text(r.label);
    const words = text(r.text);
    if (amount === null || !label || !words) {
      return { ok: false, reason: "A fee needs an amount and what it is for." };
    }
    const days = Array.isArray(r.days) ? r.days : [];
    const valid = [...new Set(days)].filter(
      (d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6,
    );
    if (valid.length !== days.length || valid.length === 7) {
      return { ok: false, reason: "Say which days the fee is for." };
    }
    return {
      ok: true,
      detail: {
        kind: "fee",
        amount,
        label,
        text: words,
        ...withService,
        ...(valid.length ? { days: valid.sort((a, b) => a - b) } : {}),
      },
    };
  }
  if (r.kind === "eligibility") {
    const condition = text(r.condition);
    const words = text(r.text);
    if (!service || !condition || !words) {
      return { ok: false, reason: "Say which service and when you do it." };
    }
    return { ok: true, detail: { kind: "eligibility", service, condition, text: words } };
  }
  if (r.kind === "closed_dates") {
    const from = text(r.from);
    const to = text(r.to);
    if (!validMonthDay(from) || !validMonthDay(to)) {
      return { ok: false, reason: "Closed dates need a first and last day." };
    }
    const year = r.year;
    if (year !== undefined && year !== null) {
      if (typeof year !== "number" || !Number.isInteger(year) || year < 2000 || year > 2100) {
        return { ok: false, reason: "Closed dates need a real year." };
      }
      return { ok: true, detail: { kind: "closed_dates", from, to, year } };
    }
    return { ok: true, detail: { kind: "closed_dates", from, to } };
  }
  if (r.kind === "discount") {
    const percent = typeof r.percent === "number" ? r.percent : Number.NaN;
    const frequency = FREQUENCIES.find((f) => f === r.frequency);
    const condition = text(r.condition).toLowerCase();
    // "Jobs over $2000 get $100 off" / "... get 5% off": a threshold the
    // quote's own total is checked against.
    const over = typeof r.over === "number" && Number.isFinite(r.over) && r.over > 0 ? r.over : 0;
    const amountOff =
      typeof r.amountOff === "number" && Number.isFinite(r.amountOff) && r.amountOff > 0
        ? r.amountOff
        : 0;
    if (over) {
      const pct = percent > 0 && percent < 100 ? percent : 0;
      if ((!pct && !amountOff) || (amountOff && amountOff >= over)) {
        return {
          ok: false,
          reason: "A discount over an amount needs how much comes off, less than that amount.",
        };
      }
      const words = text(r.text);
      return {
        ok: true,
        detail: {
          kind: "discount",
          percent: pct,
          ...(amountOff ? { amountOff } : {}),
          over,
          condition: condition || `jobs over $${over}`,
          ...(words ? { text: words } : {}),
          ...withService,
        },
      };
    }
    if (!(percent > 0 && percent < 100) || (!frequency && !condition)) {
      return {
        ok: false,
        reason: "A discount needs a percentage and who gets it or how often the job repeats.",
      };
    }
    if (!frequency) {
      const words = text(r.text);
      return {
        ok: true,
        detail: {
          kind: "discount",
          percent,
          condition,
          ...(words ? { text: words } : {}),
          ...withService,
        },
      };
    }
    return { ok: true, detail: { kind: "discount", percent, frequency, ...withService } };
  }
  if (r.kind === "answer") {
    const topic = text(r.topic).toLowerCase();
    const question = text(r.question);
    const words = text(r.text);
    if (!/^[a-z0-9-]{2,40}$/.test(topic) || !question || !words) {
      return { ok: false, reason: "A saved answer needs the question and your answer." };
    }
    return { ok: true, detail: { kind: "answer", topic, question, text: words } };
  }
  if (r.kind === "working_hours") {
    const days = text(r.workingDays);
    const start = text(r.hoursStart);
    const end = text(r.hoursEnd);
    const hm = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!(WORKING_DAY_CHOICES as readonly string[]).includes(days)) {
      return { ok: false, reason: "Working days must be one of the choices in Settings." };
    }
    if (!hm.test(start) || !hm.test(end) || end <= start) {
      return { ok: false, reason: "Working hours need a start and a later finish." };
    }
    return {
      ok: true,
      detail: { kind: "working_hours", workingDays: days, hoursStart: start, hoursEnd: end },
    };
  }
  return { ok: false, reason: `Unknown business detail: ${String(r.kind)}` };
}

/** "07:00" -> "7am", "17:30" -> "5:30pm". */
function clock(hm: string): string {
  const [h, m] = hm.split(":").map(Number) as [number, number];
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

const DAY_ABBR = String.raw`(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?`;
const TIME = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?`;
/** "Mon-Sat 7am-5pm", "Hours: Monday to Friday 8-4:30", "every day 7-5". */
const HOURS_LINE = new RegExp(
  String.raw`^\s*(?:(?:i|we)\s*(?:'m|'re|am|are)?\s*(?:work|open|working|available)\s+)?(?:(?:our|my)\s+)?(?:(?:working|business|opening|trading)\s+)?(?:hours?\s*(?:are|:|-)?\s*)?(?:open\s+)?(?:(every\s+day|7\s+days|daily)|${DAY_ABBR}\s*(?:-|–|to|through|thru)\s*${DAY_ABBR}),?\s*(?:from\s+)?${TIME}\s*(?:-|–|to|until|till)\s*${TIME}\s*[.!]?\s*$`,
  "i",
);
const DAY_RANGES: Record<string, string> = {
  "mon-fri": "Monday to Friday",
  "mon-sat": "Monday to Saturday",
  "mon-sun": "Every day",
  "sat-sun": "Weekends",
};

function hm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * "Mon-Sat 7am-5pm" as working hours Settings can hold, or null. A stretch
 * of days Settings cannot hold ("Tue-Thu") is left for the owner as a note.
 */
export function readWorkingHours(line: string): WorkingHoursDetail | null {
  const m = HOURS_LINE.exec(line);
  if (!m) return null;
  const days = m[1] ? "Every day" : DAY_RANGES[`${m[2]!.toLowerCase()}-${m[3]!.toLowerCase()}`];
  if (!days) return null;
  const toHour = (h: string, ap: string | undefined, isEnd: boolean, start?: number) => {
    let n = Number(h);
    if (ap) return ap.toLowerCase() === "pm" ? (n % 12) + 12 : n % 12;
    // "7-5": a finish written smaller than the start is in the afternoon.
    if (isEnd && start !== undefined && n <= start) n += 12;
    return n;
  };
  const startHour = toHour(m[4]!, m[6], false);
  const endHour = toHour(m[7]!, m[9], true, startHour);
  if (startHour > 23 || endHour > 23) return null;
  const hoursStart = hm(startHour, Number(m[5] ?? 0));
  const hoursEnd = hm(endHour, Number(m[8] ?? 0));
  if (hoursEnd <= hoursStart) return null;
  return { kind: "working_hours", workingDays: days, hoursStart, hoursEnd };
}

type DetailBearing = { state?: string | null; rulePayload?: unknown };

/** The Active, valid details of a business. */
export function activeDetails(business: {
  knowledge?: ReadonlyArray<DetailBearing> | null;
}): BusinessDetail[] {
  const out: BusinessDetail[] = [];
  for (const item of business.knowledge ?? []) {
    if (item.state !== "Active" || item.rulePayload == null) continue;
    const parsed = parseBusinessDetail(item.rulePayload);
    if (parsed.ok) out.push(parsed.detail);
  }
  return out;
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

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

/** "12-24" -> "24 December". */
export function spokenMonthDay(md: string): string {
  const m = MONTH_DAY.exec(md);
  if (!m) return md;
  return `${Number(m[2])} ${MONTH_NAMES[Number(m[1]) - 1]}`;
}

/** "10-10" in 2026 -> "Saturday 10 October". */
export function spokenDayOf(md: string, year: number): string {
  const m = MONTH_DAY.exec(md);
  if (!m) return md;
  const date = new Date(year, Number(m[1]) - 1, Number(m[2]));
  return `${WEEKDAYS[date.getDay()]} ${spokenMonthDay(md)}`;
}

export type ClosedRange = { from: string; to: string; year?: number };

/** Whether a day (yyyy-mm-dd) falls in a closed stretch: every year, or the one year saved. */
export function closedRangeCovers(iso: string, r: ClosedRange): boolean {
  const md = iso.slice(5);
  if (r.year === undefined) {
    return r.from <= r.to ? md >= r.from && md <= r.to : md >= r.from || md <= r.to;
  }
  const from = `${r.year}-${r.from}`;
  const to = `${r.to < r.from ? r.year + 1 : r.year}-${r.to}`;
  return iso >= from && iso <= to;
}

/** The reply's reason for a closed stretch: "I'm not available on Saturday 10 October". */
export function closedRangeReason(r: ClosedRange): string {
  if (r.from === r.to) {
    return r.year !== undefined
      ? `I'm not available on ${spokenDayOf(r.from, r.year)}`
      : `I'm not working on ${spokenMonthDay(r.from)}`;
  }
  return `I'm not working from ${spokenMonthDay(r.from)} to ${spokenMonthDay(r.to)}`;
}

/** The owner's read-back of a closed stretch, saying plainly whether it repeats. */
function describeClosedDates(d: ClosedDatesDetail): string {
  if (d.year !== undefined) {
    const toYear = d.to < d.from ? d.year + 1 : d.year;
    return d.from === d.to
      ? `Closed on ${spokenDayOf(d.from, d.year)} ${d.year} only`
      : `Closed from ${spokenDayOf(d.from, d.year)} to ${spokenDayOf(d.to, toYear)} ${toYear} only`;
  }
  return d.from === d.to
    ? `Closed on ${spokenMonthDay(d.from)} every year`
    : `You're closed ${spokenMonthDay(d.from)} to ${spokenMonthDay(d.to)}`;
}

/** "$450", "$32.50". */
export function dollars(amount: number): string {
  const whole = Number.isInteger(amount);
  return `$${amount.toLocaleString("en-AU", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function dayList(days: readonly number[]): string {
  // The working week's order: "Saturdays or Sundays", never Sunday first.
  const names = [...days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => `${WEEKDAYS[d]!}s`);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`
    : (names[0] ?? "");
}

/** What the owner reads back on the business screen. */
export function describeDetail(detail: BusinessDetail): string {
  switch (detail.kind) {
    case "note":
      return detail.text;
    case "not_offered":
      return `You don't ${detail.verb ?? "offer"} ${detail.service.toLowerCase()}`;
    case "closed_days":
      return `You don't work ${dayList(detail.days)}`;
    case "minimum_charge":
      return detail.service
        ? `${detail.service}: minimum charge ${dollars(detail.amount)}`
        : `Minimum charge ${dollars(detail.amount)} on every job`;
    case "surcharge":
      return `${detail.service ? `${detail.service} on ` : ""}${dayList(detail.days)}: ${detail.percent}% more`;
    case "fee":
      return `${detail.label} ${dollars(detail.amount)}`;
    case "eligibility":
      return `${detail.service} only if ${detail.condition}`;
    case "closed_dates":
      return describeClosedDates(detail);
    case "discount":
      if (detail.over) {
        return `Jobs over ${formatMajor(detail.over)}: ${detail.amountOff ? `${formatMajor(detail.amountOff)} off` : `${detail.percent}% off`}, when you choose it on a quote`;
      }
      return detail.frequency
        ? `${capitalFirst(detail.frequency)} ${detail.service ? detail.service.toLowerCase() : "jobs"}: ${detail.percent}% off`
        : `${capitalFirst(detail.condition ?? "")}: ${detail.percent}% off, when you choose it on a quote`;
    case "answer":
      return `Saved as an answer for: ${detail.topic} - "${detail.text}"`;
    case "working_hours":
      return `Working hours: ${detail.workingDays}, ${clock(detail.hoursStart)} to ${clock(detail.hoursEnd)}`;
  }
}

/** 2000 -> "$2,000", 99.5 -> "$99.50". */
function formatMajor(n: number): string {
  const cents = Math.round(n * 100);
  const whole = Math.floor(cents / 100).toLocaleString("en-AU");
  return cents % 100 ? `$${whole}.${String(cents % 100).padStart(2, "0")}` : `$${whole}`;
}

function capitalFirst(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** Which jobs a minimum covers: one service, or every job (""). */
export function minimumScope(d: MinimumChargeDetail): string {
  return (d.service ?? "").trim().toLowerCase();
}

/**
 * What saving this minimum does to the ones already there: two minimums for
 * the same jobs never stand side by side - the highest stays.
 */
export function minimumClash(
  detail: BusinessDetail,
  current: readonly BusinessDetail[],
): string | null {
  if (detail.kind !== "minimum_charge") return null;
  const same = current.filter(
    (d): d is MinimumChargeDetail =>
      d.kind === "minimum_charge" && d !== detail && minimumScope(d) === minimumScope(detail),
  );
  const top = same.reduce((m, d) => Math.max(m, d.amount), 0);
  if (!top) return null;
  if (top >= detail.amount) {
    return `You already have a ${dollars(top)} minimum for these jobs - that one stays and this one is not saved.`;
  }
  return `Replaces your ${dollars(top)} minimum for these jobs.`;
}

/** What Enquiry does with a detail, one sentence, for the save preview. */
export function detailEffect(detail: BusinessDetail): string {
  switch (detail.kind) {
    case "closed_days":
    case "closed_dates":
      return "When they ask for a day you don't work, the reply says so and names another day you could look at, never as booked. For a wedding or another fixed day it asks if there is any flexibility instead.";
    case "not_offered":
      return "When a customer asks if you do it, Enquiry reads that as No for you to confirm.";
    case "minimum_charge":
      return "On a quote under the minimum, Enquiry asks you with one tap: apply it, or not this time.";
    case "surcharge":
      return "When the job falls on that day, Enquiry asks you with one tap: add it, or not this time.";
    case "fee":
      return detail.days?.length
        ? `When the job falls on ${dayList(detail.days)}, Enquiry asks you with one tap: add it, or it doesn't apply.`
        : "On the quotes it concerns, Enquiry asks you with one tap: add it, or it doesn't apply.";
    case "eligibility":
      return "On those quotes, Enquiry asks you to check the job fits before any price goes out.";
    case "note":
      return "Shown to you on the quotes it concerns. Never added to a price.";
    case "discount":
      if (detail.over) {
        return `When a quote comes to more than ${formatMajor(detail.over)}, Enquiry asks you with one tap: take ${detail.amountOff ? formatMajor(detail.amountOff) : `${detail.percent}%`} off, or not this time.`;
      }
      return detail.frequency
        ? `Once you confirm a job repeats ${detail.frequency === "regular" ? "regularly" : detail.frequency}, Enquiry asks you with one tap: take ${detail.percent}% off, or not this time.`
        : `When a customer mentions ${detail.condition ?? "it"} or asks about a discount, Enquiry asks you with one tap: take ${detail.percent}% off, or not this time.`;
    case "answer":
      return `Offered with one tap when a customer asks "${detail.question}". Never sent unless you choose it.`;
    case "working_hours":
      return "Saved as your working hours in Settings, the one place they are kept. Follow-ups count only these hours.";
  }
}

/** The knowledge section a detail is filed under. */
export function detailSection(
  detail: BusinessDetail,
): "policy" | "service" | "capacity" | "operating" {
  if (detail.kind === "not_offered" || detail.kind === "eligibility") return "service";
  if (detail.kind === "closed_days" || detail.kind === "closed_dates") return "capacity";
  if (detail.kind === "answer" || detail.kind === "working_hours") return "operating";
  return "policy";
}

/** A title for the knowledge row. */
export function detailTitle(detail: BusinessDetail): string {
  switch (detail.kind) {
    case "note":
      return detail.service ? `Note: ${detail.service}` : "Note";
    case "not_offered":
      return `Not offered: ${detail.service}`;
    case "closed_days":
      return "Days you don't work";
    case "closed_dates":
      return "Dates you're closed";
    case "minimum_charge":
      return detail.service ? `Minimum charge: ${detail.service}` : "Minimum charge";
    case "surcharge":
      return "Surcharge";
    case "fee":
      return detail.label;
    case "eligibility":
      return `Only if: ${detail.service}`;
    case "discount":
      return "Discount";
    case "answer":
      return "Your answer";
    case "working_hours":
      return "Working hours";
  }
}

/** Days of the week and date ranges (month-day) the business does not work. */
export function closedTimesOf(details: readonly BusinessDetail[]): {
  days: number[];
  ranges: ClosedRange[];
} {
  const days = [...closedDaysOf(details)].sort((a, b) => a - b);
  const ranges = details.flatMap((d) =>
    d.kind === "closed_dates"
      ? [{ from: d.from, to: d.to, ...(d.year !== undefined ? { year: d.year } : {}) }]
      : [],
  );
  return { days, ranges };
}

/** Weekdays a job costs more on: a percentage surcharge or a fee for those days. */
export function surchargeDaysOf(details: readonly BusinessDetail[]): number[] {
  const out = new Set<number>();
  for (const d of details) {
    if (d.kind === "surcharge") d.days.forEach((n) => out.add(n));
    if (d.kind === "fee") (d.days ?? []).forEach((n) => out.add(n));
  }
  return [...out].sort((a, b) => a - b);
}

/** Every day the business does not work, from its closed-days details. */
export function closedDaysOf(details: readonly BusinessDetail[]): Set<number> {
  const out = new Set<number>();
  for (const d of details) if (d.kind === "closed_days") d.days.forEach((n) => out.add(n));
  return out;
}

const DAY_WORDS: [RegExp, number][] = [
  [/\bsun(?:day)?s?\b/i, 0],
  [/\bmon(?:day)?s?\b/i, 1],
  [/\btue(?:s(?:day)?)?s?\b/i, 2],
  [/\bwed(?:nesday)?s?\b/i, 3],
  [/\bthu(?:r(?:s(?:day)?)?)?s?\b/i, 4],
  [/\bfri(?:day)?s?\b/i, 5],
  [/\bsat(?:urday)?s?\b/i, 6],
];

const NEGATIVE = /\b(?:don'?t|do not|never|not|no|closed)\b/i;
/** A day of the month in the line: "10 October", "Oct 10", "10/10", "the 10th". */
const DATED =
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b|\b\d{1,2}\/\d{1,2}\b|\bthe\s+\d{1,2}(?:st|nd|rd|th)\b/i;
/** "every second Saturday", "alternate Sundays", "the first Monday of the month". */
const SOME_WEEKS =
  /\bevery\s+(?:second|other|2nd|third|3rd|fourth|4th)\b|\balternate\b|\b(?:first|second|third|fourth|last)\s+(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+of\b|\bsome\b/i;
/** "No Saturdays", "no weekends", "no Sundays or public holidays": nothing but the days. */
const NO_DAYS =
  /^\s*no\s+(?:(?:work|jobs?|bookings?)\s+(?:on\s+)?)?(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|weekends?)(?:\s*(?:,|or|and|\/)\s*(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|weekends?))*\s*[.!]*\s*$/i;
const WORK_WORDS = /\b(?:work|working|open|trade|available|jobs?|bookings?)\b|\bclosed\b/i;
const OFFER =
  /^\s*(?:we|i)\s+(?:don'?t|do not|never|can'?t|cannot|won'?t)\s+(do|offer|provide|handle|take on|clean|paint|cover)\s+(?:any\s+)?(.+?)\s*[.!]*$/i;
/** Verbs that say nothing more than "offer": the read-back keeps "offer". */
const GENERIC_VERBS = new Set(["do", "offer", "provide", "handle"]);

/** The weekdays a line names ("Saturdays or Sundays", "weekends"). */
function daysIn(line: string): number[] {
  const days = new Set<number>();
  if (/\bweekends?\b/i.test(line)) [0, 6].forEach((d) => days.add(d));
  for (const [re, d] of DAY_WORDS) if (re.test(line)) days.add(d);
  return [...days].sort((a, b) => a - b);
}

/** A rule with a condition is a note, never a rule: "windows above two storeys". */
const QUALIFIER =
  /\b(?:above|below|under|over|only|except|unless|but|more than|less than|bigger than|smaller than|without|if|when|after|before)\b|\d/i;
/** Nothing named: "we don't do it" says no service. */
const VAGUE =
  /^(?:it|that|this|them|those|these|any|anything|stuff|that sort of thing|those jobs)$/i;
/** "..., sorry", "... anymore": not part of what they don't do. */
const TRAIL = /\s*,?\s*\b(?:sorry|unfortunately|any ?more|at the moment|at all|these days)\b.*$/i;

export type DetailLineRead = BusinessDetail | { refuse: string } | null;

/** The clause that says no: "We don't do Sunday jobs but we do Saturdays". */
function negativeClause(line: string): string {
  const clauses = line.split(/\bbut\b|;|\bhowever\b/i);
  return clauses.find((c) => NEGATIVE.test(c)) ?? line;
}

/**
 * "We don't work Sundays", "Closed on weekends", "We don't do mould removal":
 * a line that states a rule and names no price. A rule with a condition in it
 * ("windows above two storeys", "jobs under 100") is kept as a note instead,
 * and one that names nothing ("we don't do it") is refused. Returns null for
 * anything else, so a price line is never read here.
 */
export function readDetailLine(line: string): DetailLineRead {
  if (/\$\s?\d|\d\s*(?:dollars?|bucks)\b/i.test(line)) return null;
  const clause = negativeClause(line);
  const days = daysIn(clause);
  // "closed every second Saturday" is not every Saturday: refused, never
  // widened into a rule that closes all of them.
  if (days.length > 0 && SOME_WEEKS.test(clause)) {
    return {
      refuse:
        "It closes only some of those days, and Enquiry can only keep a day you never work. Write the dates you're closed instead, for example: Not available Saturday 10 October.",
    };
  }
  // "Not available Saturday 10 October" is that one date. Only a line with no
  // date in it can say every Saturday.
  if (days.length > 0 && DATED.test(clause)) {
    return {
      refuse:
        "It names a date as well as a day of the week, and Enquiry could not read which date. Write it as, for example: Not available Saturday 10 October.",
    };
  }
  if (days.length > 0 && days.length < 7 && NEGATIVE.test(clause) && WORK_WORDS.test(clause)) {
    return { kind: "closed_days", days };
  }
  // "No Saturdays", "no weekends, sorry": a closed day with no work word.
  if (days.length > 0 && days.length < 7 && NO_DAYS.test(clause.replace(TRAIL, ""))) {
    return { kind: "closed_days", days };
  }
  const offer = OFFER.exec(line.replace(TRAIL, ""));
  const service = (offer?.[2] ?? "")
    .replace(/[.,;!]+$/, "")
    .replace(TRAIL, "")
    .trim();
  if (!offer) return null;
  if (!service || VAGUE.test(service)) {
    return {
      refuse:
        "It does not say what you don't do. Write it out, for example: We don't do mould removal.",
    };
  }
  if (QUALIFIER.test(service) || service.split(/\s+/).length > 5 || daysIn(service).length > 0) {
    return { kind: "note", text: line.trim().replace(/[.;]+$/, "") };
  }
  const verb = offer[1]!.toLowerCase();
  return {
    kind: "not_offered",
    service: service.toLowerCase(),
    ...(GENERIC_VERBS.has(verb) || verb.includes(" ") ? {} : { verb }),
  };
}

export type DetailRead = { line: string; detail: BusinessDetail };

/** A conditional or fee line kept as a note, tied to the saved service it names. */
export function noteFor(line: string, services: readonly string[]): NoteDetail {
  const lower = line.toLowerCase();
  const named = [...services]
    .sort((a, b) => b.length - a.length)
    .find((s) => s.trim() && lower.includes(s.trim().toLowerCase()));
  const text = line.trim().replace(/[.;]+$/, "");
  return { kind: "note", text, ...(named ? { service: named.trim() } : {}) };
}
