import assert from "node:assert/strict";
import test from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { ForbiddenError, requireEnquiryAccess } from "./tenancy.server.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import { toEnquiry, type EnquiryRow } from "./rows.ts";
import { promiseVerdict } from "../../domain/labels.ts";
import { INSURANCE_AS_ANSWER } from "./reviewed-send-core.ts";
import {
  WED_30_SEP,
  answer,
  enquiry,
  freshDb,
  refusedForOther,
  row,
  send,
  sendAs,
  settle,
  sqlFor,
  tell,
  tenant,
  tx,
} from "./pass8-db-helpers.ts";

/**
 * Trust pass 10, against a real database: three reply-logic problems found
 * walking the app, the send gate misreading "$90 million", and the independent
 * review of the first fix (PR #79). Each repro is driven the way the owner
 * drives it on an injected day (Wednesday 30 September or Wednesday 14 October
 * 2026, Brisbane), and the app's own reply goes through the send path
 * (`prepareReviewedSendInTransaction`). Every write a second tenant could try
 * is refused and moves nothing.
 */

const WED_14_OCT = new Date("2026-10-14T10:15:00+10:00");

const MAKEUP_LINES = ["Makeup trial $90", "Bridal makeup $250", "We don't work Sundays"];
const MAKEUP = MAKEUP_LINES.join("\n");
const CHLOE = "Hi! Wedding is Sunday 8 November, trial on 24 October. Chloe";

async function setup(
  t: { after: (fn: () => Promise<void>) => void },
  business = MAKEUP,
  industry = "beauty",
) {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Mia Makeup", industry);
  await tenant(pg, "user-b", "Bravo");
  await tell(pg, a.businessId, business);
  return { pg, a };
}

/** The verdict the card shows, read the way the desk reads the row. */
async function verdict(pg: PGlite, enquiryId: string): Promise<string> {
  const r = await pg.query<EnquiryRow>("select * from enquiry where id = $1", [enquiryId]);
  const e = toEnquiry(r.rows[0]!, { facts: [], conversation: [], quotes: [] });
  return promiseVerdict(e).line;
}

async function reviewedSends(pg: PGlite, enquiryId: string): Promise<number> {
  const r = await pg.query("select 1 from reviewed_send where enquiry_id = $1", [enquiryId]);
  return r.rows.length;
}

const CHLOE_REPLY = [
  "Hi there,",
  "",
  "Thanks for getting in touch about bridal makeup.",
  "",
  "For the makeup trial, that comes to $90.",
  "",
  "I haven't included the bridal makeup, as I'm not available on Sunday 8 November.",
  "",
  "You mentioned Sunday 8 November - I'm sorry, I'm not available on Sunday 8 November. Is there any flexibility on the date?",
  "For the trial, you mentioned Saturday 24 October - I'll confirm whether that works.",
  "",
  "Let me know what date suits and I'll confirm.",
  "",
  "Thanks,",
  "Sam",
].join("\n");

/** Chloe's enquiry with the trial added at its saved price, settled the owner's way. */
async function chloe(pg: PGlite, businessId: string, checks: [RegExp, string][] = []) {
  const e = await enquiry(pg, businessId, CHLOE, "Bridal makeup", WED_30_SEP);
  // "They mention makeup trial": the owner adds it at its saved $90.
  await refusedForOther(pg, e.enquiryId, "extra:Makeup trial", "include");
  await answer(pg, "user-a", e.enquiryId, "extra:Makeup trial", "include");
  await settle(pg, e.enquiryId, { checks });
  return e;
}

