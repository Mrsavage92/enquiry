import type { Booking, Business, Enquiry, Service } from "./types";
import {
  addMinutesToIso,
  dayKeyFromIso,
  isoOffset,
  startOfDay,
  wallDate,
  wallNow,
} from "./format";

const DEFAULT_DURATION = 90;

export function activeBookings(bookings: Booking[]): Booking[] {
  return bookings.filter((b) => b.status !== "cancelled");
}

export function durationOf(booking: Pick<Booking, "durationMinutes" | "serviceLabel">, business?: Business): number {
  if (booking.durationMinutes && booking.durationMinutes > 0) return booking.durationMinutes;
  return durationForService(booking.serviceLabel, business?.services);
}

export function durationForService(label: string, services?: Service[]): number {
  const lower = label.toLowerCase();
  if (services?.length) {
    const hit = services.find(
      (s) =>
        lower.includes(s.name.toLowerCase()) ||
        lower.includes(s.customerLabel.toLowerCase()) ||
        s.name.toLowerCase().includes(lower) ||
        s.customerLabel.toLowerCase().includes(lower),
    );
    if (hit?.durationMinutes) {
      const people = lower.match(/×\s*(\d+)/);
      if (people && /group/.test(lower)) return hit.durationMinutes * Number(people[1]);
      return hit.durationMinutes;
    }
  }
  if (/group/.test(lower)) {
    const n = Number(lower.match(/×\s*(\d+)/)?.[1] ?? 3);
    return 45 * n;
  }
  if (/bridal/.test(lower)) return 90;
  if (/formal/.test(lower)) return 60;
  if (/interior|two rooms/.test(lower)) return 300;
  if (/brand|identity/.test(lower)) return 120;
  if (/deep clean/.test(lower)) return 300;
  if (/standard clean/.test(lower)) return 180;
  if (/end of lease|bond/.test(lower)) return 360;
  if (/family/.test(lower)) return 120;
  if (/event/.test(lower)) return 240;
  if (/headshot/.test(lower)) return 180;
  return DEFAULT_DURATION;
}

export function offsetForTimezone(tz?: string): string {
  if (!tz) return "+10:00";
  if (/Adelaide|Broken_Hill|Darwin/i.test(tz)) return "+09:30";
  if (/Perth/i.test(tz)) return "+08:00";
  if (/Auckland/i.test(tz)) return "+12:00";
  return "+10:00";
}

export function bookingEnd(booking: Booking, business?: Business): string {
  return addMinutesToIso(booking.when, durationOf(booking, business));
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((wallDate(endIso).getTime() - wallDate(startIso).getTime()) / 60_000);
}

export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return wallDate(aStart) < wallDate(bEnd) && wallDate(bStart) < wallDate(aEnd);
}

export function overlaps(a: Booking, b: Booking): boolean {
  if (a.id === b.id) return false;
  if (a.businessId !== b.businessId) return false;
  if (a.status === "cancelled" || b.status === "cancelled") return false;
  return intervalsOverlap(a.when, bookingEnd(a), b.when, bookingEnd(b));
}

export function conflictsFor(booking: Booking, all: Booking[]): Booking[] {
  return all.filter((other) => overlaps(booking, other));
}

export function sortedOnDay(bookings: Booking[], dayKey: string): Booking[] {
  return bookings
    .filter((b) => b.status !== "cancelled" && dayKeyFromIso(b.when) === dayKey)
    .sort((a, b) => wallDate(a.when).getTime() - wallDate(b.when).getTime());
}

export function happeningNow(booking: Booking, now = wallNow()): boolean {
  if (booking.status === "cancelled") return false;
  const start = wallDate(booking.when);
  const end = wallDate(bookingEnd(booking));
  return now >= start && now < end;
}

export function isHoldDue(booking: Booking): boolean {
  return booking.status === "pending" && !booking.depositPaid;
}

export type TravelGap = {
  minutes: number;
  travel: number;
  tight: boolean;
  from: string;
  to: string;
};

