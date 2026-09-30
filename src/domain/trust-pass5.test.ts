import assert from "node:assert/strict";
import test from "node:test";
import { decideEnquiry } from "./decide.ts";
import { decideConfirmed } from "./coverage-testing.ts";
import { composeReply } from "./compose-reply.ts";
import { snapshotFromDecision, stateFromDecision } from "./decision-snapshot.ts";
import { COVERAGE_FIELD } from "./coverage.ts";
import { extraField } from "./extras.ts";
import { readPriceLine } from "./price-sentence.ts";
import { readBusinessDetails } from "./business-details-read.ts";
import { readDetailLine } from "./business-detail.ts";
import { readServiceQuestions, questionField } from "./service-questions.ts";
import { askFor } from "./compose-reply.ts";
import { countOf, howMany, isOwnerEstimate, numberOf, ownerQuestion } from "./count-phrase.ts";
import { normaliseTrustMode } from "./trust-mode.ts";
import { laterChoices } from "./time-cues.ts";
import { readDates } from "./enquiry-basics.ts";
import type { BusinessRule } from "./business-rule.ts";

/**
 * Pass 5 (independent review 38/52 on 271c261): never tell a customer
 * something untrue, never invent or silently drop a price. Every repro from the
 * review is a test here.
 */

type Fact = { field: string; value: string; status: string; displayValue?: string };
const fact = (field: string, value: string, status = "confirmed", displayValue?: string): Fact => ({
  field,
  value,
  status,
  ...(displayValue ? { displayValue } : {}),
});
const brain = (...rules: unknown[]) => ({
  knowledge: rules.map((rulePayload) => ({ state: "Active", rulePayload })),
});

const EOL = {
  kind: "per_unit",
  service: "End of lease clean",
  amount: 190,
  currency: "AUD",
  unit: "bedroom",
  quantityField: "bedrooms",
};
const OVEN = { kind: "fixed_price", service: "Oven clean", amount: 120, currency: "AUD" };

function rule(line: string): BusinessRule {
  const read = readPriceLine(line);
  assert.ok("rule" in read, `${line}: ${"reason" in read ? read.reason : ""}`);
  return (read as { rule: BusinessRule }).rule;
}

// 1. Coverage gate ----------------------------------------------------------

test("a price is not a ready reply until the owner confirms what it covers", () => {
  const facts = [
    fact("service", "End of lease clean"),
    fact("bedrooms", "3"),
    fact(extraField("Oven clean"), "include"),
  ];
  const open = decideEnquiry(brain(EOL, OVEN), {
    serviceLabel: "End of lease clean",
    facts: facts as never,
  });
  assert.equal(open.action, "ESCALATE_HUMAN");
  assert.equal(open.coverage?.confirmed, false);
  assert.deepEqual(
    open.coverage?.lines.map((l) => [l.label, l.quantity ?? "", l.amountMinor]),
    [
      ["End of lease clean", "3 bedrooms", 57000],
      ["Oven clean", "", 12000],
    ],
  );
  const snap = snapshotFromDecision(open);
  assert.equal(snap.price, undefined, "no send path can record a total yet");
  assert.deepEqual(snap.impliedAmountsMinor, []);
  assert.equal(stateFromDecision(open).decisionState, "NEEDS_HUMAN");
  assert.doesNotMatch(snap.draft.body, /\$/, "the reply names no price before the check");

  const done = decideConfirmed(brain(EOL, OVEN), {
    serviceLabel: "End of lease clean",
    facts: facts as never,
  });
  assert.equal(done.action, "SEND_QUOTE");
  const reply = composeReply(done, { serviceLabel: "End of lease clean" });
  assert.match(
    reply,
    /For the end of lease clean \(3 bedrooms\) and the oven clean, that comes to \$690:/,
  );
  assert.doesNotMatch(reply, /all up/);
});

