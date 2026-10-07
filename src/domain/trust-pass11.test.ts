import assert from "node:assert/strict";
import test from "node:test";
import { detectVoiceEdit, dollarAmounts } from "./voice-detect.ts";
import { sweepDates } from "./date-sweep.ts";
import { readExtraRequests } from "./extras.ts";
import { frequencyFor } from "./coverage.ts";
import { ownerEditWarnings } from "./edit-warnings.ts";
import { applyRules } from "./rule-checks.ts";
import { identityLine } from "./channel.ts";
import { readBusinessDetails } from "./business-details-read.ts";
import { compilePrice } from "./price-compiler.ts";
import { suggestService } from "./service-match.ts";
import { readEnquiryBasics } from "./enquiry-basics.ts";
import type { VoiceProfile } from "./types.ts";

/**
 * Trust pass 11, pure logic: the review of main d9651c5. Every date is read
 * against an injected clock, Wednesday 30 September 2026 in Brisbane.
 */

export const WED_30_SEP = new Date("2026-09-30T10:15:00+10:00");

const VOICE: VoiceProfile = {
  warmth: "Warm",
  formality: "Casual",
  energy: "Calm",
  directness: "Direct",
  salesPressure: "Low",
  greeting: "Hi {name},",
  paragraphLength: "Short",
  bullets: false,
  signOff: "Thanks,\nDana",
  preferredPhrases: [],
} as unknown as VoiceProfile;

test("1: a greeting changed only by a confirmed name is not the owner changing their voice", () => {
  const prepared = "Hi Mel,\n\nThanks for getting in touch.\n\nThanks,\nDana";
  const kept = "Hi there,\n\nThanks for getting in touch. Looking forward to it.\n\nThanks,\nDana";
  assert.equal(detectVoiceEdit(prepared, kept, VOICE, "Mel"), null);
  assert.equal(detectVoiceEdit(kept, prepared, VOICE, "Mel"), null);
  // A greeting the owner really changed is still offered.
  const own = "Hey Mel!\n\nThanks for getting in touch.\n\nThanks,\nDana";
  assert.equal(detectVoiceEdit(prepared, own, VOICE, "Mel")?.reason, "You changed the greeting.");
});

// 3. The date sweep ----------------------------------------------------------

test("3: the sweep reads every day, whatever it is for, against the injected clock", () => {
  const jase = sweepDates(
    "EOL clean 2br unit, settlement 28/12 so need it done 27th or 28th. oven too. $$? ta Jase",
    WED_30_SEP,
  );
  assert.deepEqual(
    jase.days.map((d) => [d.iso, d.span, Boolean(d.context)]),
    [
      ["2026-12-27", "27th or 28th", false],
      ["2026-12-28", "27th or 28th", false],
    ],
  );
  const ahmed = sweepDates(
    "Our lease ends Sunday 27 December so it would need to be the 26th or 27th.",
    WED_30_SEP,
  );
  assert.deepEqual(
    ahmed.days.map((d) => d.iso),
    ["2026-12-26", "2026-12-27"],
  );
  // "this Thursday" is tomorrow; on a Wednesday "next Thursday" could be
  // either Thursday, so it is asked about, never guessed (date-sweep.ts).
  const both = sweepDates("Free this Thursday? Or next Thursday?", WED_30_SEP);
  assert.deepEqual(
    both.days.map((d) => d.iso),
    ["2026-10-01"],
  );
  assert.deepEqual(both.either, { "next Thursday": ["2026-10-01", "2026-10-08"] });
  // Said on a Thursday, "next Thursday" is a week today, in the sweep and the reader alike.
  const THU_1_OCT = new Date("2026-10-01T10:15:00+10:00");
  assert.deepEqual(
    sweepDates("Free next Thursday?", THU_1_OCT).days.map((d) => d.iso),
    ["2026-10-08"],
  );
  assert.equal(
    readEnquiryBasics("Could you come next Thursday? Liz", THU_1_OCT).jobDate?.iso,
    "2026-10-08",
  );
  const week = sweepDates("the week of 9 Nov if possible", WED_30_SEP).days[0]!;
  assert.equal(week.to, "2026-11-15");
  assert.equal(week.span, "the week of 9 Nov");
  const context = sweepDates("moving out Fri 16th Oct, need the oven done", WED_30_SEP).days[0]!;
  assert.equal(context.context, true);
});

test("3: what is not a day is never read as one, and what cannot be read is said", () => {
  for (const text of [
    "Unit 5/12 Park Rd",
    "3/4 of the lawn",
    "open 24/7",
    "50/50 split",
    "my daughter's 18th",
    "the 2nd coat",
    "I work Monday to Friday",
    "not Saturday though",
  ]) {
    assert.deepEqual(sweepDates(text, WED_30_SEP).days, [], text);
  }
  assert.deepEqual(sweepDates("could you do 31/9?", WED_30_SEP).unread, ["31/9"]);
  // No month anywhere: the next time that day comes round.
  assert.deepEqual(
    sweepDates("need it done 27th or 28th pls", WED_30_SEP).days.map((d) => d.iso),
    ["2026-10-27", "2026-10-28"],
  );
});