test("1/2 Chloe: the trial is priced, the Sunday wedding is named without a price, the verdict says one date can't be done", async (t) => {
  const { pg, a } = await setup(t);
  const e = await chloe(pg, a.businessId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  // Was "For the bridal makeup and the makeup trial, that comes to $340" - a
  // total for a wedding day the owner doesn't work, as if it could be booked.
  // Review: the held work is named with no figure of its own.
  assert.equal(body, CHLOE_REPLY);
  assert.equal(snapshot.price?.amountMinor, 9000);
  assert.equal(sent.ok && sent.amountMinor, 9000, "the recorded quote is the trial's price");
  assert.equal(await verdict(pg, e.enquiryId), "Yes - reply ready, one date can't be done");
  // The owner confirmed exactly what is quoted: the held work is on the check.
  assert.ok(
    snapshot.coverage?.flagged.some(
      (f) => f.text === "Not included - closed day: bridal makeup (Sunday 8 November)",
    ),
    JSON.stringify(snapshot.coverage),
  );
  // No old total and no held price is a figure the reply may name (review M2).
  for (const wrong of ["$340", "$250"]) {
    const res = await sendAs(pg, a.businessId, e.enquiryId, body.replace("$90.", `${wrong}.`));
    assert.equal(!res.ok && res.reason, "amount_mismatch", wrong);
    const also = await sendAs(
      pg,
      a.businessId,
      e.enquiryId,
      `${body}\n\nThe wedding day is ${wrong}.`,
    );
    assert.equal(!also.ok && also.reason, "amount_mismatch", wrong);
  }
});

// HIGH-1: the work left is priced again from the owner's rules, in any order.
const RULED: [string, [RegExp, string][], number, RegExp][] = [
  [
    "Travel fee $40",
    [[/travel/i, "apply"]],
    13000,
    /that comes to \$130:\n- Makeup trial: \$90\n- Travel fee: \$40/,
  ],
  ["Minimum charge $150", [[/minimum/i, "apply"]], 15000, /that comes to \$150 \(minimum charge/],
  ["Minimum charge $400", [[/minimum/i, "apply"]], 40000, /that comes to \$400 \(minimum charge/],
  ["Sunday jobs add 50%", [[/./, "apply"]], 9000, /For the makeup trial, that comes to \$90\./],
  [
    "Weekend jobs have a $50 surcharge",
    [[/weekend/i, "apply"]],
    14000,
    /- Weekend surcharge: \$50/,
  ],
];

for (const [rule, checks, amount, said] of RULED) {
  for (const first of [true, false]) {
    test(`HIGH-1: '${rule}' (${first ? "first" : "last"}) is worked out on the trial left, never subtracted: ${amount / 100}`, async (t) => {
      const business = (first ? [rule, ...MAKEUP_LINES] : [...MAKEUP_LINES, rule]).join("\n");
      const { pg, a } = await setup(t, business);
      const e = await chloe(pg, a.businessId, checks);
      const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
      assert.equal(sent.ok, true, JSON.stringify(sent));
      assert.equal(snapshot.price?.amountMinor, amount, body);
      assert.equal(sent.ok && sent.amountMinor, amount);
      assert.match(body, said);
      assert.match(
        body,
        /I haven't included the bridal makeup, as I'm not available on Sunday 8 November\./,
      );
      // A fee or a top-up is never "held" and never named as not included.
      assert.doesNotMatch(
        body,
        /top-up|\$340|\$250|haven't included the (?:travel|minimum|weekend|sunday)/i,
      );
      const old = await sendAs(pg, a.businessId, e.enquiryId, `${body}\n\nAll up $340.`);
      assert.equal(!old.ok && old.reason, "amount_mismatch");
    });
  }
}

test("HIGH-1/LOW: a fee beside a wedding that is all they asked for - no price is named or recordable, never $0", async (t) => {
  const { pg, a } = await setup(t, [...MAKEUP_LINES, "Travel fee $40"].join("\n"));
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, my wedding is Sunday 8 November, I need bridal makeup please. Amy",
    "Bridal makeup",
    WED_14_OCT,
  );
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(sent.ok && sent.amountMinor, null, "nothing quote-shaped is recorded");
  assert.equal(snapshot.price, undefined);
  assert.doesNotMatch(body, /\$/);
  assert.match(
    body,
    /Thanks for getting in touch about bridal makeup\.\n\nYou mentioned Sunday 8 November - I'm sorry, I'm not available on Sunday 8 November\. Is there any flexibility on the date\?\n\nLet me know what date suits and I'll confirm\./,
  );
  assert.equal(snapshot.recommendation.label, "Ask if the date can move");
  // Was "Yes - reply ready".
  assert.equal(await verdict(pg, e.enquiryId), "Not yet - that day is a closed day");
  for (const total of ["$250", "$290", "$0"]) {
    const res = await sendAs(pg, a.businessId, e.enquiryId, `${body}\n\nThat comes to ${total}.`);
    assert.equal(!res.ok && res.reason, "amount_mismatch", total);
  }
});

test("1: 'can you do a trial?' answered Yes before the trial had a price: priced once, never 'I'll come back with a price'", async (t) => {
  const { pg, a } = await setup(t, ["Bridal makeup $250", "We don't work Sundays"].join("\n"));
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi! Wedding is Sunday 8 November, need bridal makeup. Can you do a trial on 24 October? Chloe",
    "Bridal makeup",
    WED_30_SEP,
  );
  const q = (await row(pg, e.enquiryId)).decision_snapshot.questionPending;
  assert.equal(q?.field, "question:trial");
  await refusedForOther(pg, e.enquiryId, "question:trial", "yes");
  await answer(pg, "user-a", e.enquiryId, "question:trial", "yes");
  // The owner then saves the trial's price, and adds it to the quote.
  await tell(pg, a.businessId, "Makeup trial $90");
  await answer(pg, "user-a", e.enquiryId, "extra:Makeup trial", "include");
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  // Was: "$90 trial" priced AND "Yes, I can help with trial - I'll come back
  // to you with a price for that." in the same reply.
  assert.equal(body, CHLOE_REPLY);
  const item = snapshot.asked?.find((i) => i.id === "question:trial");
  assert.equal(item?.text, "Trial", "the ledger names what they asked, not 'Yes - you do this'");
  assert.equal(item?.status, "answered");
});

test("M3: 'do you do trials?' answered No beside a priced makeup trial is held for the owner, never sent saying both", async (t) => {
  const { pg, a } = await setup(t, ["Bridal makeup $250", "We don't work Saturdays"].join("\n"));
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi! Wedding is Sunday 8 November, need bridal makeup. Can you do a trial on 24 October? Chloe",
    "Bridal makeup",
    WED_30_SEP,
  );
  await answer(pg, "user-a", e.enquiryId, "question:trial", "no");
  await tell(pg, a.businessId, "Makeup trial $90");
  await answer(pg, "user-a", e.enquiryId, "extra:Makeup trial", "include");
  await settle(pg, e.enquiryId);
  const r = await row(pg, e.enquiryId);
  const s = r.decision_snapshot;
  assert.equal(s.recommendation.label, "Settle what's on the quote");
  assert.match(
    (s as { explanation?: string }).explanation ?? "",
    /You said you don't do trial, but makeup trial is on this quote/,
  );
  assert.equal(s.price, undefined, "no total is authorised while they disagree");
  const both = /Sorry, I don't do trial/.test(s.draft.body) && /\$/.test(s.draft.body);
  assert.equal(both, false, s.draft.body);
  const sent = await sendAs(pg, a.businessId, e.enquiryId, s.draft.body);
  assert.equal(sent.ok, false);
  // Round 2 (M3): "That's everything" is refused while they disagree, so the
  // enquiry can never be confirmed into a state the desk cannot settle; the
  // snapshot carries the conflict for the desk to show. Nothing moves.
  assert.match((s as { conflict?: string }).conflict ?? "", /You said you don't do trial/);
  const tap = (userId: string) =>
    confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, {
      enquiryId: e.enquiryId,
      key: s.coverage?.key ?? "",
      revision: Number(r.decision_revision),
    });
  const refusedTap = await tap("user-a");
  assert.equal(refusedTap.ok, false);
  assert.equal(!refusedTap.ok && refusedTap.reason, "conflict");
  await assert.rejects(tap("user-b"), ForbiddenError);
  const still = await row(pg, e.enquiryId);
  assert.equal(still.decision_revision, r.decision_revision);
  assert.deepEqual(still.decision_snapshot, r.decision_snapshot);
  await refusedForOther(pg, e.enquiryId, "question:trial", "yes");
  // The owner settles it: Yes, they do trials. One priced reply, no "Sorry".
  await answer(pg, "user-a", e.enquiryId, "question:trial", "yes");
  await settle(pg, e.enquiryId);
  const { body, sent: ok } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.match(body, /For the bridal makeup and the makeup trial, that comes to \$340:/);
  assert.doesNotMatch(body, /Sorry, I don't do trial|come back to you/);
});

// HIGH-2: a Yes or a come-back about a DIFFERENT thing is never dropped.

const CLEAN = ["End of lease clean $380", "We don't work Sundays"];

test("HIGH-2: 'do you do the oven?' answered Yes is still said beside priced oven racks", async (t) => {
  const { pg, a } = await setup(t, CLEAN.join("\n"), "cleaning");
  const e = await enquiry(
    pg,
    a.businessId,
    "End of lease clean please, plus the oven racks. Do you do the oven as well? Chris",
    "End of lease clean",
    WED_14_OCT,
  );
  assert.equal(
    (await row(pg, e.enquiryId)).decision_snapshot.questionPending?.field,
    "question:oven",
  );
  await answer(pg, "user-a", e.enquiryId, "question:oven", "yes");
  await tell(pg, a.businessId, "Oven racks $40", "user-a");
  await settle(pg, e.enquiryId, { answers: { "extra:Oven racks": "include" } });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 42000, body);
  assert.match(body, /- Oven racks: \$40/);
  assert.match(body, /Yes, I can help with oven - I'll come back to you with a price for that\./);
});

test("HIGH-2: window cleaning left to come back on is still said beside priced window tracks", async (t) => {
  const { pg, a } = await setup(
    t,
    [...CLEAN, "Window tracks $50", "Window cleaning $80"].join("\n"),
    "cleaning",
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "End of lease clean please, plus window tracks. Could you also quote window cleaning? Chris",
    "End of lease clean",
    WED_14_OCT,
  );
  // The owner records the window cleaning they also asked about as one to
  // come back on (the reader takes "window tracks" and "window cleaning" in
  // one message as one extra; a separate follow-up).
  await refusedForOther(pg, e.enquiryId, "extra:Window cleaning", "come_back");
  await answer(pg, "user-a", e.enquiryId, "extra:Window cleaning", "come_back");
  await settle(pg, e.enquiryId, {
    answers: { "extra:Window tracks": "include" },
  });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 43000, body);
  assert.match(body, /- Window tracks: \$50/);
  assert.match(body, /I'll come back to you on the window cleaning\./);
});

test("HIGH-2: 'do you do windows?' to come back on is still said beside priced window tracks", async (t) => {
  const { pg, a } = await setup(t, CLEAN.join("\n"), "cleaning");
  const e = await enquiry(
    pg,
    a.businessId,
    "End of lease clean please, plus window tracks. Do you do windows? Chris",
    "End of lease clean",
    WED_14_OCT,
  );
  assert.equal(
    (await row(pg, e.enquiryId)).decision_snapshot.questionPending?.field,
    "question:windows",
  );
  await answer(pg, "user-a", e.enquiryId, "question:windows", "later");
  await tell(pg, a.businessId, "Window tracks $50", "user-a");
  await settle(pg, e.enquiryId, { answers: { "extra:Window tracks": "include" } });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 43000, body);
  assert.match(body, /I'll come back to you on windows\./);
});

test("1: the same Yes beside a Saturday wedding the owner works: one total, still no 'come back with a price'", async (t) => {
  const { pg, a } = await setup(t, ["Bridal makeup $250", "We don't work Sundays"].join("\n"));
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi! Wedding is Saturday 7 November, need bridal makeup. Can you do a trial on 24 October? Chloe",
    "Bridal makeup",
    WED_30_SEP,
  );
  await answer(pg, "user-a", e.enquiryId, "question:trial", "yes");
  await tell(pg, a.businessId, "Makeup trial $90");
  await answer(pg, "user-a", e.enquiryId, "extra:Makeup trial", "include");
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 34000, body);
  assert.match(body, /For the bridal makeup and the makeup trial, that comes to \$340:/);
  assert.doesNotMatch(body, /come back to you/);
  assert.equal(await verdict(pg, e.enquiryId), "Yes - reply ready");
});

