import assert from "node:assert/strict";
import test from "node:test";
import { decideEnquiry } from "./decide.ts";
import { decideConfirmed } from "./coverage-testing.ts";
import { composeReply } from "./compose-reply.ts";
import { readDates } from "./enquiry-basics.ts";
import { replyContextFromFacts, isFollowUp, type ReplyFact } from "./reply-context.ts";
import { closedTimesOf, type BusinessDetail } from "./business-detail.ts";
import { readBusinessDetails } from "./business-details-read.ts";
import { COVERAGE_FIELD, unsettledFlags } from "./coverage.ts";
import { questionField } from "./service-questions.ts";
import { RULE_CHOICE } from "./rule-checks.ts";

/**
 * Review 5b (37/52 on 73712cf): every untrue or dropped reply it found is a
 * repro here. Dates are read on Sunday 27 September 2026, Brisbane.
 */

const NOW = new Date("2026-09-27T10:00:00+10:00");

const fact = (field: string, value: string, status = "confirmed", extra: object = {}) => ({
  field,
  value,
  status,
  ...extra,
});

const INTERIOR = {
  kind: "per_unit",
  service: "Interior painting",
  amount: 32,
  currency: "AUD",
  unit: "square metre",
  quantityField: "square metres",
};
const EXTERIOR = { ...INTERIOR, service: "Exterior painting", amount: 38 };
const OVEN = { kind: "fixed_price", service: "Oven clean", amount: 90, currency: "AUD" };
const EOL3 = {
  kind: "fixed_price",
  service: "End of lease clean (3 bedroom)",
  amount: 480,
  currency: "AUD",
};

const SUNDAYS: BusinessDetail = { kind: "closed_days", days: [0] };
const MINIMUM: BusinessDetail = {
  kind: "minimum_charge",
  amount: 450,
  service: "Interior painting",
};
const SATURDAY: BusinessDetail = { kind: "surcharge", percent: 20, days: [6] };
const SINGLE: BusinessDetail = {
  kind: "eligibility",
  service: "Exterior painting",
  condition: "single storey",
  text: "Exterior painting only if the house is single storey",
};

/** The field an "only if" rule's choice is stored under, as the check names it. */
function onlyField(service: string): string {
  const d = decideEnquiry(brain(EXTERIOR, SINGLE), {
    serviceLabel: service,
    facts: [fact("service", service), fact("square metres", "220")] as never,
    messageText: "Two storey house",
  });
  return d.coverage!.flagged.find((f) => f.kind === "rule")!.check!.field;
}

const brain = (...items: unknown[]) => ({
  knowledge: items.map((rulePayload) => ({ state: "Active", rulePayload })),
});

/** The reply the owner would get: facts read, then the owner's own choices. */
function replyFor(
  items: unknown[],
  serviceLabel: string,
  facts: ReplyFact[],
  message: string,
  owner: { closed?: boolean; followUp?: boolean } = {},
) {
  const d = decideConfirmed(brain(...items), {
    serviceLabel,
    facts: facts as never,
    messageText: message,
  });
  const details = items.filter(
    (i) => (i as { kind: string }).kind !== "per_unit",
  ) as BusinessDetail[];
  const ctx = replyContextFromFacts(facts, {
    customerName: "",
    serviceLabel,
    ...(owner.closed === false ? {} : { closed: closedTimesOf(details) }),
    ...(owner.followUp ? { followUp: true } : {}),
  });
  return { decision: d, reply: composeReply(d, ctx) };
}

/** The date facts manual-enquiry-core writes for a message, as reply facts. */
function dateFactsOf(text: string): ReplyFact[] {
  const r = readDates(text, NOW);
  const out: ReplyFact[] = [];
  if (r.jobDate) {
    out.push({
      field: "date",
      value: r.jobDate.iso,
      status: "inferred",
      date_asked: r.jobDate.asked,
      date_span: r.jobDate.span,
    });
  } else if (r.options) {
    out.push({
      field: "date",
      value: r.options.days.map((d) => d.iso).join("|"),
      status: "inferred",
      date_asked: true,
      date_span: r.options.span,
    });
  } else if (r.approx) {
    out.push({
      field: "date",
      value: "approx",
      status: "inferred",
      date_asked: true,
      date_span: r.approx.span,
    });
  }
  if (r.preference) out.push({ field: "day_preference", value: r.preference, status: "inferred" });
  return out;
}

// 2. Date lines are never untrue ---------------------------------------------

