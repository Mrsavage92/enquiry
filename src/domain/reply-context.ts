import type { ReplyContext } from "./compose-reply.ts";
import type { DateIssue } from "./enquiry-basics.ts";
import { ASK_AVAILABILITY } from "./customer-asks.ts";
import { fixedEventNear } from "./fixed-event.ts";

/**
 * What the reply may say about the customer, from the live facts - and what it
 * may not. A name or a day only read from their message is a reading: the
 * greeting stays "Hi there," until the owner confirms the name, and a day is
 * only quoted back in their own words ("You mentioned Saturday 3 October").
 */

export const ASAP_VALUE = "asap";
/** A date fact holding a loose ask ("week of the 12th"): their words are the span. */
export const APPROX_VALUE = "approx";
/** "tuesdays pref": the day of the week they prefer, as a reading. */
export const DAY_PREFERENCE_FIELD = "day_preference";

export type ReplyFact = {
  field: string;
  value: string;
  status: string;
  /** provenance.asked, for a date. */
  date_asked?: string | boolean | null;
  /** provenance.span: the customer's words. */
  date_span?: string | null;
  /** provenance.issue, for a date that has passed or disagrees with its weekday. */
  date_issue?: unknown;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A date fact holding a stretch of days: "2026-11-02..2026-11-09". */
export const WINDOW_VALUE = /^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/;

function field(f: ReplyFact): string {
  return f.field.trim().toLowerCase();
}

function asIssue(raw: unknown): ReplyContext["dateIssue"] | undefined {
  const value = typeof raw === "string" ? safeParse(raw) : raw;
  if (!value || typeof value !== "object") return undefined;
  const v = value as Partial<DateIssue>;
  if (!v.kind || !v.mention) return undefined;
  return { kind: v.kind, mention: v.mention, ...(v.actualDay ? { actualDay: v.actualDay } : {}) };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Words that say the message continues a conversation: "the quote you sent",
 * "as discussed", "following up", "thanks for the quote".
 */
const FOLLOW_UP =
  /\b(?:the|your)\s+quote\s+(?:you\s+)?(?:sent|gave|emailed|did|quoted)\b|\bas\s+discussed\b|\bfollowing\s+up\b|\bfurther\s+to\b|\bthanks\s+for\s+(?:the|your)\s+quote\b|\bgot\s+(?:the|your)\s+quote\b|\bwe\s+spoke\b|\bjust\s+(?:checking|following)\s+(?:in|up|back)\b|\bre\s*:\s/i;

/** Whether a reply answers a conversation already going, not a first enquiry. */
export function isFollowUp(inbound: readonly string[], hasOutbound = false): boolean {
  if (hasOutbound || inbound.length > 1) return true;
  return inbound.some((t) => FOLLOW_UP.test(t));
}

/** The greeting name: only a name the owner typed or confirmed. */
export function greetingName(customerName: string, facts: readonly ReplyFact[]): string {
  const read = facts.find((f) => field(f) === "name");
  if (read && read.status !== "confirmed") return "";
  return customerName;
}

export function replyContextFromFacts(
  facts: readonly ReplyFact[],
  base: Pick<ReplyContext, "ownerFirstName" | "serviceLabel" | "closed" | "followUp"> & {
    customerName: string;
    /** Everything the customer wrote, to tell a wedding day from a movable one. */
    message?: string;
  },
): ReplyContext {
  const date = facts.find((f) => field(f) === "date");
  // "r u free this sat or sun?" answered by the owner: that answer is the day line.
  const dateAnswered = facts.some(
    (f) =>
      field(f) === ASK_AVAILABILITY &&
      f.status === "confirmed" &&
      ["yes", "no", "later"].includes(String(f.value ?? "").trim()),
  );
  const fixedEvent = base.message
    ? fixedEventNear(base.message, date?.date_span ?? undefined)
    : undefined;
  const value = String(date?.value ?? "").trim();
  const confirmed = date?.status === "confirmed";
  const issue = date && !confirmed ? asIssue(date.date_issue) : undefined;
  const asked = String(date?.date_asked) === "true";
  const preference = facts.find((f) => field(f) === DAY_PREFERENCE_FIELD);
  const options = value.split("|").filter((d) => ISO_DAY.test(d));
  return {
    customerName: greetingName(base.customerName, facts),
    ownerFirstName: base.ownerFirstName,
    serviceLabel: base.serviceLabel,
    ...(date && ISO_DAY.test(value) && (asked || confirmed)
      ? {
          jobDateIso: value,
          jobDateConfirmed: confirmed,
          ...(date.date_span ? { jobDateSpan: String(date.date_span) } : {}),
        }
      : {}),
    // A day only mentioned, not asked about: never quoted back as a question,
    // but a day the owner does not work is still said plainly.
    ...(date && ISO_DAY.test(value) && !asked && !confirmed
      ? {
          mentionedDateIso: value,
          ...(date.date_span ? { mentionedDateSpan: String(date.date_span) } : {}),
        }
      : {}),
    ...(issue ? { dateIssue: issue } : {}),
    // Two days offered ("Sat 26 or Sun 27 Sep"): quoted back, never picked.
    ...(!confirmed && value.includes("|") && date?.date_span
      ? { dateOptions: String(date.date_span), dateOptionIsos: options }
      : {}),
    // "between 2 and 9 November (not weekends)": the stretch, in their words.
    ...((value === APPROX_VALUE || WINDOW_VALUE.test(value)) && date?.date_span
      ? { approxSpan: String(date.date_span) }
      : {}),
    ...(preference && String(preference.value ?? "").trim()
      ? { dayPreference: String(preference.value).trim() }
      : {}),
    ...(base.closed ? { closed: base.closed } : {}),
    ...(base.followUp ? { followUp: true } : {}),
    ...(dateAnswered ? { dateAnswered: true } : {}),
    ...(fixedEvent ? { fixedEvent } : {}),
    asap: value === ASAP_VALUE,
  };
}