test("2: an oven clean asked for on a Sunday can move: priced as usual, and the verdict says the day can't be done", async (t) => {
  const { pg, a } = await setup(t, ["Oven clean $60", "We don't work Sundays"].join("\n"));
  const e = await enquiry(
    pg,
    a.businessId,
    "Oven clean on Sunday 18 October please. Tom",
    "Oven clean",
    WED_14_OCT,
  );
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 6000, body);
  assert.match(body, /For the oven clean, that comes to \$60\./);
  assert.match(body, /I don't work Sundays/);
  assert.equal(await verdict(pg, e.enquiryId), "Yes - reply ready, one date can't be done");
});

test("3: an answered 'do you do exterior painting?' is 'Exterior painting' in the ledger; stored answers read the same", async (t) => {
  const { pg, a } = await setup(
    t,
    ["Interior painting $28 per square metre", "We don't do exterior painting"].join("\n"),
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "Do you do exterior painting? Also the lounge walls inside, about 20 square metres. Nat",
    "Interior painting",
    WED_14_OCT,
  );
  const q = (await row(pg, e.enquiryId)).decision_snapshot.questionPending;
  assert.equal(q?.field, "question:exterior painting");
  await refusedForOther(pg, e.enquiryId, q!.field, "no");
  await answer(pg, "user-a", e.enquiryId, q!.field, "no");
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /Sorry, I don't do exterior painting\./);
  const item = snapshot.asked?.find((i) => i.id === "question:exterior painting") as
    { text: string; status: string; declined?: boolean } | undefined;
  assert.deepEqual(
    { text: item?.text, status: item?.status, declined: item?.declined },
    { text: "Exterior painting", status: "answered", declined: true },
  );
  // A snapshot stored before this pass carried the owner's answer as the label.
  await pg.query(
    `update enquiry set decision_snapshot = jsonb_set(decision_snapshot, '{asked}',
       (select jsonb_agg(case when i->>'id' = 'question:exterior painting'
         then (i - 'declined') || '{"text": "No - you don''t do this"}'::jsonb else i end)
        from jsonb_array_elements(decision_snapshot->'asked') i))
     where id = $1`,
    [e.enquiryId],
  );
  const r = await pg.query<EnquiryRow>("select * from enquiry where id = $1", [e.enquiryId]);
  const read = toEnquiry(r.rows[0]!, { facts: [], conversation: [], quotes: [] });
  const migrated = read.decision.asked?.find((i) => i.id === "question:exterior painting");
  assert.equal(migrated?.text, "Exterior painting");
  assert.equal(migrated?.declined, true);
});

