import type { ReplyContext } from "./compose-reply.ts";
import type { DateIssue } from "./enquiry-basics.ts";
import type { DateClose } from "./compose-reply.ts";
import type { DateRole } from "./enquiry-basics.ts";
import { ASK_AVAILABILITY, availabilitySettled, parseAvailability } from "./customer-asks.ts";
import { fixedEventNear } from "./fixed-event.ts";
import { contextMentions } from "./date-roles.ts";
import { echoable } from "./enquiry-basics.ts";
import { closedReason } from "./compose-reply.ts";
import { closedRangeCovers } from "./business-detail.ts";
import {
  CLOSED_DAY_CHOICE,
  CLOSED_DAY_PREFIX,
  DATE_CHECK_CHOICE,
  DATE_CHECK_PREFIX,
  DATE_SWEEP_FIELD,
  dateAddedText,
  isDateAddedField,
  readSweep,
} from "./date-sweep.ts";

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
  /** provenance.role, for a date: "deadline", "event". */
  date_role?: string | null;
  /** provenance.what, for a date: "settlement", "wedding". */
  date_what?: string | null;
  /** The owner-facing words, for a legacy `date_context` value with no roles in it. */
  display_value?: string | null;
};

const DATE_ROLES = new Set(["job", "deadline", "event", "trial", "context"]);

/** What an availability answer leaves the close to say: a No on every day, or days to come back on. */
function answerClose(value: string): DateClose | undefined {
  const read = parseAvailability(value);
  if (!read) return undefined;
  const choices = "plain" in read ? [read.plain] : read.days.map(([, c]) => c);
  if (choices.every((c) => c === "no")) return "closed";
  if (choices.some((c) => c === "later" || c === "no")) return "unconfirmed";
  return undefined;
}

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

/** A swept day the owner has to settle: closed, and no other line of the reply says so. */
export type SweptCheck =
  | {
      kind: "closed";
      field: string;
      iso: string;
      span: string;
      context: boolean;
      week: boolean;
      /** For a week: its last day. */
      to?: string;
      /**
       * "next Sunday" said on a Saturday, with Sundays off: whichever day
       * they mean is closed, so it is a closed day, never a question of which.
       */
      either?: [string, string];
    }
  | {
      kind: "unread";
      field: string;
      words: string;
      /** The two days their words could be ("next Thursday" said on a Wednesday). */
      either?: [string, string];
      /** The stored sweep could not be read back: the owner checks every date. */
      corrupt?: true;
    };

/** The check raised when a stored sweep cannot be read back. */
export const SWEEP_UNREADABLE_FIELD = `${DATE_CHECK_PREFIX}dates in this message`;

/**
 * What the date sweep adds for the owner: every closed day it read that the
 * reply's other date lines do not already say, and every date-like fragment
 * it could not read. Each is an owner check (asked.ts) until settled.
 */
export function sweptChecks(
  facts: readonly ReplyFact[],
  ctx: Pick<
    ReplyContext,
    "closed" | "jobDateIso" | "mentionedDateIso" | "dateOptionIsos" | "otherDates"
  >,
): SweptCheck[] {
  const stored = facts.find((f) => field(f) === DATE_SWEEP_FIELD);
  if (!stored) return [];
  const sweep = readSweep(stored.value);
  const said = new Set<string>([
    ...(ctx.jobDateIso ? [ctx.jobDateIso] : []),
    ...(ctx.mentionedDateIso ? [ctx.mentionedDateIso] : []),
    ...(ctx.dateOptionIsos ?? []),
    ...(ctx.otherDates ?? [])
      .filter((d) => !d.to && d.role !== "context" && d.role !== "event")
      .map((d) => d.iso),
  ]);
  const out: SweptCheck[] = [];
  for (const d of sweep.days) {
    if (d.to) {
      // A week always holds a day off; only closed dates inside it count.
      const hit = (ctx.closed?.ranges ?? []).some((r) =>
        stretchIsos(d.iso, d.to!).some((iso) => closedRangeCovers(iso, r)),
      );
      if (hit) {
        out.push({
          kind: "closed",
          field: `${CLOSED_DAY_PREFIX}${d.iso}`,
          iso: d.iso,
          span: d.span,
          context: false,
          week: true,
          to: d.to,
        });
      }
      continue;
    }
    if (said.has(d.iso)) continue;
    if (!closedReason(d.iso, ctx.closed)) continue;
    out.push({
      kind: "closed",
      field: `${CLOSED_DAY_PREFIX}${d.iso}`,
      iso: d.iso,
      span: d.span,
      context: Boolean(d.context),
      week: false,
    });
  }
  for (const words of sweep.unread) {
    const either = sweep.either?.[words];
    // Which of the two days they mean only matters when one could be worked.
    if (either && either.every((iso) => closedReason(iso, ctx.closed))) {
      // Already asked about as a closed day of its own ("next Sunday, the 4th").
      if (out.some((c) => c.field === `${CLOSED_DAY_PREFIX}${either[0]}`)) continue;
      out.push({
        kind: "closed",
        field: `${CLOSED_DAY_PREFIX}${either[0]}`,
        iso: either[0],
        span: words,
        context: false,
        week: false,
        either,
      });
      continue;
    }
    out.push({
      kind: "unread",
      field: `${DATE_CHECK_PREFIX}${words.toLowerCase()}`,
      words,
      ...(either ? { either } : {}),
    });
  }
  if (sweep.corrupt) {
    out.push({ kind: "unread", field: SWEEP_UNREADABLE_FIELD, words: "", corrupt: true });
  }
  return out;
}

