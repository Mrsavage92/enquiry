import assert from "node:assert/strict";
import test from "node:test";
import { decideEnquiry } from "./decide.ts";
import { decideConfirmed } from "./coverage-testing.ts";
import { composeReply } from "./compose-reply.ts";
import { readDates, readCustomerName } from "./enquiry-basics.ts";
import { replyContextFromFacts, type ReplyFact } from "./reply-context.ts";
import { closedTimesOf, minimumClash, type BusinessDetail } from "./business-detail.ts";
import { readBusinessDetails } from "./business-details-read.ts";
import { unsettledFlags } from "./coverage.ts";
import { questionField } from "./service-questions.ts";
import { rankServices, suggestService } from "./service-match.ts";
import { RULE_CHOICE } from "./rule-checks.ts";

/** Review of PR #72 (FIX FIRST): every repro it names is a test here. */

const NOW = new Date("2026-09-27T10:00:00+10:00");
const fact = (field: string, value: string, status = "confirmed", extra: object = {}) => ({
  field,
  value,
  status,
  ...extra,
});
const brain = (...items: unknown[]) => ({
  knowledge: items.map((rulePayload) => ({ state: "Active", rulePayload })),
});
const INTERIOR = {
  kind: "per_unit",
  service: "Interior painting",
  amount: 30,
  currency: "AUD",
  unit: "square metre",
  quantityField: "square metres",
};
const OVEN = { kind: "fixed_price", service: "Oven clean", amount: 90, currency: "AUD" };
const TRAVEL: BusinessDetail = {
  kind: "fee",
  amount: 40,
  label: "Travel fee",
  text: "Travel fee $40",
};
const MIN450: BusinessDetail = { kind: "minimum_charge", amount: 450 };
const SAT20: BusinessDetail = { kind: "surcharge", percent: 20, days: [6] };
const SUNDAYS: BusinessDetail = { kind: "closed_days", days: [0] };
const XMAS: BusinessDetail = { kind: "closed_dates", from: "12-20", to: "01-05" };

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]),
  );
}

/** Every open rule applied, the way the owner taps "Apply" on each. */
function allApplied(items: unknown[], serviceLabel: string, facts: object[], message: string) {
  let all = [...facts];
  for (let i = 0; i < 6; i += 1) {
    const d = decideEnquiry(brain(...items), {
      serviceLabel,
      facts: all as never,
      messageText: message,
    });
    const open = unsettledFlags(d.coverage?.flagged ?? []).filter((f) => f.kind === "rule");
    if (open.length === 0) break;
    all = [...all, ...open.map((f) => fact(f.check!.field, RULE_CHOICE.apply))];
  }
  return decideConfirmed(brain(...items), {
    serviceLabel,
    facts: all as never,
    messageText: message,
  });
}

// C1 ----------------------------------------------------------------------------

test("C1: minimum, surcharge and fee give one total whatever order they were saved in", () => {
  const facts = [
    fact("service", "Interior painting"),
    fact("square metres", "14"),
    fact("date", "2026-10-03", "inferred", { date_asked: true, date_span: "Saturday" }),
  ];
  const totals = new Set<number>();
  for (const order of permutations<unknown>([MIN450, SAT20, TRAVEL])) {
    const d = allApplied([INTERIOR, ...order], "Interior painting", facts, "Saturday please");
    assert.equal(d.price.kind, "EXACT");
    if (d.price.kind !== "EXACT") continue;
    totals.add(d.price.amountMinor);
    for (const l of d.lines ?? []) assert.ok(l.amountMinor > 0, `${l.label} ${l.amountMinor}`);
    for (const n of d.price.alsoImplied ?? []) assert.ok(n > 0, `implied ${n}`);
    const reply = composeReply(d, {});
    assert.doesNotMatch(reply, /-\$|top-up/);
    // $420 lifted to $450, Saturday 20% of $450 = $90, travel $40.
    assert.match(reply, /Saturday rate \(20% of \$450\): \$90/);
  }
  assert.deepEqual([...totals], [58000]);
});

test("C1: a fee saved before the minimum never makes a negative top-up", () => {
  const facts = [fact("service", "Interior painting"), fact("square metres", "14")];
  for (const order of permutations<unknown>([TRAVEL, MIN450])) {
    const d = allApplied([INTERIOR, ...order], "Interior painting", facts, "Lounge");
    assert.equal(d.price.kind === "EXACT" && d.price.amountMinor, 49000);
    assert.doesNotMatch(composeReply(d, {}), /-\$10/);
  }
});

