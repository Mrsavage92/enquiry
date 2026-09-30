import assert from "node:assert/strict";
import test from "node:test";
import { readDates } from "./enquiry-basics.ts";
import { composeReply, CLOSE_CLOSED_DAY, type ReplyContext } from "./compose-reply.ts";
import { decideEnquiry } from "./decide.ts";
import { readBusinessDetails } from "./business-details-read.ts";
import { describeDetail, type BusinessDetail } from "./business-detail.ts";
import { rankServices, suggestService } from "./service-match.ts";
import { readQuantityFromMessage } from "./quantity-reader.ts";
import { readCustomerAsks } from "./customer-asks.ts";
import { applyRules } from "./rule-checks.ts";
import { updateEditFigures, describeChange } from "./edit-figures.ts";
import { readExtraRequests } from "./extras.ts";
import { contextMentions, roleLabel } from "./date-roles.ts";
import { jobDateCue } from "./time-cues.ts";

/**
 * Trust pass 8: the independent review of main 9c64cc8. Every repro here is
 * one the reviewer hit; the reply-affecting ones are proven again through the
 * send path in `src/lib/repo/trust-pass8.db.test.ts`.
 */

const WED_30_SEP = new Date("2026-09-30T10:15:00+10:00");

// 1. Dates and their roles ------------------------------------------------

test("1b/7: 'the day before (29/10)' settlement is a deadline, never context, never 'No date given'", () => {
  const read = readDates(
    "Hi, settlement is 30/10 so we need a vacate clean the day before (29/10). House is 5 bedrooms.",
    WED_30_SEP,
  );
  assert.equal(read.jobDate?.iso, "2026-10-29");
  assert.equal(read.jobDate?.role, "deadline");
  assert.equal(read.jobDate?.what, "settlement");
  assert.deepEqual(
    read.context.map((d) => [d.iso, d.role, d.what]),
    [["2026-10-30", "context", "settlement"]],
  );
  assert.equal(
    roleLabel(read.jobDate?.role, read.jobDate?.what, read.jobDate!.label),
    "Deadline Thu 29 Oct",
  );
});

test("1c: 'fri 16th oct b4 inspection sat' is the job by Friday, the inspection Saturday", () => {
  const read = readDates(
    "end of lease clean 3 bed 2 bath in Chermside, need it done fri 16th oct b4 inspection sat. also oven pls.",
    WED_30_SEP,
  );
  assert.equal(read.jobDate?.iso, "2026-10-16");
  assert.equal(read.jobDate?.role, "deadline");
  assert.deepEqual(
    read.context.map((d) => [d.iso, d.role, d.what]),
    [["2026-10-17", "context", "inspection"]],
  );
});

test("1a/7: a Sunday wedding is the event day; the trial is its own day, never the job's", () => {
  const read = readDates(
    "Hi! Wedding is Sunday 8 November, ceremony 2pm at Maleny. Need bridal makeup for bride + mum + 2 bridesmaids. Are you insured? Also can you do a trial on 24 October? Chloe",
    WED_30_SEP,
  );
  assert.equal(read.jobDate?.iso, "2026-11-08");
  assert.equal(read.jobDate?.role, "event");
  assert.equal(read.jobDate?.what, "wedding");
  assert.deepEqual(
    read.context.map((d) => [d.iso, d.role]),
    [["2026-10-24", "trial"]],
  );
  assert.equal(roleLabel("event", "wedding", read.jobDate!.label), "Wedding Sun 8 Nov");
  // The row says what the day is for, never "Asked for Sat 24 Oct".
  assert.equal(jobDateCue({ dateLabel: "Wedding Sun 8 Nov", facts: [] }), "Wedding Sun 8 Nov");
});

test("1d: a trial 'in December' is the whole month, read with its role", () => {
  const read = readDates(
    "I'm getting married on Saturday 2 January 2027 in Samford. Could we also book a trial in December?",
    WED_30_SEP,
  );
  assert.equal(read.jobDate?.iso, "2027-01-02");
  assert.equal(read.jobDate?.role, "event");
  const trial = read.context.find((d) => d.role === "trial");
  assert.equal(trial?.iso, "2026-12-01");
  assert.equal(trial?.to, "2026-12-31");
});

test("1g: 'tmrw' is stored as the day itself, so no reply ever says 'tomorrow' after midnight", () => {
  const read = readDates("gel nails tmrw for 3 of us?? how much all up", WED_30_SEP);
  assert.equal(read.jobDate?.iso, "2026-10-01");
  assert.equal(read.jobDate?.span, "Thursday 1 October");
  const arvo = readDates("can you come tomorrow arvo", WED_30_SEP);
  assert.equal(arvo.jobDate?.span, "Thursday 1 October (afternoon)");
});

