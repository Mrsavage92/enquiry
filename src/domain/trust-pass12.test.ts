import assert from "node:assert/strict";
import test from "node:test";
import { readWeekdayWord, sweepDates, readSweep } from "./date-sweep.ts";
import { readEnquiryBasics } from "./enquiry-basics.ts";
import { ownerEditWarnings, warningsKey } from "./edit-warnings.ts";
import { dollarMatches } from "./voice-detect.ts";
import { readBusinessDetails } from "./business-details-read.ts";
import { frequencyIn } from "./coverage.ts";
import { frequencyWord } from "./rule-checks.ts";

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

const WED = new Date("2026-09-30T10:15:00+10:00");

test("M3: what the owner writes that promises a day, a price or a freebie is listed", () => {
  const table: [string, RegExp][] = [
    ["Guaranteed we'll have it done Saturday.", /^"Guaranteed" - a booking promise/],
    ["I'm definitely free that day.", /^"I'm definitely free" - a booking promise/],
    ["That's locked in.", /^"That's locked" - a booking promise/],
    ["We've locked that in for you.", /^"We've locked that" - a booking promise/],
    ["We can do Saturday.", /^"We can do" - a booking promise/],
    ["I can do Saturday.", /^"I can do" - a booking promise/],
    ["Happy to do Saturday.", /^"Happy to do" - a booking promise/],
    ["Sure thing, Saturday works.", /^"Saturday works" - a booking promise/],
    ["We'll be there at 9.", /^"We'll be there" - a booking promise/],
    ["We'll see you Saturday.", /^"We'll see you" - a booking promise/],
    ["Booked!", /^"Booked" - a booking promise/],
    ["Confirmed for the 3rd.", /^"Confirmed" - a booking promise/],
    ["The windows are free.", /^"free" - something at no charge/],
    ["I'll waive the fee.", /^"waive" - a discount/],
    ["No extra cost for the fridge.", /^"No extra cost" - something at no charge/],
    ["Half price for you.", /^"Half price" - a discount/],
    ["I can also come Saturday 17 October", /^"I can also come" - a booking promise/],
  ];
  for (const [said, re] of table) {
    const warned = ownerEditWarnings(said, "", { now: WED });
    assert.ok(
      warned.some((w) => re.test(w)),
      `${said} -> ${JSON.stringify(warned)}`,
    );
  }
  for (const said of [
    "Free quote included.",
    "Feel free to call.",
    "I'm not free Saturday.",
    "I'm not available Saturday.",
    "Are you free to chat?",
    "I can do 10% off that.",
  ]) {
    const warned = ownerEditWarnings(said, "", { now: WED });
    assert.ok(
      !warned.some((w) => /booking promise|no charge/.test(w)),
      `${said} -> ${JSON.stringify(warned)}`,
    );
  }
});

test("M1: a warnings key changes with the list", () => {
  const one = ['"See you then" - a booking promise - nothing has checked your calendar.'];
  const two = [...one, '"Saturday 17 October" - I\'m not working from 17 October to 18 October.'];
  assert.notEqual(warningsKey(one), warningsKey(two));
  assert.equal(warningsKey(one), warningsKey([...one]));
  assert.notEqual(warningsKey([]), warningsKey(one));
});

test("M4: a 'jobs over' discount that takes nothing, all, or more than the job is refused", () => {
  for (const line of [
    "Jobs over $100 get $200 off",
    "Jobs over $500 get $500 off",
    "Jobs over $500 get 0% off",
    "Jobs over $500 get 100% off",
  ]) {
    const read = readBusinessDetails(line, WED);
    assert.deepEqual(read.details, [], line);
    assert.equal(read.unread.length, 1, line);
    assert.notEqual(read.unread[0]?.note, true, line);
  }
  assert.equal(
    readBusinessDetails("Jobs over $100 get $200 off", WED).unread[0]?.reason,
    "$200 off a job over $100 could bring a price to $0 or less. Make the amount off less than $100.",
  );
  assert.equal(readBusinessDetails("Jobs over $600 get $300 off", WED).details.length, 1);
});

test("M5: the sweep never reads a reference, a street or a time as a day, and says what it cannot read", () => {
  const days = (s: string) => sweepDates(s, WED).days.map((d) => [d.iso, d.to ?? ""]);
  assert.deepEqual(days("Ref INV 12/03 attached"), []);
  assert.deepEqual(days("order #12/03"), []);
  assert.deepEqual(days("job no. 5/12"), []);
  assert.deepEqual(days("5/12 smith st"), []);
  assert.deepEqual(days("come at 10/11 am"), []);
  assert.deepEqual(sweepDates("12/25 please", WED).unread, ["12/25"]);
  assert.deepEqual(days("28-3 Jan"), [["2026-12-28", "2027-01-03"]]);
  assert.deepEqual(days("28 December to 3 January"), [["2026-12-28", "2027-01-03"]]);
  assert.deepEqual(days("Christmas Eve"), [["2026-12-24", ""]]);
  assert.deepEqual(days("Christmas Day or Boxing Day"), [
    ["2026-12-25", ""],
    ["2026-12-26", ""],
  ]);
  assert.deepEqual(days("New Year's Eve"), [["2026-12-31", ""]]);
  assert.deepEqual(days("New Year's Day"), [["2027-01-01", ""]]);
  // Still read: a date that only looks like these.
  assert.deepEqual(days("either way 10/11 works"), [["2026-11-10", ""]]);
  // M2: never across a full stop.
  assert.deepEqual(sweepDates("Is Saturday ok? If not Monday. 3 hour clean.", WED).unread, []);
  assert.ok(
    !sweepDates("Is Saturday ok? If not Monday. 3 hour clean.", WED).days.some((d) =>
      d.span.includes("3"),
    ),
  );
});

test("ALSO: money said in words is read as money", () => {
  const read = (s: string) => dollarMatches(s).map((m) => m.amount);
  assert.deepEqual(read("Make it 5 hundred."), [500]);
  assert.deepEqual(read("Let's say five hundred and fifty."), [550]);
  assert.deepEqual(read("I'll knock fifty off."), [50]);
  assert.deepEqual(read("Call it 550."), [550]);
  assert.deepEqual(read("five fifty all up."), [550]);
  // Counts and times stay counts and times.
  for (const s of [
    "I'd say two hours.",
    "Call it 2 days.",
    "Can you make it 9am?",
    "make it 10 people",
  ]) {
    assert.deepEqual(read(s), [], s);
  }
});

test("ALSO: the keys' day is their own, and 'every second week' / 'twice a month' repeat", () => {
  const r = readEnquiryBasics(
    "Hi, end of lease clean, need it done on the 30th Dec, keys back 31st. Thanks, Jo",
    WED,
  );
  assert.equal(r.jobDate?.iso, "2026-12-30");
  assert.ok(!r.dates.context.some((c) => c.iso === "2026-12-30"));
  assert.equal(frequencyIn("every second week for the garden"), "every second week");
  assert.equal(frequencyWord("every second week"), "fortnightly");
  assert.equal(frequencyIn("twice a month please"), "twice a month");
});