export function travelBetween(prev: Booking, next: Booking): number {
  if (next.travelMinutes != null) return next.travelMinutes;
  const a = (prev.location ?? "").trim().toLowerCase();
  const b = (next.location ?? "").trim().toLowerCase();
  if (!a || !b) return 20;
  if (a === b) return 10;
  const suburb = (s: string) => s.split(",")[0]?.trim() ?? s;
  if (suburb(a) === suburb(b)) return 15;
  return 25;
}

export function gapAfter(prev: Booking, next: Booking): TravelGap | null {
  if (dayKeyFromIso(prev.when) !== dayKeyFromIso(next.when)) return null;
  const minutes = minutesBetween(bookingEnd(prev), next.when);
  if (minutes <= 0) return null;
  const travel = travelBetween(prev, next);
  const from = prev.location ?? "";
  const to = next.location ?? "";
  if (!from && !to && travel <= 0) return null;
  return {
    minutes,
    travel,
    tight: minutes < travel + 10,
    from,
    to,
  };
}

export function dayDensity(bookings: Booking[], dayKey: string): number {
  return sortedOnDay(bookings, dayKey).length;
}

export function weekValue(bookings: Booking[], startKey: string, endKey: string): number {
  return bookings
    .filter((b) => {
      if (b.status === "cancelled") return false;
      const key = dayKeyFromIso(b.when);
      return key >= startKey && key <= endKey;
    })
    .reduce((sum, b) => sum + (b.value?.amount ?? 0), 0);
}

export function startOfWeekMonday(d: Date): Date {
  const start = startOfDay(d);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeekMonday(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function rollingDays(from: Date, count: number): Date[] {
  const start = startOfDay(from);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function monthMatrix(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1);
  const start = startOfWeekMonday(first);
  return rollingDays(start, 42);
}

export function stripOrigin(selected: Date, today: Date): Date {
  const sel = startOfDay(selected);
  const tod = startOfDay(today);
  return sel < tod ? sel : tod;
}

export function hoursSpan(bookings: Booking[]): { startHour: number; endHour: number } {
  let startHour = 7;
  let endHour = 18;
  for (const b of bookings) {
    const s = wallDate(b.when);
    const e = wallDate(bookingEnd(b));
    startHour = Math.min(startHour, s.getHours());
    const endH = e.getHours() + (e.getMinutes() > 0 ? 1 : 0);
    endHour = Math.max(endHour, endH);
  }
  return { startHour: Math.max(6, startHour), endHour: Math.min(22, Math.max(endHour, startHour + 8)) };
}

export function bookingDraftFromEnquiry(
  enquiry: Enquiry,
  business?: Business,
): Pick<Booking, "when" | "durationMinutes" | "location"> {
  const dateFact = enquiry.facts.find((f) => f.field === "date" && !f.superseded);
  const locFact = enquiry.facts.find((f) => f.field === "location" && !f.superseded);
  const offset = offsetForTimezone(business?.timezone);
  const durationMinutes = durationForService(enquiry.serviceLabel, business?.services);
  const when = dateFact?.value ? `${dateFact.value}T09:00:00${offset}` : new Date().toISOString();
  const location = locFact?.displayValue ?? locFact?.value;
  return { when, durationMinutes, location };
}

export function proposedBooking(
  booking: Booking,
  when: string,
  durationMinutes?: number,
): Booking {
  return {
    ...booking,
    when,
    durationMinutes: durationMinutes ?? booking.durationMinutes,
  };
}

export function layoutDay(jobs: Booking[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...jobs].sort((a, b) => wallDate(a.when).getTime() - wallDate(b.when).getTime());
  const placed: { id: string; lane: number; start: string; end: string }[] = [];
  for (const job of sorted) {
    const end = bookingEnd(job);
    const taken = new Set(
      placed.filter((p) => intervalsOverlap(job.when, end, p.start, p.end)).map((p) => p.lane),
    );
    let lane = 0;
    while (taken.has(lane)) lane++;
    placed.push({ id: job.id, lane, start: job.when, end });
  }
  const lanes = placed.reduce((m, p) => Math.max(m, p.lane + 1), 1);
  return new Map(placed.map((p) => [p.id, { lane: p.lane, lanes }]));
}

export function sameOffset(iso: string, fallback = "+10:00"): string {
  return isoOffset(iso) || fallback;
}
