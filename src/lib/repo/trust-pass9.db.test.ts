import assert from "node:assert/strict";
import test from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { ForbiddenError } from "./tenancy.server.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import { saveReplyDraftForUser } from "./owner-state-core.ts";
import { saveBusinessDetailsForUser } from "./business-rule-core.ts";
import { readBusinessDetails } from "../../domain/business-details-read.ts";
import {
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
 * Trust pass 9, against a real database: the independent review of PR #77.
 * Each repro is run on the reviewer's own day (Wednesday 14 October 2026 in
 * Brisbane, clock injected), driven the way the owner drives it, and the app's
 * own reply goes through the send path (`prepareReviewedSendInTransaction`).
 * Every write a second tenant could try is refused and moves nothing.
 */

const WED_14_OCT = new Date("2026-10-14T10:15:00+10:00");

const BUSINESS = [
  "Regular house clean $45 per hour, minimum 3 hours",
  "Oven clean $60",
  "End of lease clean $380 for up to 2 bedrooms, extra bedrooms $70 each",
  "Weekend jobs have a $50 surcharge",
  "Interior painting $28 per square metre",
  "Makeup trial $90",
  "Gel manicure $55",
  "We don't work Sundays",
  "We don't do exterior painting",
  "We have $20 million public liability insurance",
].join("\n");

async function setup(t: { after: (fn: () => Promise<void>) => void }, business = BUSINESS) {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Savvy Services");
  const b = await tenant(pg, "user-b", "Bravo");
  await tell(pg, a.businessId, business);
  return { pg, a, b };
}

async function auditRows(pg: PGlite, businessId: string) {
  return (
    await pg.query<{ summary: string; detail: string | null; object_type: string; actor: string }>(
      "select summary, detail, object_type, actor from audit_event where business_id = $1 order by at",
      [businessId],
    )
  ).rows;
}

test("H1: the house on Friday is the job; the birthday party on Saturday is only what it's for", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "My daughter's birthday party is Saturday. Can you do the house on Friday? About 3 hours. Jen",
    "Regular house clean",
    WED_14_OCT,
  );
  const first = await row(pg, e.enquiryId);
  assert.equal(first.date_label, "Fri 16 Oct");
  assert.deepEqual(
    first.decision_snapshot.dates?.map((d) => [d.iso, d.role]),
    [
      ["2026-10-16", "job"],
      ["2026-10-17", "event"],
    ],
  );
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  // Friday is a weekday: the weekend surcharge never lands on it.
  assert.equal(snapshot.price?.amountMinor, 13500, body);
  assert.match(body, /Friday 16 October/);
  assert.doesNotMatch(body, /done by Saturday|on Saturday 17 October - I'll confirm/);
});

test("H1/H2: 'wedding is Saturday 24 October, makeup done by Friday 23 October' - the deadline is the job", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "My wedding is Saturday 24 October, I need a makeup trial done by Friday 23 October. Amy",
    "Makeup trial",
    WED_14_OCT,
  );
  const first = await row(pg, e.enquiryId);
  assert.equal(first.date_label, "Deadline Fri 23 Oct");
  await settle(pg, e.enquiryId);
  const { body, sent } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(
    body,
    /I understand you need it done by Friday 23 October - I'll confirm whether that works\.\nI understand the wedding is on Saturday 24 October\./,
  );
  // The work is on Friday: the wedding's Saturday never brings the weekend surcharge in.
  assert.doesNotMatch(body, /weekend/i);
});

test("H4: 'Unit 5/12 Park Rd' is never said back as 5 December", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, Unit 5/12 Park Rd, end of lease clean please, 2 bedrooms. Thanks, Ravi",
    "End of lease clean",
    WED_14_OCT,
  );
  const first = await row(pg, e.enquiryId);
  assert.notEqual(first.date_label, "Sat 5 Dec");
  await settle(pg, e.enquiryId);
  const { body, sent } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.doesNotMatch(body, /December/);
  assert.doesNotMatch(body, /You mentioned/);
});

test("H5/H6: a makeup trial on Saturday 17 October is the job's day, and Saturday's surcharge is asked", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, could I book a makeup trial on Saturday 17 October? Zoe",
    "Makeup trial",
    WED_14_OCT,
  );
  const first = await row(pg, e.enquiryId);
  assert.equal(first.date_label, "Sat 17 Oct", "the trial is the job, never a trial beside it");
  const flag = first.decision_snapshot.coverage?.flagged.find((f) => /Weekend/i.test(f.text));
  assert.ok(flag?.check, JSON.stringify(first.decision_snapshot.coverage));
  await settle(pg, e.enquiryId, { checks: [[/Weekend/i, "apply"]] });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 14000, body);
  assert.match(body, /You mentioned Saturday 17 October - I'll confirm whether that works\./);
});