/** A one-line quote the owner has confirmed covers everything: the reply names its total. */
function priced(service = "Bridal makeup"): ReturnType<typeof decideEnquiry> {
  const brain = {
    knowledge: [
      {
        state: "Active",
        rulePayload: { kind: "fixed_price", service, amount: 180, currency: "AUD" },
      },
    ],
  };
  const facts = [{ field: "service", value: service, status: "confirmed" }];
  const open = decideEnquiry(brain, { serviceLabel: service, facts: facts as never });
  return decideEnquiry(brain, {
    serviceLabel: service,
    facts: [
      ...facts,
      { field: "coverage", value: open.coverage!.key, status: "confirmed" },
    ] as never,
  });
}

const SUNDAYS = { days: [0] };

test("1a/1e: a closed event day is said plainly, the trial gets its own line, and the close never says 'go ahead'", () => {
  const ctx: ReplyContext = {
    jobDateIso: "2026-11-08",
    jobDateSpan: "Sunday 8 November",
    jobDateRole: "event",
    jobDateWhat: "wedding",
    fixedEvent: "wedding",
    closed: SUNDAYS,
    otherDates: contextMentions("2026-10-24~trial~trial"),
  };
  const reply = composeReply(priced(), ctx);
  assert.match(reply, /I'm not available on Sunday 8 November/);
  assert.match(
    reply,
    /For the trial, you mentioned Saturday 24 October - I'll confirm whether that works\./,
  );
  assert.match(reply, new RegExp(CLOSE_CLOSED_DAY.replace(/[.']/g, (c) => `\\${c}`)));
  assert.doesNotMatch(reply, /Just let me know if you'd like to go ahead/);
});

test("1d: a trial in a month partly closed says the closed stretch", () => {
  const ctx: ReplyContext = {
    jobDateIso: "2027-01-02",
    jobDateSpan: "Saturday 2 January 2027",
    jobDateRole: "event",
    jobDateWhat: "wedding",
    fixedEvent: "wedding",
    closed: { days: [0], ranges: [{ from: "12-20", to: "01-05" }] },
    otherDates: contextMentions("2026-12-01..2026-12-31~trial~trial"),
  };
  const reply = composeReply(priced(), ctx);
  assert.match(reply, /I'm not available on Saturday 2 January/);
  assert.match(
    reply,
    /For the trial in December, I'll confirm which day works - I'm not working from 20 December to 5 January\./,
  );
  assert.doesNotMatch(reply, /go ahead/);
});

test("1b: a deadline is acknowledged with what it comes before", () => {
  const ctx: ReplyContext = {
    jobDateIso: "2026-10-29",
    jobDateSpan: "29/10",
    jobDateRole: "deadline",
    jobDateWhat: "settlement",
    otherDates: contextMentions("2026-10-30~context~settlement"),
  };
  const reply = composeReply(priced("End of lease clean"), ctx);
  assert.match(
    reply,
    /I understand you need it done by Thursday 29 October, before settlement on Friday 30 October - I'll confirm whether that works\./,
  );
  assert.match(reply, /Just let me know if you'd like to go ahead and I'll confirm the day\./);
});

test("1f: a day offered instead skips a surcharge day and is never presented as free", () => {
  const ctx: ReplyContext = {
    jobDateIso: "2026-10-23",
    jobDateSpan: "Friday 23 October",
    closed: { days: [0], ranges: [{ from: "10-23", to: "10-23", year: 2026 }] },
    surchargeDays: [0, 6],
  };
  const reply = composeReply(priced("Interior painting"), ctx);
  assert.match(
    reply,
    /I'm not available on Friday 23 October\. If another day suits, I could look at Monday 26 October - I'll confirm it's free\./,
  );
  assert.doesNotMatch(reply, /Would Saturday 24 October suit instead\?/);
  // When every near day costs more, it is said.
  const all = composeReply(priced("Interior painting"), {
    ...ctx,
    surchargeDays: [1, 2, 3, 4, 5, 6],
  });
  assert.match(all, /jobs cost more\) - I'll confirm it's free\./);
});

test("1: a day only mentioned ('Thurs 8th Oct if poss', 'Preferred date: 14/10/2026') still gets its line", () => {
  const reply = composeReply(priced("Regular house clean"), {
    jobDateIso: "2026-10-14",
    jobDateSpan: "14/10/2026",
    jobDateConfirmed: false,
  });
  assert.match(reply, /You mentioned Wednesday 14 October - I'll confirm whether that works\./);
});

// 3. Counts ---------------------------------------------------------------

test("3: people and hours are read the way people write them", () => {
  const cases: [string, string, string | undefined][] = [
    ["bridal makeup for me plus 3 bridesmaids (4 of us total)", "people", "4"],
    ["gel nails tmrw for 3 of us??", "people", "3"],
    ["could i book gel mani for me n my sister (2 ppl) this sat 3rd?", "people", "2"],
    ["Need bridal makeup for bride + mum + 2 bridesmaids.", "people", "4"],
    ["4 hrs prob. Thurs 8th Oct if poss.", "hours", "4"],
    ["Probably 3 hours each time?", "hours", "3"],
    ["Name: Sandra\nBedrooms: 2\nPets: no", "bedrooms", "2"],
    ["cleaning for me and the kitchen", "people", undefined],
  ];
  for (const [text, field, want] of cases) {
    assert.equal(readQuantityFromMessage(text, field)?.value, want, text);
  }
  // A hedge after the count is kept in their words, so the reply says "about".
  assert.equal(readQuantityFromMessage("4 hrs prob.", "hours")?.span, "4 hrs prob");
  assert.equal(readQuantityFromMessage("4 hrs prob.", "hours")?.approximate, true);
});

test("3: '5 bedrooms' is the house, '4 bedrooms upstairs' the carpets", () => {
  const text =
    "we need a vacate clean the day before (29/10). House is 5 bedrooms. Could you also steam clean carpets in the 4 bedrooms upstairs?";
  const main = readQuantityFromMessage(text, "bedrooms", "bedroom", {
    service: "End of lease clean",
    others: ["Carpet steam cleaning"],
  });
  assert.equal(main?.value, "5");
  const carpets = readQuantityFromMessage(text, "rooms for carpet steam cleaning", "room", {
    service: "Carpet steam cleaning",
    others: ["End of lease clean"],
  });
  assert.equal(carpets?.value, "4");
});

test("3: two people against a flat price is asked, never priced as one", () => {
  const brain = {
    knowledge: [
      {
        state: "Active",
        rulePayload: { kind: "fixed_price", service: "Gel manicure", amount: 55, currency: "AUD" },
      },
    ],
  };
  const message = "hiya could i book gel mani for me n my sister (2 ppl) this sat 3rd? ta, Brooke";
  const base = [{ field: "service", value: "Gel manicure", status: "confirmed" }];
  const open = decideEnquiry(brain, {
    serviceLabel: "Gel manicure",
    facts: base as never,
    messageText: message,
  });
  const flag = open.coverage?.flagged.find((f) => f.check?.kind === "headcount");
  assert.equal(flag?.text, "They mention 2 people - your gel manicure price is per booking");
  assert.deepEqual(
    flag?.check?.choices.map((c) => c[0]),
    ["apply", "waive"],
  );
  assert.equal(open.coverage?.confirmed, false);
  const each = decideEnquiry(brain, {
    serviceLabel: "Gel manicure",
    facts: [...base, { field: flag!.thing!, value: "apply", status: "confirmed" }] as never,
    messageText: message,
  });
  assert.equal(each.price.kind === "EXACT" ? each.price.amountMinor : 0, 11000);
  assert.equal(each.lines?.[0]?.detail, "2 people at $55 each");
});

// 2. Everything they asked -----------------------------------------------

test("2: instructions, what the price includes, a counter-offer and 'is there a discount?' are all asks", () => {
  const read = (t: string) => readCustomerAsks(t).map((a) => a.topic);
  assert.deepEqual(read("And please confirm you are insured. Doyle"), ["insurance"]);
  assert.deepEqual(read("Also, is the price including paint? When's your earliest?"), [
    "inclusions",
    "availability",
  ]);
  assert.deepEqual(read("Not sure of the size. Could you do it for $500?"), ["offer"]);
  assert.deepEqual(read("(I'm a pensioner, is there a discount?)"), ["discount"]);
});

test("2/4: a not-offered thing they ask for without a question is read as No for the owner", async () => {
  const { readServiceQuestions } = await import("./service-questions.ts");
  const q = readServiceQuestions(
    "Hi, looking to get the outside of the house painted plus the inside of the garage.",
    ["Interior painting"],
    [{ kind: "not_offered", service: "exterior painting" }],
  );
  assert.equal(q.length, 1);
  assert.equal(q[0]!.thing, "exterior painting");
  assert.equal(q[0]!.notOffered, true);
  assert.equal(q[0]!.requested, true);
});

// 6. Owner sentences -------------------------------------------------------

test("6: every line ends in exactly one place: saved, a note offered, or could not read", () => {
  const lines = [
    "10% off for pensioners",
    "Pensioners get 10% off",
    "Weekend jobs have a $50 surcharge. 10% off for pensioners",
    "Oven clean is an extra $60 each",
    "Minimum job $600",
    "Mon-Sat 7am-5pm",
    "We have $20 million public liability insurance",
    "We bring our own equipment",
    "Extra charge $50",
  ];
  const read = readBusinessDetails(lines.join("\n"), WED_30_SEP);
  const placed = [
    ...read.prices.map((p) => p.line),
    ...read.details.map((d) => d.line),
    ...read.unread.map((u) => u.line),
  ];
  // "Weekend ... surcharge. 10% off for pensioners" is two lines, each placed once.
  const expected = lines.flatMap((l) =>
    l.startsWith("Weekend")
      ? ["Weekend jobs have a $50 surcharge.", "10% off for pensioners"]
      : [l],
  );
  assert.deepEqual([...placed].sort(), [...expected].sort());
});

test("6: pensioners, weekend surcharge, oven per oven, minimum scope, hours and saved answers", () => {
  const read = readBusinessDetails(
    [
      "10% off for pensioners",
      "Pensioners get 10% off",
      "Weekend jobs have a $50 surcharge",
      "Oven clean is an extra $60 each",
      "Minimum job $600",
      "Minimum $600 on every job",
      "Mon-Sat 7am-5pm",
      "We have $20 million public liability insurance",
      "We bring our own equipment",
    ].join("\n"),
    WED_30_SEP,
  );
  const details = read.details.map((d) => d.detail);
  const find = <K extends BusinessDetail["kind"]>(kind: K) =>
    details.filter((d): d is Extract<BusinessDetail, { kind: K }> => d.kind === kind);
  assert.deepEqual(
    find("discount").map((d) => [d.percent, d.condition]),
    [
      [10, "pensioners"],
      [10, "pensioners"],
    ],
  );
  const [fee] = find("fee");
  assert.equal(fee?.label, "Weekend surcharge");
  assert.deepEqual(fee?.days, [0, 6]);
  assert.equal(read.prices[0]?.rule.service, "Oven clean");
  assert.equal(read.prices[0]?.rule.kind === "per_unit" && read.prices[0].rule.unit, "oven");
  // Said with painting, never on a manicure: kept as a note until "every job".
  assert.ok(read.unread.some((u) => u.line === "Minimum job $600" && u.note));
  assert.deepEqual(
    find("minimum_charge").map((d) => [d.amount, d.service]),
    [[600, undefined]],
  );
  const [hours] = find("working_hours");
  assert.deepEqual(
    [hours?.workingDays, hours?.hoursStart, hours?.hoursEnd],
    ["Monday to Saturday", "07:00", "17:00"],
  );
  const answers = find("answer");
  assert.deepEqual(
    answers.map((a) => a.topic),
    ["insurance", "equipment"],
  );
  assert.match(describeDetail(answers[0]!), /^Saved as an answer for: insurance/);
});

test("6: 'Extra charge $50' with no reason is refused, and a stored one never names itself to a customer", () => {
  const read = readBusinessDetails("Extra charge $50", WED_30_SEP);
  assert.equal(read.details.length, 0);
  assert.equal(read.unread[0]?.note, undefined);
  const ruled = applyRules({
    details: [{ kind: "fee", amount: 50, label: "Extra charge", text: "Extra charge $50" }],
    lines: [{ label: "Oven clean", amountMinor: 6000 }],
    message: "oven please",
    jobDates: [],
    facts: [],
  });
  assert.deepEqual(
    ruled.open[0]?.choices.map((c) => c[0]),
    ["waive"],
  );
});

test("6: a weekend surcharge is only asked about for a weekend job; a pensioner discount only when mentioned", () => {
  const weekend: BusinessDetail = {
    kind: "fee",
    amount: 50,
    label: "Weekend surcharge",
    text: "Weekend jobs have a $50 surcharge",
    days: [0, 6],
  };
  const friday = applyRules({
    details: [weekend],
    lines: [{ label: "End of lease clean", amountMinor: 45000 }],
    message: "",
    jobDates: ["2026-10-16"],
    facts: [],
  });
  assert.equal(friday.open.length, 0);
  const saturday = applyRules({
    details: [weekend],
    lines: [{ label: "End of lease clean", amountMinor: 45000 }],
    message: "",
    jobDates: ["2026-10-17"],
    facts: [],
  });
  assert.equal(saturday.open.length, 1);
  const pension: BusinessDetail = {
    kind: "discount",
    percent: 10,
    condition: "pensioners",
    text: "10% off for pensioners",
  };
  const quiet = applyRules({
    details: [pension],
    lines: [{ label: "Carpet steam cleaning", amountMinor: 12000 }],
    message: "2 bedrooms please",
    jobDates: [],
    facts: [],
  });
  assert.equal(quiet.open.length, 0);
  const asked = applyRules({
    details: [pension],
    lines: [{ label: "Carpet steam cleaning", amountMinor: 12000 }],
    message: "I'm a pensioner, is there a discount?",
    jobDates: [],
    facts: [],
  });
  assert.match(asked.open[0]?.text ?? "", /\$120 becomes \$108/);
});

// 8. Service suggestions ---------------------------------------------------

const MIXED = [
  "Regular house clean",
  "End of lease clean",
  "Oven clean",
  "Carpet steam cleaning",
  "Interior painting",
  "Ceilings",
  "Bridal makeup",
  "Makeup trial",
  "Gel manicure",
  "Lash lift",
];

test("8: suggestions stay in the message's trade and prefer what they asked for first", () => {
  // A cleaning message never has the painting service "Ceilings" picked for it.
  assert.notEqual(
    suggestService(
      "Hi, bathroom has black mould on the ceiling, can u clean that + do a regular clean of the rest?",
      MIXED,
    ),
    "Ceilings",
  );
  assert.ok(
    !rankServices("Hi, bathroom has black mould on the ceiling, can u clean that?", MIXED)
      .slice(0, 3)
      .includes("Ceilings"),
  );
  const painting = rankServices(
    "Hi, we need the lounge painted, maybe 90sqm of walls, and the ceilings maybe 35sqm?",
    MIXED,
  ).slice(0, 3);
  assert.ok(!painting.includes("Bridal makeup") && !painting.includes("Carpet steam cleaning"));
  const wedding = rankServices(
    "I'm getting married and would love bridal makeup for me plus 3 bridesmaids",
    MIXED,
  ).slice(0, 3);
  assert.ok(!wedding.includes("Carpet steam cleaning"));
  assert.equal(
    suggestService(
      "hiya could i book gel mani for me n my sister (2 ppl) this sat 3rd? also how much is lash lift?",
      MIXED,
    ),
    "Gel manicure",
  );
  assert.equal(
    suggestService("settlement is 30/10 so we need a vacate clean the day before", MIXED),
    "End of lease clean",
  );
});

test("8: a painting service is never read as an extra on a cleaning message; a form's extras list is", () => {
  assert.deepEqual(
    readExtraRequests(
      "bathroom has black mould on the ceiling, can u clean that + do a regular clean of the rest?",
      "Regular house clean",
      MIXED,
    ).map((e) => e.label),
    [],
  );
  assert.deepEqual(
    readExtraRequests(
      "Name: Sandra\nBedrooms: 2\nExtras: Oven, Carpets (2 rooms)\nPets: no",
      "End of lease clean",
      MIXED,
    ).map((e) => e.label),
    ["Oven clean", "Carpet steam cleaning"],
  );
});

// 5. Keep my edit -----------------------------------------------------------

test("5: a kept edit keeps its words; only the figures that moved change, and each change is said", () => {
  const edit = [
    "Hi Chloe,",
    "",
    "Lovely to hear from you.",
    "",
    "For the bridal makeup (4 people) and the makeup trial, that comes to $810:",
    "- Bridal makeup: $720 (4 people at $180 each)",
    "- Makeup trial: $90",
    "",
    "We have $20 million public liability insurance.",
  ].join("\n");
  const { body, changes } = updateEditFigures(
    edit,
    [
      { label: "Bridal makeup", amountMinor: 72000, detail: "4 people at $180 each" },
      { label: "Makeup trial", amountMinor: 9500 },
    ],
    81500,
  );
  assert.match(body, /^Hi Chloe,\n\nLovely to hear from you\./);
  assert.match(body, /- Makeup trial: \$95/);
  assert.match(body, /that comes to \$815:/);
  assert.match(body, /\$20 million public liability/);
  assert.deepEqual(changes.map(describeChange), ["Makeup trial $90 -> $95", "Total $810 -> $815"]);
});