// 4 / round 2. One rule for money in a reply: an amount of the quote, or a
// figure inside the owner's own answer sentence as they wrote it.

test("round 2 (M1/M2): a cover figure goes out as the owner's own answer, as written, and nowhere else", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, could I book a makeup trial please? Are you insured? Mia",
    "Makeup trial",
    WED_14_OCT,
  );
  const q = (await row(pg, e.enquiryId)).decision_snapshot.questionPending;
  assert.equal(q?.field, "ask:insurance");
  await refusedForOther(pg, e.enquiryId, "ask:insurance", "We have public liability cover $20m.");
  await answer(pg, "user-a", e.enquiryId, "ask:insurance", "We have public liability cover $20m.");
  await settle(pg, e.enquiryId);
  const { body, sent } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(sent.ok && sent.amountMinor, 9000);
  assert.match(
    body,
    /For the makeup trial, that comes to \$90\.\n\nWe have public liability cover \$20m\./,
  );
  // Edited, the sentence is no longer the owner's answer; the same $20m
  // anywhere else is a figure like any other (review M2).
  for (const [edited, message] of [
    [body.replace("cover $20m.", "cover $25m."), INSURANCE_AS_ANSWER],
    [`${body}\n\nBridal makeup plus travel, all up $20m.`, null],
    [
      body.replace(
        "We have public liability cover $20m.",
        "We're insured for $20m, and the total is $20m.",
      ),
      INSURANCE_AS_ANSWER,
    ],
  ] as const) {
    const res = await sendAs(pg, a.businessId, e.enquiryId, edited);
    assert.equal(!res.ok && res.reason, "amount_mismatch", edited);
    if (message) assert.equal(!res.ok && res.message, message, edited);
  }
  // The owner answers again in other words: those words carry the figure now.
  await answer(pg, "user-a", e.enquiryId, "ask:insurance", "We're insured for $20m.");
  await settle(pg, e.enquiryId);
  const again = await send(pg, a.businessId, e.enquiryId);
  assert.equal(again.sent.ok, true, JSON.stringify(again.sent));
  assert.match(again.body, /We're insured for \$20m\./);
});