test("any change to the facts resets the coverage confirmation", () => {
  const facts = [fact("service", "End of lease clean"), fact("bedrooms", "3")];
  const first = decideEnquiry(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: facts as never,
  });
  const confirmed = [...facts, fact(COVERAGE_FIELD, first.coverage!.key)];
  const ok = decideEnquiry(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: confirmed as never,
  });
  assert.equal(ok.coverage?.confirmed, true);
  const moved = decideEnquiry(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [...confirmed, fact(extraField("carpet"), "leave_out")] as never,
  });
  assert.equal(moved.coverage?.confirmed, false);
  assert.equal(moved.action, "ESCALATE_HUMAN");
  // A new message mentioning something else also moves it.
  const mentioned = decideEnquiry(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: confirmed as never,
    messageText: "Also the deck needs doing",
  });
  assert.equal(mentioned.coverage?.confirmed, false);
  assert.deepEqual(
    mentioned.coverage?.flagged.map((f) => f.text),
    ["They mention the deck"],
  );
});

test("something not priced yet is an honest reply line, never a made-up price", () => {
  const d = decideConfirmed(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [
      fact("service", "End of lease clean"),
      fact("bedrooms", "3"),
      fact(extraField("deck staining"), "come_back"),
    ] as never,
  });
  assert.equal(d.price.kind === "EXACT" && d.price.amountMinor, 57000);
  const reply = composeReply(d, {});
  assert.match(reply, /I'll come back to you on the deck staining\./);
  assert.equal((reply.match(/\$/g) ?? []).length, 2, "$570 total and its $190 rate only");
});

test("a recurring job is priced per visit and a first-visit extra is separate", () => {
  const regular = {
    kind: "per_unit",
    service: "Regular clean",
    amount: 70,
    currency: "AUD",
    unit: "bedroom",
    quantityField: "bedrooms",
  };
  const d = decideConfirmed(brain(regular, OVEN), {
    serviceLabel: "Regular clean",
    facts: [
      fact("service", "Regular clean"),
      fact("bedrooms", "3"),
      fact(extraField("Oven clean"), "include", "confirmed", "oven on the first clean please"),
      fact("recurring", "yes"),
    ] as never,
    messageText: "Fortnightly clean for a 3 bed house, oven on the first clean please",
  });
  const reply = composeReply(d, {});
  assert.match(
    reply,
    /For the regular clean, that's \$210 per visit \(3 bedrooms at \$70 each\)\./,
  );
  assert.match(reply, /The first visit adds \$120 for the oven clean\./);
  assert.doesNotMatch(reply, /all up|comes to \$330/);
  assert.equal(
    (snapshotFromDecision(d).price as { amountMinor?: number } | undefined)?.amountMinor,
    21000,
  );
});

// 2. Per-unit parsing -------------------------------------------------------

test("'Doors $90 each' is per door, and 3 doors is a $270 line (repro 1 totals $1,350)", () => {
  const doors = rule("Doors $90 each");
  assert.deepEqual(doors, {
    kind: "per_unit",
    service: "Doors",
    amount: 90,
    currency: "AUD",
    unit: "door",
    quantityField: "doors",
    minimumQuantity: undefined,
  });
  const painting = rule("Interior painting $450 per room");
  const ceiling = rule("Ceiling $180 per room");
  const d = decideConfirmed(brain(painting, ceiling, doors), {
    serviceLabel: "Interior painting",
    facts: [
      fact("service", "Interior painting"),
      fact("rooms", "2"),
      fact(extraField("Ceiling"), "include"),
      fact("rooms for ceiling", "1"),
      fact(extraField("Doors"), "include"),
      fact("doors for doors", "3"),
    ] as never,
  });
  assert.deepEqual(
    d.lines?.map((l) => [l.label, l.amountMinor]),
    [
      ["Interior painting", 90000],
      ["Ceiling", 18000],
      ["Doors", 27000],
    ],
  );
  assert.equal(d.price.kind === "EXACT" && d.price.amountMinor, 135000);
  assert.match(composeReply(d, {}), /- Doors: \$270 \(3 doors at \$90 each\)/);
});

test("each / per / a / an <unit> is per-unit everywhere; '65 dollars an hour' reads", () => {
  for (const [line, unit] of [
    ["Windows $8 each window", "window"],
    ["Windows $8 per window", "window"],
    ["Carpet steam $40 a room", "room"],
    ["Exterior painting 65 dollars an hour", "hour"],
    ["Oven clean $95 each", "oven"],
  ] as const) {
    const r = rule(line);
    assert.equal(r.kind, "per_unit", line);
    if (r.kind === "per_unit") assert.equal(r.unit, unit, line);
  }
  assert.equal(rule("Exterior painting 65 dollars an hour").amount, 65);
});

