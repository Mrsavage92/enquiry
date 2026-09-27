import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import type { Decision, QuoteLine } from "./decide.ts";
import { formatMinorAud } from "./money-format.ts";
import { dateQuestion, type DateIssue } from "./enquiry-basics.ts";
import { countOf, countParts, howMany, humanField, isOwnerEstimate } from "./count-phrase.ts";

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
};

/** "2026-10-03" -> "Saturday 3 October", or null for anything else. */
export function spokenDate(iso: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime()) || date.getDate() !== Number(m[3])) return null;
  return format(date, "EEEE d MMMM", { locale: enAU });
}

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
  return span
    .trim()
    .replace(/\b(mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\b\.?/gi, (w) => {
      const key = w.replace(/\.$/, "").toLowerCase();
      return WEEKDAY_WORDS[key] ?? w;
    })
    .replace(/[?!.]+$/, "");
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
  return `You mentioned ${spokenSpan(span)} - I'll confirm whether that works.`;
}

/** The one date sentence a reply carries, if any. */
function dateSentence(opts: ReplyContext): string | null {
  if (opts.dateIssue) return dateQuestion(opts.dateIssue, opts.asap);
  if (opts.dateOptions?.trim()) {
    return `You mentioned ${spokenSpan(opts.dateOptions)} - I'll confirm which day works.`;
  }
  const line = dateLine(
    opts.jobDateIso,
    opts.jobDateSpan,
    opts.jobDateConfirmed ?? !opts.jobDateSpan,
  );
  if (line) return line;
  return opts.asap ? "I'll let you know the soonest day I can do it." : null;
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
  return line.count ? `the ${label} (${line.count})` : `the ${label}`;
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
  const covered = single ? `the ${lines[0]!.label.toLowerCase()}` : listPhrase(lines);
  const head = recurring
    ? `For ${covered}, that's ${total} per visit`
    : `For ${covered}, that comes to ${total}`;
  const body =
    lines.length > 1
      ? [`${head}:`, ...itemised(lines, currency)]
      : [lines[0]?.detail ? `${head} (${lines[0].detail}).` : `${head}.`];
  const firstVisit = first.map(
    (l) => `The first visit adds ${formatMinor(l.amountMinor, currency)} for ${coveredPhrase(l)}.`,
  );
  const left = decision.leftOut?.length
    ? [`I haven't included ${joinLabels(decision.leftOut)} in this price.`]
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
  const first = (opts.customerName ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = first ? `Hi ${first},` : "Hi there,";
  const date = dateSentence(opts);
  const dateBlock = date ? [date, ""] : [];
  const signOff = opts.ownerFirstName?.trim() ? `Thanks,\n${opts.ownerFirstName.trim()}` : "Thanks";
  const service = (opts.serviceLabel ?? "").trim();
  const thanks = service
    ? `Thanks for getting in touch about ${service.toLowerCase()}.`
    : "Thanks for getting in touch.";
  const coverageOpen = decision.coverage ? !decision.coverage.confirmed : false;
  const onHold = Boolean(decision.questionPending) || coverageOpen;

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
      CLOSE,
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
      "Once I have that I can send the full cost straight back.",
      "",
      signOff,
    ].join("\n");
  }

  // Nothing prices it yet, or the owner has not settled it. The draft opens
  // the conversation without committing the business to anything.
  return [
    greeting,
    "",
    "Thanks for getting in touch.",
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
