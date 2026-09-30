import assert from "node:assert/strict";
import test from "node:test";
import { decideEnquiry } from "./decide.ts";
import { snapshotFromDecision } from "./decision-snapshot.ts";
import { askedLedger, readableAsked, type AskedItem } from "./asked.ts";
import { dollarMatches, isNonPriceFigure } from "./voice-detect.ts";
import type { ReplyContext } from "./compose-reply.ts";
import { amountAgrees, priceFigures } from "../lib/repo/reviewed-send-core.ts";

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

// 4 / HIGH-3. Money in a reply -------------------------------------------------

test("4: amounts followed by million, m, k or thousand are read at their true value", () => {
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
  assert.deepEqual(
    dollarMatches("£500 or €500").map((m) => [m.amount, m.foreign]),
    [
      [500, true],
      [500, true],
    ],
  );
});

test("HIGH-3: only named insurance is not a price; anything said as a price or a line item is", () => {
  const exempt = (t: string) => dollarMatches(t).map((m) => isNonPriceFigure(t, m));
  assert.deepEqual(exempt("We have $20m public liability."), [true]);
  assert.deepEqual(exempt("We carry $1.5m public liability."), [true]);
  assert.deepEqual(exempt("Public liability insurance of $20,000,000."), [true]);
  assert.deepEqual(exempt("Insurance claims carry a $2k excess."), [true]);
  for (const t of [
    "We carry $90 million cover.",
    "Insured to $1.5m.",
    "$1.5m",
    "Your excess is $500.",
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
    "Total $1.5m cover",
    "That comes to $2m.",
  ]) {
    assert.ok(!exempt(t).some(Boolean), t);
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

test("HIGH-3: the reviewer's table - every one refuses, with the quote total present or not, and with no quote", () => {
  const base = "Hi Mia,\n\nFor the makeup trial, that comes to $90.";
  for (const row of [
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
  ]) {
    assert.equal(amountAgrees(row, PRICE(9000), [9000]), false, `alone: ${row}`);
    assert.equal(
      amountAgrees(`${base}\n\n${row}`, PRICE(9000), [9000]),
      false,
      `with total: ${row}`,
    );
    assert.equal(amountAgrees(row, null), false, `no quote: ${row}`);
  }
  // "your excess is $500 and the total is $5,000", on a $5,000 quote.
  const excess = "Your excess is $500 and the total is $5,000.";
  assert.equal(amountAgrees(excess, PRICE(500_000), [500_000]), false);
});

test("HIGH-3: named insurance goes out only beside the correct quote total", () => {
  const base = "Hi Mia,\n\nFor the makeup trial, that comes to $90.";
  for (const line of [
    "We have $20m public liability.",
    "We carry $1.5m public liability.",
    "Insurance claims carry a $2k excess.",
  ]) {
    assert.deepEqual(priceFigures(`${base}\n\n${line}`), [90], line);
    assert.equal(amountAgrees(`${base}\n\n${line}`, PRICE(9000), [9000]), true, line);
    assert.equal(amountAgrees(line, PRICE(9000), [9000]), false, `no total: ${line}`);
    assert.equal(amountAgrees(line, null), false, `no quote: ${line}`);
    const wrong = `Hi Mia,\n\nFor the makeup trial, that comes to $95.\n\n${line}`;
    assert.equal(amountAgrees(wrong, PRICE(9000), [9000]), false, `wrong total: ${line}`);
  }
  // The owner's own typed answer stays trusted as written, as in pass 7.
  const owned = "We have $20 million public liability insurance.";
  assert.equal(amountAgrees(owned, null, [], [2_000_000_000]), true);
});