/** Every day of a week or a stretch they named, first to last (at most 62 days). */
function stretchIsos(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number) as [number, number, number];
  for (let i = 0; i <= 62; i += 1) {
    const day = new Date(y, m - 1, d + i);
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    if (iso > to) break;
    out.push(iso);
  }
  return out;
}

/** The owner's word on a swept check, or undefined while it is open. */
export function sweptAnswer(facts: readonly ReplyFact[], check: SweptCheck): string | undefined {
  const f = facts.find((x) => field(x) === check.field.toLowerCase() && x.status === "confirmed");
  return f ? String(f.value ?? "").trim() : undefined;
}

/** The reply's share of the sweep: days to say, fragments to confirm, and whether any is open. */
function sweptReply(
  facts: readonly ReplyFact[],
  checks: readonly SweptCheck[],
  closedTimes?: ReplyContext["closed"],
): Pick<ReplyContext, "sweptClosed" | "sweptUnread" | "sweptOpen"> {
  const closed: NonNullable<ReplyContext["sweptClosed"]> = [];
  const unread: string[] = [];
  let open = false;
  for (const c of checks) {
    const answer = sweptAnswer(facts, c);
    if (!answer) open = true;
    if (c.kind === "closed") {
      // The owner can do it after all: the reply says only that they'll confirm.
      if (answer === CLOSED_DAY_CHOICE.available) {
        if (!c.context && !unread.includes(c.span)) unread.push(c.span);
        continue;
      }
      // A week the owner says so of: the closed days in it are named.
      if (c.week && c.to && answer === CLOSED_DAY_CHOICE.notAvailable) {
        for (const iso of stretchIsos(c.iso, c.to)) {
          // A week always holds a day off: only its closed dates are named.
          if ((closedTimes?.ranges ?? []).some((r) => closedRangeCovers(iso, r))) {
            closed.push({ iso, span: c.span, say: true });
          }
        }
        continue;
      }
      const say = !c.week && (answer === CLOSED_DAY_CHOICE.notAvailable || (!answer && !c.context));
      if (c.either) {
        // Either day is closed: said by why ("I don't work Sundays") when the
        // reason is the same for both, never by a day they may not mean.
        const reasons = new Set(c.either.map((iso) => closedReason(iso, closedTimes)));
        const reason = reasons.size === 1 ? [...reasons][0] : null;
        for (const iso of c.either) {
          closed.push({ iso, span: c.span, say, ...(reason ? { reason } : {}) });
        }
        continue;
      }
      closed.push({ iso: c.iso, span: c.span, say });
      continue;
    }
    // An unreadable stored sweep holds the reply; it never puts their words in it.
    if (c.corrupt) {
      if (answer === DATE_CHECK_CHOICE.confirm && !unread.includes("")) unread.push("");
      continue;
    }
    if (answer !== DATE_CHECK_CHOICE.notADate) unread.push(c.words);
  }
  return {
    ...(closed.length ? { sweptClosed: closed } : {}),
    ...(unread.length ? { sweptUnread: unread } : {}),
    ...(open ? { sweptOpen: true } : {}),
  };
}

