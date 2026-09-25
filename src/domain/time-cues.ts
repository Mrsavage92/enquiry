import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import { addCalendarDays, dayKeyFromDate, startOfDay, wallNow } from "./format";
import { queueSection } from "./labels";
import type { Enquiry, WorkspacePrefs } from "./types";
import { FOLLOW_UP_AFTER_MINUTES, isWorkingDay, parseHm } from "./working-hours";

/**
 * Concrete time, never "about 1 month ago".
 *
 * A relative phrase makes the reader do arithmetic and hold the result, which
 * is exactly the load this product promises to take away. Every cue here names
 * a day a person can picture: "today 9:14am", "Tue 9:14am", "Tue 22 Sep".
 */

const DEFAULT_ZONE = "Australia/Brisbane";
const MINUTE = 60_000;
const DAY = 86_400_000;
/** How long an absence has to be before Today offers a "since you were last here" line. */
export const CATCH_UP_AFTER_MS = 2 * 60 * MINUTE;

function wall(iso: string | Date, tz: string): Date | null {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  return wallNow(d, tz);
}

function clock(d: Date): string {
  return format(d, "h:mmaaa", { locale: enAU });
}

/** "today 9:14am", "yesterday 4:05pm", "Tue 9:14am" within a week, else "Tue 22 Sep". */
export function concreteWhen(iso: string, now = new Date(), tz = DEFAULT_ZONE): string {
  const then = wall(iso, tz);
  const today = wall(now, tz);
  if (!then || !today) return "";
  const days = Math.round((startOfDay(today).getTime() - startOfDay(then).getTime()) / DAY);
  if (days === 0) return `today ${clock(then)}`;
  if (days === 1) return `yesterday ${clock(then)}`;
  if (days > 1 && days < 7) return `${format(then, "EEE", { locale: enAU })} ${clock(then)}`;
  return format(then, "EEE d MMM", { locale: enAU });
}

/**
 * Where a parked enquiry is: "Parked until 3:15pm today", "Parked until
 * tomorrow 8:00am", "Parked until Mon 28 Sep". The day keeps its capitals
 * wherever the sentence is used.
 */
export function parkedUntil(untilIso: string, now = new Date(), tz = DEFAULT_ZONE): string {
  const back = wall(untilIso, tz);
  const today = wall(now, tz);
  if (!back || !today) return "Parked";
  const key = dayKeyFromDate(back);
  if (key === dayKeyFromDate(today)) return `Parked until ${clock(back)} today`;
  if (key === dayKeyFromDate(addCalendarDays(today, 1))) {
    return `Parked until tomorrow ${clock(back)}`;
  }
  return `Parked until ${format(back, "EEE d MMM", { locale: enAU })}`;
}

/** A day to come back on: "today", "tomorrow", "Tue 29 Sep". */
export function concreteDay(target: Date, now = new Date(), tz = DEFAULT_ZONE): string {
  const today = wall(now, tz);
  if (!today) return "";
  const key = dayKeyFromDate(target);
  if (key === dayKeyFromDate(today)) return "today";
  if (key === dayKeyFromDate(addCalendarDays(today, 1))) return "tomorrow";
  return format(target, "EEE d MMM", { locale: enAU });
}

/**
 * When a quiet customer comes back to the owner, as a wall-clock Date in the
 * workspace zone: the moment two working days (FOLLOW_UP_AFTER_MINUTES) of the
 * owner's own hours have passed since the last reply went out.
 *
 * Walks whole days rather than 15-minute steps, so it is cheap enough to run
 * for every row on every render and for every enquiry on a server read.
 */
export function followUpDueWall(lastOutIso: string, prefs: WorkspacePrefs): Date | null {
  const tz = prefs.timezone || DEFAULT_ZONE;
  const from = wall(lastOutIso, tz);
  if (!from) return null;
  const start = parseHm(prefs.hoursStart || "08:00");
  const end = parseHm(prefs.hoursEnd || "17:30");
  if (end <= start) return null;
  let remaining = FOLLOW_UP_AFTER_MINUTES;
  for (let i = 0; i < 120; i += 1) {
    const day = startOfDay(addCalendarDays(from, i));
    if (!isWorkingDay(day.getDay(), prefs.workingDays)) continue;
    const open = day.getTime() + start * MINUTE;
    const close = day.getTime() + end * MINUTE;
    const begin = Math.max(open, i === 0 ? from.getTime() : open);
    if (begin >= close) continue;
    const available = (close - begin) / MINUTE;
    if (available >= remaining) return new Date(begin + remaining * MINUTE);
    remaining -= available;
  }
  return null;
}

