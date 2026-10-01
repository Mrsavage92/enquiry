import assert from "node:assert/strict";
import test from "node:test";
import { readWeekdayWord, sweepDates, readSweep } from "./date-sweep.ts";
import { readEnquiryBasics } from "./enquiry-basics.ts";

const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function plus(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Monday 28 September to Sunday 4 October 2026, each at three clock times (Brisbane). */
const ARRIVALS = Array.from({ length: 7 }, (_, i) => 28 + i).flatMap((day) =>
  ["00:15", "10:15", "23:45"].map((clock) => {
    const dd = day <= 30 ? `09-${day}` : `10-0${day - 30}`;
    return new Date(`2026-${dd}T${clock}:00+10:00`);
  }),
);

function wallDay(now: Date): Date {
  // Brisbane is UTC+10 with no daylight saving.
  const b = new Date(now.getTime() + 10 * 3_600_000);
  return new Date(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
}

/** The rule, computed independently of the code under test. */
function expected(form: "this" | "next" | "bare", weekday: number, today: Date): string[] {
  const dow = today.getDay();
  const toNext = (weekday - dow + 7) % 7;
  if (form === "this") return [iso(plus(today, toNext))];
  if (form === "bare") return [iso(plus(today, toNext || 7))];
  const a = (dow + 6) % 7;
  const n = (weekday + 6) % 7;
  if (n > a) return [iso(plus(today, n - a)), iso(plus(today, n - a + 7))];
  return [iso(plus(today, 7 - a + n))];
}

test("H1: 7 arrival days x 3 clocks x 7 weekdays - this / next / bare read one way in both readers", () => {
  let checked = 0;
  for (const now of ARRIVALS) {
    const today = wallDay(now);
    for (let wd = 0; wd < 7; wd += 1) {
      for (const form of ["this", "next", "bare"] as const) {
        const want = expected(form, wd, today);
        const r = readWeekdayWord(form, wd, today);
        const got = "date" in r ? [iso(r.date)] : r.either.map(iso);
        assert.deepEqual(got, want, `${form} ${NAMES[wd]} on ${today.toDateString()}`);

        const words = form === "bare" ? NAMES[wd]! : `${form} ${NAMES[wd]}`;
        const message = `Could you do a regular clean ${words}? Thanks, Liz`;
        const sweep = sweepDates(message, now);
        const basics = readEnquiryBasics(message, now);
        if (want.length === 1) {
          assert.deepEqual(
            sweep.days.map((d) => d.iso),
            want,
            `sweep: ${words} on ${today.toDateString()}`,
          );
          assert.equal(basics.jobDate?.iso, want[0], `reader: ${words} on ${today.toDateString()}`);
        } else {
          // Either day: nothing guessed, the owner is asked in their words.
          assert.deepEqual(sweep.days, [], `sweep guessed ${words} on ${today.toDateString()}`);
          assert.deepEqual(sweep.unread, [words]);
          assert.deepEqual(sweep.either?.[words], want);
          assert.equal(basics.jobDate, undefined, `reader guessed ${words}`);
        }
        checked += 1;
      }
    }
  }
  assert.equal(checked, 7 * 3 * 7 * 3);
});

test("H1: the reviewer's cases", () => {
  const at = (s: string) => new Date(`${s}T10:15:00+10:00`);
  const jobIso = (msg: string, s: string) => readEnquiryBasics(msg, at(s)).jobDate?.iso;
  // Wed 30 Sep: Tuesday is behind in this week, so next week's Tuesday.
  assert.equal(jobIso("any chance next Tuesday?", "2026-09-30"), "2026-10-06");
  // Fri 2 Oct: Thursday of next week is 8 Oct, not 15 Oct.
  assert.equal(jobIso("could you do a clean next Thursday?", "2026-10-02"), "2026-10-08");
  assert.equal(jobIso("next monday works", "2026-09-29"), "2026-10-05");
  assert.equal(jobIso("next Saturday?", "2026-10-04"), "2026-10-10");
  // Thu 1 Oct: "next Thursday" is a week today; "this Thursday" is today.
  assert.equal(jobIso("next Thursday please", "2026-10-01"), "2026-10-08");
  assert.equal(jobIso("this Thursday please", "2026-10-01"), "2026-10-01");
  // A bare weekday never means today.
  assert.equal(jobIso("Thursday please", "2026-10-01"), "2026-10-08");
  // Wed 30 Sep: "next Thursday" is 1 or 8 Oct - asked, never guessed.
  const sweep = sweepDates("Free next Thursday?", at("2026-09-30"));
  assert.deepEqual(sweep.either, { "next Thursday": ["2026-10-01", "2026-10-08"] });
  assert.equal(jobIso("Free next Thursday?", "2026-09-30"), undefined);
});

test("LOW: a stored sweep that cannot be read fails closed", () => {
  const saved = console.error;
  const logged: unknown[] = [];
  console.error = (...a: unknown[]) => void logged.push(a);
  try {
    assert.equal(readSweep("{not json").corrupt, true);
    assert.equal(readSweep({ days: "x" }).corrupt, true);
    assert.equal(readSweep(null).corrupt, true);
    assert.equal(logged.length, 3);
    const ok = readSweep(JSON.stringify({ days: [], unread: [] }));
    assert.equal(ok.corrupt, undefined);
  } finally {
    console.error = saved;
  }
});