// 5. Everything asked for is read ---------------------------------------------

const SERVICES = [
  "Regular house clean",
  "End of lease clean 2 bedroom",
  "Inside windows",
  "Interior painting",
];

test("5: 'Also a feature wall' and 'a regular clean' are items, 'as well as possible' is not", () => {
  assert.deepEqual(
    readExtraRequests(
      "Walls painted please, 55 square metres. Also a feature wall in the bedroom.",
      "Interior painting",
      SERVICES,
    ).map((e) => e.label),
    ["feature wall painting"],
  );
  assert.deepEqual(
    readExtraRequests(
      "Interior painted please, and a regular clean once we are in, probably weekly.",
      "Interior painting",
      SERVICES,
    ).map((e) => e.label),
    ["Regular house clean"],
  );
  assert.deepEqual(
    readExtraRequests(
      "we clean regularly ourselves, just the end of lease clean",
      SERVICES[1]!,
      SERVICES,
    ),
    [],
  );
  assert.deepEqual(readExtraRequests("Do it as well as possible", SERVICES[1]!, SERVICES), []);
});

test("5: how often belongs to the work it is said about", () => {
  const carter =
    "We would like the interior painted, and a regular clean once we are in, probably weekly.";
  assert.equal(frequencyFor(carter, ["Interior painting"], SERVICES), undefined);
  const margaret = "I'm a pensioner and would like a fortnightly clean, about 3 hours.";
  assert.equal(frequencyFor(margaret, ["Regular house clean"], SERVICES), "fortnightly");
});

// 7. Owner-edit warnings and money said in words ------------------------------

test("7: money said in words is read as money; words that only look like it are not", () => {
  assert.deepEqual(dollarAmounts("All up it is half a grand."), [500]);
  assert.deepEqual(dollarAmounts("We carry 20 mil in public liability cover."), [20_000_000]);
  assert.deepEqual(dollarAmounts("That's a grand, all in."), [1000]);
  assert.deepEqual(dollarAmounts("A grand total of"), []);
  assert.deepEqual(dollarAmounts("It was a grand opening"), []);
});

test("7: only what the owner added is checked, and each warning quotes their words", () => {
  const draft = "Hi there,\n\nFor the clean, that comes to $580.\n\nThanks,\nDana";
  assert.deepEqual(ownerEditWarnings(draft, draft), []);
  const edited = draft.replace(
    "\n\nThanks,",
    "\n\nFeel free to call me. I can do 10% off that. I'm fully licensed.\n\nThanks,",
  );
  assert.deepEqual(ownerEditWarnings(edited, draft, { now: WED_30_SEP }), [
    '"10% off" - a discount the quote does not include.',
    '"licensed" - a claim Enquiry cannot check.',
  ]);
  assert.deepEqual(
    ownerEditWarnings(`${draft}\n\nYou are booked in for Friday.`, draft, { now: WED_30_SEP }),
    ['"You are booked" - a booking promise - nothing has checked your calendar.'],
  );
  const closed = { days: [0] };
  assert.deepEqual(
    ownerEditWarnings(`${draft}\n\nCould do Sunday 18 October instead.`, draft, {
      closed,
      now: WED_30_SEP,
    }),
    [`"Sunday 18 October" - I don't work Sundays.`],
  );
});

// 8. Small things ---------------------------------------------------------------

test("8: a weekend note reads mid-sentence, and a number in their message is a way to reach them", () => {
  const weekend = (facts: { field: string; value: string; status: string }[]) =>
    applyRules({
      details: [{ kind: "surcharge", percent: 20, days: [0, 6] }],
      lines: [{ label: "End of lease clean", amountMinor: 48_000 }],
      message: "end of lease clean please",
      jobDates: [],
      facts,
    });
  const field = weekend([]).open[0]!.field;
  const { notes } = weekend([{ field, value: "waive", status: "confirmed" }]);
  assert.ok(notes.includes("Just so you know, weekends are 20% more."), notes.join(" | "));
  const line = identityLine({
    customerEmail: "",
    customerPhone: "",
    customerHandle: "",
    facts: [{ field: "phone", value: "0412 555 019", superseded: false }],
  } as never);
  assert.equal(line, "0412 555 019 (from their message)");
});

// 9. Owner sentences, names, negations ------------------------------------------