// H1 ----------------------------------------------------------------------------

test("H1: two general minimums never share one tap; the highest stands, text is clean", () => {
  const facts = [fact("service", "Interior painting"), fact("square metres", "10")];
  const low: BusinessDetail = { kind: "minimum_charge", amount: 300 };
  const open = decideEnquiry(brain(INTERIOR, low, MIN450), {
    serviceLabel: "Interior painting",
    facts: facts as never,
    messageText: "One room",
  });
  const rules = unsettledFlags(open.coverage!.flagged).filter((f) => f.kind === "rule");
  assert.equal(rules.length, 1);
  assert.equal(rules[0]!.check!.choices[0]![1], "Apply $450 minimum");
  const d = allApplied([INTERIOR, low, MIN450], "Interior painting", facts, "One room");
  const reply = composeReply(d, {});
  assert.match(
    reply,
    /that comes to \$450 \(minimum charge - 10 square metres at \$30 each comes to \$300\)/,
  );
  assert.doesNotMatch(reply, /minimum charge - minimum charge/);
  assert.match(minimumClash(low, [MIN450])!, /\$450 minimum .* stays/);
  assert.match(minimumClash(MIN450, [low])!, /Replaces your \$300 minimum/);
});

// H2 ----------------------------------------------------------------------------

test("H2: only the quoted service's own work folds; separate work stays a flag", () => {
  const flags = (items: unknown[], service: string, message: string, extra: object[] = []) =>
    decideEnquiry(brain(...items), {
      serviceLabel: service,
      facts: [fact("service", service), ...extra] as never,
      messageText: message,
    }).coverage!.flagged.map((f) => `${f.kind}:${f.thing ?? f.text}`);
  const sqm = [fact("square metres", "40")];
  assert.deepEqual(
    flags(
      [INTERIOR],
      "Interior painting",
      "Paint the lounge walls, and also the eaves and facade outside",
      sqm,
    ),
    ["mention:eaves", "mention:facade", "included:Included in interior painting: walls"],
  );
  const fence = { kind: "fixed_price", service: "Fence painting", amount: 500, currency: "AUD" };
  const f = flags([fence], "Fence painting", "Paint the fence, and the house walls, garage doors");
  assert.ok(!f.some((x) => x.startsWith("included")), f.join());
  const o = flags([OVEN], "Oven clean", "Oven clean please, and the cupboards and ceiling fans");
  assert.ok(!o.some((x) => x.startsWith("included")), o.join());
});

// H3 ----------------------------------------------------------------------------

test("H3: a price line is never read as a fee", () => {
  for (const [line, service, amount] of [
    ["Rubbish removal $150", "Rubbish removal", 150],
    ["Tip run $120", "Tip run", 120],
    ["End of lease clean $350 including parking", "End of lease clean", 350],
  ] as const) {
    const r = readBusinessDetails(line);
    assert.equal(r.prices[0]?.rule.service, service, line);
    assert.equal(r.prices[0]?.rule.amount, amount, line);
    assert.ok(!r.details.some((d) => d.detail.kind === "fee"), line);
  }
  assert.equal(
    readBusinessDetails("Travel fee $40 outside Brisbane").details[0]?.detail.kind,
    "fee",
  );
});

// H4 ----------------------------------------------------------------------------

function replyFor(items: unknown[], service: string, facts: ReplyFact[], message: string) {
  const d = decideConfirmed(brain(...items), {
    serviceLabel: service,
    facts: facts as never,
    messageText: message,
  });
  const details = items.filter(
    (i) => (i as { kind: string }).kind !== "per_unit",
  ) as BusinessDetail[];
  return {
    d,
    reply: composeReply(
      d,
      replyContextFromFacts(facts, { customerName: "", closed: closedTimesOf(details) }),
    ),
  };
}

function dateFacts(text: string): ReplyFact[] {
  const r = readDates(text, NOW);
  if (r.jobDate) {
    return [
      {
        field: "date",
        value: r.jobDate.iso,
        status: "inferred",
        date_asked: r.jobDate.asked,
        date_span: r.jobDate.span,
      },
    ];
  }
  if (r.options) {
    return [
      {
        field: "date",
        value: r.options.days.map((x) => x.iso).join("|"),
        status: "inferred",
        date_asked: r.options.days.some((x) => x.asked),
        date_span: r.options.span,
      },
    ];
  }
  return [];
}

