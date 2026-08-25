import { commercialValue, queueSection } from "./labels";
import { isSnoozed } from "./commercial";
import type { Booking, Business, Enquiry } from "./types";

export type Briefing = {
  needsYou: number;
  waiting: number;
  atRisk: number;
  followUp: number;
  learning: number;
  calendarDown: number;
  openExact: number;
  openExactValue: number;
  quotedWaiting: number;
  bookedValue: number;
  bookedCount: number;
  closedLost: number;
  quoted: number;
  accepted: number;
};

export function scopedEnquiries(enquiries: Enquiry[], filter: string): Enquiry[] {
  return filter === "all" ? enquiries : enquiries.filter((e) => e.businessId === filter);
}

export function briefing(
  enquiries: Enquiry[],
  businesses: Business[],
  bookings: Booking[],
  filter: string,
): Briefing {
  const visible = scopedEnquiries(enquiries, filter);
  const open = visible.filter((e) => e.state.lifecycle === "OPEN" && !isSnoozed(e));
  const exactOpen = open.filter((e) => commercialValue(e).kind === "exact");
  const scopedBookings =
    filter === "all" ? bookings : bookings.filter((b) => b.businessId === filter);
  const booked = scopedBookings.filter((b) => b.status === "confirmed");
  const calendarDown = open.filter((e) =>
    e.decision.evaluators.some(
      (ev) =>
        (ev.type === "capacity" || ev.type === "availability") &&
        ev.status === "UNKNOWN_INTEGRATION",
    ),
  ).length;
  const learning = businesses
    .filter((b) => filter === "all" || b.id === filter)
    .reduce(
      (n, b) => n + b.learningSuggestions.filter((l) => l.status === "pending").length,
      0,
    );

  return {
    needsYou: visible.filter((e) => queueSection(e) === "needs_you").length,
    waiting: visible.filter((e) => queueSection(e) === "waiting").length,
    atRisk: visible.filter((e) => queueSection(e) === "at_risk").length,
    followUp: visible.filter((e) => e.followUpDue).length,
    learning,
    calendarDown,
    openExact: exactOpen.length,
    openExactValue: exactOpen.reduce((s, e) => s + (e.valueExact?.amount ?? 0), 0),
    quotedWaiting: visible.filter(
      (e) =>
        e.state.lifecycle === "OPEN" &&
        (e.state.commercial === "QUOTED" || e.state.commercial === "ESTIMATED"),
    ).length,
    bookedValue: booked.reduce((s, b) => s + (b.value?.amount ?? 0), 0),
    bookedCount: booked.length,
    closedLost: visible.filter(
      (e) => e.state.lifecycle === "LOST" || e.state.lifecycle === "DECLINED",
    ).length,
    quoted: visible.filter(
      (e) => e.state.commercial === "QUOTED" || e.state.commercial === "ACCEPTED",
    ).length,
    accepted: visible.filter((e) => e.state.commercial === "ACCEPTED").length,
  };
}

export function funnel(b: Briefing) {
  const open = b.needsYou + b.waiting + b.atRisk;
  return [
    { id: "open", label: "Open", value: open },
    { id: "quoted", label: "Quoted", value: b.quoted },
    { id: "booked", label: "Booked", value: b.bookedCount },
    { id: "closed", label: "Closed without booking", value: b.closedLost },
  ];
}

export function waitingAge(enquiries: Enquiry[], filter: string) {
  const now = Date.now();
  return scopedEnquiries(enquiries, filter)
    .filter(
      (e) =>
        e.state.lifecycle === "OPEN" &&
        e.state.decision === "WAITING_ON_CLIENT",
    )
    .map((e) => {
      const t = Date.parse(e.updatedAt);
      const days = Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86_400_000)) : 0;
      return { enquiry: e, days };
    })
    .sort((a, b) => b.days - a.days);
}