test("round 2 (M2): a deposit the owner wrote is theirs in its sentence, never a total elsewhere", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, could I book a makeup trial please? Do you need a deposit? Mia",
    "Makeup trial",
    WED_14_OCT,
  );
  await answer(pg, "user-a", e.enquiryId, "ask:deposit", "Yes, a $50 deposit secures the day.");
  await settle(pg, e.enquiryId);
  const { body, sent } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /Yes, a \$50 deposit secures the day\./);
  const res = await sendAs(
    pg,
    a.businessId,
    e.enquiryId,
    body.replace("that comes to $90.", "that comes to $90. Total: $50."),
  );
  assert.equal(!res.ok && res.reason, "amount_mismatch");
});

test("round 2 (M6): the all-closed wedding names no money in any form; the trial quote only its own", async (t) => {
  const { pg, a } = await setup(t);
  const closed = await enquiry(
    pg,
    a.businessId,
    "Hi, my wedding is Sunday 8 November, I need bridal makeup please. Amy",
    "Bridal makeup",
    WED_14_OCT,
  );
  await settle(pg, closed.enquiryId);
  const draft = (await row(pg, closed.enquiryId)).decision_snapshot.draft.body;
  assert.equal(
    (await sendAs(pg, a.businessId, closed.enquiryId, draft)).ok,
    true,
    "Send stays enabled",
  );
  for (const line of [
    "Bridal makeup is 250 if you can move it.",
    "Bridal makeup is AUD250.",
    "It would be 5 grand.",
    "Price: 5000",
    "5,000 all up",
    "US$250",
    "We have $20m public liability.",
  ]) {
    const res = await sendAs(pg, a.businessId, closed.enquiryId, `${draft}\n\n${line}`);
    assert.equal(!res.ok && res.reason, "amount_mismatch", line);
  }
  const trial = await chloe(pg, a.businessId);
  const body = (await row(pg, trial.enquiryId)).decision_snapshot.draft.body;
  const s = await row(pg, trial.enquiryId);
  const done = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    enquiryId: trial.enquiryId,
    key: s.decision_snapshot.coverage!.key,
    revision: Number(s.decision_revision),
  });
  assert.equal(done.ok, true);
  const ready = (await row(pg, trial.enquiryId)).decision_snapshot.draft.body;
  void body;
  const res = await sendAs(
    pg,
    a.businessId,
    trial.enquiryId,
    `${ready}\n\nBridal makeup is 250 on another day.`,
  );
  assert.equal(!res.ok && res.reason, "amount_mismatch");
});

