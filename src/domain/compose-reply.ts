import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import type { Decision, QuoteLine } from "./decide.ts";
import { formatMinorAud } from "./money-format.ts";
import { dateQuestion, type DateIssue } from "./enquiry-basics.ts";
import { countOf, countParts, howMany, humanField, isOwnerEstimate } from "./count-phrase.ts";
import { SERVICE_NOUNS } from "./extras.ts";
import { closedRangeCovers, closedRangeReason, type ClosedRange } from "./business-detail.ts";
import type { DateRole } from "./enquiry-basics.ts";
import type { DateMention } from "./date-roles.ts";

export { humanField, howMany };

export type ReplyContext = {
  customerName?: string;
  ownerFirstName?: string;
  serviceLabel?: string;
  /**
   * The day the customer asked about, yyyy-mm-dd. Enquiry has no availability
   * to check it against, so the reply says the owner will confirm it rather
   * than ignoring the question or implying the day is free.
   */
  jobDateIso?: string;
  /**
   * They asked for it as soon as possible and gave no usable day. The reply
   * says the owner will come back with the soonest day, never a date.
   */
  asap?: boolean;
  /**
   * The customer's own words for the day ("Saturday 3 October"). An inferred
   * day is only ever quoted back in their words, never stated as the job date.
   */
  jobDateSpan?: string;
  /** The owner confirmed the day, so the reply may state it. */
  jobDateConfirmed?: boolean;
  /** A day that has passed or whose weekday disagrees: the reply asks. */
  dateIssue?: Pick<DateIssue, "kind" | "mention" | "actualDay">;
  /**
   * They offered more than one day ("Sat 26 or Sun 27 September"): quoted
   * back as written, and the owner says which works.
   */
  dateOptions?: string;
  /**
   * A reply in a conversation already going ("the quote you sent last week"):
   * never opened with "Thanks for getting in touch", as if they were new.
   */
  followUp?: boolean;
  /** A day read from the message but not asked about: checked against closed days only. */
  mentionedDateIso?: string;
  mentionedDateSpan?: string;
  /** The days offered, yyyy-mm-dd, first preferred: checked against closed days. */
  dateOptionIsos?: string[];
  /** "tuesdays pref": a day of the week they prefer, in their words. */
  dayPreference?: string;
  /** "week of the 12th", "tomorrow arvo": a loose ask, quoted back as written. */
  approxSpan?: string;
  /**
   * When the business does not work, from its own saved rules: the reply never
   * says it will "confirm whether" a day the owner already said is closed.
   */
  closed?: ClosedTimes;
  /**
   * They asked if the owner is free and the owner answered: that answer is
   * the reply's line about the day, never a second "I'll confirm" beside it.
   */
  dateAnswered?: boolean;
  /** What that answer leaves open: a No on every day asks what suits, a "come back" confirms later. */
  dateAnswerClose?: DateClose;
  /**
   * The day is for something that cannot move - a wedding, a formal, a
   * funeral, a deadline: the reply never offers another day for it.
   */
  fixedEvent?: string;
  /** What the job's day is for: the day it must be done by, or the event itself. */
  jobDateRole?: DateRole;
  /** The deadline's reason ("settlement", "inspection") or the event ("wedding"). */
  jobDateWhat?: string;
  /**
   * Every other day they wrote: the trial, the inspection, a second day. Each
   * gets its own true sentence, never silently passed over.
   */
  otherDates?: DateMention[];
  /**
   * Weekdays that cost more (a weekend surcharge): a day offered instead is
   * never one of these without saying so.
   */
  surchargeDays?: readonly number[];
};

/**
 * Days of the week (0 is Sunday) and yearly date ranges ("12-24" to "01-02",
 * month-day) the owner said they don't work.
 */