function lastMessageAt(enquiry: Enquiry, direction: "inbound" | "outbound"): string | undefined {
  return [...enquiry.conversation].reverse().find((m) => m.direction === direction)?.at;
}

/** Waiting on a customer after a reply went out, with nothing parked or already due. */
function quietCandidate(enquiry: Enquiry, now: Date): string | undefined {
  if (enquiry.state.lifecycle !== "OPEN") return undefined;
  if (enquiry.state.decision !== "WAITING_ON_CLIENT") return undefined;
  if (enquiry.snoozedUntil && Date.parse(enquiry.snoozedUntil) > now.getTime()) return undefined;
  return lastMessageAt(enquiry, "outbound");
}

/**
 * Bring a quiet enquiry back, computed from what is on record rather than from
 * an open browser tab.
 *
 * Only the attention flags change: the enquiry lands back in "Needs you" with a
 * reason that names the day the reply went out. The stored decision is not
 * rewritten, so nothing here can invent a send the server would then refuse.
 */
export function withFollowUpDue(
  enquiry: Enquiry,
  prefs: WorkspacePrefs,
  now = new Date(),
): Enquiry {
  if (enquiry.followUpDue) return enquiry;
  const lastOut = quietCandidate(enquiry, now);
  if (!lastOut) return enquiry;
  const due = followUpDueWall(lastOut, prefs);
  const tz = prefs.timezone || DEFAULT_ZONE;
  const nowWall = wall(now, tz);
  if (!due || !nowWall || nowWall.getTime() < due.getTime()) return enquiry;
  return {
    ...enquiry,
    followUpDue: true,
    followUpReason: followUpReason(enquiry, lastOut, now, tz),
  };
}

/**
 * "No reply for 3 days since the quote. It went out Tue 10:00am." The day
 * count is calendar days in the business's own time zone, never fewer than 1.
 */
export function followUpReason(
  enquiry: Pick<Enquiry, "state">,
  lastOutIso: string,
  now = new Date(),
  tz = DEFAULT_ZONE,
): string {
  const sentWall = wall(new Date(lastOutIso), tz);
  const nowWall = wall(now, tz);
  const days =
    sentWall && nowWall
      ? Math.max(
          1,
          Math.round((startOfDay(nowWall).getTime() - startOfDay(sentWall).getTime()) / 86_400_000),
        )
      : 1;
  const quoted = enquiry.state.commercial === "QUOTED" || enquiry.state.commercial === "ESTIMATED";
  const what = quoted ? "the quote" : "your reply";
  return `No reply for ${days} day${days === 1 ? "" : "s"} since ${what}. It went out ${concreteWhen(lastOutIso, now, tz)}.`;
}

/**
 * The one concrete cue a row shows: what is waiting, since when, or when it
 * comes back. Never a bare relative time.
 */
export function rowTimeCue(enquiry: Enquiry, prefs: WorkspacePrefs, now = new Date()): string {
  const tz = prefs.timezone || DEFAULT_ZONE;
  if (enquiry.state.lifecycle !== "OPEN") {
    return `Updated ${concreteWhen(enquiry.updatedAt, now, tz)}`;
  }
  if (enquiry.snoozedUntil && Date.parse(enquiry.snoozedUntil) > now.getTime()) {
    return parkedUntil(enquiry.snoozedUntil, now, tz);
  }
  const lastOut = lastMessageAt(enquiry, "outbound");
  if (enquiry.followUpDue && lastOut) {
    return `Sent ${concreteWhen(lastOut, now, tz)}, no answer yet`;
  }
  if (queueSection(enquiry) === "waiting" && lastOut) {
    const due = followUpDueWall(lastOut, prefs);
    const sent = `Sent ${concreteWhen(lastOut, now, tz)}`;
    return due ? `${sent} · back ${concreteDay(due, now, tz)} if no answer` : sent;
  }
  if (enquiry.state.decision === "EVALUATING") return "Reading now";
  const since = lastMessageAt(enquiry, "inbound") ?? enquiry.receivedAt;
  return `Your turn since ${concreteWhen(since, now, tz)}`;
}

/** When a waiting enquiry comes back to the owner, as a short sentence. */
export function comesBackCue(enquiry: Enquiry, prefs: WorkspacePrefs, now = new Date()): string {
  const tz = prefs.timezone || DEFAULT_ZONE;
  if (enquiry.snoozedUntil && Date.parse(enquiry.snoozedUntil) > now.getTime()) {
    const back = wall(enquiry.snoozedUntil, tz);
    return back ? `Comes back ${concreteDay(back, now, tz)}.` : "";
  }
  const lastOut = lastMessageAt(enquiry, "outbound");
  if (!lastOut) return "";
  const due = followUpDueWall(lastOut, prefs);
  return due ? `Comes back to you ${concreteDay(due, now, tz)} if there is no answer.` : "";
}

