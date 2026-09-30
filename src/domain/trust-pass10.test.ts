import assert from "node:assert/strict";
import test from "node:test";
import { decideEnquiry } from "./decide.ts";
import { snapshotFromDecision } from "./decision-snapshot.ts";
import { askedLedger, readableAsked, type AskedItem } from "./asked.ts";
import { dollarMatches } from "./voice-detect.ts";
import type { ReplyContext } from "./compose-reply.ts";
import {
  INSURANCE_AS_ANSWER,
  amountAgrees,
  mismatchMessage,
} from "../lib/repo/reviewed-send-core.ts";

/**
 * Trust pass 10: three reply-logic problems found walking the app, the send
 * gate misreading "$90 million", and the independent review of the first fix.
 * The reply-affecting repros are proven again through the send path in
 * `src/lib/repo/trust-pass10.db.test.ts`.
 */

const fixed = (service: string, amount: number) => ({
  state: "Active",
  rulePayload: { kind: "fixed_price", service, amount, currency: "AUD" },
});

type Fact = { field: string; value: string; status: string };

/** Decide, then decide again with "That's everything" tapped for exactly these facts. */
function confirmed(
  brain: { knowledge: unknown[] },
  serviceLabel: string,
  facts: Fact[],
  reply?: ReplyContext,
) {
  const open = decideEnquiry(brain as never, { serviceLabel, facts: facts as never, reply });
  if (!open.coverage) return open;
  return decideEnquiry(brain as never, {
    serviceLabel,
    facts: [
      ...facts,
      { field: "coverage", value: open.coverage.key, status: "confirmed" },
    ] as never,
    reply,
  });
}

// 1 / HIGH-2. A priced thing is never also one the reply "comes back" on - and
// a different thing is never mistaken for it.

const BRIDAL = { knowledge: [fixed("Bridal makeup", 250), fixed("Makeup trial", 90)] };

function trialQuote(question: "yes" | "later") {
  return confirmed(BRIDAL, "Bridal makeup", [
    { field: "service", value: "Bridal makeup", status: "confirmed" },
    { field: "extra:Makeup trial", value: "include", status: "confirmed" },
    { field: "question:trial", value: question, status: "confirmed" },
  ]);
}

test("1: 'can you do a trial?' answered Yes or later, the trial on the quote: never 'I'll come back'", () => {
  for (const answer of ["yes", "later"] as const) {
    const d = trialQuote(answer);
    assert.equal(d.action, "SEND_QUOTE");
    assert.equal(d.price.kind === "EXACT" && d.price.amountMinor, 34000);
    assert.doesNotMatch((d.replyNotes ?? []).join("\n"), /come back to you/, answer);
    const body = snapshotFromDecision(d).draft.body;
    assert.match(body, /- Makeup trial: \$90/);
    assert.doesNotMatch(body, /come back to you/);
  }
});

const CLEAN = {
  knowledge: [
    fixed("End of lease clean", 380),
    fixed("Oven racks", 40),
    fixed("Window tracks", 50),
    fixed("Window cleaning", 80),
  ],
};

test("HIGH-2: 'the oven' is not 'Oven racks', 'windows' and 'window cleaning' are not 'Window tracks'", () => {
  const d = confirmed(CLEAN, "End of lease clean", [
    { field: "service", value: "End of lease clean", status: "confirmed" },
    { field: "extra:Oven racks", value: "include", status: "confirmed" },
    { field: "extra:Window tracks", value: "include", status: "confirmed" },
    { field: "extra:Window cleaning", value: "come_back", status: "confirmed" },
    { field: "question:oven", value: "yes", status: "confirmed" },
    { field: "question:windows", value: "later", status: "confirmed" },
    // Round 2: each shares a word with a priced line, so the owner says
    // whether it is the same thing; here, something else.
    { field: "rule:same:oven", value: "waive", status: "confirmed" },
    { field: "rule:same:windows", value: "waive", status: "confirmed" },
  ]);
  assert.equal(d.price.kind === "EXACT" && d.price.amountMinor, 47000);
  assert.deepEqual(d.replyNotes, [
    "I'll come back to you on the window cleaning.",
    "Yes, I can help with oven - I'll come back to you with a price for that.",
    "I'll come back to you on windows.",
  ]);
});

