import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookingDraftFromEnquiry,
  bookingEnd,
  conflictsFor,
  durationForService,
  gapAfter,
  happeningNow,
  hoursSpan,
  offsetForTimezone,
  overlaps,
  startOfWeekMonday,
  sortedOnDay,
} from "./calendar.ts";
import {
  addMinutesToIso,
  dayKeyFromIso,
  formatDuration,
  isoFromDayAndTime,
  todayKey,
  wallNow,
} from "./format.ts";
import { BOOKINGS } from "../fixtures/bookings.ts";
import type { Booking, Enquiry } from "./types.ts";

const hall = BOOKINGS.find((b) => b.id === "b3")!;
const sofia = BOOKINGS.find((b) => b.id === "b1")!;
const claire = BOOKINGS.find((b) => b.id === "b4")!;

test("group makeup duration multiplies per person", () => {
  assert.equal(durationForService("Group mobile makeup × 3"), 135);
  assert.equal(durationForService("Interior · two rooms"), 300);
  assert.equal(durationForService("Formal makeup"), 60);
});

test("West End hall runs 7:30 to 12:30", () => {
  assert.equal(dayKeyFromIso(hall.when), "2026-08-26");
  assert.equal(bookingEnd(hall), "2026-08-26T12:30:00+10:00");
  assert.equal(formatDuration(hall.durationMinutes ?? 0), "5h");
});

test("addMinutesToIso preserves the wall offset", () => {
  assert.equal(addMinutesToIso("2026-08-26T07:30:00+10:00", 300), "2026-08-26T12:30:00+10:00");
  assert.equal(isoFromDayAndTime("2026-08-29", "11:00", "+10:00"), "2026-08-29T11:00:00+10:00");
});

test("overlaps only inside the same business", () => {
  const clash: Booking = {
    ...claire,
    id: "clash",
    businessId: "glow",
    when: "2026-08-29T11:30:00+10:00",
    durationMinutes: 60,
  };
  assert.equal(overlaps(sofia, clash), true);
  assert.equal(overlaps(sofia, { ...clash, businessId: "ridge" }), false);
  assert.equal(overlaps(sofia, hall), false);
  const adjacent: Booking = {
    ...sofia,
    id: "after",
    when: bookingEnd(sofia),
  };
  assert.equal(overlaps(sofia, adjacent), false);
});

test("cancelled bookings do not conflict", () => {
  const clash: Booking = {
    ...sofia,
    id: "gone",
    when: sofia.when,
    status: "cancelled",
  };
  assert.equal(conflictsFor(sofia, [clash]).length, 0);
});

test("travel gap is tight when the window is shorter than the drive", () => {
  const later: Booking = {
    ...hall,
    id: "next",
    when: "2026-08-26T12:40:00+10:00",
    durationMinutes: 60,
    location: "New Farm",
    travelMinutes: 25,
  };
  const gap = gapAfter(hall, later);
  assert.ok(gap);
  assert.equal(gap.minutes, 10);
  assert.equal(gap.tight, true);
});

test("happeningNow is true during the job window", () => {
  assert.equal(happeningNow(hall, new Date(2026, 7, 26, 7, 57)), true);
  assert.equal(happeningNow(hall, new Date(2026, 7, 26, 12, 30)), false);
  assert.equal(happeningNow(hall, new Date(2026, 7, 26, 7, 29)), false);
});

test("sortedOnDay keeps wall order", () => {
  const rows = sortedOnDay(BOOKINGS, "2026-08-26");
  assert.equal(rows[0]?.id, "b3");
});

test("week starts Monday in Australia", () => {
  const wed = new Date(2026, 7, 26);
  const start = startOfWeekMonday(wed);
  assert.equal(start.getDay(), 1);
  assert.equal(start.getDate(), 24);
});

test("hoursSpan covers the 7:30 start", () => {
  const span = hoursSpan([hall]);
  assert.equal(span.startHour, 7);
  assert.ok(span.endHour >= 13);
});

test("accepting a quote uses the date fact, not ready-by", () => {
  const priya = {
    id: "f01",
    serviceLabel: "Group mobile makeup",
    facts: [
      { field: "date", value: "2026-09-19", displayValue: "19 Sep 2026" },
      { field: "ready_time", value: "14:00", displayValue: "2:00pm" },
      {
        field: "location",
        value: "12 Merthyr Rd, New Farm",
        displayValue: "12 Merthyr Rd, New Farm",
      },
    ],
  } as Enquiry;
  const draft = bookingDraftFromEnquiry(priya);
  assert.match(draft.when, /^2026-09-19T09:00:00\+10:00$/);
  assert.equal(draft.location, "12 Merthyr Rd, New Farm");
  assert.ok((draft.durationMinutes ?? 0) >= 45);
});

test("Adelaide keeps a +09:30 offset", () => {
  assert.equal(offsetForTimezone("Australia/Adelaide"), "+09:30");
  assert.equal(offsetForTimezone("Australia/Brisbane"), "+10:00");
});

test("todayKey is Brisbane wall date, not UTC", () => {
  const utcEvening = new Date("2026-08-25T21:57:00Z");
  assert.equal(todayKey(utcEvening, "Australia/Brisbane"), "2026-08-26");
  const wall = wallNow(utcEvening, "Australia/Brisbane");
  assert.equal(wall.getDate(), 26);
  assert.equal(wall.getHours(), 7);
});
