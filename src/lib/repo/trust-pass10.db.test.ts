import assert from "node:assert/strict";
import test from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { ForbiddenError, requireEnquiryAccess } from "./tenancy.server.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import { toEnquiry, type EnquiryRow } from "./rows.ts";
import { promiseVerdict } from "../../domain/labels.ts";
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

test("4: insurance figures go out beside the total; cover, prices, line items and money with no quote do not", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, could I book a makeup trial please? Mia",
    "Makeup trial",
    WED_14_OCT,
  );
  const s0 = await row(pg, e.enquiryId);
  const done = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    enquiryId: e.enquiryId,
    key: s0.decision_snapshot.coverage!.key,
    revision: Number(s0.decision_revision),
  });
  assert.equal(done.ok, true);
  const prepared = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.match(prepared, /For the makeup trial, that comes to \$90\./);
  // Another tenant cannot reach the send path, and nothing is prepared or moved.
  const before = await row(pg, e.enquiryId);
  await assert.rejects(requireEnquiryAccess("user-b", e.enquiryId, sqlFor(pg)), ForbiddenError);
  assert.equal(await reviewedSends(pg, e.enquiryId), 0);
  assert.deepEqual(await row(pg, e.enquiryId), before);
  const edit = (line: string) => prepared.replace("Hi there,", "Hi Mia,") + `\n\n${line}`;
  for (const line of [
    "We have $20m public liability.",
    "We carry $1.5m public liability.",
    "Insurance claims carry a $2k excess.",
  ]) {
    const res = await sendAs(pg, a.businessId, e.enquiryId, edit(line));
    assert.equal(res.ok, true, `${line}: ${JSON.stringify(res)}`);
    assert.equal(res.ok && res.amountMinor, 9000, line);
  }
  for (const body of [
    prepared.replace("$90.", "$95."),
    edit("A $50 deposit and that's all."),
    "Hi Mia,\n\nA $50 deposit holds the day.\n\nThanks,\nSam",
    "Hi Mia,\n\nWe have $20m public liability.\n\nThanks,\nSam",
    edit("That comes to $2m."),
    edit("We carry $90 million cover."),
    edit("Price: $5,000 insurance included."),
    edit("Pool cover: $1,200."),
    edit("Deposit: $1m"),
    edit("That comes to £90."),
  ]) {
    const res = await sendAs(pg, a.businessId, e.enquiryId, body);
    assert.equal(!res.ok && res.reason, "amount_mismatch", body);
  }
});

test("4 (HIGH-3): money about insurance on a reply with no quote is refused, never read as 'no money named'", async (t) => {
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
  ]) {
    const res = await sendAs(pg, a.businessId, e.enquiryId, `${s.draft.body}\n\n${line}`);
    assert.equal(!res.ok && res.reason, "amount_mismatch", line);
  }
  assert.equal((await sendAs(pg, a.businessId, e.enquiryId, s.draft.body)).ok, true);
});
