import assert from "node:assert/strict";
import test from "node:test";
import { decideEnquiry } from "./decide.ts";
import { snapshotFromDecision } from "./decision-snapshot.ts";
import { askedLedger, readableAsked, type AskedItem } from "./asked.ts";
import { dollarMatches, isNonPriceFigure } from "./voice-detect.ts";
import type { ReplyContext } from "./compose-reply.ts";
import { amountAgrees, priceFigures } from "../lib/repo/reviewed-send-core.ts";

/**
 * Trust pass 10: three reply-logic problems found walking the app, and the
 * send gate misreading "$90 million". The reply-affecting repros are proven
 * again through the send path in `src/lib/repo/trust-pass10.db.test.ts`.
 */

// 1. A priced thing is never also one the reply "comes back" on --------------

const BRIDAL = {
  knowledge: [
    {
      state: "Active",
      rulePayload: { kind: "fixed_price", service: "Bridal makeup", amount: 250, currency: "AUD" },
    },
    {
      state: "Active",
      rulePayload: { kind: "fixed_price", service: "Makeup trial", amount: 90, currency: "AUD" },
    },
  ],
};

function trialQuote(question: "yes" | "later") {
  const facts = [
    { field: "service", value: "Bridal makeup", status: "confirmed" },
    { field: "extra:Makeup trial", value: "include", status: "confirmed" },
    { field: "question:trial", value: question, status: "confirmed" },
  ];
  const open = decideEnquiry(BRIDAL, { serviceLabel: "Bridal makeup", facts: facts as never });
  return decideEnquiry(BRIDAL, {
    serviceLabel: "Bridal makeup",
    facts: [
      ...facts,
      { field: "coverage", value: open.coverage!.key, status: "confirmed" },
    ] as never,
  });
}

test("1: 'can you do a trial?' answered Yes, the trial on the quote: never 'I'll come back with a price'", () => {
  for (const answer of ["yes", "later"] as const) {
    const d = trialQuote(answer);
    assert.equal(d.action, "SEND_QUOTE");
    assert.equal(d.price.kind === "EXACT" && d.price.amountMinor, 34000);
    const notes = (d.replyNotes ?? []).join("\n");
    assert.doesNotMatch(notes, /come back to you/, `${answer}: ${notes}`);
    const body = snapshotFromDecision(d).draft.body;
    assert.match(body, /- Makeup trial: \$90/);
    assert.doesNotMatch(body, /come back to you with a price|come back to you on trial/);
  }
});

test("1: a Yes about something not on the quote still says the price comes later", () => {
  const facts = [
    { field: "service", value: "Bridal makeup", status: "confirmed" },
    { field: "question:hair styling", value: "yes", status: "confirmed" },
  ];
  const d = decideEnquiry(BRIDAL, { serviceLabel: "Bridal makeup", facts: facts as never });
  assert.deepEqual(d.replyNotes, [
    "Yes, I can help with hair styling - I'll come back to you with a price for that.",
  ]);
});

// 1 and 2. A wedding day the owner doesn't work -------------------------------

const SUNDAYS: ReplyContext["closed"] = { days: [0] };

function bridalOnly() {
  const brain = { knowledge: [BRIDAL.knowledge[0]!] };
  const facts = [{ field: "service", value: "Bridal makeup", status: "confirmed" }];
  const open = decideEnquiry(brain, { serviceLabel: "Bridal makeup", facts: facts as never });
  return decideEnquiry(brain, {
    serviceLabel: "Bridal makeup",
    facts: [
      ...facts,
      { field: "coverage", value: open.coverage!.key, status: "confirmed" },
    ] as never,
  });
}

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

test("1/2: a Sunday wedding with nothing else on the quote is priced for a day the owner is available, and held as Not yet", () => {
  const snap = snapshotFromDecision(bridalOnly(), WEDDING_SUNDAY);
  assert.deepEqual(snap.closedDay, {
    days: ["2026-11-08"],
    held: [{ label: "Bridal makeup", amountMinor: 25000, iso: "2026-11-08" }],
    bookable: false,
  });
  assert.match(
    snap.draft.body,
    /For the bridal makeup, that comes to \$250 on a day I'm available\./,
  );
  assert.match(snap.draft.body, /I'm sorry, I'm not available on Sunday 8 November/);
  assert.doesNotMatch(snap.draft.body, /that comes to \$250\./);
  // The price the send check holds the reply to is the same price.
  assert.equal(snap.price?.amountMinor, 25000);
});