test("H6: 'Oven clean this weekend please' - the weekend surcharge is one tap, applied when chosen", async (t) => {
  const { pg, a, b } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Oven clean this weekend please. Tom",
    "Oven clean",
    WED_14_OCT,
  );
  const first = (await row(pg, e.enquiryId)).decision_snapshot;
  const flag = first.coverage?.flagged.find((f) => /Weekend/i.test(f.text));
  assert.ok(flag?.check, JSON.stringify(first.coverage));
  assert.equal(first.coverage?.confirmed, false);
  await refusedForOther(pg, e.enquiryId, flag!.check!.field, "apply");
  void b;
  await settle(pg, e.enquiryId, { checks: [[/Weekend/i, "apply"]] });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 11000, body);
});

test("H6: a stretch over a weekend is asked; 'not this time' says so in a 'Just so you know' line", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Could you do an oven clean sometime between 16 and 19 October? Pat",
    "Oven clean",
    WED_14_OCT,
  );
  const first = (await row(pg, e.enquiryId)).decision_snapshot;
  const flag = first.coverage?.flagged.find((f) => /Some of the days they mentioned/.test(f.text));
  assert.ok(flag?.check, JSON.stringify(first.coverage));
  await settle(pg, e.enquiryId, { checks: [[/Some of the days/, "waive"]] });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 6000, body);
  assert.match(body, /Just so you know, [^\n]*\$50/);
});

test("H7: an unscoped 'Minimum charge $150' blocks 'That's everything' until the owner taps", async (t) => {
  const { pg, a } = await setup(t, ["Oven clean $60", "Minimum charge $150"].join("\n"));
  const e = await enquiry(pg, a.businessId, "Oven clean please. Lee", "Oven clean", WED_14_OCT);
  const s = await row(pg, e.enquiryId);
  const flag = s.decision_snapshot.coverage?.flagged.find((f) => f.check);
  assert.ok(flag, JSON.stringify(s.decision_snapshot.coverage));
  const refused = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    enquiryId: e.enquiryId,
    key: s.decision_snapshot.coverage!.key,
    revision: Number(s.decision_revision),
  });
  assert.equal(refused.ok, false);
  assert.equal(!refused.ok && refused.reason, "unsettled");
  await settle(pg, e.enquiryId, { checks: [[/minimum/i, "apply"]] });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 15000, body);
});

test("M2: '4 of us live here' on a clean is never a headcount; 'me and my 2 kids' on a manicure is 3", async (t) => {
  const { pg, a } = await setup(t);
  const clean = await enquiry(
    pg,
    a.businessId,
    "Regular clean please, 3 hours on Tuesday 20 October, 4 of us live here. Kim",
    "Regular house clean",
    WED_14_OCT,
  );
  const c = (await row(pg, clean.enquiryId)).decision_snapshot;
  assert.ok(!c.coverage?.flagged.some((f) => /people/.test(f.text)), JSON.stringify(c.coverage));
  const nails = await enquiry(
    pg,
    a.businessId,
    "Gel nails for me and my 2 kids on Tuesday 20 October? Kim",
    "Gel manicure",
    WED_14_OCT,
  );
  const n = (await row(pg, nails.enquiryId)).decision_snapshot;
  const flag = n.coverage?.flagged.find((f) => /They mention 3 people/.test(f.text));
  assert.ok(flag?.check, JSON.stringify(n.coverage));
  // Before the owner chooses, nothing names a price for the booking.
  assert.doesNotMatch(n.draft.body, /that comes to \$55|per person/);
  await settle(pg, nails.enquiryId, { checks: [[/They mention 3 people/, "apply"]] });
  const { body, sent, snapshot } = await send(pg, a.businessId, nails.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 16500, body);
});

test("M4: a service question can be 'come back to you', and the reply says so; another tenant cannot", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Do you do exterior painting? Also the lounge walls inside, about 20 square metres. Nat",
    "Interior painting",
    WED_14_OCT,
  );
  const q = (await row(pg, e.enquiryId)).decision_snapshot.questionPending;
  assert.equal(q?.field, "question:exterior painting");
  await refusedForOther(pg, e.enquiryId, q!.field, "later");
  await answer(pg, "user-a", e.enquiryId, q!.field, "later");
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /I'll come back to you on exterior painting\./);
  assert.ok(
    snapshot.asked?.some((i) => i.id === "question:exterior painting" && i.status === "come_back"),
    JSON.stringify(snapshot.asked),
  );
});