test("4 (HIGH-3): money on a reply with no quote is refused, whatever it is about", async (t) => {
  const { pg, a } = await setup(t, ["End of lease clean $190 per bedroom"].join("\n"), "cleaning");
  const e = await enquiry(
    pg,
    a.businessId,
    "End of lease clean please. Jo",
    "End of lease clean",
    WED_14_OCT,
  );
  const s = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(s.recommendation.action, "REQUEST_INFORMATION");
  for (const line of [
    "Pool cover: $1,200.",
    "We have $20m public liability.",
    "Fully insured: $5,000.",
    "It's usually 380 for two.",
  ]) {
    const res = await sendAs(pg, a.businessId, e.enquiryId, `${s.draft.body}\n\n${line}`);
    assert.equal(!res.ok && res.reason, "amount_mismatch", line);
  }
  assert.equal((await sendAs(pg, a.businessId, e.enquiryId, s.draft.body)).ok, true);
  // Another tenant cannot reach the send path, and nothing is prepared or moved.
  const before = await row(pg, e.enquiryId);
  const sends = await reviewedSends(pg, e.enquiryId);
  await assert.rejects(requireEnquiryAccess("user-b", e.enquiryId, sqlFor(pg)), ForbiddenError);
  assert.equal(await reviewedSends(pg, e.enquiryId), sends);
  assert.deepEqual(await row(pg, e.enquiryId), before);
});

/**
 * The permanent regression suite: owner-edited bodies against a $340 quote
 * (bridal makeup $250 and a makeup trial $90, wedding on a Saturday the owner
 * works) and a $90 one (Chloe's trial, the Sunday wedding held). Each row is
 * appended to the app's own reply and sent through the send path.
 * [row, goes out on the $340 quote, goes out on the $90 quote]
 */