test("H4: a day only mentioned in the closed dates is still said, and the flag is true", () => {
  const message = "Hi, need the lounge painted, 10sqm, on the 22nd of December";
  const facts = [
    fact("service", "Interior painting"),
    fact("square metres", "10"),
    ...dateFacts(message),
  ];
  const { d, reply } = replyFor([INTERIOR, XMAS], "Interior painting", facts, message);
  assert.match(
    reply,
    /You mentioned 22nd of December - I'm not working from 20 December to 5 January\. Would Wednesday 6 January suit instead\?/,
  );
  const flag = decideEnquiry(brain(INTERIOR, XMAS), {
    serviceLabel: "Interior painting",
    facts: facts as never,
    messageText: message,
  }).coverage!.flagged.find((f) => f.kind === "closed_day");
  assert.equal(
    flag?.text,
    "A day they mentioned is in your closed dates (20 December to 5 January) - the reply says so",
  );
  assert.equal(d.action, "SEND_QUOTE");
  const two = "Mon 21 Dec or Tue 22 Dec please, 10sqm lounge";
  const r2 = replyFor(
    [INTERIOR, XMAS],
    "Interior painting",
    [fact("service", "Interior painting"), fact("square metres", "10"), ...dateFacts(two)],
    two,
  ).reply;
  assert.match(
    r2,
    /Monday 21 December or Tuesday 22 December - I'm not working from 20 December to 5 January\. Would Wednesday 6 January suit instead\?/,
  );
});

// H5 ----------------------------------------------------------------------------

