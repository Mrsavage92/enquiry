import assert from "node:assert/strict";
import { test } from "node:test";
import { ENQUIRIES } from "./enquiries.ts";
import { BOOKINGS } from "./bookings.ts";
import {
  relativeSample,
  sampleShiftDays,
  shiftDateWords,
  shiftIso,
  shiftSample,
} from "./relative-dates.ts";

// A fixed "now", a month after the sample was written, so the suite never
// depends on the day it runs.
const NOW = new Date("2026-09-25T09:00:00+10:00");

test("timestamps and plain dates move by whole days and keep their offset", () => {
  assert.equal(shiftIso("2026-08-24T09:14:00+10:00", 32), "2026-09-25T09:14:00+10:00");
  assert.equal(shiftIso("2026-08-22T10:05:00+09:30", 1), "2026-08-23T10:05:00+09:30");
  assert.equal(shiftIso("2026-09-19", 32), "2026-10-21");
});

test("dates written as words move and keep how they were written", () => {
  assert.equal(shiftDateWords("Saturday 19 September", 7), "Saturday 26 September");
  assert.equal(shiftDateWords("19 Sep 2026", 13), "2 Oct 2026");
  assert.equal(shiftDateWords("Done by Fri 28 Aug", 3), "Done by Mon 31 Aug");
  assert.equal(shiftDateWords("makeup saturday 5th, 10.30", 7), "makeup saturday 12th, 10.30");
  assert.equal(shiftDateWords("Start Sep 2026", 30), "Start Oct 2026");
  assert.equal(shiftDateWords("the 10th of October", 1), "the 11th of October");
  // Numbers that are not dates stay exactly as written.
  assert.equal(shiftDateWords("her 40th, 4 people, $625", 30), "her 40th, 4 people, $625");
});

test("the sample lands just before now: nothing in the future, nothing weeks stale", () => {
  const { enquiries } = relativeSample(ENQUIRIES, BOOKINGS, NOW);
  for (const e of enquiries) {
    const moments = [e.receivedAt, e.updatedAt, ...e.conversation.map((m) => m.at)].map((s) =>
      Date.parse(s),
    );
    const latest = Math.max(...moments);
    assert.ok(latest <= NOW.getTime(), `${e.id} arrives in the future`);
    assert.ok(NOW.getTime() - latest < 86_400_000, `${e.id} is more than a day old`);
  }
});

test("every sample job date is still ahead after the move", () => {
  const { enquiries, bookings } = relativeSample(ENQUIRIES, BOOKINGS, NOW);
  const today = "2026-09-25";
  for (const e of enquiries) {
    for (const f of e.facts) {
      if (f.field === "date" && /^\d{4}-\d{2}-\d{2}$/.test(f.value)) {
        assert.ok(f.value >= today, `${e.id} job date ${f.value} is in the past`);
      }
    }
  }
  assert.equal(bookings.length, BOOKINGS.length);
  for (const b of bookings) {
    assert.ok(Date.parse(b.when) > NOW.getTime(), `booking ${b.id} is in the past`);
  }
});

test("the same now always gives the same sample", () => {
  assert.deepEqual(
    relativeSample(ENQUIRIES, BOOKINGS, NOW),
    relativeSample(ENQUIRIES, BOOKINGS, new Date(NOW)),
  );
  assert.equal(sampleShiftDays(ENQUIRIES, new Date("2026-08-24T20:10:00+10:00")), 0);
});

test("with no time passed, the sample is exactly the fixtures", () => {
  assert.equal(shiftSample(ENQUIRIES, 0), ENQUIRIES);
});
