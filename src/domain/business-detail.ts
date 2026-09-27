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
};
/** "Exterior painting only if single storey": when a job qualifies at all. */
export type EligibilityDetail = {
  kind: "eligibility";
  service: string;
  /** "single storey". */
  condition: string;
  text: string;
};
/** "Closed 24 Dec - 2 Jan": month-day, every year; `to` may wrap into January. */
export type ClosedDatesDetail = { kind: "closed_dates"; from: string; to: string };

export type BusinessDetail =
  | NoteDetail
  | NotOfferedDetail
  | ClosedDaysDetail
  | MinimumChargeDetail
  | SurchargeDetail
  | FeeDetail
  | EligibilityDetail
  | ClosedDatesDetail;

export const DETAIL_KINDS = [
  "note",
  "not_offered",
  "closed_days",
  "minimum_charge",
  "surcharge",
  "fee",
  "eligibility",
  "closed_dates",
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
    return { ok: true, detail: { kind: "fee", amount, label, text: words, ...withService } };
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
    return { ok: true, detail: { kind: "closed_dates", from, to } };
  }
  return { ok: false, reason: `Unknown business detail: ${String(r.kind)}` };
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

/** "$450", "$32.50". */
export function dollars(amount: number): string {
  const whole = Number.isInteger(amount);
  return `$${amount.toLocaleString("en-AU", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function dayList(days: readonly number[]): string {
  const names = days.map((d) => `${WEEKDAYS[d]!}s`);
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
      return `You're closed ${spokenMonthDay(detail.from)} to ${spokenMonthDay(detail.to)}`;
  }
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
      return "When they ask for a day you don't work, the reply says so and offers the next day you do.";
    case "not_offered":
      return "When a customer asks if you do it, Enquiry reads that as No for you to confirm.";
    case "minimum_charge":
      return "On a quote under the minimum, Enquiry asks you with one tap: apply it, or not this time.";
    case "surcharge":
      return "When the job falls on that day, Enquiry asks you with one tap: add it, or not this time.";
    case "fee":
      return "On the quotes it concerns, Enquiry asks you with one tap: add it, or it doesn't apply.";
    case "eligibility":
      return "On those quotes, Enquiry asks you to check the job fits before any price goes out.";
    case "note":
      return "Shown to you on the quotes it concerns. Never added to a price.";
  }
}

/** The knowledge section a detail is filed under. */
export function detailSection(detail: BusinessDetail): "policy" | "service" | "capacity" {
  if (detail.kind === "not_offered" || detail.kind === "eligibility") return "service";
  if (detail.kind === "closed_days" || detail.kind === "closed_dates") return "capacity";
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
  }
}

/** Days of the week and date ranges (month-day) the business does not work. */
export function closedTimesOf(details: readonly BusinessDetail[]): {
  days: number[];
  ranges: { from: string; to: string }[];
} {
  const days = [...closedDaysOf(details)].sort((a, b) => a - b);
  const ranges = details.flatMap((d) =>
    d.kind === "closed_dates" ? [{ from: d.from, to: d.to }] : [],
  );
  return { days, ranges };
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
  if (days.length > 0 && days.length < 7 && NEGATIVE.test(clause) && WORK_WORDS.test(clause)) {
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