// 3. Conditions are never silently dropped ----------------------------------

test("every conditional price is refused the same way and offered as a note", () => {
  for (const line of [
    "Windows inside only $8 per window",
    "Carpet steam $40 a room, not available on weekends",
    "Travel fee $40 outside Brisbane northside",
    "Painting $50 an hour on weekends",
    "Discount $100 for jobs over $2,000",
    "Minimum call out $80",
    "Oven clean $95 minimum",
  ]) {
    const read = readPriceLine(line);
    assert.ok(!("rule" in read), `${line} was saved as a price`);
    if ("rule" in read) continue;
    assert.equal(read.note, true, `${line} is offered as a note`);
    assert.ok(read.reason.length > 20, line);
  }
  // A minimum that is part of a per-unit price is modelled, and the price respects it.
  const group = rule("Group makeup $160 a person, minimum 3");
  assert.equal(group.kind === "per_unit" && group.minimumQuantity, 3);
});

test("a saved note shows on the quote it concerns; a weekend note flags a weekend day", () => {
  const note = {
    kind: "note",
    text: "Carpet steam $40 a room, not available on weekends",
    service: "End of lease clean",
  };
  const closed = { kind: "closed_days", days: [0] };
  const d = decideEnquiry(brain(EOL, note, closed), {
    serviceLabel: "End of lease clean",
    facts: [
      fact("service", "End of lease clean"),
      fact("bedrooms", "3"),
      fact("date", "2026-10-04", "inferred"),
    ] as never,
  });
  const flags = d.coverage?.flagged.map((f) => f.text) ?? [];
  assert.ok(flags.includes("Your note: Carpet steam $40 a room, not available on weekends"));
  assert.ok(
    flags.includes("A day they mentioned is a Sunday - you don't work Sundays, the reply says so"),
  );
});

// 4. Non-price business details and questions -------------------------------

test("'Add a business detail' accepts days not worked and services not offered", () => {
  assert.deepEqual(readDetailLine("We don't work Sundays"), { kind: "closed_days", days: [0] });
  assert.deepEqual(readDetailLine("Closed on weekends"), { kind: "closed_days", days: [0, 6] });
  assert.deepEqual(readDetailLine("We don't do mould removal"), {
    kind: "not_offered",
    service: "mould removal",
  });
  assert.equal(readDetailLine("Oven clean $120"), null);
  const all = readBusinessDetails("We don't work Sundays\nOven clean $120\nNo pets inside");
  assert.equal(all.details.length, 1);
  assert.equal(all.prices.length, 1);
  assert.equal(all.unread[0]?.note, true, "anything else can still be kept as a note");
});

test("'do you do mould removal?' reads as No from the owner's rule; an unknown one is asked", () => {
  const details = [{ kind: "not_offered" as const, service: "mould removal" }];
  const text =
    "Need an end of lease clean. Do you do mould removal? And do you do gutter cleaning?";
  const qs = readServiceQuestions(text, ["End of lease clean"], details);
  assert.deepEqual(
    qs.map((q) => [q.thing, q.notOffered]),
    [
      ["mould removal", true],
      ["gutter cleaning", false],
    ],
  );
  assert.deepEqual(readServiceQuestions("can u do Sat 3rd??", ["End of lease clean"]), []);
  assert.deepEqual(
    readServiceQuestions("Do you do end of lease cleans?", ["End of lease clean"]),
    [],
  );
});