test("2: a job that can move, asked for on a closed day, keeps its price; only the day can't be done", () => {
  const snap = snapshotFromDecision(bridalOnly(), {
    ...WEDDING_SUNDAY,
    jobDateRole: undefined,
    jobDateWhat: undefined,
    fixedEvent: undefined,
  });
  assert.deepEqual(snap.closedDay, { days: ["2026-11-08"], held: [], bookable: true });
  assert.match(snap.draft.body, /For the bridal makeup, that comes to \$250\./);
});

test("2: a day the owner confirmed is theirs: nothing is held", () => {
  const snap = snapshotFromDecision(bridalOnly(), { ...WEDDING_SUNDAY, jobDateConfirmed: true });
  assert.equal(snap.closedDay, undefined);
  assert.match(snap.draft.body, /that comes to \$250\./);
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
  const q = items.filter((i) => i.kind === "question");
  assert.deepEqual(q, [
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
  ]);
});

test("3: a ledger stored before pass 10 reads as the thing asked about, not the answer", () => {
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
  ];
  assert.deepEqual(
    readableAsked(stored)!.map((i) => i.text),
    ["Exterior painting", "Trial", "Deck", "Are you insured?"],
  );
  assert.equal(readableAsked(undefined), undefined);
});

// 4. "$90 million" is ninety million, and cover is not a price ----------------

test("4: amounts followed by million, m, k or thousand are read at their true value", () => {
  const read = (t: string) => dollarMatches(t).map((m) => [m.amount, m.scale ?? 1]);
  assert.deepEqual(read("$90 million cover"), [[90_000_000, 1e6]]);
  assert.deepEqual(read("$20m public liability"), [[20_000_000, 1e6]]);
  assert.deepEqual(read("$1.5m"), [[1_500_000, 1e6]]);
  assert.deepEqual(read("$2k excess"), [[2000, 1e3]]);
  assert.deepEqual(read("$2 thousand"), [[2000, 1e3]]);
});

test("4: cover and excess figures are not prices; the same figure said as the total is", () => {
  const nonPrice = (t: string) => dollarMatches(t).map((m) => isNonPriceFigure(t, m));
  assert.deepEqual(nonPrice("We carry $90 million cover."), [true]);
  assert.deepEqual(nonPrice("We have $20m public liability."), [true]);
  assert.deepEqual(nonPrice("Insured to $1.5m."), [true]);
  assert.deepEqual(nonPrice("Any claim has a $2k excess."), [true]);
  assert.deepEqual(nonPrice("Public liability of $20,000."), [true]);
  assert.deepEqual(nonPrice("That comes to $2m."), [false]);
  assert.deepEqual(nonPrice("$90 million all up."), [false]);
  assert.deepEqual(nonPrice("A $50 deposit holds the day."), [false]);
  assert.deepEqual(nonPrice("It was 3.6k before."), [false]);
});

const PRICE = {
  kind: "EXACT" as const,
  amountMinor: 9000,
  currency: "AUD" as const,
  workings: "",
  rule: { kind: "fixed_price", service: "Makeup trial", amount: 90, currency: "AUD" } as never,
};

test("4: the send check allows cover figures and still refuses a total or a deposit that differs", () => {
  const base = "Hi Mia,\n\nFor the makeup trial, that comes to $90.";
  for (const extra of [
    "We carry $20m public liability.",
    "We carry $90 million cover.",
    "Our insurance is $1.5m.",
    "Any claim has a $2k excess.",
  ]) {
    const body = `${base}\n\n${extra}`;
    assert.deepEqual(priceFigures(body), [90], extra);
    assert.equal(amountAgrees(body, PRICE, [9000]), true, extra);
  }
  for (const wrong of [
    "Hi Mia,\n\nFor the makeup trial, that comes to $95.",
    `${base}\n\nA $50 deposit holds the day.`,
    "Hi Mia,\n\nA $50 deposit holds the day.",
    "Hi Mia,\n\nThat comes to $2m.",
  ]) {
    assert.equal(amountAgrees(wrong, PRICE, [9000]), false, wrong);
  }
});
