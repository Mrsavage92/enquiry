import assert from "node:assert/strict";
import test from "node:test";
import { readDates, echoable } from "./enquiry-basics.ts";
import { readCustomerAsks, answerTopicOf } from "./customer-asks.ts";
import { peopleIn } from "./headcount.ts";
import { rankServices, suggestService } from "./service-match.ts";
import { readBusinessDetails } from "./business-details-read.ts";
import { type BusinessDetail } from "./business-detail.ts";
import { applyRules } from "./rule-checks.ts";
import { updateEditFigures, describeChange } from "./edit-figures.ts";
import { workingHoursChange } from "./workspace-prefs.ts";
import { roleLabel } from "./date-roles.ts";
import { modelFactsToKeep } from "../lib/repo/manual-enquiry-core.ts";

/**
 * Trust pass 9: the independent review of PR #77. Every repro the reviewer
 * hit, on the reviewer's own days (Wednesday 14 October 2026 and Wednesday 30
 * September 2026, Brisbane) - never the real clock. The reply-affecting ones
 * are proven again through the send path in `trust-pass9.db.test.ts`.
 */

const WED_14_OCT = new Date("2026-10-14T10:15:00+10:00");
const WED_30_SEP = new Date("2026-09-30T10:15:00+10:00");
const TZ = "Australia/Brisbane";

const read = (text: string, now = WED_14_OCT, service = "") =>
  readDates(text, now, TZ, { service });
const others = (r: ReturnType<typeof readDates>) =>
  r.context.map((c) => [c.iso, c.role, c.what] as const);

// H1. The day they ask for is the job; an event day only when no other day is said.

test("H1: 'birthday party is Saturday. Can you do the house on Friday?' - the job is Friday", () => {
  const r = read("My daughter's birthday party is Saturday. Can you do the house on Friday?");
  assert.equal(r.jobDate?.iso, "2026-10-16");
  assert.equal(r.jobDate?.role, undefined);
  assert.deepEqual(others(r), [["2026-10-17", "event", "birthday party"]]);
});

test("H1: 'wedding is Saturday 24 October, need makeup done by Friday 23 October' - the deadline is the job", () => {
  const r = read("My wedding is Saturday 24 October, I need makeup done by Friday 23 October");
  assert.equal(r.jobDate?.iso, "2026-10-23");
  assert.equal(r.jobDate?.role, "deadline");
  assert.deepEqual(others(r), [["2026-10-24", "event", "wedding"]]);
});

// H2. A date's role comes from the words nearest it, never the whole sentence.

test("H2: 'trial in December please, wedding in march' - the trial is December, never March", () => {
  const r = read("I'd like a trial in December please, wedding in march");
  const trial = r.context.find((c) => c.role === "trial");
  assert.equal(trial?.iso, "2026-12-01");
  assert.equal(trial?.to, "2026-12-31");
  assert.ok(!r.context.some((c) => c.role === "trial" && c.iso.startsWith("2027-03")));
});

test("H2: 'wedding on 8 Nov and engagement party on 22 Nov' - each its own event", () => {
  const r = read("Wedding on 8 Nov and engagement party on 22 Nov - makeup for both please");
  assert.deepEqual(
    [r.jobDate?.iso, r.jobDate?.role, r.jobDate?.what],
    ["2026-11-08", "event", "wedding"],
  );
  assert.deepEqual(others(r), [["2026-11-22", "event", "engagement party"]]);
});

test("H2: 'any day between Friday 16 and Sunday 18 October' is a stretch, never one day", () => {
  const r = read("Bridal makeup any day between Friday 16 and Sunday 18 October");
  assert.equal(r.jobDate, undefined);
  assert.deepEqual([r.window?.from, r.window?.to], ["2026-10-16", "2026-10-18"]);
});

test("H2: 'could I book bridal makeup on Saturday 17 October' is the job day, never a wedding", () => {
  const r = read("could I book bridal makeup on Saturday 17 October");
  assert.equal(r.jobDate?.iso, "2026-10-17");
  assert.equal(r.jobDate?.role, undefined);
  assert.equal(roleLabel(r.jobDate?.role, r.jobDate?.what, r.jobDate!.label), "Sat 17 Oct");
});

// H3. "The day before 30/10" is 29 October, worked out, never "done by 30 October".

test("H3: 'the day before 30/10' is Thursday 29 October, labelled as the day before", () => {
  const r = read("we need a vacate clean the day before 30/10", WED_30_SEP);
  assert.equal(r.jobDate?.iso, "2026-10-29");
  assert.equal(r.jobDate?.role, undefined, "never a 'by' deadline");
  assert.equal(r.jobDate?.label, "Thu 29 Oct (day before Fri 30 Oct)");
});

// H4. Only what they wrote as a date is ever said back.