test("an unanswered question is never 'reply ready'; the answer goes in the reply", () => {
  const base = [fact("service", "End of lease clean"), fact("bedrooms", "3")];
  const open = decideEnquiry(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [
      ...base,
      fact(questionField("mould removal"), "no", "inferred", "Do you do mould removal?"),
    ] as never,
  });
  assert.equal(open.action, "ESCALATE_HUMAN");
  assert.equal(open.questionPending?.thing, "mould removal");
  assert.equal(open.questionPending?.readAs, "no");
  assert.equal(snapshotFromDecision(open).price, undefined);

  const answered = decideConfirmed(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [...base, fact(questionField("mould removal"), "no")] as never,
  });
  assert.equal(answered.action, "SEND_QUOTE");
  assert.match(composeReply(answered, {}), /Sorry, I don't do mould removal\./);
  const yes = decideConfirmed(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [...base, fact(questionField("gutter cleaning"), "yes")] as never,
  });
  assert.match(
    composeReply(yes, {}),
    /Yes, I can help with gutter cleaning - I'll come back to you with a price for that\./,
  );
});

// 5. Count phrases: one builder, every unit ---------------------------------

test("every count reads as a person says it, never 'windows for windows'", () => {
  const cases: [string, string, string | null, string][] = [
    [
      "bedrooms",
      "the number of bedrooms",
      "how many bedrooms",
      "can you let me know how many bedrooms there are?",
    ],
    [
      "rooms",
      "the number of rooms",
      "how many rooms",
      "can you let me know how many rooms there are?",
    ],
    [
      "rooms for ceiling",
      "the number of rooms for the ceiling",
      "how many rooms for the ceiling",
      "can you let me know how many rooms there are?",
    ],
    [
      "windows for windows",
      "the number of windows",
      "how many windows",
      "can you let me know how many windows there are?",
    ],
    [
      "doors for doors",
      "the number of doors",
      "how many doors",
      "can you let me know how many doors there are?",
    ],
    [
      "square metres",
      "the number of square metres",
      "how many square metres",
      "can you let me know how many square metres there are?",
    ],
    [
      "square metres for ceilings",
      "the number of square metres for the ceilings",
      "how many square metres for the ceilings",
      "can you let me know how many square metres there are?",
    ],
    [
      "people",
      "the number of people",
      "how many people",
      "can you let me know how many people there are?",
    ],
    [
      "metres",
      "the number of metres",
      "how many metres",
      "can you let me know how many metres there are?",
    ],
    [
      "hours",
      "the number of hours",
      "how many hours",
      "can you let me know how many hours there are?",
    ],
    ["address", "the address", null, "can you let me know the address?"],
  ];
  for (const [field, number, many, ask] of cases) {
    assert.equal(numberOf(field), number, field);
    assert.equal(howMany(field), many, field);
    assert.equal(askFor(field), ask, field);
  }
  assert.equal(countOf("1", "rooms for ceiling"), "1 room");
  assert.equal(countOf("3", "people"), "3 people");
  assert.equal(countOf("1", "people"), "1 person");
});