export type ClosedTimes = {
  days: readonly number[];
  ranges?: readonly ClosedRange[];
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dateOf(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "I don't work Sundays", "I'm not working from 24 December to 2 January", or null. */
export function closedReason(iso: string, closed: ClosedTimes | undefined): string | null {
  const date = dateOf(iso);
  if (!date || !closed) return null;
  if (closed.days.includes(date.getDay())) return `I don't work ${DAY_NAMES[date.getDay()]}s`;
  const range = (closed.ranges ?? []).find((r) => closedRangeCovers(iso, r));
  if (!range) return null;
  return closedRangeReason(range);
}

/** The first day after this one the owner works, within about two months. */
export function nextWorkingDay(iso: string, closed: ClosedTimes | undefined): string | null {
  const date = dateOf(iso);
  if (!date) return null;
  for (let i = 1; i <= 62; i += 1) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + i);
    if (!closedReason(isoOf(next), closed)) return isoOf(next);
  }
  return null;
}

/**
 * Another day to look at, never presented as free: nothing checks the
 * calendar, so the owner confirms it. A day that costs more (a weekend
 * surcharge) is skipped for one that does not, within a week; when every day
 * near it costs more, the reply says so rather than offering it quietly.
 */
function offerInstead(
  iso: string,
  closed: ClosedTimes | undefined,
  surchargeDays: readonly number[] = [],
): string {
  const first = nextWorkingDay(iso, closed);
  if (!first) return "What other day would suit you?";
  let pick = first;
  for (let i = 0; i < 7 && surchargeDays.includes(dateOf(pick)!.getDay()); i += 1) {
    const next = nextWorkingDay(pick, closed);
    if (!next) break;
    pick = next;
  }
  const day = spokenDate(pick)!;
  const costsMore = surchargeDays.includes(dateOf(pick)!.getDay());
  const note = costsMore ? ` (${DAY_NAMES[dateOf(pick)!.getDay()]} jobs cost more)` : "";
  return `If another day suits, I could look at ${day}${note} - I'll confirm it's free.`;
}

/** "2026-10-03" -> "Saturday 3 October", or null for anything else. */
export function spokenDate(iso: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime()) || date.getDate() !== Number(m[3])) return null;
  return format(date, "EEEE d MMMM", { locale: enAU });
}

const MONTH_WORDS: Record<string, string> = {
  jan: "January",
  feb: "February",
  mar: "March",
  apr: "April",
  jun: "June",
  jul: "July",
  aug: "August",
  sep: "September",
  oct: "October",
  nov: "November",
  dec: "December",
};