test("H4: 'Unit 5/12 Park Rd' is an address, never 5 December", () => {
  const withDay = read("Unit 5/12 Park Rd, clean on 20 Oct please");
  assert.equal(withDay.jobDate?.iso, "2026-10-20");
  assert.ok(!withDay.context.some((c) => c.iso.endsWith("-12-05")));
  const without = read("Unit 5/12 Park Rd, end of lease clean please");
  assert.equal(without.jobDate, undefined);
  assert.equal(without.context.length, 0);
  // A span with no month or weekday word in their message is never echoed.
  assert.equal(echoable("5/12", "Unit 5/12 Park Rd, end of lease clean please"), false);
  assert.equal(echoable("20 Oct", "Unit 5/12 Park Rd, clean on 20 Oct please"), true);
});

// H5. When the trial IS the service, its day is the job's day.

test("H5: 'a makeup trial on Saturday 17 October' with the service Makeup trial is the job date", () => {
  const r = read("could I book a makeup trial on Saturday 17 October", WED_14_OCT, "Makeup trial");
  assert.equal(r.jobDate?.iso, "2026-10-17");
  assert.notEqual(r.jobDate?.role, "trial");
  assert.equal(r.context.length, 0);
});

// H6. A weekend surcharge on a stretch, "this weekend", or a day not yet known.

const WEEKEND: BusinessDetail = {
  kind: "fee",
  amount: 50,
  label: "Weekend surcharge",
  text: "Weekend jobs have a $50 surcharge",
  days: [0, 6],
};
const OVEN = [{ label: "Oven clean", amountMinor: 6000 }];

test("H6: a stretch that spans a weekend, and 'this weekend', are asked about", () => {
  const range = applyRules({
    details: [WEEKEND],
    lines: OVEN,
    message: "sometime between 16 and 19 October",
    jobDates: [],
    // Fri 16, Sat 17, Sun 18, Mon 19.
    jobWeekdays: [0, 1, 5, 6],
    facts: [],
  });
  assert.equal(range.open.length, 1);
  assert.match(range.open[0]!.text, /Some of the days they mentioned are/);
  const weekend = applyRules({
    details: [WEEKEND],
    lines: OVEN,
    message: "Oven clean this weekend please",
    jobDates: [],
    jobWeekdays: [0, 6],
    facts: [],
  });
  assert.equal(weekend.open.length, 1);
  assert.doesNotMatch(weekend.open[0]!.text, /Some of the days/);
  // A stretch on weekdays only never asks.
  const weekdays = applyRules({
    details: [WEEKEND],
    lines: OVEN,
    message: "",
    jobDates: [],
    jobWeekdays: [1, 2, 3],
    facts: [],
  });
  assert.equal(weekdays.open.length, 0);
});

