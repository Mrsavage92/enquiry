import type { QuoteLine } from "./decide.ts";
import { closedReason, type ReplyContext } from "./compose-reply.ts";
import { stemsOf } from "./service-words.ts";

/**
 * A day they asked for that the owner doesn't work, on a priced quote.
 *
 * Chloe's wedding is Sunday 8 November and the owner doesn't work Sundays. The
 * reply said so, and in the same breath quoted the bridal makeup and the trial
 * as one total - a price for a day that cannot be booked, as if it could. So:
 *
 *  - a wedding, a formal or any day that cannot move, on a closed day: the
 *    work for that day is held off the quote, and the rest (the trial on its
 *    own open day) is priced again from the owner's rules - a minimum, a fee
 *    or a surcharge is worked out for what is left, never subtracted after;
 *  - when that work is everything they asked for, nothing is priced and the
 *    reply only asks whether the date can move;
 *  - a job that can move (a clean asked for on a Sunday) keeps its price: the
 *    reply already offers another day, and only the asked day can't be done.
 *
 * Only a day read from their message counts: a day the owner confirmed, or an
 * availability question the owner answered, is the owner's own call. This
 * decides nothing about money itself; `decide.ts` re-prices from the plan.
 */

export type ClosedDayPlan = {
  /** Every asked day the owner doesn't work, yyyy-mm-dd. */
  days: string[];
  /** Work held off the quote: its fixed day is closed. Never a fee or a top-up. */
  held: { label: string; iso: string; count?: string }[];
  /** The days of the work left on the quote (the trial's), for day-based rules. */
  workDays: string[];
};

/** The job's own day, when it is one the owner doesn't work. */
function closedJobDay(who: ReplyContext): string | undefined {
  if (who.jobDateConfirmed || who.dateAnswered || who.dateIssue) return undefined;
  const options = who.dateOptions?.trim() ? (who.dateOptionIsos ?? []) : [];
  if (options.length > 0) {
    return options.every((iso) => closedReason(iso, who.closed)) ? options[0] : undefined;
  }
  const iso = who.jobDateIso ?? who.mentionedDateIso;
  return iso && closedReason(iso, who.closed) ? iso : undefined;
}

/** Other days they asked for work on (the trial's), each with what it is for. */
function workDaysOf(who: ReplyContext): { iso: string; what: string }[] {
  return (who.otherDates ?? [])
    .filter((d) => !d.to && d.role !== "context" && d.role !== "event")
    .map((d) => ({ iso: d.iso, what: d.what?.trim() || (d.role === "trial" ? "trial" : "") }));
}

/** A line that is for another day's work: "Makeup trial" beside the trial's day. */
function ownDayOf(line: QuoteLine, who: ReplyContext): string | undefined {
  const words = stemsOf(line.label);
  return workDaysOf(who).find((d) => {
    const what = stemsOf(d.what);
    return what.length > 0 && what.every((s) => words.includes(s));
  })?.iso;
}

/** The day cannot move: a wedding, a formal, a party. A deadline can come earlier. */
function fixedDay(who: ReplyContext): boolean {
  return Boolean(who.fixedEvent) && who.fixedEvent !== "deadline";
}

/**
 * Which asked days are closed, and which of the quote's service lines are for
 * a fixed day that is. Undefined when every asked day is one the owner works.
 * `lines` are the quote's service lines before the owner's rules add anything,
 * the main job first.
 *
 * A second thing the owner names differently from their words ("Makeup
 * preview" for the trial on Saturday 24 October) is for that other day when
 * it is the only other day they asked for work on: never held with the
 * wedding just because the words differ. With more than one other day it is
 * held, and named on the owner's check as not included.
 */
export function planClosedDays(
  lines: readonly QuoteLine[],
  who: ReplyContext | undefined,
): ClosedDayPlan | undefined {
  if (!who) return undefined;
  const main = closedJobDay(who);
  const otherClosed = workDaysOf(who)
    .map((d) => d.iso)
    .filter((iso) => closedReason(iso, who.closed));
  const days = [...new Set([...(main ? [main] : []), ...otherClosed])];
  if (days.length === 0) return undefined;
  const services = lines.filter((l) => !l.adjustment);
  const works = workDaysOf(who);
  const dayOf = (l: QuoteLine, i: number) =>
    ownDayOf(l, who) ?? (i > 0 && works.length === 1 ? works[0]!.iso : undefined);
  const held =
    main && fixedDay(who)
      ? services
          .filter((l, i) => !dayOf(l, i))
          .map((l) => ({ label: l.label, iso: main, ...(l.count ? { count: l.count } : {}) }))
      : [];
  const workDays = [
    ...new Set(
      services
        .map((l, i) => (held.some((h) => h.label === l.label) ? undefined : dayOf(l, i)))
        .filter((iso): iso is string => Boolean(iso)),
    ),
  ];
  return { days, held, workDays };
}