const WEEKDAY_WORDS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  tues: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** "Sat 3rd" -> "Saturday 3rd": their words, with the weekday written out. */
export function spokenSpan(span: string): string {
  return (
    span
      .trim()
      // "Next Tuesday" at the start of their sentence reads mid-sentence in the reply.
      .replace(/^(Next|This|Coming)\b/, (w) => w.toLowerCase())
      .replace(/\b(jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\b\.?/gi, (w) => {
        const key = w.replace(/\.$/, "").slice(0, 3).toLowerCase();
        return MONTH_WORDS[key] ?? w;
      })
      .replace(/\b(mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\b\.?/gi, (w) => {
        const key = w.replace(/\.$/, "").toLowerCase();
        return WEEKDAY_WORDS[key] ?? w;
      })
      .replace(/[?!.]+$/, "")
  );
}

/**
 * The line that answers a date question honestly when nothing checks
 * availability. A day the owner confirmed may be stated; a day only read from
 * their message is quoted back in their own words.
 */
export function dateLine(iso: string | undefined, span?: string, confirmed = true): string | null {
  const day = spokenDate(iso);
  if (!day) return null;
  if (confirmed || !span?.trim()) {
    return confirmed ? `I'll confirm whether ${day} works.` : null;
  }
  return `You mentioned ${daySaid(span, iso)} - I'll confirm whether that works.`;
}

/** "today", "tmrw", "this sat": words that name a different day once time passes. */
const RELATIVE =
  /\b(?:today|tonight|tomorrow|tmrw|tmr|tomoz|2moro|this|next|coming|arvo)\b|\bweek(?:end)?\b/i;
const HAS_MONTH = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

/**
 * Their words for a day when those words name it for good ("24 October",
 * "Saturday 3 October"); the day itself otherwise ("Saturday 3 October" for
 * "this sat 3rd", "Thursday 1 October" for "tmrw"), so a reply sent later
 * never names the wrong day.
 */
function daySaid(span: string | undefined, iso: string | undefined): string {
  const words = (span ?? "").trim();
  const day = spokenDate(iso);
  if (!words) return day ?? "";
  if (day && (RELATIVE.test(words) || !HAS_MONTH.test(words))) {
    const part = /\((morning|afternoon|evening)\)/i.exec(words)?.[1];
    return part ? `${day} (${part.toLowerCase()})` : day;
  }
  return spokenSpan(words);
}

/**
 * What the reply's date lines leave open. `closed`: a day they asked for is
 * one the owner does not work, so the close asks what date suits. `unconfirmed`:
 * a day the owner still has to confirm, so the close never implies it is booked.
 */
export type DateClose = "closed" | "unconfirmed";
type DateTalk = { lines: string[]; close?: DateClose };

function worst(a: DateClose | undefined, b: DateClose | undefined): DateClose | undefined {
  if (a === "closed" || b === "closed") return "closed";
  return a ?? b;
}

/** "the inspection", "settlement", "the keys". */
function theThing(what: string): string {
  const w = what.trim().toLowerCase();
  if (!w) return "";
  if (/^(?:settlement|handover|vacate|vacating|moving out|move out)$/.test(w)) return w;
  return `the ${w}`;
}

/** "your lease ends on Thursday 1 October", "the inspection is on Saturday 17 October". */
function contextSaid(what: string, day: string): string {
  const w = what.trim().toLowerCase();
  if (/^lease\s+(?:ends?|finishes|is\s+up)$/.test(w)) return `your lease ends on ${day}`;
  if (/^(?:moving out|move[sd]? out|moving|vacate|vacating)$/.test(w)) {
    return `you're moving out on ${day}`;
  }
  if (/^move in$/.test(w)) return `you're moving in on ${day}`;
  if (/^keys?$/.test(w)) return `the keys are due on ${day}`;
  if (/^(?:real estate|hand(?:ing)? over)$/.test(w)) return `the handover is on ${day}`;
  if (w && !/^inspect(?:ed|ing)$/.test(w)) return `${theThing(w)} is on ${day}`;
  if (w) return `the inspection is on ${day}`;
  return `you mentioned ${day}`;
}

/** Every date line a reply carries, and what its close may say. */
function dateTalk(opts: ReplyContext): DateTalk {
  const others = [...(opts.otherDates ?? [])];
  const main = mainDateTalk(opts, others);
  const rest = others.map((d) => otherDateTalk(d, opts));
  return {
    lines: [...main.lines, ...rest.flatMap((r) => r.lines)],
    close: rest.reduce<DateClose | undefined>((c, r) => worst(c, r.close), main.close),
  };
}

/**
 * The job's own day: a problem asked about, two days offered, a day they
 * don't work, the day it must be done by, or the day itself. A context day
 * that follows it ("before the inspection on Saturday 17 October") is folded
 * in and taken out of `others`.
 */
function mainDateTalk(opts: ReplyContext, others: DateMention[]): DateTalk {
  if (opts.dateAnswered) return { lines: [], close: opts.dateAnswerClose };
  if (opts.dateIssue) {
    return { lines: [dateQuestion(opts.dateIssue, opts.asap)], close: "closed" };
  }
  if (opts.dateOptions?.trim()) return optionsSentence(opts.dateOptions, opts);
  const closedLine = closedDaySentence(opts);
  if (closedLine) return { lines: [closedLine], close: "closed" };
  // A day only mentioned, and not in words that name it, is never said back:
  // it may be a misread ("Unit 5/12"). A closed one is still said above.
  const iso = opts.jobDateIso;
  const day = spokenDate(iso);
  if (iso && day) {
    // A day with none of their words is one the owner gave: stated as such.
    const confirmed = opts.jobDateConfirmed ?? !opts.jobDateSpan;
    if (opts.jobDateWhat === "day before" && !opts.jobDateConfirmed) {
      return { lines: [dayBeforeLine(iso, day, others)], close: "unconfirmed" };
    }
    const reason = foldContext(iso, opts.jobDateWhat, others);
    if (opts.jobDateRole === "deadline") {
      return {
        lines: [
          `I understand you need it done by ${day}${reason} - I'll confirm whether that works.`,
        ],
        close: "unconfirmed",
      };
    }
    if (opts.jobDateRole === "event" && opts.jobDateWhat) {
      return {
        lines: [
          `You mentioned ${day} for ${theThing(opts.jobDateWhat)} - I'll confirm whether that works.`,
        ],
        close: "unconfirmed",
      };
    }
    if (confirmed) return { lines: [`I'll confirm whether ${day} works.`], close: "unconfirmed" };
    const said = daySaid(opts.jobDateSpan, iso);
    return {
      lines: [`You mentioned ${said}${reason} - I'll confirm whether that works.`],
      close: "unconfirmed",
    };
  }
  if (opts.asap) {
    return { lines: ["I'll let you know the soonest day I can do it."], close: "unconfirmed" };
  }
  if (opts.approxSpan?.trim()) {
    const span = spokenSpan(opts.approxSpan);
    return {
      lines: [
        /\b(?:week|fortnight|month|days|between|from)\b/i.test(span)
          ? `You mentioned ${span} - I'll confirm which day works.`
          : `You mentioned ${span} - I'll confirm whether that works.`,
      ],
      close: "unconfirmed",
    };
  }
  return preferenceSentence(opts);
}

/**
 * "the day before (29/10)" beside settlement: "You mentioned Thursday 29
 * October, the day before settlement on Friday 30 October". "the day before
 * 30/10" with nothing named: the day worked out, and said as worked out.
 */
function dayBeforeLine(iso: string, day: string, others: DateMention[]): string {
  const next = nextDayIso(iso);
  const at = others.findIndex((d) => d.role === "context" && !d.to && d.iso === next);
  if (at !== -1) {
    const d = others[at]!;
    others.splice(at, 1);
    const what = d.what ? `${beforeSaid(d.what)} on ` : "";
    return `You mentioned ${day}, the day before ${what}${spokenDate(d.iso)} - I'll confirm whether that works.`;
  }
  return `You mentioned the day before ${spokenDate(next)}, which is ${day} - I'll confirm whether that works.`;
}

function nextDayIso(iso: string): string {
  const d = dateOf(iso)!;
  return isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
}

/**
 * ", before the inspection on Saturday 17 October": the context day just after
 * the job's own, named in the same sentence and taken out of the others.
 */
function foldContext(iso: string, what: string | undefined, others: DateMention[]): string {
  const at = others.findIndex(
    (d) =>
      d.role === "context" &&
      !d.to &&
      d.iso > iso &&
      (!what || !d.what || d.what.toLowerCase() === what.toLowerCase()),
  );
  if (at === -1) return "";
  const d = others[at]!;
  others.splice(at, 1);
  return `, before ${beforeSaid(d.what)} on ${spokenDate(d.iso)}`;
}

/** "you move out", "your lease ends", "the inspection". */
function beforeSaid(what: string): string {
  const w = what.trim().toLowerCase();
  if (/^lease\s+(?:ends?|finishes|is\s+up)$/.test(w)) return "your lease ends";
  if (/^(?:moving out|move[sd]? out|moving|vacate|vacating)$/.test(w)) return "you move out";
  if (/^move in$/.test(w)) return "you move in";
  if (/^keys?$/.test(w)) return "the keys are due";
  if (/^inspect(?:ed|ing)$/.test(w)) return "the inspection";
  return theThing(w) || "that";
}

/** One sentence for a day that is not the job's: the trial, the inspection, a second day. */
function otherDateTalk(d: DateMention, opts: ReplyContext): DateTalk {
  const day = spokenDate(d.iso);
  if (!day) return { lines: [] };
  if (d.to) {
    // "a trial in December": a whole month, with any days in it they don't work.
    const range = (opts.closed?.ranges ?? []).find(
      (r) => closedRangeCovers(d.iso, r) || closedRangeCovers(d.to!, r),
    );
    const month = d.label;
    const lead = d.what ? `For ${theThing(d.what)} in ${month}` : `For ${month}`;
    return range
      ? {
          lines: [`${lead}, I'll confirm which day works - ${closedRangeReason(range)}.`],
          close: "unconfirmed",
        }
      : { lines: [`${lead}, I'll confirm which day works.`], close: "unconfirmed" };
  }
  const reason = closedReason(d.iso, opts.closed);
  // Another day's event ("the wedding is Saturday 24 October" beside a
  // makeup job the day before): theirs, said as theirs, never booked.
  if (d.role === "context" || d.role === "event") {
    const said = contextSaid(d.what, day);
    return {
      lines: [
        d.role === "event"
          ? `I understand ${said}.`
          : `I understand ${said} - I'll work around that.`,
      ],
    };
  }
  const lead =
    d.role === "trial" || (d.what && d.role !== "job")
      ? `For ${theThing(d.what || "trial")}, you mentioned ${day}`
      : `You also mentioned ${day}`;
  if (reason) return { lines: [`${lead} - ${reason}.`], close: "closed" };
  return { lines: [`${lead} - I'll confirm whether that works.`], close: "unconfirmed" };
}

/**
 * A day they asked for that the owner said they don't work: said plainly, with
 * a day to look at instead. Only for a day read from the message - a day the
 * owner confirmed is the owner's call.
 */
function closedDaySentence(opts: ReplyContext): string | null {
  if (opts.jobDateConfirmed) return null;
  const iso = opts.jobDateIso ?? opts.mentionedDateIso;
  if (!iso) return null;
  const reason = closedReason(iso, opts.closed);
  if (!reason) return null;
  const span = opts.jobDateIso ? opts.jobDateSpan : opts.mentionedDateSpan;
  const said = daySaid(span, iso);
  // A wedding or a formal cannot move to Monday: say the day is taken and
  // ask, never offer another day.
  if (opts.fixedEvent) return fixedDaySentence(said || iso, [iso], opts.fixedEvent);
  return `You mentioned ${said} - ${reason}. ${offerInstead(iso, opts.closed, opts.surchargeDays)}`;
}

/** "You mentioned Sunday 8 November - I'm sorry, I'm not available on Sunday 8 November. Is there any flexibility on the date?" */
function fixedDaySentence(said: string, isos: string[], event?: string): string {
  const days = isos.map((iso) => spokenDate(iso)).filter(Boolean);
  const which = days.length > 1 ? `${days.slice(0, -1).join(", ")} or ${days.at(-1)}` : days[0];
  // A deadline can come earlier; an event day cannot move at all.
  if (event === "deadline") {
    return `You mentioned ${said} - I'm sorry, I'm not available on ${which}. Could it be done on an earlier day?`;
  }
  return `You mentioned ${said} - I'm sorry, I'm not available on ${which}. Is there any flexibility on the date?`;
}

/** Two days offered, the first preferred: a closed one is said, the other offered. */
function optionsSentence(span: string, opts: ReplyContext): DateTalk {
  const said = spokenSpan(span);
  const [first, second] = opts.dateOptionIsos ?? [];
  const firstClosed = first ? closedReason(first, opts.closed) : null;
  const secondClosed = second ? closedReason(second, opts.closed) : null;
  if (!first || !second || (!firstClosed && !secondClosed)) {
    return {
      lines: [`You mentioned ${said} - I'll confirm which day works.`],
      close: "unconfirmed",
    };
  }
  if (firstClosed && !secondClosed) {
    return {
      lines: [
        `You mentioned ${said} - ${firstClosed}, so I'll confirm whether ${spokenDate(second)} works.`,
      ],
      close: "unconfirmed",
    };
  }
  if (!firstClosed) {
    return {
      lines: [
        `You mentioned ${said} - I'll confirm whether ${spokenDate(first)} works. ${secondClosed![0]!.toUpperCase()}${secondClosed!.slice(1)}.`,
      ],
      close: "unconfirmed",
    };
  }
  if (opts.fixedEvent) {
    return { lines: [fixedDaySentence(said, [first, second], opts.fixedEvent)], close: "closed" };
  }
  const reasons = [...new Set([firstClosed, secondClosed])].join(" and ");
  return {
    lines: [
      `You mentioned ${said} - ${reasons}. ${offerInstead(first, opts.closed, opts.surchargeDays)}`,
    ],
    close: "closed",
  };
}

/** "tuesdays pref": a preference, never a date. A closed day in it is said plainly. */
function preferenceSentence(opts: ReplyContext): DateTalk {
  const pref = opts.dayPreference?.trim();
  if (!pref) return { lines: [] };
  const closedNames = DAY_NAMES.filter((name, i) => {
    if (!(opts.closed?.days ?? []).includes(i)) return false;
    return new RegExp(String.raw`\b${name}`, "i").test(pref);
  });
  if (closedNames.length > 0) {
    return {
      lines: [
        `You mentioned you'd prefer ${pref} - I don't work ${closedNames.map((n) => `${n}s`).join(" or ")}, so I'll let you know which days I can do.`,
      ],
      close: "closed",
    };
  }
  return {
    lines: [`You mentioned you'd prefer ${pref} - I'll confirm which day I can do.`],
    close: "unconfirmed",
  };
}

/** "120 square metres", "1 bedroom": a count said the way a person says it. */
export function quantityPhrase(value: string, field: string): string {
  return countOf(value, field);
}

/** Money arrives in minor units; a customer reads dollars ("$4.50", never "$4.5"). */
function formatMinor(amountMinor: number, currency: string): string {
  return formatMinorAud(amountMinor, currency);
}

/** "oven cleaning", "oven cleaning and windows". */
function joinLabels(labels: string[]): string {
  const lower = labels.map((l) => l.toLowerCase());
  if (lower.length <= 1) return lower[0] ?? "";
  return `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
}

/** "the end of lease clean (3 bedrooms)": one covered line, as the customer reads it. */
function coveredPhrase(line: QuoteLine): string {
  const label = line.label.toLowerCase();
  // "(please confirm)" is said once, beside the line's own workings.
  const count = line.count?.replace(/\s*\(please confirm\)$/, "");
  return count ? `the ${label} (${count})` : `the ${label}`;
}

function listPhrase(lines: readonly QuoteLine[]): string {
  const parts = lines.map(coveredPhrase);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function itemised(lines: readonly QuoteLine[], currency: string): string[] {
  return lines.map(
    (l) =>
      `- ${l.label}: ${formatMinor(l.amountMinor, currency)}${l.detail ? ` (${l.detail})` : ""}`,
  );
}

function priceLines(decision: Decision): QuoteLine[] {
  if (decision.price.kind !== "EXACT") return [];
  if (decision.lines?.length) return decision.lines;
  const rule = decision.price.rule;
  return [
    {
      label: rule.service,
      amountMinor: decision.price.amountMinor,
      ...(rule.kind === "per_unit" ? { detail: decision.price.workings.replace(/\.$/, "") } : {}),
      ...(decision.price.count ? { count: decision.price.count } : {}),
    },
  ];
}

/**
 * The price paragraph. It names exactly what the total covers - never "all
 * up", which told a customer that everything they asked for was in a total
 * that had dropped the deck staining. A recurring job is "per visit", with
 * anything for the first visit only said separately.
 */
function priceBlock(decision: Decision): string[] {
  if (decision.price.kind !== "EXACT") return [];
  const currency = decision.price.currency;
  const all = priceLines(decision);
  const recurring = Boolean(decision.coverage?.recurring);
  const first = recurring ? all.filter((l) => l.firstVisit) : [];
  const lines = all.filter((l) => !first.includes(l));
  const total = formatMinor(
    lines.reduce((sum, l) => sum + l.amountMinor, 0),
    currency,
  );
  // One line with its workings already says the count: "(3 bedrooms at $70
  // each)" is not repeated as "(3 bedrooms)".
  const single = lines.length === 1 && lines[0]?.detail;
  // "For the oven clean, that comes to $108" - a Saturday rate or a travel fee
  // is itemised below, never named as something they asked for.
  const jobs = lines.filter((l) => !l.adjustment);
  const covered = single ? `the ${lines[0]!.label.toLowerCase()}` : listPhrase(jobs);
  // Their rough size ("maybe 90sqm"): the total is "about", and the owner
  // will confirm it - never stated as a firm price.
  const about = decision.approximate ? "about " : "";
  const hedge = decision.approximate ? ", I'll confirm once I've seen the job" : "";
  const head = recurring
    ? `For ${covered}, that's ${about}${total} per visit${hedge}`
    : `For ${covered}, that comes to ${about}${total}${hedge}`;
  const body =
    lines.length > 1
      ? [`${head}:`, ...itemised(lines, currency)]
      : [lines[0]?.detail ? `${head} (${lines[0].detail}).` : `${head}.`];
  const firstVisit = first.map(
    (l) => `The first visit adds ${formatMinor(l.amountMinor, currency)} for ${coveredPhrase(l)}.`,
  );
  const left = decision.leftOut?.length
    ? [`I haven't included ${joinLabels(decision.leftOut.map(withArticle))} in this price.`]
    : [];
  const after = [...firstVisit, ...left];
  return after.length ? [...body, "", ...after] : body;
}

/**
 * The question for the one missing fact, as a person would ask it: "can you
 * let me know how many bedrooms there are?", not "...know the bedrooms?". A
 * singular field keeps "the" ("...know the address?").
 */
export function askFor(field: string): string {
  const parts = countParts(field);
  if (!parts.noun) return "can you tell me a bit more about the job?";
  if (!parts.isCount) return `can you let me know the ${parts.noun}?`;
  return `can you let me know how many ${parts.noun} there are?`;
}

/** "Before I can give you a price for the ceiling, can you let me know how many rooms there are?" */
function priceQuestion(field: string): string {
  const parts = countParts(field);
  const lead = parts.forService
    ? `Before I can give you a price for ${parts.forService}`
    : "Before I can give you a price";
  return `${lead}, ${askFor(field)}`;
}

function notesBlock(decision: Decision): string[] {
  return decision.replyNotes?.length ? [...decision.replyNotes, ""] : [];
}

/**
 * The close. Never "Happy to lock it in": nothing checks availability, and a
 * day they asked about is still the owner's to confirm.
 */
const CLOSE = "Just let me know if you'd like to go ahead.";
/** A day they asked for is one the owner does not work: the close never says "go ahead". */
export const CLOSE_CLOSED_DAY = "Let me know what date suits and I'll confirm.";
/** A day the owner still has to confirm: going ahead never books it. */
export const CLOSE_UNCONFIRMED_DAY =
  "Just let me know if you'd like to go ahead and I'll confirm the day.";

function closeFor(close: DateClose | undefined): string {
  if (close === "closed") return CLOSE_CLOSED_DAY;
  if (close === "unconfirmed") return CLOSE_UNCONFIRMED_DAY;
  return CLOSE;
}

/**
 * Write the reply the owner will actually send.
 *
 * Deliberately not a language model. Every sentence here is derived from the
 * decision - the business's own price, its own workings, the one fact that is
 * missing - so nothing in a customer-facing message can be invented. A model
 * may one day phrase this better; it will still not be allowed to decide what
 * the message claims.
 *
 * A total is only written once the owner has confirmed what it covers
 * (`decision.coverage.confirmed`); before that, and while a question they
 * asked is unanswered, the reply names no price at all.
 */
export function composeReply(decision: Decision, opts: ReplyContext = {}): string {
  // "Margaret & Tony Russo" is greeted as "Margaret & Tony"; one name by its first word.
  const who = (opts.customerName ?? "").trim();
  const first = /^(\S+\s+(?:&|and)\s+\S+)/.exec(who)?.[1] ?? who.split(/\s+/)[0] ?? "";
  const greeting = first ? `Hi ${first},` : "Hi there,";
  const date = dateTalk(opts);
  const dateBlock = date.lines.length ? [...date.lines, ""] : [];
  const signOff = opts.ownerFirstName?.trim() ? `Thanks,\n${opts.ownerFirstName.trim()}` : "Thanks";
  const service = (opts.serviceLabel ?? "").trim();
  const hello = opts.followUp ? "Thanks for your message." : "Thanks for getting in touch.";
  const thanks = opts.followUp
    ? hello
    : service
      ? `Thanks for getting in touch about ${service.toLowerCase()}.`
      : hello;
  // A kind no: their question or the job is outside what the owner does.
  if (decision.action === "DECLINE" && decision.declined?.length) {
    return [greeting, "", hello, "", ...decision.declined, "", signOff].join("\n");
  }
  const coverageOpen = decision.coverage ? !decision.coverage.confirmed : false;
  // Nothing priced goes in the reply while something they asked for is unsettled.
  const onHold =
    Boolean(decision.questionPending) || coverageOpen || Boolean(decision.extraPending);

  if (decision.price.kind === "EXACT" && !onHold) {
    return [
      greeting,
      "",
      thanks,
      "",
      ...priceBlock(decision),
      "",
      ...notesBlock(decision),
      ...dateBlock,
      closeFor(date.close),
      "",
      signOff,
    ].join("\n");
  }

  if (decision.price.kind === "BLOCKED" && !onHold) {
    const field = decision.price.missingField;
    const inferred = decision.blocker?.inferred;
    const said = inferred
      ? `I'll work out the price from the ${quantityPhrase(inferred.value, field)} you mentioned and send it straight back.`
      : isOwnerEstimate(field)
        ? "I'll work out how long it will take and send the price straight back."
        : null;
    if (said) {
      return [
        greeting,
        "",
        thanks,
        "",
        said,
        "",
        ...notesBlock(decision),
        ...dateBlock,
        signOff,
      ].join("\n");
    }
    return [
      greeting,
      "",
      thanks,
      "",
      priceQuestion(field),
      "",
      ...notesBlock(decision),
      ...dateBlock,
      "Once I have that I can send the price straight back.",
      "",
      signOff,
    ].join("\n");
  }

  // Nothing prices it yet, or the owner has not settled it. The draft opens
  // the conversation without committing the business to anything.
  return [
    greeting,
    "",
    hello,
    "",
    service
      ? `Let me check the details on ${service.toLowerCase()} and come straight back to you.`
      : "Let me check the details and come straight back to you.",
    "",
    ...notesBlock(decision),
    ...dateBlock,
    signOff,
  ].join("\n");
}

/** "deck" -> "the deck": a bare thing reads as a thing; "oven cleaning" stays as it is. */
function withArticle(label: string): string {
  const one = label.trim().toLowerCase();
  return SERVICE_NOUNS.has(one) ? `the ${one}` : label;
}