test("H6: no day said - one tap, and 'not this time' leaves a 'Just so you know' line", () => {
  const unsure = applyRules({
    details: [WEEKEND],
    lines: OVEN,
    message: "oven clean please",
    jobDates: [],
    jobWeekdays: [],
    facts: [],
  });
  assert.equal(unsure.open.length, 1);
  assert.match(unsure.open[0]!.text, /They haven't said which day/);
  const field = unsure.open[0]!.field;
  const waived = applyRules({
    details: [WEEKEND],
    lines: OVEN,
    message: "oven clean please",
    jobDates: [],
    jobWeekdays: [],
    facts: [{ field, value: "waive", status: "confirmed" }],
  });
  assert.equal(waived.open.length, 0);
  assert.equal(
    waived.lines.reduce((n, l) => n + l.amountMinor, 0),
    6000,
  );
  assert.ok(waived.notes.some((n) => /^Just so you know, /.test(n) && /\$50/.test(n)));
  assert.deepEqual(waived.implied, [5000]);
});

// H7. An unscoped minimum is every job; only a named service scopes it.

test("H7: 'Minimum charge $N' is every job; 'only for painting' is painting; 'per job' is every job", () => {
  const r = readBusinessDetails(
    [
      "Minimum charge $150",
      "Min charge $150 per job",
      "Minimum charge $200 only for painting",
    ].join("\n"),
    WED_14_OCT,
  );
  assert.equal(r.unread.length, 0);
  assert.deepEqual(
    r.details
      .map((d) => d.detail)
      .map((d) => (d.kind === "minimum_charge" ? [d.amount, d.service] : d.kind)),
    [
      [150, undefined],
      [150, undefined],
      [200, "Painting"],
    ],
  );
});

test("H7: an unscoped minimum under the job is a blocking one-tap check", () => {
  const ruled = applyRules({
    details: [{ kind: "minimum_charge", amount: 150 }],
    lines: [{ label: "Oven clean", amountMinor: 6000 }],
    message: "oven clean please",
    jobDates: [],
    facts: [],
  });
  assert.equal(ruled.open.length, 1);
  assert.deepEqual(
    ruled.open[0]!.choices.map((c) => c[0]),
    ["apply", "waive"],
  );
});

// M1. A kept edit: only the total sentence's figure, every time it stands alone.

test("M1: the total changes everywhere it stands alone; $150 million cover, a deposit and 'per' never move", () => {
  const edit =
    "Hi,\nFor the clean, that comes to $150.\nSo $150 all up. We carry $150 million cover and a $150 deposit, $150 per hour after, $150m liability.\n";
  const prepared =
    "For the clean, that comes to $160.\n- Weekend surcharge: $50\nJust so you know, weekend jobs cost more.";
  const out = updateEditFigures(
    edit,
    [{ label: "Regular house clean", amountMinor: 16000 }],
    16000,
    prepared,
  );
  assert.match(out.body, /that comes to \$160\.\nSo \$160 all up\./);
  assert.match(
    out.body,
    /\$150 million cover and a \$150 deposit, \$150 per hour after, \$150m liability/,
  );
  assert.deepEqual(out.changes.map(describeChange), ["Total $150 -> $160"]);
  assert.deepEqual(out.missing, [
    "- Weekend surcharge: $50",
    "Just so you know, weekend jobs cost more.",
  ]);
});

test("M1: a figure outside the prepared total sentence is never read as the total", () => {
  const edit = "Hi,\nIt's $150 for the first hour, then we'll see.\n";
  const out = updateEditFigures(edit, [], 16000, "For the clean, that comes to $160.");
  assert.equal(out.body, edit);
  assert.deepEqual(out.changes, []);
});

// M2. Counting people.

test("M2: 'me and my 2 kids' is 3, 'for 2' and 'for two' are 2, '4 of us live here' is nobody booked", () => {
  assert.equal(peopleIn("Can I book bridal makeup for me and my 2 kids")?.n, 3);
  assert.equal(peopleIn("gel nails for 2 please")?.n, 2);
  assert.equal(peopleIn("gel nails for two please")?.n, 2);
  assert.equal(peopleIn("Regular clean, 4 of us live here"), undefined);
  assert.equal(peopleIn("regular clean for 2 hours"), undefined);
});

// M3/M4. What counts as a question they asked.

test("M3: a card they hold, dog hair, parking and cash are never read as the wrong topic", () => {
  const topics = (t: string) => readCustomerAsks(t).map((a) => a.topic);
  assert.deepEqual(topics("I have my Working With Children card"), []);
  assert.ok(!topics("Is it extra for dog hair?").includes("pets"));
  assert.ok(!topics("Do I need to pay for parking?").includes("payment"));
  assert.ok(!topics("Can I take cash for a discount?").includes("payment"));
  assert.deepEqual(topics("Do you have a police check?"), ["licence"]);
  assert.notEqual(
    answerTopicOf("Answer: police check - yes, all our staff have one")?.topic,
    "insurance",
  );
});

test("M4: small talk is not an ask; flexibility, cancellation and 'I was wondering whether' are", () => {
  const topics = (t: string) => readCustomerAsks(t).map((a) => a.topic);
  assert.deepEqual(topics("Hi, how are you going? Need a regular clean."), []);
  assert.deepEqual(topics("Is there any flexibility on price?"), ["offer"]);
  assert.deepEqual(topics("whats your cancellation policy"), ["cancellation"]);
  assert.deepEqual(topics("I was wondering whether you are licensed"), ["licence"]);
});

// M5. Services in the message's trade, unless they named one in full.

test("M5: 'Interior car clean' is the car service they named, never painting", () => {
  const services = [
    "Interior painting",
    "Exterior painting",
    "Regular house clean",
    "Car detailing",
    "Interior car clean",
  ];
  assert.equal(suggestService("Interior car clean please", services), "Interior car clean");
  assert.notEqual(rankServices("Interior car clean please", services)[0], "Interior painting");
});

// M6. Working hours: the old beside the new.

test("M6: the working-hours read-back says the old hours beside the new", () => {
  assert.equal(
    workingHoursChange(
      { workingDays: "Mon-Fri", hoursStart: "08:00", hoursEnd: "17:30" },
      { workingDays: "Mon-Sat", hoursStart: "07:00", hoursEnd: "17:00" },
    ),
    "Settings hours change from Mon-Fri 08:00-17:30 to Mon-Sat 07:00-17:00",
  );
});

// LOW. Model facts, discount words.

test("LOW: a model never plants an ask, a headcount choice or the days around the job", () => {
  const kept = modelFactsToKeep(
    [
      { field: "people" },
      { field: "ask:insurance" },
      { field: "count:Gel manicure" },
      { field: "rule:minimum:150" },
      { field: "date_context" },
    ],
    "gel nails for 2",
  ).map((f) => f.field);
  assert.deepEqual(kept, ["people"]);
});

test("LOW: '10% off for new customers' is never offered on a 'new carpet' message", () => {
  const discount: BusinessDetail = {
    kind: "discount",
    percent: 10,
    condition: "new customers",
    text: "10% off for new customers",
  };
  const carpet = applyRules({
    details: [discount],
    lines: [{ label: "Carpet steam cleaning", amountMinor: 12000 }],
    message: "We just got new carpet in 3 rooms, can you steam clean the old ones?",
    jobDates: [],
    facts: [],
  });
  assert.equal(carpet.open.length, 0);
  const customer = applyRules({
    details: [discount],
    lines: [{ label: "Carpet steam cleaning", amountMinor: 12000 }],
    message: "We're new customers - do you do carpets?",
    jobDates: [],
    facts: [],
  });
  assert.equal(customer.open.length, 1);
});