const FUZZ: [string, boolean, boolean][] = [
  // Words with no money in them.
  ["Looking forward to it!", true, true],
  ["See you on the 24th.", true, true],
  ["Call me on 0412 345 678.", true, true],
  ["Our ABN is 12 345 678 901.", true, true],
  ["There are 4 of us.", true, true],
  ["Start time is 9:30.", true, true],
  ["The wedding is 8 November.", true, true],
  ["Total: 14 October booking.", true, true],
  ["It's about 2 hours.", true, true],
  ["Insurance: I'm fully insured.", true, true],
  ["Parking is fine out the front.", true, true],
  ["I'll bring everything I need.", true, true],
  // The quote's own amounts.
  ["So $340 all up.", true, false],
  ["Total $340.", true, false],
  ["That comes to 340 dollars.", true, false],
  ["Three hundred and forty dollars all up.", true, false],
  ["So $90 all up.", true, true],
  ["The trial is $90 of that.", true, true],
  ["The bridal makeup is $250.", true, false],
  ["Bridal makeup is 250 if you can move it.", true, false],
  ["Bridal makeup is AUD250.", true, false],
  ["Bridal makeup is 250 on another day.", true, false],
  // H1: a total behind an insurance word is just a figure.
  ["If you can move the wedding, the total including insurance $340.", true, false],
  ["Total with insurance $340.", true, false],
  ["All up with public liability $340.", true, false],
  ["Wedding day total inc. public liability $340.", true, false],
  ["Plus a $250 insurance fee for the wedding day.", true, false],
  ["Clean $340. Total including $20m public liability insurance $5,000", false, false],
  ["Clean $340. Total inc. insurance $5,000.", false, false],
  // H2: charges named after insurance.
  ["plus $150 insurance fee", false, false],
  ["plus a $150 public liability levy", false, false],
  ["$50 insurance applies", false, false],
  ["Damage insurance $50 per day", false, false],
  ["Plus $20 product liability surcharge", false, false],
  ["Indemnity $80.", false, false],
  ["Professional indemnity $80 extra.", false, false],
  ["around $5,000 insurance incl.", false, false],
  ["Per our cancellation policy, an excess of $50 applies.", false, false],
  // Free-edited cover figures: a saved answer only.
  ["We have $20m public liability.", false, false],
  ["We're insured for $20m.", false, false],
  ["Insurance claims carry a $2k excess.", false, false],
  ["We carry $90 million cover.", false, false],
  // Round 1.
  ["Price: $5,000 insurance included.", false, false],
  ["Quote: $2m.", false, false],
  ["that'll be $5m", false, false],
  ["You'll pay $5m", false, false],
  ["Wedding package - $5.5m", false, false],
  ["Deposit: $1m", false, false],
  ["deposit $5m", false, false],
  ["Pool cover: $1,200.", false, false],
  ["Full cover for $5,000.", false, false],
  ["Fully insured: $5,000.", false, false],
  ["Cover: $2,000.", false, false],
  ["Removal of excess: $150.", false, false],
  ["That comes to $2m", false, false],
  ["Total $1.5m cover", false, false],
  ["$250k", false, false],
  ["$1,000 thousand", false, false],
  ["fifty thousand dollars", false, false],
  ["$3.6k", false, false],
  ["A $50 deposit holds the day.", false, false],
  ["2 thousand dollars", false, false],
  // M6: forms the gate could not see.
  ["It would be 5 grand.", false, false],
  ["Price: 5000", false, false],
  ["Quote: 5000", false, false],
  ["That'll be 5000", false, false],
  ["5,000 all up", false, false],
  ["500 euros", false, false],
  ["340 NZD", false, false],
  ["NZ$340", false, false],
  ["US$340", false, false],
  ["USD 340", false, false],
  ["£340", false, false],
  ["€90", false, false],
  ["That comes to $341.", false, false],
  ["That comes to $89.", false, false],
  ["That comes to three hundred dollars.", false, false],
];

test(`round 2: the ${FUZZ.length}-row regression table of owner edits against a $340 and a $90 quote`, async (t) => {
  assert.ok(FUZZ.length >= 60);
  const { pg, a } = await setup(t);
  // The $340 quote: a Saturday wedding the owner works, the trial added.
  const sat = await enquiry(
    pg,
    a.businessId,
    "Hi! Wedding is Saturday 7 November, need bridal makeup. Could you also do a makeup trial on 24 October? Chloe",
    "Bridal makeup",
    WED_30_SEP,
  );
  await settle(pg, sat.enquiryId, { answers: { "extra:Makeup trial": "include" } });
  const s340 = await send(pg, a.businessId, sat.enquiryId);
  assert.equal(s340.sent.ok, true, JSON.stringify(s340.sent));
  assert.equal(s340.snapshot.price?.amountMinor, 34000, s340.body);
  // The $90 quote: Chloe's trial, the Sunday wedding held.
  const sun = await chloe(pg, a.businessId);
  const s90 = await send(pg, a.businessId, sun.enquiryId);
  assert.equal(s90.sent.ok, true, JSON.stringify(s90.sent));
  assert.equal(s90.snapshot.price?.amountMinor, 9000, s90.body);
  const wrong: string[] = [];
  for (const [line, on340, on90] of FUZZ) {
    for (const [quote, id, want] of [
      [s340, sat.enquiryId, on340],
      [s90, sun.enquiryId, on90],
    ] as const) {
      const res = await sendAs(pg, a.businessId, id, `${quote.body}\n\n${line}`);
      if (res.ok !== want) {
        wrong.push(`${quote === s340 ? "$340" : "$90"} "${line}": ${res.ok ? "sent" : res.reason}`);
      }
      if (res.ok) assert.equal(res.amountMinor, quote.snapshot.price?.amountMinor, line);
    }
  }
  assert.deepEqual(wrong, []);
});