test("hours are the owner's estimate: asked of the owner, never of the customer", () => {
  assert.equal(isOwnerEstimate("hours"), true);
  assert.equal(isOwnerEstimate("bedrooms"), false);
  assert.equal(ownerQuestion("hours"), "How many hours do you estimate?");
  assert.equal(ownerQuestion("rooms for ceiling"), "How many rooms for the ceiling?");
  const hourly = {
    kind: "per_unit",
    service: "Exterior painting",
    amount: 65,
    currency: "AUD",
    unit: "hour",
    quantityField: "hours",
  };
  const d = decideEnquiry(brain(hourly), {
    serviceLabel: "Exterior painting",
    facts: [fact("service", "Exterior painting")] as never,
  });
  assert.equal(d.action, "REQUEST_INFORMATION");
  assert.match(d.explanation, /your estimate of the hours decides the price/);
  const snap = snapshotFromDecision(d);
  assert.equal(snap.recommendation.label, "Estimate the hours");
  assert.doesNotMatch(snap.draft.body, /how many hours|let me know how many/i);
  assert.match(snap.draft.body, /I'll work out how long it will take/);
});

// 7. Dates in the reply ------------------------------------------------------

test("a read day is quoted, never 'Happy to lock it in'", () => {
  const d = decideConfirmed(brain(OVEN), {
    serviceLabel: "Oven clean",
    facts: [fact("service", "Oven clean")] as never,
  });
  const reply = composeReply(d, {
    jobDateIso: "2026-10-03",
    jobDateSpan: "Sat 3rd",
    jobDateConfirmed: false,
  });
  // A day without its month is said as the day itself, never \"Saturday 3rd\".\n  assert.match(reply, /You mentioned Saturday 3 October - I'll confirm whether that works\./);
  assert.doesNotMatch(reply, /lock it in/i);
  const options = composeReply(d, { dateOptions: "Sat 26 or Sun 27 Sep" });
  assert.match(
    options,
    /You mentioned Saturday 26 or Sunday 27 September - I'll confirm which day works\./,
  );
});

// 14. Trust mode --------------------------------------------------------------

test("the retired autonomous trust mode maps to Assist and is never stored", () => {
  assert.equal(normaliseTrustMode("Autopilot"), "Assist");
  assert.equal(normaliseTrustMode("autopilot"), "Assist");
  assert.equal(normaliseTrustMode("Observe"), "Observe");
  assert.equal(normaliseTrustMode("Robot"), null);
});

test("later choices never offer a day the business does not work", () => {
  const prefs = {
    hoursStart: "08:00",
    hoursEnd: "17:30",
    workingDays: "Monday to Friday",
    timezone: "Australia/Brisbane",
    notifyArrival: false,
    notifyFollowUp: false,
    notifyLearning: false,
  };
  // Saturday: tomorrow is Sunday, which a Monday to Friday business does not work.
  const saturday = laterChoices(new Date("2026-09-26T10:00:00+10:00"), prefs);
  assert.deepEqual(
    saturday.map((c) => c.label),
    ["Next working day, Mon 28 Sep 8:00am"],
  );
  // A seven-day business that said "We don't work Sundays".
  const sevenDays = { ...prefs, workingDays: "Seven days" };
  const closed = laterChoices(new Date("2026-09-26T19:00:00+10:00"), sevenDays, new Set([0]));
  assert.ok(
    closed.every((c) => !/Sun/.test(c.label)),
    JSON.stringify(closed),
  );
});

test("C11: the job date is the day asked for - not a move-out, not an inspection, not one of two", () => {
  const fri = new Date("2026-09-25T09:00:00+10:00");
  const dave = readDates(
    "need an end of lease clean. we move out Mon 5 Oct and the inspection is Wed 7 Oct. can u do Sat 3rd?? cheers, Dave",
    fri,
  );
  assert.equal(dave.jobDate?.iso, "2026-10-03");
  assert.equal(dave.jobDate?.span, "Sat 3rd");
  assert.deepEqual(
    dave.context.map((c) => [c.what, c.iso]),
    [
      ["move out", "2026-10-05"],
      ["inspection", "2026-10-07"],
    ],
  );
  const two = readDates("Could you do Sat 26 or Sun 27 Sep?", fri);
  assert.equal(two.jobDate, undefined, "one of two options is never the job date");
  assert.equal(two.options?.label, "Sat 26 or Sun 27 Sep");
  // One of the two already gone: the other is still read, never dropped.
  const later = readDates(
    "Could you do Sat 26 or Sun 27 Sep?",
    new Date("2026-09-27T09:00:00+10:00"),
  );
  assert.equal(later.jobDate?.iso, "2026-09-27");
  const ruled = readDates("Any time except the week of 12 October. Could you do 19 October?", fri);
  assert.equal(ruled.jobDate?.iso, "2026-10-19");
  assert.equal(ruled.unavailable[0]?.label, "week of Mon 12 Oct");
});

test("coverage flags: a shared work word is not a mention, and an answered question is settled", () => {
  const WALL = {
    kind: "per_unit",
    service: "Feature wall",
    amount: 300,
    currency: "AUD",
    unit: "room",
    quantityField: "rooms",
  };
  const d = decideEnquiry(brain(WALL, EOL, OVEN), {
    serviceLabel: "Feature wall",
    facts: [
      fact("service", "Feature wall"),
      fact("rooms", "1"),
      fact(questionField("gutter cleaning"), "no"),
    ] as never,
    messageText: "can u do a feature wall in 1 room? also do you do gutter cleaning? ta, Steve",
    services: ["Feature wall", "End of lease clean", "Oven clean"],
  });
  assert.deepEqual(d.coverage?.flagged, []);
});