test("1: a Yes about something not on the quote still says the price comes later", () => {
  const d = decideEnquiry(BRIDAL, {
    serviceLabel: "Bridal makeup",
    facts: [
      { field: "service", value: "Bridal makeup", status: "confirmed" },
      { field: "question:hair styling", value: "yes", status: "confirmed" },
    ] as never,
  });
  assert.deepEqual(d.replyNotes, [
    "Yes, I can help with hair styling - I'll come back to you with a price for that.",
  ]);
});

test("M3: 'No, I don't do trials' beside a priced makeup trial is a conflict for the owner, never both in a reply", () => {
  const d = confirmed(BRIDAL, "Bridal makeup", [
    { field: "service", value: "Bridal makeup", status: "confirmed" },
    { field: "extra:Makeup trial", value: "include", status: "confirmed" },
    { field: "question:trial", value: "no", status: "confirmed" },
  ]);
  assert.equal(d.action, "ESCALATE_HUMAN");
  assert.match(d.conflict ?? "", /You said you don't do trial, but makeup trial is on this quote/);
  const snap = snapshotFromDecision(d);
  assert.equal(snap.price, undefined);
  assert.equal(snap.recommendation.primaryEnabled, false);
  assert.equal(snap.recommendation.label, "Settle what's on the quote");
  assert.ok(!(/Sorry, I don't do trial/.test(snap.draft.body) && /\$/.test(snap.draft.body)));
});

// 1 / 2 / HIGH-1 / M1. A wedding day the owner doesn't work -------------------

const SUNDAYS: ReplyContext["closed"] = { days: [0] };

const WEDDING_SUNDAY: ReplyContext = {
  serviceLabel: "Bridal makeup",
  jobDateIso: "2026-11-08",
  jobDateSpan: "Sunday 8 November",
  jobDateConfirmed: false,
  jobDateRole: "event",
  jobDateWhat: "wedding",
  fixedEvent: "wedding",
  closed: SUNDAYS,
};

const WITH_TRIAL: ReplyContext = {
  ...WEDDING_SUNDAY,
  otherDates: [{ iso: "2026-10-24", role: "trial", what: "trial", label: "Sat 24 Oct" }],
};

const BRIDAL_ONLY = [{ field: "service", value: "Bridal makeup", status: "confirmed" }];
const BRIDAL_AND_TRIAL = [
  ...BRIDAL_ONLY,
  { field: "extra:Makeup trial", value: "include", status: "confirmed" },
];

test("1/2: a Sunday wedding with nothing else to book names no price and is Not yet", () => {
  const d = confirmed(BRIDAL, "Bridal makeup", BRIDAL_ONLY, WEDDING_SUNDAY);
  assert.equal(d.action, "REQUEST_INFORMATION");
  assert.deepEqual(d.closedDay, {
    days: ["2026-11-08"],
    held: [{ label: "Bridal makeup", iso: "2026-11-08" }],
    bookable: false,
  });
  const snap = snapshotFromDecision(d, WEDDING_SUNDAY);
  assert.equal(snap.price, undefined, "nothing is recordable");
  assert.deepEqual(snap.impliedAmountsMinor, []);
  assert.doesNotMatch(snap.draft.body, /\$/);
  assert.match(snap.draft.body, /I'm sorry, I'm not available on Sunday 8 November/);
  assert.equal(snap.recommendation.label, "Ask if the date can move");
});

test("HIGH-1/M2: the trial left is priced on its own; old totals and held prices are never implied", () => {
  const d = confirmed(BRIDAL, "Bridal makeup", BRIDAL_AND_TRIAL, WITH_TRIAL);
  assert.equal(d.action, "SEND_QUOTE");
  assert.equal(d.price.kind === "EXACT" && d.price.amountMinor, 9000);
  const snap = snapshotFromDecision(d, WITH_TRIAL);
  assert.deepEqual(snap.impliedAmountsMinor, [9000]);
  assert.match(snap.draft.body, /For the makeup trial, that comes to \$90\./);
  assert.match(
    snap.draft.body,
    /I haven't included the bridal makeup, as I'm not available on Sunday 8 November\./,
  );
});

test("LOW: held work is named with its count, never its price", () => {
  const brain = {
    knowledge: [
      {
        state: "Active",
        rulePayload: {
          kind: "per_unit",
          service: "Bridal makeup",
          amount: 180,
          currency: "AUD",
          unit: "person",
          quantityField: "people",
        },
      },
      fixed("Makeup trial", 90),
    ],
  };
  const d = confirmed(
    brain,
    "Bridal makeup",
    [...BRIDAL_AND_TRIAL, { field: "people", value: "3", status: "confirmed" }],
    WITH_TRIAL,
  );
  const body = snapshotFromDecision(d, WITH_TRIAL).draft.body;
  assert.match(body, /I haven't included the bridal makeup for 3 people, as I'm not available/);
  assert.doesNotMatch(body, /\$540|\$180/);
});

test("M1: the owner confirms exactly what is quoted - held work is on the check, and the key moves with it", () => {
  const facts = BRIDAL_AND_TRIAL;
  const held = decideEnquiry(BRIDAL, {
    serviceLabel: "Bridal makeup",
    facts: facts as never,
    reply: WITH_TRIAL,
  });
  const dayConfirmed = { ...WITH_TRIAL, jobDateConfirmed: true };
  const full = decideEnquiry(BRIDAL, {
    serviceLabel: "Bridal makeup",
    facts: facts as never,
    reply: dayConfirmed,
  });
  assert.ok(
    held.coverage?.flagged.some(
      (f) => f.text === "Not included - closed day: bridal makeup (Sunday 8 November)",
    ),
  );
  assert.deepEqual(
    held.coverage?.lines.map((l) => l.label),
    ["Makeup trial"],
  );
  assert.deepEqual(
    full.coverage?.lines.map((l) => l.label),
    ["Bridal makeup", "Makeup trial"],
  );
  assert.notEqual(held.coverage?.key, full.coverage?.key);
  // A "That's everything" tapped on the held quote does not confirm the full one.
  const tapped = [...facts, { field: "coverage", value: held.coverage!.key, status: "confirmed" }];
  const after = decideEnquiry(BRIDAL, {
    serviceLabel: "Bridal makeup",
    facts: tapped as never,
    reply: dayConfirmed,
  });
  assert.equal(after.coverage?.confirmed, false);
});

test("2: a job that can move, asked for on a closed day, keeps its price; a confirmed day holds nothing", () => {
  const movable = {
    ...WEDDING_SUNDAY,
    jobDateRole: undefined,
    jobDateWhat: undefined,
    fixedEvent: undefined,
  };
  const d = confirmed(BRIDAL, "Bridal makeup", BRIDAL_ONLY, movable);
  assert.deepEqual(d.closedDay, { days: ["2026-11-08"], held: [], bookable: true });
  assert.match(snapshotFromDecision(d, movable).draft.body, /that comes to \$250\./);
  const own = { ...WEDDING_SUNDAY, jobDateConfirmed: true };
  const mine = confirmed(BRIDAL, "Bridal makeup", BRIDAL_ONLY, own);
  assert.equal(mine.closedDay, undefined);
  assert.match(snapshotFromDecision(mine, own).draft.body, /that comes to \$250\./);
});

// 3. The ledger names what they asked, never the owner's answer -----------------

test("3: an answered 'do you do exterior painting?' is 'Exterior painting', answered, declined", () => {
  const items = askedLedger(
    { action: "SEND_QUOTE", price: { kind: "EXACT" } },
    [
      {
        field: "question:exterior painting",
        value: "no",
        status: "confirmed",
        displayValue: "No - you don't do this",
      },
      {
        field: "question:gutter cleaning",
        value: "yes",
        status: "confirmed",
        displayValue: "Yes - you do this",
      },
    ],
    "Interior painting",
  );
  assert.deepEqual(
    items.filter((i) => i.kind === "question"),
    [
      {
        id: "question:exterior painting",
        kind: "question",
        text: "Exterior painting",
        status: "answered",
        declined: true,
      },
      {
        id: "question:gutter cleaning",
        kind: "question",
        text: "Gutter cleaning",
        status: "answered",
      },
    ],
  );
});

test("3: a ledger stored before pass 10 reads as the thing asked about; a bad one never throws", () => {
  const stored: AskedItem[] = [
    {
      id: "question:exterior painting",
      kind: "question",
      text: "No - you don't do this",
      status: "answered",
    },
    { id: "question:trial", kind: "question", text: "Yes - you do this", status: "answered" },
    {
      id: "question:deck",
      kind: "question",
      text: "You'll come back to them on it",
      status: "come_back",
    },
    { id: "ask:insurance", kind: "ask", text: "Are you insured?", status: "answered" },
    { id: "question:", kind: "question", text: "Yes - you do this", status: "answered" },
    { id: "question:roof", kind: "question", text: null as never, status: "answered" },
  ];
  const read = readableAsked(stored)!;
  assert.deepEqual(
    read.map((i) => i.text),
    ["Exterior painting", "Trial", "Deck", "Are you insured?", "Question", "Roof"],
  );
  assert.equal(read[0]!.declined, true, "a stored No is declined");
  assert.equal(read[1]!.declined, undefined);
  for (const bad of [undefined, null, {}, "asked", 3, [null, 7]]) {
    assert.doesNotThrow(() => readableAsked(bad));
  }
  assert.equal(readableAsked({}), undefined);
  assert.deepEqual(readableAsked([null, 7]), []);
});

// 4 / HIGH-3 / round 2. Money in a reply: one rule --------------------------

test("4/M6: money is read in every form a person writes it, at its true value", () => {
  const read = (t: string) => dollarMatches(t).map((m) => m.amount);
  assert.deepEqual(read("$90 million cover"), [90_000_000]);
  assert.deepEqual(read("$20m public liability"), [20_000_000]);
  assert.deepEqual(read("$1.5m"), [1_500_000]);
  assert.deepEqual(read("$2k excess"), [2000]);
  assert.deepEqual(read("$2 thousand"), [2000]);
  assert.deepEqual(read("2 thousand dollars"), [2000]);
  assert.deepEqual(read("That comes to 2 thousand dollars."), [2000]);
  assert.deepEqual(read("That comes to 2 million."), [2_000_000]);
  assert.deepEqual(read("$1,000 thousand"), [1_000_000]);
  assert.deepEqual(read("fifty thousand dollars"), [50_000]);
  assert.deepEqual(read("$250k"), [250_000]);
  assert.deepEqual(read("5 grand"), [5000]);
  assert.deepEqual(read("five grand"), [5000]);
  assert.deepEqual(read("Bridal makeup is 250 if you can move it."), [250]);
  assert.deepEqual(read("Bridal makeup is AUD250."), [250]);
  assert.deepEqual(read("Price: 5000"), [5000]);
  assert.deepEqual(read("Quote: 5000"), [5000]);
  assert.deepEqual(read("That'll be 5000"), [5000]);
  assert.deepEqual(read("5,000 all up"), [5000]);
  for (const t of ["500 euros", "340 NZD", "NZ$340", "US$340", "USD 340", "£500", "€500"]) {
    const m = dollarMatches(t);
    assert.equal(m.length, 1, t);
    assert.equal(m[0]!.foreign, true, t);
  }
});

test("M1/M6: dates, times, counts, phone numbers and ABNs are not money", () => {
  const read = (t: string) => dollarMatches(t).map((m) => m.amount);
  assert.deepEqual(read("Total: 14 October booking, $340"), [340]);
  for (const t of [
    "Call me on 0412 345 678.",
    "Our ABN is 12 345 678 901.",
    "The house is 3 bedrooms.",
    "The wedding is 8 November.",
    "The trial is 24/10.",
    "There are 4 of us.",
    "Start time is 9:30.",
    "Start time is 9am.",
    "That's 3 hours.",
    "The inspection is on the 17th.",
    "It's 20 square metres.",
  ]) {
    assert.deepEqual(read(t), [], t);
  }
});

const PRICE = (amountMinor: number) => ({
  kind: "EXACT" as const,
  amountMinor,
  currency: "AUD" as const,
  workings: "",
  rule: {
    kind: "fixed_price",
    service: "Job",
    amount: amountMinor / 100,
    currency: "AUD",
  } as never,
});

const BASE = "Hi Mia,\n\nFor the makeup trial, that comes to $90.";

/** Every one of these refuses: alone, beside the correct total, and with no quote. */
const REFUSED = [
  // Round 1.
  "Price: $5,000 insurance included.",
  "Quote: $2m.",
  "that'll be $5m",
  "You'll pay $5m",
  "Wedding package - $5.5m",
  "Deposit: $1m",
  "deposit $5m",
  "Pool cover: $1,200.",
  "Full cover for $5,000.",
  "Fully insured: $5,000.",
  "Cover: $2,000.",
  "Removal of excess: $150.",
  "That comes to $2m",
  "Total $1.5m cover",
  "$250k",
  "$1,000 thousand",
  "fifty thousand dollars",
  "$3.6k",
  "A $50 deposit holds the day.",
  "We carry $90 million cover.",
  "That comes to £90.",
  "2 thousand dollars",
  // Round 2, H1: a total hidden behind an insurance word.
  "If you can move the wedding, the total including insurance $340.",
  "Total with insurance $340.",
  "All up with public liability $340.",
  "Wedding day total inc. public liability $340.",
  "Clean $340. Total including $20m public liability insurance $5,000",
  "Clean $340. Total inc. insurance $5,000.",
  // H2: charges named after insurance.
  "Plus a $250 insurance fee for the wedding day.",
  "plus $150 insurance fee",
  "plus a $150 public liability levy",
  "$50 insurance applies",
  "Damage insurance $50 per day",
  "Plus $20 product liability surcharge",
  "Indemnity $80.",
  "Professional indemnity $80 extra.",
  "around $5,000 insurance incl.",
  "Per our cancellation policy, an excess of $50 applies.",
  // Free-edited cover figures: a saved answer only.
  "We have $20m public liability.",
  "We're insured for $20m.",
  "Insurance claims carry a $2k excess.",
  // M6.
  "Bridal makeup is 250 if you can move it.",
  "Bridal makeup is AUD250.",
  "5 grand",
  "Price: 5000",
  "Quote: 5000",
  "That'll be 5000",
  "5,000 all up",
  "500 euros",
  "340 NZD",
  "NZ$340",
  "US$340",
  "That comes to US$90.",
];

test("round 2: every money row refuses - alone, beside the correct total, and with no quote", () => {
  for (const row of REFUSED) {
    assert.equal(amountAgrees(row, PRICE(9000), [9000]), false, `alone: ${row}`);
    assert.equal(
      amountAgrees(`${BASE}\n\n${row}`, PRICE(9000), [9000]),
      false,
      `with total: ${row}`,
    );
    assert.equal(amountAgrees(row, null), false, `no quote: ${row}`);
  }
  // "your excess is $500 and the total is $5,000", on a $5,000 quote.
  const excess = "Your excess is $500 and the total is $5,000.";
  assert.equal(amountAgrees(excess, PRICE(500_000), [500_000]), false);
});

test("round 2: a free-edited cover figure is refused with 'write it as a saved answer'", () => {
  for (const row of [
    "We have $20m public liability.",
    "Plus a $250 insurance fee for the wedding day.",
  ]) {
    assert.equal(
      mismatchMessage(`${BASE}\n\n${row}`, PRICE(9000), [9000]),
      INSURANCE_AS_ANSWER,
      row,
    );
  }
});

test("M1/M2: the owner's own answer sentence carries its own figures - there, as written, and nowhere else", () => {
  for (const answer of [
    "We have public liability cover $20m.",
    "We're insured for $20m.",
    "Yes, fully insured with $20m public liability.",
  ]) {
    const own = [answer];
    assert.equal(amountAgrees(`${BASE}\n\n${answer}`, PRICE(9000), [9000], own), true, answer);
    // The same answer on a reply with no quote: its own figures only.
    assert.equal(amountAgrees(`Hi Mia,\n\n${answer}`, null, [], own), true, answer);
    // Edited, it is no longer the owner's sentence.
    const edited = answer.replace("$20m", "$25m");
    assert.equal(amountAgrees(`${BASE}\n\n${edited}`, PRICE(9000), [9000], own), false, edited);
  }
  // M2: an answer's number is never allowed anywhere else by value.
  const deposit = ["Yes, a $50 deposit secures the day."];
  assert.equal(
    amountAgrees(
      `Hi Mia,\n\nTrial $90. Total: $50.\n\n${deposit[0]}`,
      PRICE(9000),
      [9000],
      deposit,
    ),
    false,
  );
  const cover = ["We have $20m public liability."];
  assert.equal(
    amountAgrees(
      `Bridal makeup plus travel, all up $20m.\n\n${cover[0]}`,
      PRICE(9000),
      [9000],
      cover,
    ),
    false,
  );
  const both = ["All up we'd be at $340 for the wedding."];
  assert.equal(amountAgrees("Trial $90. Total: $340.", PRICE(9000), [9000], both), false);
  // M1: "Makeup trial $90" then a line with no figure: just the quote.
  assert.equal(
    amountAgrees("Makeup trial $90\nInsurance: I'm fully insured.", PRICE(9000), [9000]),
    true,
  );
});

// M4. A thing asked about beside a priced line that shares a word -----------

const NAILS = { knowledge: [fixed("Pedicure", 60), fixed("Gel manicure", 50)] };

test("M4: 'manicures' answered No beside a priced gel manicure is a conflict, never both in a reply", () => {
  const d = confirmed(NAILS, "Pedicure", [
    { field: "service", value: "Pedicure", status: "confirmed" },
    { field: "extra:Gel manicure", value: "include", status: "confirmed" },
    { field: "question:manicures", value: "no", status: "confirmed" },
  ]);
  assert.equal(d.action, "ESCALATE_HUMAN");
  assert.match(
    d.conflict ?? "",
    /You said you don't do manicures, but gel manicure is on this quote/,
  );
  const snap = snapshotFromDecision(d);
  assert.equal(snap.price, undefined);
  assert.equal(snap.conflict, d.conflict, "the desk can show it");
});

test("M4: 'painting' answered No beside interior and exterior painting is a conflict", () => {
  const brain = { knowledge: [fixed("Interior painting", 900), fixed("Exterior painting", 1500)] };
  const d = confirmed(brain, "Interior painting", [
    { field: "service", value: "Interior painting", status: "confirmed" },
    { field: "extra:Exterior painting", value: "include", status: "confirmed" },
    { field: "question:painting", value: "no", status: "confirmed" },
  ]);
  assert.match(d.conflict ?? "", /You said you don't do painting/);
});

test("M4: a Yes beside a priced line that shares a word is the owner's one tap: same thing, or come back", () => {
  const cases: [string, string, string][] = [
    ["Carpet steam clean", "carpets", "Regular house clean"],
    ["Carpet steam clean", "carpet cleaning", "Regular house clean"],
    ["Wall washing", "walls", "Regular house clean"],
    ["Makeup trial", "trial run", "Bridal makeup"],
    ["Oven racks", "oven", "End of lease clean"],
  ];
  for (const [line, thing, main] of cases) {
    const brain = { knowledge: [fixed(main, 300), fixed(line, 80)] };
    const facts = [
      { field: "service", value: main, status: "confirmed" },
      { field: `extra:${line}`, value: "include", status: "confirmed" },
      { field: `question:${thing}`, value: "yes", status: "confirmed" },
    ];
    const open = decideEnquiry(brain, { serviceLabel: main, facts: facts as never });
    const check = open.coverage?.flagged.find((f) => f.check?.field === `rule:same:${thing}`);
    assert.ok(check, `${thing}: ${JSON.stringify(open.coverage?.flagged)}`);
    assert.equal(open.coverage?.confirmed, false);
    const same = confirmed(brain, main, [
      ...facts,
      { field: `rule:same:${thing}`, value: "apply", status: "confirmed" },
    ]);
    assert.equal(same.action, "SEND_QUOTE", thing);
    assert.doesNotMatch((same.replyNotes ?? []).join(" "), /come back/, thing);
    const other = confirmed(brain, main, [
      ...facts,
      { field: `rule:same:${thing}`, value: "waive", status: "confirmed" },
    ]);
    assert.equal(other.action, "SEND_QUOTE", thing);
    assert.match((other.replyNotes ?? []).join(" "), new RegExp(`help with ${thing}`), thing);
  }
});

// M5 / LOW. What a closed wedding day holds ----------------------------------

test("M5: a trial the owner calls 'Makeup preview' is the trial's day's work, never held with the wedding", () => {
  const brain = { knowledge: [fixed("Bridal makeup", 250), fixed("Makeup preview", 90)] };
  const d = confirmed(
    brain,
    "Bridal makeup",
    [
      { field: "service", value: "Bridal makeup", status: "confirmed" },
      { field: "extra:Makeup preview", value: "include", status: "confirmed" },
    ],
    WITH_TRIAL,
  );
  assert.equal(d.action, "SEND_QUOTE");
  assert.equal(d.price.kind === "EXACT" && d.price.amountMinor, 9000);
  assert.deepEqual(
    d.closedDay?.held.map((h) => h.label),
    ["Bridal makeup"],
  );
  assert.equal(d.closedDay?.bookable, true);
});

test("LOW: the rule the reduced quote reads from is never the held line's; a repeat discount is worked on what is left", () => {
  const brain = {
    knowledge: [
      fixed("Regular house clean", 160),
      fixed("Oven clean", 60),
      {
        state: "Active",
        rulePayload: { kind: "discount", percent: 10, condition: "fortnightly cleans" },
      },
    ],
  };
  const party: ReplyContext = {
    serviceLabel: "Regular house clean",
    jobDateIso: "2026-11-08",
    jobDateSpan: "Sunday 8 November",
    jobDateConfirmed: false,
    jobDateRole: "event",
    jobDateWhat: "party",
    fixedEvent: "party",
    closed: SUNDAYS,
    otherDates: [{ iso: "2026-11-07", role: "job", what: "oven", label: "Sat 7 Nov" }],
  };
  let facts: Fact[] = [
    { field: "service", value: "Regular house clean", status: "confirmed" },
    { field: "extra:Oven clean", value: "include", status: "confirmed" },
    { field: "recurring", value: "yes", status: "confirmed" },
  ];
  // Settle every check the owner is shown, their rule's own way.
  for (let i = 0; i < 6; i += 1) {
    const d = decideEnquiry(brain as never, {
      serviceLabel: "Regular house clean",
      facts: facts as never,
      reply: party,
    });
    const open = (d.coverage?.flagged ?? []).find(
      (f) => f.check && !facts.some((x) => x.field === f.check!.field),
    );
    if (!open) break;
    facts = [...facts, { field: open.check!.field, value: "apply", status: "confirmed" }];
  }
  const d = confirmed(brain, "Regular house clean", facts, party);
  assert.equal(d.action, "SEND_QUOTE");
  assert.deepEqual(
    d.closedDay?.held.map((h) => h.label),
    ["Regular house clean"],
  );
  const snap = snapshotFromDecision(d, party);
  const total = snap.price?.kind === "EXACT" ? snap.price.amountMinor : 0;
  assert.ok(total > 0 && total <= 6000, String(total));
  for (const heldAmount of [16000, 14400, 22000]) {
    assert.ok(!(snap.impliedAmountsMinor ?? []).includes(heldAmount), String(heldAmount));
  }
});

// Ruling: a line's amount only where it is said as that line.

test("ruling: a line's amount stands beside its own name or in the prepared reply's own sentence", () => {
  const draft =
    "Hi there,\n\nFor the makeup trial, that comes to $130:\n- Makeup trial: $90\n- Travel fee: $40\n\nThanks,\nSam";
  const quote = {
    draft,
    lines: [
      { label: "Makeup trial", amountMinor: 9000 },
      { label: "Travel fee", amountMinor: 4000 },
    ],
  };
  const agrees = (extra: string) =>
    amountAgrees(`${draft}\n\n${extra}`, PRICE(13000), [13000, 9000, 4000], [], quote);
  assert.equal(amountAgrees(draft, PRICE(13000), [13000, 9000, 4000], [], quote), true);
  assert.equal(agrees("The travel fee is $40 because you're past 15km."), true);
  assert.equal(agrees("The trial itself is $90."), true);
  assert.equal(agrees("So $130 all up."), true);
  assert.equal(agrees("A $40 cancellation fee applies."), false);
  assert.equal(agrees("The travel is $90."), false);
  assert.equal(agrees("Total with insurance $130."), false);
  assert.equal(agrees("A $130 deposit holds the day."), false);
});
