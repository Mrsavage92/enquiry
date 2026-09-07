import assert from "node:assert/strict";
import { test } from "node:test";
import { dayKeyFromIso, formatTime, formatWhen, wallDate } from "./format.ts";

/**
 * Reproduces the launch-audit finding (2026-09-04 run 29, P0-3 / P0-4): a
 * UTC ("Z"-suffixed) timestamp rendered ~10 hours behind, on the previous
 * day, because `wallDate` regex-extracted the literal digits out of the ISO
 * string and ignored the offset. That is only harmless for fixtures already
 * written in `+10:00` - every runtime-generated `new Date().toISOString()`
 * timestamp is UTC and was rendered as if it were already Brisbane local.
 *
 * Australia/Brisbane is UTC+10 with no DST, so the expected values below are
 * fixed regardless of which machine or CI runner executes the test.
 */

// 23:18 UTC on 6 Sep 2026 = 09:18 on 7 Sep 2026 in Australia/Brisbane (UTC+10).
// This is the audit's own reproduction case: observed at 09:34 AEST on 7 Sep,
// "16 minutes ago" (correct, real-elapsed-time based) alongside
// "Received - 11:34pm" (wrong: the previous day, ~10 hours behind).
const UTC_INSTANT = "2026-09-06T23:18:00.000Z";

test("wallDate converts a UTC instant into Australia/Brisbane wall-clock, not literal UTC digits", () => {
  const d = wallDate(UTC_INSTANT);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8); // September, 0-indexed
  assert.equal(d.getDate(), 7);
  assert.equal(d.getHours(), 9);
  assert.equal(d.getMinutes(), 18);
});

test("formatTime renders the Brisbane wall-clock time for a UTC instant", () => {
  assert.equal(formatTime(UTC_INSTANT), "9:18am");
});

test("formatWhen renders the correct Brisbane date and time for a UTC instant, not the previous day", () => {
  assert.equal(formatWhen(UTC_INSTANT), "7 Sep 2026, 9:18am");
});

test("dayKeyFromIso resolves the Brisbane calendar day for a UTC instant that has rolled over", () => {
  assert.equal(dayKeyFromIso(UTC_INSTANT), "2026-09-07");
});

test("a fixture timestamp already written in +10:00 still renders as its own literal digits", () => {
  assert.equal(formatTime("2026-08-24T09:14:00+10:00"), "9:14am");
  assert.equal(formatWhen("2026-08-24T09:14:00+10:00"), "24 Aug 2026, 9:14am");
});

test("an offset other than Brisbane's is converted, not taken literally", () => {
  // 10:05 at +09:30 is 10:35 in Brisbane (+10:00) - a fixture bug elsewhere
  // (src/fixtures/businesses.ts:662, out of scope here) that this fix also
  // stops from silently mis-rendering.
  assert.equal(formatTime("2026-08-22T10:05:00+09:30"), "10:35am");
});