export function replyContextFromFacts(
  facts: readonly ReplyFact[],
  base: Pick<
    ReplyContext,
    "ownerFirstName" | "serviceLabel" | "closed" | "followUp" | "surchargeDays"
  > & {
    customerName: string;
    /** Everything the customer wrote, to tell a wedding day from a movable one. */
    message?: string;
  },
): ReplyContext {
  const date = facts.find((f) => field(f) === "date");
  // "r u free this sat or sun?" answered by the owner: that answer is the day line.
  const answer = facts.find(
    (f) =>
      field(f) === ASK_AVAILABILITY &&
      f.status === "confirmed" &&
      availabilitySettled(
        String(f.value ?? ""),
        String(date?.value ?? "")
          .split("|")
          .filter((d) => ISO_DAY.test(d.trim())),
      ),
  );
  const dateAnswered = Boolean(answer);
  const role = DATE_ROLES.has(String(date?.date_role ?? ""))
    ? (String(date!.date_role) as DateRole)
    : undefined;
  const what = String(date?.date_what ?? "").trim() || undefined;
  // What the day is for, read when it was stored; a date stored before roles
  // existed is read from their words as before.
  const fixedEvent =
    role === "deadline"
      ? "deadline"
      : role === "event"
        ? (what ?? "event")
        : base.message
          ? fixedEventNear(base.message, date?.date_span ?? undefined)
          : undefined;
  const context = facts.find((f) => field(f) === "date_context");
  const read = context
    ? contextMentions(String(context.value ?? ""), String(context.display_value ?? ""))
    : [];
  const value = String(date?.value ?? "").trim();
  const confirmed = date?.status === "confirmed";
  // A makeup trial booked for itself: the trial's day is the job's.
  const trialJob =
    !ISO_DAY.test(value) && /\btrials?\b/i.test(base.serviceLabel ?? "")
      ? read.find((d) => d.role === "trial" && !d.to)
      : undefined;
  const otherDates = trialJob ? read.filter((d) => d !== trialJob) : read;
  // A day is said back when they asked about it, the owner confirmed it, the
  // reader tied it to what it is for, or their own words for it name a month,
  // a weekday or a full date and are in their message. Anything else (an
  // interpreter's guess, "5/12" beside an address) is only checked against
  // the days the owner does not work.
  const said =
    Boolean(date) &&
    (String(date!.date_asked) === "true" ||
      confirmed ||
      Boolean(role && role !== "job") ||
      Boolean(what) ||
      echoable(date!.date_span, base.message ?? ""));
  const issue = date && !confirmed ? asIssue(date.date_issue) : undefined;
  const preference = facts.find((f) => field(f) === DAY_PREFERENCE_FIELD);
  const options = value.split("|").filter((d) => ISO_DAY.test(d));
  const reply: ReplyContext = {
    customerName: greetingName(base.customerName, facts),
    ownerFirstName: base.ownerFirstName,
    serviceLabel: base.serviceLabel,
    // Every day they wrote in words that name it gets a true sentence, asked
    // about or only mentioned ("Thurs 8th Oct if poss", "Preferred date:
    // 14/10/2026").
    ...(date && ISO_DAY.test(value) && said
      ? {
          jobDateIso: value,
          jobDateConfirmed: confirmed,
          ...(date.date_span ? { jobDateSpan: String(date.date_span) } : {}),
          ...(role && role !== "job" ? { jobDateRole: role } : {}),
          ...(what ? { jobDateWhat: what } : {}),
        }
      : {}),
    ...(date && ISO_DAY.test(value) && !said
      ? {
          mentionedDateIso: value,
          ...(date.date_span ? { mentionedDateSpan: String(date.date_span) } : {}),
        }
      : {}),
    ...(trialJob ? { jobDateIso: trialJob.iso, jobDateConfirmed: false } : {}),
    ...(otherDates.length ? { otherDates } : {}),
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
    ...(answer && answerClose(String(answer.value ?? ""))
      ? { dateAnswerClose: answerClose(String(answer.value ?? "")) }
      : {}),
    ...(base.surchargeDays?.length ? { surchargeDays: base.surchargeDays } : {}),
    ...(fixedEvent ? { fixedEvent } : {}),
    asap: value === ASAP_VALUE,
  };
  const checks = sweptChecks(facts, reply);
  const swept = checks.length ? sweptReply(facts, checks, reply.closed) : {};
  const added = addedDays(facts, reply.closed);
  if (!checks.length && !added.closed.length && !added.confirm.length) return reply;
  const closedDays = [...(swept.sweptClosed ?? []), ...added.closed];
  const confirm = [...(swept.sweptUnread ?? []), ...added.confirm];
  return {
    ...reply,
    ...swept,
    ...(closedDays.length ? { sweptClosed: closedDays } : {}),
    ...(confirm.length ? { sweptUnread: confirm } : {}),
  };
}

/**
 * Days the owner added in "They asked for more": a closed one is said as not
 * available, any other as a day they'll confirm. Read when the owner typed it.
 */
export function addedDays(
  facts: readonly ReplyFact[],
  closed: ReplyContext["closed"],
): { closed: { iso: string; span: string; say: boolean }[]; confirm: string[] } {
  const out = {
    closed: [] as { iso: string; span: string; say: boolean }[],
    confirm: [] as string[],
  };
  for (const f of facts) {
    if (!isDateAddedField(f.field) || f.status !== "confirmed") continue;
    const words = dateAddedText(f.field);
    const sweep = readSweep(f.value);
    if (sweep.corrupt && !out.confirm.includes(words)) out.confirm.push(words);
    const shut = sweep.days.filter((d) => !d.to && closedReason(d.iso, closed));
    for (const d of shut) out.closed.push({ iso: d.iso, span: words, say: true });
    if (shut.length < sweep.days.length && !out.confirm.includes(words)) out.confirm.push(words);
  }
  return out;
}