test("round 2 (M4): 'do you do manicures?' answered No beside a priced gel manicure is a conflict; never sent", async (t) => {
  const { pg, a } = await setup(t, "Pedicure $60");
  const e = await enquiry(
    pg,
    a.businessId,
    "Pedicure please, plus a gel manicure. Do you do manicures? Kim",
    "Pedicure",
    WED_14_OCT,
  );
  assert.equal(
    (await row(pg, e.enquiryId)).decision_snapshot.questionPending?.field,
    "question:manicures",
  );
  await answer(pg, "user-a", e.enquiryId, "question:manicures", "no");
  await tell(pg, a.businessId, "Gel manicure $50");
  await settle(pg, e.enquiryId, { answers: { "extra:Gel manicure": "include" } });
  const r = await row(pg, e.enquiryId);
  const s = r.decision_snapshot as typeof r.decision_snapshot & { conflict?: string };
  assert.match(
    s.conflict ?? "",
    /You said you don't do manicures, but gel manicure is on this quote/,
  );
  assert.equal(s.price, undefined);
  const sent = await sendAs(pg, a.businessId, e.enquiryId, s.draft.body);
  assert.equal(sent.ok, false);
  const tap = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    enquiryId: e.enquiryId,
    key: s.coverage?.key ?? "",
    revision: Number(r.decision_revision),
  });
  assert.equal(!tap.ok && tap.reason, "conflict");
});

test("round 2 (M4): 'do you do carpets?' beside a priced carpet steam clean is the owner's one tap", async (t) => {
  for (const [choice, said] of [
    ["apply", false],
    ["waive", true],
  ] as const) {
    const { pg, a } = await setup(t, "Regular house clean $160", "cleaning");
    const e = await enquiry(
      pg,
      a.businessId,
      "Regular clean please, plus a carpet steam clean. Do you do carpets? Sue",
      "Regular house clean",
      WED_14_OCT,
    );
    assert.equal(
      (await row(pg, e.enquiryId)).decision_snapshot.questionPending?.field,
      "question:carpets",
    );
    await answer(pg, "user-a", e.enquiryId, "question:carpets", "yes");
    await tell(pg, a.businessId, "Carpet steam clean $80");
    await answer(pg, "user-a", e.enquiryId, "extra:Carpet steam clean", "include");
    const flagged = (await row(pg, e.enquiryId)).decision_snapshot.coverage?.flagged ?? [];
    const check = flagged.find((f) => f.check?.field === "rule:same:carpets");
    assert.ok(check, JSON.stringify(flagged));
    await refusedForOther(pg, e.enquiryId, "rule:same:carpets", choice);
    await settle(pg, e.enquiryId, { checks: [[/carpets/, choice]] });
    const { body, sent } = await send(pg, a.businessId, e.enquiryId);
    assert.equal(sent.ok, true, JSON.stringify(sent));
    assert.match(body, /- Carpet steam clean: \$80/);
    assert.equal(/Yes, I can help with carpets/.test(body), said, body);
  }
});

test("round 2 (M5): a trial the owner calls 'Makeup preview' is priced on the trial's day, never held with the wedding", async (t) => {
  const { pg, a } = await setup(
    t,
    ["Bridal makeup $250", "Makeup preview $90", "We don't work Sundays"].join("\n"),
  );
  const e = await enquiry(pg, a.businessId, CHLOE, "Bridal makeup", WED_30_SEP);
  await refusedForOther(pg, e.enquiryId, "extra:Makeup preview", "include");
  await answer(pg, "user-a", e.enquiryId, "extra:Makeup preview", "include");
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(sent.ok && sent.amountMinor, 9000, body);
  assert.match(body, /For the makeup preview, that comes to \$90\./);
  assert.match(
    body,
    /I haven't included the bridal makeup, as I'm not available on Sunday 8 November\./,
  );
  assert.doesNotMatch(body, /nothing else/);
  assert.equal((snapshot as { closedDay?: { bookable: boolean } }).closedDay?.bookable, true);
  assert.equal(await verdict(pg, e.enquiryId), "Yes - reply ready, one date can't be done");
});