test("2: Whitfield - a Sunday they asked for is said plainly, with the next day you work", () => {
  const message =
    "Two storey brick house, exterior repaint about 220 sq m. Could you come for a measure-up on Sunday 11 Oct?";
  const facts = [
    fact("service", "Exterior painting"),
    fact("square metres", "220"),
    ...dateFactsOf(message),
    fact(onlyField("Exterior painting"), RULE_CHOICE.quote),
  ];
  const { reply } = replyFor([EXTERIOR, SUNDAYS, SINGLE], "Exterior painting", facts, message);
  assert.match(
    reply,
    /You mentioned Sunday 11 October - I don't work Sundays\. If another day suits, I could look at Monday 12 October - I'll confirm it's free\./,
  );
  assert.doesNotMatch(reply, /confirm whether/);
});

test("2: Helen - the day she asked for, never a day she only said she works from home", () => {
  const message =
    "Hi, I work from home Monday to Wednesday so Thursday or Friday would suit best, preferably the 18th of December. Could you quote an end of lease clean?";
  const read = readDates(message, NOW);
  assert.equal(read.jobDate?.iso, "2026-12-18");
  assert.equal(read.jobDate?.label, "Fri 18 Dec");
  assert.equal(read.preference, "Thursday or Friday");
  const { reply } = replyFor(
    [EOL3],
    "End of lease clean (3 bedroom)",
    [fact("service", "End of lease clean (3 bedroom)"), ...dateFactsOf(message)],
    message,
  );
  assert.match(reply, /You mentioned 18th of December - I'll confirm whether that works\./);
  assert.doesNotMatch(reply, /Monday/);
});

test("2: Bec - 'this Sunday 4th? or 20/10 if not' keeps both days, and says Sundays are out", () => {
  const message = "2br end of lease clean pls this Sunday 4th? or 20/10 if not";
  const read = readDates(message, NOW);
  assert.deepEqual(
    read.options?.days.map((d) => d.iso),
    ["2026-10-04", "2026-10-20"],
  );
  const { reply } = replyFor(
    [EOL3, SUNDAYS],
    "End of lease clean (3 bedroom)",
    [fact("service", "End of lease clean (3 bedroom)"), ...dateFactsOf(message)],
    message,
  );
  assert.match(
    reply,
    /You mentioned Sunday 4th or 20\/10 - I don't work Sundays, so I'll confirm whether Tuesday 20 October works\./,
  );
});

test("2: Priya - 'tuesdays pref' is a preference, never the next Tuesday", () => {
  const read = readDates(
    "do u do regular cleans? fortnightly, 3hrs, tuesdays pref. Thx, Priya",
    NOW,
  );
  assert.equal(read.jobDate, undefined);
  assert.equal(read.preference, "Tuesdays");
  const facts = dateFactsOf("tuesdays pref");
  const ctx = replyContextFromFacts(facts, { customerName: "" });
  assert.equal(ctx.jobDateIso, undefined);
  assert.equal(ctx.dayPreference, "Tuesdays");
});

test("2: 'week of the 12th' is a loose ask; 'tomorrow arvo' is tomorrow, said as a date", () => {
  assert.deepEqual(readDates("could you do it the week of the 12th?", NOW).approx, {
    span: "the week of the 12th",
  });
  const tomorrow = readDates("can you come tomorrow arvo", NOW);
  assert.equal(tomorrow.approx, undefined);
  assert.equal(tomorrow.jobDate?.iso, "2026-09-28");
  // Stored as the day itself, so a reply sent after midnight never says "tomorrow".
  assert.equal(tomorrow.jobDate?.span, "Monday 28 September (afternoon)");
  const message = "Interior walls, maybe 40sqm, can you come tomorrow arvo";
  const { reply } = replyFor(
    [INTERIOR],
    "Interior painting",
    [fact("service", "Interior painting"), fact("square metres", "40"), ...dateFactsOf(message)],
    message,
  );
  assert.match(
    reply,
    /You mentioned Monday 28 September \(afternoon\) - I'll confirm whether that works\./,
  );
  const week = replyFor(
    [INTERIOR],
    "Interior painting",
    [
      fact("service", "Interior painting"),
      fact("square metres", "40"),
      ...dateFactsOf("week of the 12th"),
    ],
    "week of the 12th",
  ).reply;
  assert.match(week, /You mentioned week of the 12th - I'll confirm which day works\./);
});

test("2: a day in the owner's closed dates is said plainly too", () => {
  const closed: BusinessDetail = { kind: "closed_dates", from: "12-24", to: "01-02" };
  const facts = [
    fact("service", "Oven clean"),
    fact("date", "2026-12-28", "inferred", { date_asked: true, date_span: "Monday 28 December" }),
  ];
  const { reply } = replyFor([OVEN, closed], "Oven clean", facts, "Can you do Monday 28 December?");
  assert.match(
    reply,
    /You mentioned Monday 28 December - I'm not working from 24 December to 2 January\. If another day suits, I could look at Sunday 3 January - I'll confirm it's free\./,
  );
});

// 3. The owner's rules are applied or waived, never passive -------------------

test("3: 'Interior painting is $32 per square metre, minimum charge $450' is a price and a minimum", () => {
  const read = readBusinessDetails(
    "Interior painting is $32 per square metre, minimum charge $450",
  );
  assert.equal(read.prices.length, 1);
  assert.equal(read.prices[0]!.rule.service, "Interior painting");
  assert.deepEqual(
    read.details.map((d) => d.detail),
    [{ kind: "minimum_charge", amount: 450, service: "Interior painting" }],
  );
  assert.equal(read.unread.length, 0);
});

test("3: Mick - 12 m2 at $32 under a $450 minimum asks, and applying it makes the total $450", () => {
  const base = [fact("service", "Interior painting"), fact("square metres", "12")];
  const open = decideEnquiry(brain(INTERIOR, MINIMUM), {
    serviceLabel: "Interior painting",
    facts: base as never,
    messageText: "Paint one room, 12 m2",
  });
  const rule = unsettledFlags(open.coverage!.flagged).find((f) => f.kind === "rule");
  assert.equal(rule?.check?.choices[0]?.[1], "Apply $450 minimum");
  assert.equal(rule?.check?.choices[1]?.[1], "Doesn't apply here");
  // A confirmation over the open rule does not count.
  const forced = decideEnquiry(brain(INTERIOR, MINIMUM), {
    serviceLabel: "Interior painting",
    facts: [...base, fact(COVERAGE_FIELD, open.coverage!.key)] as never,
    messageText: "Paint one room, 12 m2",
  });
  assert.equal(forced.coverage?.confirmed, false);

  const { decision, reply } = replyFor([INTERIOR, MINIMUM], "Interior painting", base, "12 m2");
  assert.equal(decision.price.kind === "EXACT" && decision.price.amountMinor, 45000);
  assert.match(
    reply,
    /that comes to \$450 \(minimum charge - 12 square metres at \$32 each comes to \$384\)/,
  );

  const waived = replyFor(
    [INTERIOR, MINIMUM],
    "Interior painting",
    [...base, fact(rule!.check!.field, RULE_CHOICE.waive)],
    "12 m2",
  );
  assert.match(waived.reply, /that comes to \$384/);
});

test("3: Jo - moved to Saturday with 'Saturday jobs cost 20% more' asks for the Saturday rate", () => {
  const message =
    "Hi, about the quote you sent last week - could you move it to Saturday instead? And add the oven?";
  const facts = [fact("service", "Oven clean"), ...dateFactsOf(message)];
  const open = decideEnquiry(brain(OVEN, SATURDAY), {
    serviceLabel: "Oven clean",
    facts: facts as never,
    messageText: message,
  });
  const rule = unsettledFlags(open.coverage!.flagged).find((f) => f.kind === "rule");
  assert.equal(rule?.check?.choices[0]?.[1], "Add 20% Saturday rate ($18)");
  const { decision, reply } = replyFor([OVEN, SATURDAY], "Oven clean", facts, message, {
    followUp: true,
  });
  assert.equal(decision.price.kind === "EXACT" && decision.price.amountMinor, 10800);
  assert.match(reply, /- Saturday rate \(20% of \$90\): \$18/);
  assert.doesNotMatch(reply, /Thanks for getting in touch/);
});

test("3: Whitfield - two storey against 'single storey only' asks, and declining is a kind no", () => {
  const message = "Two storey brick house, exterior repaint about 220 sq m.";
  const base = [fact("service", "Exterior painting"), fact("square metres", "220")];
  const open = decideEnquiry(brain(EXTERIOR, SINGLE), {
    serviceLabel: "Exterior painting",
    facts: base as never,
    messageText: message,
  });
  const rule = unsettledFlags(open.coverage!.flagged).find((f) => f.kind === "rule");
  assert.equal(rule?.text, "Two storey - you said exterior painting only if single storey");
  assert.deepEqual(
    rule?.check?.choices.map((c) => c[1]),
    ["Decline kindly", "Quote anyway"],
  );
  const { decision, reply } = replyFor([EXTERIOR, SINGLE], "Exterior painting", base, message);
  assert.equal(decision.action, "DECLINE");
  assert.match(
    reply,
    /Sorry, I only do exterior painting if the house is single storey, so I can't quote this one\./,
  );
  assert.doesNotMatch(reply, /\$/);
});

test("3: a painting minimum never shows on a cleaning quote", () => {
  const note = { kind: "note", text: "Minimum charge for interior painting is $450" };
  const d = decideEnquiry(brain(INTERIOR, OVEN, note, MINIMUM), {
    serviceLabel: "Oven clean",
    facts: [fact("service", "Oven clean")] as never,
    messageText: "Oven clean please",
    services: ["Interior painting", "Oven clean"],
  });
  assert.deepEqual(
    d.coverage?.flagged.map((f) => f.text),
    [],
  );
});

// 4. A lighter coverage step ---------------------------------------------------

test("4: walls and ceilings fold into one 'Included in interior painting' line", () => {
  const d = decideEnquiry(brain(INTERIOR), {
    serviceLabel: "Interior painting",
    facts: [fact("service", "Interior painting"), fact("square metres", "180")] as never,
    messageText: "Paint the inside of our 3 bedroom house - walls and ceilings, plus the tiles.",
  });
  const flags = d.coverage!.flagged;
  const included = flags.find((f) => f.kind === "included");
  assert.equal(included?.text, "Included in interior painting: walls, ceilings");
  assert.equal(included?.thing, undefined, "folded things do not block");
  assert.deepEqual(
    unsettledFlags(flags).map((f) => f.thing),
    ["tiles"],
  );
});

test("4: 'carpets' and 'carpet cleaning - you don't offer it' are one flag", () => {
  const notOffered = { kind: "not_offered", service: "carpet cleaning" };
  const d = decideEnquiry(brain(EOL3, notOffered), {
    serviceLabel: "End of lease clean (3 bedroom)",
    facts: [fact("service", "End of lease clean (3 bedroom)")] as never,
    messageText: "End of lease clean, 3 bed. The carpets need steaming too - carpet cleaning?",
  });
  const things = unsettledFlags(d.coverage!.flagged).map((f) => `${f.kind}:${f.thing}`);
  assert.deepEqual(things, ["not_offered:carpet cleaning"]);
});

// 5. A plain No gets a reply ---------------------------------------------------

test("5: 'No, I don't do pressure washing' prepares the kind reply at once", () => {
  const d = decideEnquiry(brain(INTERIOR), {
    serviceLabel: "",
    facts: [fact(questionField("pressure washing"), "no")] as never,
    messageText: "Do you do pressure washing? Driveway only.",
  });
  assert.equal(d.action, "DECLINE");
  const reply = composeReply(d, {});
  assert.match(reply, /Sorry, I don't do pressure washing\./);
  assert.doesNotMatch(reply, /\$|which service/i);
});

test("5: a referral line only when the owner saved one", () => {
  const referral = {
    kind: "note",
    text: "For pressure washing I recommend Shine Bros on 0400 000 000",
  };
  const d = decideEnquiry(brain(INTERIOR, referral), {
    serviceLabel: "",
    facts: [fact(questionField("pressure washing"), "no")] as never,
    messageText: "Do you do pressure washing?",
  });
  assert.match(
    composeReply(d, {}),
    /Sorry, I don't do pressure washing\.\nFor pressure washing I recommend Shine Bros on 0400 000 000\./,
  );
});

// 6. A follow-up is never a first hello ---------------------------------------

test("6: a message about 'the quote you sent' reads as a follow-up", () => {
  assert.equal(isFollowUp(["about the quote you sent last week - move to Saturday?"]), true);
  assert.equal(isFollowUp(["Hi, can I get a quote for an oven clean?"]), false);
  assert.equal(isFollowUp(["Hi"], true), true);
  const d = decideEnquiry(brain(INTERIOR), { serviceLabel: "", facts: [] as never });
  assert.doesNotMatch(composeReply(d, { followUp: true }), /Thanks for getting in touch/);
});

// 7. Read what the customer gave --------------------------------------------

test("7: counts written the customer's way are read, never asked for again", async () => {
  const { readQuantityFromMessage } = await import("./quantity-reader.ts");
  const { blockerInput } = await import("./blocker-input.ts");
  assert.equal(
    readQuantityFromMessage("fortnightly, 3hrs, tuesdays pref", "hours", "hour")?.value,
    "3",
  );
  assert.equal(readQuantityFromMessage("do the windows x12", "windows", "window")?.value, "12");
  assert.equal(readQuantityFromMessage("x12 windows please", "windows", "window")?.value, "12");
  const approx = readQuantityFromMessage("maybe 40sqm", "square metres", "square metre");
  assert.deepEqual(approx, { value: "40", span: "maybe 40sqm", approximate: true });
  assert.equal(blockerInput("hours", "Hours").inputMode, "numeric");
  assert.equal(blockerInput("windows", "Windows").inputMode, "numeric");
});

test("7: names under emoji, device footers and pipe signatures", async () => {
  const { readCustomerName } = await import("./enquiry-basics.ts");
  assert.equal(readCustomerName("tuesdays pref. Thx, Priya 😊"), "Priya");
  assert.equal(
    readCustomerName("Quote please.\n\nKind regards,\nMargaret & Tony Russo\n\nSent from my iPad"),
    "Margaret & Tony Russo",
  );
  assert.equal(
    readCustomerName(
      "Office clean.\n\nSarah Nguyen | Office Manager | Acme Pty Ltd | 07 3000 1234",
    ),
    "Sarah Nguyen",
  );
  // Two names greet as the two of them.
  const d = decideEnquiry(brain(INTERIOR), { serviceLabel: "", facts: [] as never });
  assert.match(composeReply(d, { customerName: "Margaret & Tony Russo" }), /^Hi Margaret & Tony,/);
});

test("7: a reply that asks for one detail never promises 'the full cost'", () => {
  const d = decideEnquiry(brain(INTERIOR), {
    serviceLabel: "Interior painting",
    facts: [fact("service", "Interior painting")] as never,
  });
  assert.equal(d.action, "REQUEST_INFORMATION");
  assert.doesNotMatch(composeReply(d, {}), /full cost/);
});

// 9. Plain owner words --------------------------------------------------------

test("9: 'We don't paint roofs' keeps its verb; 'also do you do bond cleans?' is a question", async () => {
  const { readDetailLine, describeDetail } = await import("./business-detail.ts");
  const { readServiceQuestions } = await import("./service-questions.ts");
  const roofs = readDetailLine("We don't paint roofs");
  assert.deepEqual(roofs, { kind: "not_offered", service: "roofs", verb: "paint" });
  assert.equal(describeDetail(roofs as BusinessDetail), "You don't paint roofs");
  const asked = readServiceQuestions(
    "Weekly office clean, 4 hours. Also do you do bond cleans for 5 bedroom houses?",
    ["Regular clean"],
  );
  assert.deepEqual(
    asked.map((q) => q.thing),
    ["bond cleans"],
  );
});

test("9: the Later action's status says Later, the same word as the button", async () => {
  const { parkedUntil } = await import("./time-cues.ts");
  const { STATUS } = await import("./labels.ts");
  assert.equal(STATUS.parked, STATUS.later);
  assert.match(parkedUntil("2026-09-28T08:00:00+10:00", NOW), /^Later until /);
});

test("5: a No to one question never drops the job they also asked for (Russo)", () => {
  const d = decideEnquiry(brain(INTERIOR, EXTERIOR), {
    serviceLabel: "",
    facts: [fact(questionField("roofs"), "no")] as never,
    messageText:
      "We're after a quote to paint the inside of our 3 bedroom house. Do you paint roofs?",
  });
  assert.notEqual(d.action, "DECLINE");
  assert.equal(d.setup, "choose_service");
});

test("3: a Saturday rate is itemised, never named as something they asked for", () => {
  const facts = [
    fact("service", "Oven clean"),
    fact("date", "2026-10-03", "inferred", { date_asked: true, date_span: "Saturday" }),
    fact("rule:surcharge:6:20", RULE_CHOICE.apply),
  ];
  const { reply } = replyFor([OVEN, SATURDAY], "Oven clean", facts, "Saturday please");
  assert.match(reply, /For the oven clean, that comes to \$108:/);
});

test("2: a loose ask starting their sentence is quoted mid-sentence", () => {
  assert.deepEqual(readDates("The week of the 12th would suit us.", NOW).approx, {
    span: "the week of the 12th",
  });
});
