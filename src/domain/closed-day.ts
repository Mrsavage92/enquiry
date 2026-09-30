import type { ClosedDay, Decision, QuoteLine } from "./decide.ts";
import { closedReason, spokenDate, type ReplyContext } from "./compose-reply.ts";
import { formatMinorAud } from "./money-format.ts";
import { stemsOf } from "./service-words.ts";

/**
 * A day they asked for that the owner doesn't work, on a priced reply.
 *
 * Chloe's wedding is Sunday 8 November and the owner doesn't work Sundays. The
 * reply said so, and in the same breath quoted the bridal makeup and the trial
 * as one total - a price for a day that cannot be booked, as if it could. Now:
 *
 *  - a wedding, a formal or any day that cannot move, on a closed day: the
 *    work for that day is held out of the total and named as not included. The
 *    trial on its own open day is still priced, so the reply is "Yes" for the
 *    trial and says plainly the wedding day can't be done;
 *  - when that work is everything on the quote, the price is said as the price
 *    on a day the owner is available, never as a bookable total, and nothing
 *    can be offered yet;
 *  - a job that can move (a clean asked for on a Sunday) keeps its price: the
 *    reply already offers another day, and only the asked day can't be done.
 *
 * Only a day read from their message counts: a day the owner confirmed, or an
 * availability question the owner answered, is the owner's own call.
 */

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

/** Another day they asked for work on (the trial's): its own work, checked on its own. */
function workDays(who: ReplyContext): { iso: string; what: string }[] {
  return (who.otherDates ?? [])
    .filter((d) => !d.to && d.role !== "context" && d.role !== "event")
    .map((d) => ({ iso: d.iso, what: d.what?.trim() || (d.role === "trial" ? "trial" : "") }));
}

/** A line that is for another day's work: "Makeup trial" beside the trial's day. */
function ownDayOf(line: QuoteLine, who: ReplyContext): string | undefined {
  const words = stemsOf(line.label);
  return workDays(who).find((d) => {
    const what = stemsOf(d.what);
    return what.length > 0 && what.every((s) => words.includes(s));
  })?.iso;
}

/** The day cannot move: a wedding, a formal, a party. A deadline can come earlier. */
function fixedDay(who: ReplyContext): boolean {
  return Boolean(who.fixedEvent) && who.fixedEvent !== "deadline";
}

function quoteLines(decision: Decision): QuoteLine[] {
  if (decision.price.kind !== "EXACT") return [];
  if (decision.lines?.length) return decision.lines;
  return [
    {
      label: decision.price.rule.service,
      amountMinor: decision.price.amountMinor,
      ...(decision.price.count ? { count: decision.price.count } : {}),
    },
  ];
}

/**
 * The priced decision with the closed day applied: lines for a fixed day the
 * owner doesn't work held out of the total, and `closedDay` saying which days
 * and whether anything can be booked. Unchanged when no asked day is closed.
 */
export function holdClosedDays(decision: Decision, who: ReplyContext): Decision {
  if (decision.price.kind !== "EXACT" || decision.action !== "SEND_QUOTE") return decision;
  const lines = quoteLines(decision);
  const main = closedJobDay(who);
  const otherClosed = workDays(who)
    .map((d) => d.iso)
    .filter((iso) => closedReason(iso, who.closed));
  const days = [...new Set([...(main ? [main] : []), ...otherClosed])];
  if (days.length === 0) return decision;
  const held =
    main && fixedDay(who)
      ? lines
          .filter((l) => !ownDayOf(l, who))
          .map((l) => ({ label: l.label, amountMinor: l.amountMinor, iso: main }))
      : [];
  if (held.length === 0 || held.length === lines.length) {
    // Nothing held (the job can move), or everything is for the closed day:
    // the price stands, said as the price on a day the owner is available.
    const closedDay: ClosedDay = { days, held, bookable: held.length === 0 };
    return { ...decision, closedDay };
  }
  const isHeld = (l: QuoteLine) => held.some((h) => h.label === l.label);
  const rest = lines.filter((l) => !isHeld(l));
  const recurring = Boolean(decision.coverage?.recurring);
  const total = rest
    .filter((l) => !(recurring && l.firstVisit))
    .reduce((sum, l) => sum + l.amountMinor, 0);
  const workings = rest
    .map((l) => `${l.label}: ${formatMinorAud(l.amountMinor)}${l.detail ? ` (${l.detail})` : ""}.`)
    .join(" ");
  const day = spokenDate(held[0]!.iso) ?? held[0]!.iso;
  const notIn = held.map((h) => h.label.toLowerCase()).join(" and ");
  const price = decision.price;
  return {
    ...decision,
    price: {
      ...price,
      amountMinor: total,
      workings,
      lines: rest,
      // The held lines' own amounts may be named ("the bridal makeup ($250)"),
      // never the old total that counted them.
      alsoImplied: [
        ...(price.alsoImplied ?? []).filter((n) => n !== price.amountMinor),
        ...held.map((h) => h.amountMinor),
      ],
    },
    lines: rest,
    explanation: `${workings} Not in the total: ${notIn} - ${day} is a day you don't work.`,
    closedDay: { days, held, bookable: true },
  };
}