test("H5: a No declines only a message that is nothing but the question", () => {
  const decide = (message: string, things = ["pressure washing"]) =>
    decideEnquiry(brain(INTERIOR), {
      serviceLabel: "",
      facts: things.map((t) => fact(questionField(t), "no")) as never,
      messageText: message,
      services: ["Interior painting"],
    });
  assert.equal(decide("Do you do pressure washing? Driveway only.").action, "DECLINE");
  for (const message of [
    "Do you do pressure washing? Also keen to get the lounge room freshened up, about 20sqm.",
    "Do you do pressure washing? And could you do the lounge walls too?",
    "Do you do pressure washing and painting?",
    "Do you do pressure washing? If so, can you quote the house as well",
  ]) {
    const d = decide(message);
    assert.notEqual(d.action, "DECLINE", message);
    assert.match(composeReply(d, {}), /Sorry, I don't do pressure washing\./, message);
  }
});

// H6 ----------------------------------------------------------------------------

test("H6: negations are never rules; a line with two rules keeps both", () => {
  const kinds = (line: string) => readBusinessDetails(line).details.map((d) => d.detail);
  assert.deepEqual(kinds("Open through the Christmas break 20 Dec - 5 Jan"), []);
  assert.deepEqual(kinds("Not closed 20 Dec to 5 Jan this year"), []);
  assert.deepEqual(kinds("No Saturday surcharge, 20% more after 5pm"), []);
  assert.equal(
    readBusinessDetails("No Saturday surcharge, 20% more after 5pm").unread[0]?.note,
    true,
  );
  assert.deepEqual(kinds("Saturdays are 20% more, Sundays are 50% more"), [
    { kind: "surcharge", percent: 20, days: [6] },
    { kind: "surcharge", percent: 50, days: [0] },
  ]);
  assert.deepEqual(kinds("Saturdays 20% more, 25/12 to 26/12 closed"), [
    { kind: "surcharge", percent: 20, days: [6] },
    { kind: "closed_dates", from: "12-25", to: "12-26" },
  ]);
});

// M1 / M5 -----------------------------------------------------------------------

test("M5: several days offered, one a Saturday: the rate is said, never added", () => {
  const message = "Could you do Sat 3 Oct or Mon 5 Oct?";
  const facts = [fact("service", "Oven clean"), ...dateFacts(message)];
  const { d, reply } = replyFor([OVEN, SAT20], "Oven clean", facts, message);
  assert.equal(d.price.kind === "EXACT" && d.price.amountMinor, 9000);
  assert.match(reply, /Just so you know, Saturdays are 20% more\./);
});

// M2 ----------------------------------------------------------------------------

test("M2: 'sundays pref' with Sundays closed says so", () => {
  const ctx = replyContextFromFacts([fact("day_preference", "Sundays")], {
    customerName: "",
    closed: { days: [0] },
  });
  const d = decideEnquiry(brain(INTERIOR), { serviceLabel: "", facts: [] as never });
  assert.match(composeReply(d, ctx), /You mentioned you'd prefer Sundays - I don't work Sundays/);
});

// M3 ----------------------------------------------------------------------------

test("M3: their own second choice is offered, not a day they did not name", () => {
  const message = "Could you do Sun 11 Oct or Sat 17 Oct?";
  const { reply } = replyFor(
    [OVEN, SUNDAYS],
    "Oven clean",
    [fact("service", "Oven clean"), ...dateFacts(message)],
    message,
  );
  assert.match(
    reply,
    /Sunday 11 October or Saturday 17 October - I don't work Sundays, so would Saturday 17 October suit\?/,
  );
  assert.deepEqual(
    readDates("Sunday 11/10 or Monday 12/10?", NOW).options?.days.map((x) => x.iso),
    ["2026-10-11", "2026-10-12"],
  );
});

// M4 ----------------------------------------------------------------------------

test("M4: what they do not want and a more specific service rank right", () => {
  const S = ["Interior painting", "Exterior painting", "Fence painting", "Deck staining"];
  assert.equal(
    rankServices("Need the outside of the house painted, inside is fine", S)[0],
    "Exterior painting",
  );
  assert.equal(
    suggestService("Need the outside of the house painted, inside is fine", S),
    "Exterior painting",
  );
  assert.equal(rankServices("Paint the fence outside", S)[0], "Fence painting");
  assert.equal(suggestService("Paint the fence outside", S), "Fence painting");
});

// LOW and leftovers -------------------------------------------------------------

test("LOW: 'Cash only for jobs' is a note, not an eligibility rule", () => {
  const r = readBusinessDetails("Cash only for jobs");
  assert.equal(r.details.length, 0);
  assert.equal(r.unread[0]?.note, true);
});

test("Leftovers: names behind emoji, sign-offs and signature dashes; non-names refused", () => {
  const dash = String.fromCharCode(0x2014);
  assert.equal(readCustomerName("pls this Sunday 4th? or 20/10 if not \u{1F60A} Bec"), "Bec");
  assert.equal(readCustomerName("Measure-up Sunday?\n\nThanks,\nJan Whitfield"), "Jan Whitfield");
  assert.equal(readCustomerName("Measure-up Sunday?\n\nThanks\nJan"), "Jan");
  assert.equal(readCustomerName("Quote please.\n\nSarah \u{1F642}\nSent from my iPad"), "Sarah");
  assert.equal(
    readCustomerName(`Leaking tap.\n\n${dash} Dave | Dave's Plumbing | 0400 000 000`),
    "Dave",
  );
  for (const not of ["Brisbane", "Monday", "Kitchen", "Urgent", "ASAP"]) {
    assert.equal(
      readCustomerName(`Can you help?\n\nThanks,\n${not}`, { place: "Brisbane" }),
      undefined,
      not,
    );
  }
});

test("Leftovers: a No keeps the owner's verb", () => {
  const roofs = { kind: "not_offered", service: "roofs", verb: "paint" };
  const d = decideConfirmed(brain(INTERIOR, roofs), {
    serviceLabel: "Interior painting",
    facts: [
      fact("service", "Interior painting"),
      fact("square metres", "40"),
      fact(questionField("roofs"), "no"),
    ] as never,
    messageText: "Paint the inside please. Do you paint roofs?",
  });
  assert.match(composeReply(d, {}), /Sorry, I don't paint roofs\./);
});

test("Leftovers: a rough count confirmed stays rough in the reply", () => {
  const d = decideConfirmed(brain(INTERIOR), {
    serviceLabel: "Interior painting",
    facts: [
      fact("service", "Interior painting"),
      fact("square metres", "12", "confirmed", { displayValue: "about 12" }),
    ] as never,
    messageText: "maybe 12sqm",
  });
  const reply = composeReply(d, {});
  assert.match(
    reply,
    /that comes to about \$360, I'll confirm once I've seen the job \(about 12 square metres at \$30 each, please confirm the size\)/,
  );
});

test("H3: 'Add a price for this job' returns only when that job's price saved", async () => {
  const { pricedTheJob } = await import("./next-action.ts");
  assert.equal(pricedTheJob([{ service: "Gutter cleaning" }], "Gutter cleaning"), true);
  assert.equal(pricedTheJob([{ service: "Rubbish removal" }], "Gutter cleaning"), false);
  assert.equal(pricedTheJob([], "Gutter cleaning"), false);
});