test("9: owner sentences are read as the rules they are", () => {
  const read = (line: string) => readBusinessDetails(line, WED_30_SEP);
  assert.deepEqual(read("Jobs over $2000 get $100 off").details[0]?.detail, {
    kind: "discount",
    percent: 0,
    amountOff: 100,
    over: 2000,
    condition: "jobs over $2000",
    text: "Jobs over $2000 get $100 off",
  });
  assert.equal(read("Jobs over $2000 get 5% off").details[0]?.detail.kind, "discount");
  assert.deepEqual(read("Wedding party of 5 or more: $130 per person").prices[0]?.rule, {
    kind: "per_unit",
    service: "Wedding party",
    amount: 130,
    currency: "AUD",
    unit: "person",
    quantityField: "people",
    minimumQuantity: undefined,
    atLeast: 5,
  });
  assert.deepEqual(read("Feature wall $280 flat").prices[0]?.rule, {
    kind: "fixed_price",
    service: "Feature wall",
    amount: 280,
    currency: "AUD",
  });
  assert.deepEqual(read("Fortnightly regular cleans get 10% off").details[0]?.detail, {
    kind: "discount",
    percent: 10,
    frequency: "fortnightly",
    service: "Regular clean",
  });
  assert.deepEqual(read("Fortnightly cleans get 10% off").details[0]?.detail, {
    kind: "discount",
    percent: 10,
    frequency: "fortnightly",
  });
  assert.deepEqual(read("I work Monday to Saturday 7am to 4pm").details[0]?.detail, {
    kind: "working_hours",
    workingDays: "Monday to Saturday",
    hoursStart: "07:00",
    hoursEnd: "16:00",
  });
});

test("9: a group price holds from its size; a smaller group is never priced by it", () => {
  const read = readBusinessDetails("Wedding party of 5 or more: $130 per person", WED_30_SEP);
  const rule = read.prices[0]!.rule;
  const at = (n: string) =>
    compilePrice([rule], "Wedding party", [{ field: "people", value: n, status: "confirmed" }]);
  const five = at("5");
  assert.equal(five.kind === "EXACT" && five.amountMinor, 65_000);
  assert.equal(at("3").kind, "UNRESOLVED_QUANTITY");
});

test("9: a 'jobs over' discount is one tap, only on a quote over the amount", () => {
  const detail = readBusinessDetails("Jobs over $2000 get $100 off", WED_30_SEP).details[0]!.detail;
  const run = (
    amountMinor: number,
    facts: { field: string; value: string; status: string }[] = [],
  ) =>
    applyRules({
      details: [detail],
      lines: [{ label: "Interior painting", amountMinor }],
      message: "paint please",
      jobDates: [],
      facts,
    });
  assert.equal(run(150_000).open.length, 0);
  const big = run(288_000);
  assert.equal(
    big.open[0]?.text,
    "This job is over $2,000 - your discount is $100 off ($2,880 becomes $2,780)",
  );
  const applied = run(288_000, [
    { field: big.open[0]!.field, value: "apply", status: "confirmed" },
  ]);
  // The job line stands; the discount is its own line.
  assert.deepEqual(applied.lines, [
    { label: "Interior painting", amountMinor: 288_000 },
    { label: "$100 off jobs over $2,000", amountMinor: -10_000, adjustment: true },
  ]);
});

test("9: 'Nothing bridal' and 'not the bride' never pre-pick bridal makeup", () => {
  const services = ["Bridal makeup", "Bridesmaid makeup", "Party makeup"];
  assert.notEqual(
    suggestService("makeup for 6 of us for a hens party? Nothing bridal, just glam.", services),
    "Bridal makeup",
  );
  assert.equal(
    suggestService(
      "r u free mon 12/10 for bridal makeup for my sisters wedding? not the bride, i'm a bridesmaid",
      services,
    ),
    "Bridesmaid makeup",
  );
  assert.equal(
    suggestService("Getting married, need bridal makeup. Just me, no bridesmaids.", services),
    "Bridal makeup",
  );
});

test("9: 'Chloe xoxo' and a titled email signature are read as names", () => {
  assert.equal(
    readEnquiryBasics("Just me, no bridesmaids. Chloe xoxo", WED_30_SEP).customerName,
    "Chloe",
  );
  assert.equal(
    readEnquiryBasics(
      "Hello,\n\nPainting please.\n\nKind regards,\nDr Elizabeth Carter-Wong\nCarter-Wong Consulting | 0400 000 000",
      WED_30_SEP,
    ).customerName,
    "Elizabeth Carter-Wong",
  );
});

test("5: a saved 'Feature wall' is quoted from the sentence that names it, not from 'the walls'", () => {
  const read = readExtraRequests(
    "Hi, we'd like the walls of lounge and hallway painted. Also a feature wall in the bedroom.",
    "Interior painting",
    [...SERVICES, "Feature wall"],
  );
  assert.deepEqual(
    read.map((e) => [e.label, e.span]),
    [["Feature wall", "Also a feature wall in the bedroom"]],
  );
});
