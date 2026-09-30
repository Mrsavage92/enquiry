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
 * walking the app, and the send gate misreading "$90 million". Each repro is
 * driven the way the owner drives it on an injected day (Wednesday 30 September
 * or Wednesday 14 October 2026, Brisbane), and the app's own reply goes through
 * the send path (`prepareReviewedSendInTransaction`). Every write a second
 * tenant could try is refused and moves nothing.
 */

const WED_14_OCT = new Date("2026-10-14T10:15:00+10:00");

const MAKEUP = ["Makeup trial $90", "Bridal makeup $250", "We don't work Sundays"].join("\n");

async function setup(t: { after: (fn: () => Promise<void>) => void }, business = MAKEUP) {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Mia Makeup", "beauty");
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
  "I haven't included the bridal makeup ($250), as I'm not available on Sunday 8 November.",
  "",
  "You mentioned Sunday 8 November - I'm sorry, I'm not available on Sunday 8 November. Is there any flexibility on the date?",
  "For the trial, you mentioned Saturday 24 October - I'll confirm whether that works.",
  "",
  "Let me know what date suits and I'll confirm.",
  "",
  "Thanks,",
  "Sam",
].join("\n");

test("1/2 Chloe: the trial is priced, the Sunday wedding is not in the total, and the verdict says one date can't be done", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi! Wedding is Sunday 8 November, trial on 24 October. Chloe",
    "Bridal makeup",
    WED_30_SEP,
  );
  // "They mention makeup trial": the owner adds it at its saved $90.
  await refusedForOther(pg, e.enquiryId, "extra:Makeup trial", "include");
  await answer(pg, "user-a", e.enquiryId, "extra:Makeup trial", "include");
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  // Was "For the bridal makeup and the makeup trial, that comes to $340" -
  // a total for a wedding day the owner doesn't work, as if it could be booked.
  assert.equal(body, CHLOE_REPLY);
  assert.equal(snapshot.price?.amountMinor, 9000);
  assert.equal(sent.ok && sent.amountMinor, 9000, "the recorded quote is the trial's price");
  assert.doesNotMatch(body, /\$340|come back to you/);
  assert.equal(await verdict(pg, e.enquiryId), "Yes - reply ready, one date can't be done");
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
  assert.doesNotMatch(body, /come back to you with a price/);
  const item = snapshot.asked?.find((i) => i.id === "question:trial");
  assert.equal(item?.text, "Trial", "the ledger names what they asked, not 'Yes - you do this'");
  assert.equal(item?.status, "answered");
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

test("2: a Sunday wedding with nothing else to book is 'Not yet - that day is a closed day', and its price is never a bookable total", async (t) => {
  const { pg, a } = await setup(t);
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
  assert.match(body, /For the bridal makeup, that comes to \$250 on a day I'm available\./);
  assert.match(
    body,
    /You mentioned Sunday 8 November - I'm sorry, I'm not available on Sunday 8 November\. Is there any flexibility on the date\?/,
  );
  assert.equal((snapshot as { closedDay?: { bookable: boolean } }).closedDay?.bookable, false);
  // Was "Yes - reply ready".
  assert.equal(await verdict(pg, e.enquiryId), "Not yet - that day is a closed day");
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
         then i || '{"text": "No - you don''t do this"}'::jsonb else i end)
        from jsonb_array_elements(decision_snapshot->'asked') i))
     where id = $1`,
    [e.enquiryId],
  );
  const r = await pg.query<EnquiryRow>("select * from enquiry where id = $1", [e.enquiryId]);
  assert.equal(
    (r.rows[0]!.decision_snapshot as { asked: { id: string; text: string }[] }).asked.find(
      (i) => i.id === "question:exterior painting",
    )?.text,
    "No - you don't do this",
  );
  const read = toEnquiry(r.rows[0]!, { facts: [], conversation: [], quotes: [] });
  assert.equal(
    read.decision.asked?.find((i) => i.id === "question:exterior painting")?.text,
    "Exterior painting",
  );
});

test("4: '$90 million cover', '$20m public liability', '$1.5m', '$2k excess' go out; a different total or a deposit for the total does not", async (t) => {
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
    "We carry $90 million cover.",
    "We have $20m public liability.",
    "Our insurance is $1.5m.",
    "Any claim has a $2k excess.",
  ]) {
    const res = await sendAs(pg, a.businessId, e.enquiryId, edit(line));
    assert.equal(res.ok, true, `${line}: ${JSON.stringify(res)}`);
    assert.equal(res.ok && res.amountMinor, 9000, line);
  }
  for (const body of [
    prepared.replace("$90.", "$95."),
    edit("A $50 deposit and that's all."),
    "Hi Mia,\n\nA $50 deposit holds the day.\n\nThanks,\nSam",
    edit("That comes to $2m."),
  ]) {
    const res = await sendAs(pg, a.businessId, e.enquiryId, body);
    assert.equal(!res.ok && res.reason, "amount_mismatch", body);
  }
});