test("M1: a kept edit whose figures move is on the record, with what it said before", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Mia Makeup", "beauty");
  await tenant(pg, "user-b", "Bravo");
  await tell(pg, a.businessId, "Makeup trial $90");
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
  const edited = `${prepared.replace("Hi there,", "Hi Mia,")}\n\nSo $90 all up. We carry $90 million cover.`;
  await tell(pg, a.businessId, "Makeup trial $95");
  await saveReplyDraftForUser(sqlFor(pg) as never, "user-a", e.enquiryId, edited);
  const r1 = await row(pg, e.enquiryId);
  const before = (await auditRows(pg, a.businessId)).length;
  const kept = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    enquiryId: e.enquiryId,
    key: r1.decision_snapshot.coverage!.key,
    revision: Number(r1.decision_revision),
  });
  assert.equal(kept.ok, true, JSON.stringify(kept));
  assert.deepEqual(kept.ok && kept.editKept?.changes, ["Total $90 -> $95"]);
  const audit = (await auditRows(pg, a.businessId)).slice(before);
  const record = audit.find(
    (r) => r.object_type === "enquiry" && /Your edit was kept/.test(r.summary),
  );
  assert.ok(record, JSON.stringify(audit));
  const detail = JSON.parse(record!.detail!) as { before: string; after: string };
  assert.equal(detail.before, edited);
  assert.match(detail.after, /So \$95 all up\. We carry \$90 million cover\./);
  const draft = await pg.query<{ body: string }>(
    "select body from reply_draft where enquiry_id = $1",
    [e.enquiryId],
  );
  // Pass 10 (review of PR #79): "$90 million" is read at its true value, but
  // bare "cover" is not named insurance ("Pool cover: $1,200" is a price), so
  // the kept edit with it is still refused; the reply that goes out is the
  // kept edit without it. "$90 million public liability" would go out.
  const kept = draft.rows[0]!.body;
  const refused = await sendAs(pg, a.businessId, e.enquiryId, kept);
  assert.equal(!refused.ok && refused.reason, "amount_mismatch");
  const sent = await sendAs(
    pg,
    a.businessId,
    e.enquiryId,
    kept.replace(" We carry $90 million cover.", ""),
  );
  assert.equal(sent.ok, true, JSON.stringify(sent));
  const named = await sendAs(
    pg,
    a.businessId,
    e.enquiryId,
    kept.replace("$90 million cover", "$90 million public liability"),
  );
  assert.equal(named.ok, true, JSON.stringify(named));
});

test("M6: working hours saved from a sentence are on the record with the hours they replaced; another tenant cannot", async (t) => {
  const { pg, a } = await setup(t);
  const details = readBusinessDetails("Mon-Sat 7am-5pm", WED_14_OCT).details.map((d) => d.detail);
  const before = await auditRows(pg, a.businessId);
  await assert.rejects(
    saveBusinessDetailsForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-b", {
      businessId: a.businessId,
      rules: [],
      details,
    }),
    ForbiddenError,
  );
  assert.equal((await auditRows(pg, a.businessId)).length, before.length);
  await saveBusinessDetailsForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    businessId: a.businessId,
    rules: [],
    details,
  });
  const record = (await auditRows(pg, a.businessId)).find((r) => /^Settings hours/.test(r.summary));
  assert.ok(record);
  assert.match(
    record!.summary,
    /^Settings hours change from .+ to Monday to Saturday 07:00-17:00$/,
  );
  const detail = JSON.parse(record!.detail!) as {
    previous: { workingDays: string; hoursStart: string; hoursEnd: string };
    next: { workingDays: string };
  };
  assert.equal(detail.next.workingDays, "Monday to Saturday");
  assert.ok(detail.previous.workingDays && detail.previous.hoursStart && detail.previous.hoursEnd);
  assert.ok(
    record!.summary.includes(`${detail.previous.workingDays} ${detail.previous.hoursStart}`),
  );
});

test("LOW: a snapshot decided before the ledger, with a question open, confirms with 'recheck'", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Oven clean please. Also, are you insured? Lee",
    "Oven clean",
    WED_14_OCT,
  );
  // Answered, so "That's everything" is showing...
  await answer(pg, "user-a", e.enquiryId, "ask:insurance", "Yes, we're fully insured.");
  await settle(pg, e.enquiryId);
  // ...then, as on an enquiry decided before the ledger existed, the snapshot
  // carries no ledger while the question is open again underneath it.
  await pg.query(
    "update enquiry_fact set superseded = true where enquiry_id = $1 and field = 'ask:insurance'",
    [e.enquiryId],
  );
  await pg.query(
    "update enquiry set decision_snapshot = decision_snapshot - 'asked' where id = $1",
    [e.enquiryId],
  );
  const s = await row(pg, e.enquiryId);
  assert.equal(s.decision_snapshot.asked, undefined);
  const res = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    enquiryId: e.enquiryId,
    key: s.decision_snapshot.coverage!.key,
    revision: Number(s.decision_revision),
  });
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.ok && res.confirmed, false);
  assert.equal(res.ok && res.reason, "recheck");
});