/** The last reply on record, for "what you sent, and when". */
export function lastSent(
  enquiry: Enquiry,
  now = new Date(),
  tz = DEFAULT_ZONE,
): { when: string; excerpt: string } | null {
  const out = [...enquiry.conversation].reverse().find((m) => m.direction === "outbound");
  if (!out) return null;
  const flat = out.body.replace(/\s+/g, " ").trim();
  const excerpt = flat.length > 110 ? `${flat.slice(0, 107).trimEnd()}...` : flat;
  return { when: concreteWhen(out.at, now, tz), excerpt };
}

export type CatchUp = { arrived: number; answered: number; due: number };

/**
 * What changed while the owner was away. Null when they were not away long
 * enough for it to be worth a line, or nothing happened.
 */
export function catchUpSince(
  enquiries: Enquiry[],
  lastSeenIso: string | null,
  now = new Date(),
): CatchUp | null {
  if (!lastSeenIso) return null;
  const since = Date.parse(lastSeenIso);
  if (!Number.isFinite(since) || now.getTime() - since < CATCH_UP_AFTER_MS) return null;
  let arrived = 0;
  let answered = 0;
  let due = 0;
  for (const e of enquiries) {
    if (e.practice) continue;
    if (Date.parse(e.receivedAt) > since) {
      arrived += 1;
      continue;
    }
    const lastIn = lastMessageAt(e, "inbound");
    if (lastIn && Date.parse(lastIn) > since) {
      answered += 1;
      continue;
    }
    const back = e.snoozedUntil ? Date.parse(e.snoozedUntil) : NaN;
    if (e.followUpDue || (Number.isFinite(back) && back > since && back <= now.getTime())) {
      due += 1;
    }
  }
  return arrived + answered + due > 0 ? { arrived, answered, due } : null;
}

/** "Later" choices: later today, tomorrow morning, after the weekend. */
/** Leave at least this long before "later today" is worth offering. */
const LATER_TODAY_MIN_MINUTES = 60;

/**
 * "Later today" inside the owner's working hours, or nothing. Three hours on,
 * pulled back to the end of the working day when that comes first; never on a
 * day they do not work, and never after they finish. At 4:30pm with a 5:30pm
 * finish that is 5:30pm; at 5pm there is no "later today" at all.
 */
export function laterTodayTime(today: Date, prefs: WorkspacePrefs): Date | null {
  if (!isWorkingDay(today.getDay(), prefs.workingDays || "Monday to Friday")) return null;
  const start = parseHm(prefs.hoursStart || "08:00");
  const end = parseHm(prefs.hoursEnd || "17:30");
  const nowMins = today.getHours() * 60 + today.getMinutes();
  const target = Math.min(Math.max(nowMins + 3 * 60, start), end);
  if (target - nowMins < LATER_TODAY_MIN_MINUTES) return null;
  const at = startOfDay(today);
  at.setHours(Math.floor(target / 60), target % 60, 0, 0);
  return dayKeyFromDate(at) === dayKeyFromDate(today) ? at : null;
}

export function laterChoices(
  now = new Date(),
  prefs: WorkspacePrefs,
): { id: string; label: string; until: string }[] {
  const tz = prefs.timezone || DEFAULT_ZONE;
  const today = wallNow(now, tz);
  const offsetMs = today.getTime() - now.getTime();
  const [sh, sm] = (prefs.hoursStart || "08:00").split(":").map(Number);
  const morning = (d: Date) => {
    const m = startOfDay(d);
    m.setHours(sh || 8, sm || 0, 0, 0);
    return m;
  };
  const toIso = (wallDate: Date) => new Date(wallDate.getTime() - offsetMs).toISOString();
  const choices: { id: string; label: string; until: string }[] = [];
  const laterToday = laterTodayTime(today, prefs);
  if (laterToday) {
    choices.push({
      id: "today",
      label: `Later today, ${clock(laterToday)}`,
      until: toIso(laterToday),
    });
  }
  const tomorrow = morning(addCalendarDays(today, 1));
  choices.push({
    id: "tomorrow",
    label: `Tomorrow, ${format(tomorrow, "EEE", { locale: enAU })} ${clock(tomorrow)}`,
    until: toIso(tomorrow),
  });
  const daysToMonday = (8 - today.getDay()) % 7 || 7;
  const monday = morning(addCalendarDays(today, daysToMonday));
  if (daysToMonday > 1) {
    choices.push({
      id: "weekend",
      label: `After the weekend, ${format(monday, "EEE d MMM", { locale: enAU })}`,
      until: toIso(monday),
    });
  }
  return choices;
}
