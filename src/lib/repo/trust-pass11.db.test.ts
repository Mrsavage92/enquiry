import assert from "node:assert/strict";
import test from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { ForbiddenError, requireEnquiryAccess } from "./tenancy.server.ts";
import { confirmReviewedSendInTransaction } from "./sent-reply-core.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import { FORBIDDEN_PROMISES } from "../../domain/edit-warnings.ts";
import { toEnquiry, type EnquiryRow } from "./rows.ts";
import { promiseVerdict } from "../../domain/labels.ts";
import {
  WED_30_SEP,
  answer,
  enquiry,
  freshDb,
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
 * Trust pass 11, against a real database: the review of main d9651c5 (37/52).
 * Each repro is driven the way the owner drives it on Wednesday 30 September
 * 2026 in Brisbane (the injected clock in pass8-db-helpers), and every reply
 * that reaches a customer goes through `prepareReviewedSendInTransaction`.
 * A second tenant is refused and moves nothing.
 */

export const CLEANING = [
  "Regular house clean is $55 an hour, minimum 3 hours",
  "End of lease clean 2 bedroom $380",
  "End of lease clean 3 bedroom $480",
  "Oven clean $60",
  "Fridge clean $40",
  "Inside windows $8 per window",
  "Weekend jobs have a 20% surcharge",
  "We don't work Sundays",
  "Closed 24 December to 4 January",
  "We have $10 million public liability insurance",
].join("\n");

export const MEL =
  "hey there!! need an end of lease clean for my 3 bed unit in Chermside, moving out Fri 16th Oct. can u also do the oven + fridge?? how much all up. cheers Mel";

export async function setup(t: { after: (fn: () => Promise<void>) => void }, business = CLEANING) {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Dana Clean");
  await tenant(pg, "user-b", "Bravo");
  await tell(pg, a.businessId, business);
  return { pg, a };
}

async function confirmAs(
  pg: PGlite,
  businessId: string,
  enquiryId: string,
  reviewedSendId: string,
) {
  return tx(pg, (sql) =>
    confirmReviewedSendInTransaction(sql, {
      reviewedSendId,
      enquiryId,
      businessId,
      userId: "user-a",
      staleAttestation: false,
    }),
  );
}

async function messages(pg: PGlite, enquiryId: string): Promise<number> {
  const r = await pg.query(
    "select 1 from message where enquiry_id = $1 and direction = 'outbound'",
    [enquiryId],
  );
  return r.rows.length;
}

/** Mel's quote settled, the owner's own edit of the prepared reply, and its first review. */
async function melEdited(t: { after: (fn: () => Promise<void>) => void }) {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, MEL, "End of lease clean 3 bedroom");
  await settle(pg, e.enquiryId, {});
  const first = await send(pg, a.businessId, e.enquiryId);
  assert.equal(first.sent.ok, true, JSON.stringify(first.sent));
  const edited = first.body.replace(/\n\nThanks,\n/, "\n\nLooking forward to it.\n\nThanks,\n");
  assert.notEqual(edited, first.body);
  const reviewed = await sendAs(pg, a.businessId, e.enquiryId, edited);
  assert.equal(reviewed.ok, true, JSON.stringify(reviewed));
  return { pg, a, e, edited, reviewed: reviewed.ok ? reviewed : null };
}

test("1: 'Keep my edit' after 'Use this name' can be recorded - the same text is reviewed again at the new revision", async (t) => {
  const { pg, a, e, edited, reviewed } = await melEdited(t);
  const before = await row(pg, e.enquiryId);
  // Back, "Use this name": the decision moves on.
  await answer(pg, "user-a", e.enquiryId, "name", "Mel");
  const moved = await row(pg, e.enquiryId);
  assert.ok(moved.decision_revision > before.decision_revision);
  // Keep my edit, Review reply: the same words, prepared again.
  const again = await sendAs(pg, a.businessId, e.enquiryId, edited);
  assert.equal(again.ok, true, JSON.stringify(again));
  if (!again.ok || !reviewed) return;
  assert.equal(again.reviewedSendId, reviewed.reviewedSendId, "one row per exact text");
  assert.equal(
    again.decisionRevision,
    moved.decision_revision,
    "bound to the decision it was checked against",
  );
  // "I've sent this externally" records it, not "This enquiry has changed".
  const res = await confirmAs(pg, a.businessId, e.enquiryId, again.reviewedSendId);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.ok && res.stale, false);
  assert.equal(await messages(pg, e.enquiryId), 1);
});

test("1: a review nobody prepared again after the decision moved is still stale", async (t) => {
  const { pg, a, e, reviewed } = await melEdited(t);
  await answer(pg, "user-a", e.enquiryId, "name", "Mel");
  const res = await confirmAs(pg, a.businessId, e.enquiryId, reviewed!.reviewedSendId);
  assert.equal(res.ok, false);
  assert.equal(!res.ok && res.reason, "stale");
  assert.equal(await messages(pg, e.enquiryId), 0);
});

test("1: a recorded review is never re-pointed or recorded twice", async (t) => {
  const { pg, a, e, edited, reviewed } = await melEdited(t);
  const res = await confirmAs(pg, a.businessId, e.enquiryId, reviewed!.reviewedSendId);
  assert.equal(res.ok, true);
  const stored = await pg.query<{ decision_revision: number; amount_minor: number }>(
    "select decision_revision, amount_minor from reviewed_send where id = $1",
    [reviewed!.reviewedSendId],
  );
  // Preparing the same words again finds the recorded artefact, unchanged.
  const again = await sendAs(pg, a.businessId, e.enquiryId, edited);
  assert.equal(again.ok && again.alreadyConfirmed, true);
  const after = await pg.query<{ decision_revision: number; amount_minor: number }>(
    "select decision_revision, amount_minor from reviewed_send where id = $1",
    [reviewed!.reviewedSendId],
  );
  assert.deepEqual(after.rows[0], stored.rows[0]);
  const dup = await confirmAs(pg, a.businessId, e.enquiryId, reviewed!.reviewedSendId);
  assert.equal(dup.ok && dup.duplicate, true);
  assert.equal(await messages(pg, e.enquiryId), 1);
});

test("1: a text reviewed at an older price is refused, never re-bound to the new amount", async (t) => {
  const { pg, a, e, edited, reviewed } = await melEdited(t);
  // The owner adds the inside windows: the total moves.
  await answer(pg, "user-a", e.enquiryId, "extra:Inside windows", "include");
  await answer(pg, "user-a", e.enquiryId, "windows for inside windows", "4");
  await settle(pg, e.enquiryId, {});
  const again = await sendAs(pg, a.businessId, e.enquiryId, edited);
  assert.equal(again.ok, false, "the old total no longer agrees");
  const res = await confirmAs(pg, a.businessId, e.enquiryId, reviewed!.reviewedSendId);
  assert.equal(!res.ok && res.reason, "stale");
});

test("1: another tenant cannot reach the review and nothing moves", async (t) => {
  const { pg, e } = await melEdited(t);
  const before = await row(pg, e.enquiryId);
  const sends = await pg.query("select * from reviewed_send where enquiry_id = $1", [e.enquiryId]);
  await assert.rejects(requireEnquiryAccess("user-b", e.enquiryId, sqlFor(pg)), ForbiddenError);
  await assert.rejects(answer(pg, "user-b", e.enquiryId, "name", "Mel"), ForbiddenError);
  assert.deepEqual(await row(pg, e.enquiryId), before);
  const after = await pg.query("select * from reviewed_send where enquiry_id = $1", [e.enquiryId]);
  assert.deepEqual(after.rows, sends.rows);
});

// ---------------------------------------------------------------------------
// Shared: the ledger's date checks and the owner's one tap on each
// ---------------------------------------------------------------------------

type Asked = { id: string; kind: string; text: string; status: string; closed?: boolean };

async function ledger(pg: PGlite, enquiryId: string): Promise<Asked[]> {
  return (
    ((await row(pg, enquiryId)).decision_snapshot as unknown as { asked?: Asked[] }).asked ?? []
  );
}

/** Every closed day and unread date the sweep raised, answered the way the owner taps. */
async function settleDays(
  pg: PGlite,
  enquiryId: string,
  closedChoice = "not_available",
  userId = "user-a",
) {
  for (const item of await ledger(pg, enquiryId)) {
    if (item.status !== "open") continue;
    if (item.id.startsWith("closed_day:"))
      await answer(pg, userId, enquiryId, item.id, closedChoice);
    if (item.id.startsWith("date_check:")) await answer(pg, userId, enquiryId, item.id, "confirm");
  }
}

/** The whole owner flow: checks, days, "That's everything", then the app's own reply sent. */
async function settleAndSend(
  pg: PGlite,
  businessId: string,
  enquiryId: string,
  answers: Record<string, string> = {},
) {
  await settle(pg, enquiryId, { answers });
  await settleDays(pg, enquiryId);
  await settle(pg, enquiryId, { answers });
  return send(pg, businessId, enquiryId);
}

function assertNoPromises(body: string) {
  for (const re of FORBIDDEN_PROMISES) assert.doesNotMatch(body, re, body);
}

// ---------------------------------------------------------------------------
// 2. Never promise availability
// ---------------------------------------------------------------------------

test("2 Mel: a day about something else is said as theirs, never 'I'll work around that'", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, MEL, "End of lease clean 3 bedroom");
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assertNoPromises(body);
  assert.match(body, /I understand you're moving out on Friday 16 October\./);
  assert.doesNotMatch(body, /Just let me know if you'd like to go ahead\.\n/);
  assert.match(body, /Just let me know if you'd like to go ahead and I'll confirm the day\./);
});

// ---------------------------------------------------------------------------
// 3. Every day they mention is checked against closed dates
// ---------------------------------------------------------------------------

const JASE =
  "EOL clean 2br unit, settlement 28/12 so need it done 27th or 28th. oven too. $$? ta Jase";
const AHMED =
  "Hi, we need an end of lease clean for a 2 bedroom apartment. Our lease ends Sunday 27 December so it would need to be the 26th or 27th. Could you also do the inside windows, there are 10. Thanks, Ahmed";

test("3 Jase: '27th or 28th' beside 28/12 is read, and both days are in the closed stretch", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, JASE, "End of lease clean 2 bedroom");
  await settle(pg, e.enquiryId);
  const open = (await ledger(pg, e.enquiryId)).filter((i) => i.status === "open");
  assert.deepEqual(
    open.map((i) => i.text),
    [
      "A day they mention is one you don't work: Sun 27 Dec",
      "A day they mention is in your closed dates: Mon 28 Dec",
    ],
  );
  // The owner cannot say "That's everything" over a closed day nobody settled.
  const before = await row(pg, e.enquiryId);
  assert.equal(before.decision_snapshot.coverage?.confirmed, false);
  assert.match(
    before.decision_snapshot.draft.body,
    /You mentioned 27th or 28th - I'm sorry, I'm not available on Sunday 27 or Monday 28 December\./,
  );
  // Another tenant cannot settle it, and nothing moves.
  const fieldId = open[0]!.id;
  const snap = await row(pg, e.enquiryId);
  await assert.rejects(answer(pg, "user-b", e.enquiryId, fieldId, "not_available"), ForbiddenError);
  assert.deepEqual(await row(pg, e.enquiryId), snap);
  // A made-up choice is refused.
  await assert.rejects(answer(pg, "user-a", e.enquiryId, fieldId, "maybe"));
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /I'm not available on Sunday 27 or Monday 28 December\./);
  assert.match(body, /Let me know what date suits and I'll confirm\./);
  assert.doesNotMatch(body, /Just let me know if you'd like to go ahead/);
  assertNoPromises(body);
  // Both days are closed, so the weekend rate is never asked about: the quote
  // is for the day the owner would offer instead.
  const surcharge = await pg.query(
    "select 1 from enquiry_fact where enquiry_id = $1 and field like 'rule:surcharge%'",
    [e.enquiryId],
  );
  assert.equal(surcharge.rows.length, 0);
  assert.equal(sent.ok && sent.amountMinor, 44_000);
  // Settled as not available, each day reads "Not available" and the verdict says so.
  const days = (await ledger(pg, e.enquiryId)).filter((i) => i.id.startsWith("closed_day:"));
  assert.deepEqual(
    days.map((d) => d.closed),
    [true, true],
  );
  const r = await pg.query<EnquiryRow>("select * from enquiry where id = $1", [e.enquiryId]);
  const enq = toEnquiry(r.rows[0]!, { facts: [], conversation: [], quotes: [] });
  assert.equal(promiseVerdict(enq).line, "Yes - reply ready, two dates can't be done");
});

test("3 Ahmed: 'lease ends Sunday 27 December ... the 26th or 27th' is never 'I'll work around that'", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, AHMED, "End of lease clean 2 bedroom");
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId, {
    "windows for inside windows": "10",
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /I understand your lease ends on Sunday 27 December\./);
  assert.match(
    body,
    /You mentioned the 26th or 27th - I'm sorry, I'm not available on Saturday 26 or Sunday 27 December\./,
  );
  assert.doesNotMatch(body, /Just let me know if you'd like to go ahead/);
  assertNoPromises(body);
});

test("3: the owner can say they do that day - the reply then only says they'll confirm", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, JASE, "End of lease clean 2 bedroom");
  await settle(pg, e.enquiryId);
  await settleDays(pg, e.enquiryId, "available");
  const body = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.doesNotMatch(body, /not available/);
  assert.match(body, /You mentioned 27th or 28th - I'll confirm which day works\./);
});

test("3 Dr Carter-Wong: 'next Thursday' on Wednesday 30 September is Thursday 8 October", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, could you do a regular clean? Would you be free next Thursday? Thanks, Liz",
    "Regular house clean",
  );
  assert.equal((await row(pg, e.enquiryId)).date_label, "Thu 8 Oct");
  const f = await enquiry(
    pg,
    a.businessId,
    "Hi, could you do a regular clean this Thursday? Thanks, Liz",
    "Regular house clean",
  );
  assert.equal((await row(pg, f.enquiryId)).date_label, "Thu 1 Oct");
});

test("3 Tom: 'the week of 9 Nov' stays a week, never 'You mentioned 9 November'", async (t) => {
  const { pg, a } = await setup(t, "Interior painting $32 per sqm, minimum charge $600");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, we'd like the lounge walls painted, 55 square metres. We're hoping for the week of 9 Nov if possible. Regards, Tom",
    "Interior painting",
  );
  const body = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.match(body, /You mentioned the week of 9 November - I'll confirm which day works\./);
  assert.doesNotMatch(body, /You mentioned 9 November/);
});

test("3: a week that runs into closed dates is the owner's to settle", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, end of lease clean please, the week of 21 December. Thanks, Kim",
    "End of lease clean 2 bedroom",
  );
  const open = (await ledger(pg, e.enquiryId)).filter((i) => i.status === "open");
  assert.ok(open.some((i) => i.text === "Part of the week of 21 December is in your closed dates"));
  // Said as not available, the closed days in that week are named.
  await settleDays(pg, e.enquiryId);
  assert.match(
    (await row(pg, e.enquiryId)).decision_snapshot.draft.body,
    /You mentioned the week of 21 December - I'll confirm which day works\.\nI'm sorry, I'm not available on Thursday 24, Friday 25, Saturday 26 or Sunday 27 December\./,
  );
});

// ---------------------------------------------------------------------------
// 4. A surcharge on a day the owner does not work is never offered
// ---------------------------------------------------------------------------

test("4 Rob: Sunday 11 October is not worked - no Sunday rate, and the quote is for Monday's price", async (t) => {
  const { pg, a } = await setup(
    t,
    [
      "Interior painting $32 per sqm, minimum charge $600",
      "Weekend jobs have a 20% surcharge",
      "We don't work Sundays",
    ].join("\n"),
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "G'day, looking to get the kitchen walls painted, it's only small, 15 square metres. Could you do Sunday 11 October? Cheers, Rob Kelly",
    "Interior painting",
  );
  const seen: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const s = (await row(pg, e.enquiryId)).decision_snapshot;
    seen.push(...(s.coverage?.flagged ?? []).map((f) => f.text));
    await settle(pg, e.enquiryId, { checks: [[/minimum/i, "apply"]] });
  }
  assert.ok(!seen.some((t2) => /sunday rate|20% more/i.test(t2)), seen.join(" | "));
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(sent.ok && sent.amountMinor, 60_000, "the price for the Monday the reply offers");
  assert.match(body, /I could look at Monday 12 October/);
  assert.doesNotMatch(body, /\$720|Sunday rate/);
});

test("4 Priyanka: Saturday 2 January inside the closed stretch never gets the Saturday rate", async (t) => {
  const { pg, a } = await setup(
    t,
    [
      "Interior painting $32 per sqm, minimum charge $600",
      "Weekend jobs have a 20% surcharge",
      "Closed 24 December to 4 January",
    ].join("\n"),
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, we settle on Saturday 2 January and would love the place painted that day, approx 90 square metres. Is that doable? Priyanka & Dev",
    "Interior painting",
  );
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(sent.ok && sent.amountMinor, 288_000);
  assert.doesNotMatch(body, /Saturday rate/);
});

// ---------------------------------------------------------------------------
// 5. Every item in the message is in the ledger
// ---------------------------------------------------------------------------

test("5 Tom: 'Also a feature wall in the bedroom' is an item to settle, never dropped", async (t) => {
  const { pg, a } = await setup(t, "Interior painting $32 per sqm, minimum charge $600");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, we'd like the lounge walls painted, 55 square metres. Also a feature wall in the bedroom. Regards, Tom",
    "Interior painting",
  );
  const items = await ledger(pg, e.enquiryId);
  const wall = items.find((i) => /feature wall/i.test(i.text));
  assert.ok(wall, JSON.stringify(items));
  assert.equal(wall!.status, "open");
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /feature wall/i, "the reply says what happens to it");
});

test("5 Dr Carter-Wong: the weekly clean is its own item, and the painting is never 'per visit'", async (t) => {
  const { pg, a } = await setup(
    t,
    [
      "Interior painting $32 per sqm",
      "Inside windows $8 per window",
      "Regular house clean is $55 an hour, minimum 3 hours",
    ].join("\n"),
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "Good afternoon,\n\nWe would like the interior painted before we move in, approximately 120 square metres of walls. We would also like the inside windows cleaned, 14 of them, and a regular clean once we are in, probably weekly.\n\nKind regards,\nDr Elizabeth Carter-Wong",
    "Interior painting",
  );
  const items = await ledger(pg, e.enquiryId);
  assert.ok(
    items.some((i) => i.text === "Regular house clean"),
    JSON.stringify(items),
  );
  await settle(pg, e.enquiryId, {
    answers: {
      "extra:Regular house clean": "come_back",
      "windows for inside windows": "14",
    },
  });
  const s = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.ok(!(s.coverage?.flagged ?? []).some((f) => f.kind === "recurring"));
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId, {
    "extra:Regular house clean": "come_back",
    "windows for inside windows": "14",
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.doesNotMatch(body, /per visit/);
  assert.match(body, /regular house clean/i);
});

// ---------------------------------------------------------------------------
// 6 and 7. The send check: saved answers typed by hand, warnings, money words
// ---------------------------------------------------------------------------

async function melReady(t: { after: (fn: () => Promise<void>) => void }) {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, MEL, "End of lease clean 3 bedroom");
  const first = await settleAndSend(pg, a.businessId, e.enquiryId);
  assert.equal(first.sent.ok, true, JSON.stringify(first.sent));
  return { pg, a, e, body: first.body };
}

test("6: the owner's saved insurance sentence typed by hand is that answer; another figure is refused", async (t) => {
  const { pg, a, e, body } = await melReady(t);
  const withAnswer = body.replace(
    "\n\nThanks,",
    "\n\nwe have $10 million public liability insurance\n\nThanks,",
  );
  const ok = await sendAs(pg, a.businessId, e.enquiryId, withAnswer);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const own = body.replace(
    "\n\nThanks,",
    "\n\nWe carry $10m in public liability cover.\n\nThanks,",
  );
  assert.equal((await sendAs(pg, a.businessId, e.enquiryId, own)).ok, true);
  for (const line of [
    "We are fully insured with $5m public liability.",
    "We carry 20 mil in public liability cover.",
  ]) {
    const res = await sendAs(
      pg,
      a.businessId,
      e.enquiryId,
      body.replace("\n\nThanks,", `\n\n${line}\n\nThanks,`),
    );
    assert.equal(!res.ok && res.reason, "amount_mismatch", line);
    assert.equal(
      !res.ok && res.message,
      "Your saved insurance answer says $10,000,000. Use that figure, or change your saved answer first.",
    );
  }
  const grand = await sendAs(
    pg,
    a.businessId,
    e.enquiryId,
    body.replace("\n\nThanks,", "\n\nAll up it is half a grand.\n\nThanks,"),
  );
  assert.equal(!grand.ok && grand.reason, "amount_mismatch");
});

test("7: promises the owner writes are listed to check; sending anyway is one tap, recorded", async (t) => {
  const { pg, a, e, body } = await melReady(t);
  const edited = body.replace(
    "\n\nThanks,",
    "\n\nI can do 10% off that. I will throw in the fridge clean for free. You are booked in for Friday 16 October. I am fully licensed and police checked. I can come Sunday 18 October instead.\n\nThanks,",
  );
  const prepared = await tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: e.enquiryId,
      businessId: a.businessId,
      userId: "user-a",
      body: edited,
      channel: "manual",
      now: WED_30_SEP,
    }),
  );
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) return;
  const warned = prepared.warnings.join(" | ");
  for (const re of [
    /10% off/,
    /throw in|free/,
    /booked/,
    /licensed/,
    /"Sunday 18 October" - I don't work Sundays/,
    /I can come/,
  ]) {
    assert.match(warned, re);
  }
  const refused = await tx(pg, (sql) =>
    confirmReviewedSendInTransaction(sql, {
      reviewedSendId: prepared.reviewedSendId,
      enquiryId: e.enquiryId,
      businessId: a.businessId,
      userId: "user-a",
      now: WED_30_SEP,
    }),
  );
  assert.equal(!refused.ok && refused.reason, "warnings");
  assert.equal(await messages(pg, e.enquiryId), 0);
  const sent = await tx(pg, (sql) =>
    confirmReviewedSendInTransaction(sql, {
      reviewedSendId: prepared.reviewedSendId,
      enquiryId: e.enquiryId,
      businessId: a.businessId,
      userId: "user-a",
      acknowledgedWarnings: true,
      now: WED_30_SEP,
    }),
  );
  assert.equal(sent.ok, true, JSON.stringify(sent));
  const audit = await pg.query<{ detail: string }>(
    "select detail from audit_event where object_id = $1 order by at desc limit 1",
    [e.enquiryId],
  );
  assert.match(audit.rows[0]!.detail, /Sent anyway after checking: .*10% off/);
  // The app's own reply warns about nothing.
  const clean = await tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: e.enquiryId,
      businessId: a.businessId,
      userId: "user-a",
      body,
      channel: "manual",
      now: WED_30_SEP,
    }),
  );
  assert.deepEqual(clean.ok && clean.warnings, []);
});

// ---------------------------------------------------------------------------
// 8. A closed wedding day is "Not available", never "Answered"
// ---------------------------------------------------------------------------

test("8 Priya: the wedding day she asked for is closed, and the ledger says so", async (t) => {
  const { pg, a } = await setup(
    t,
    ["Bridal makeup $250", "Closed Saturday 14 November"].join("\n"),
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi! My wedding is Saturday 14 November, can you do my bridal makeup? Priya",
    "Bridal makeup",
  );
  const date = (await ledger(pg, e.enquiryId)).find((i) => i.id === "date");
  assert.equal(date?.closed, true, JSON.stringify(date));
});

// ---------------------------------------------------------------------------
// 9. Vague asks, negations, added days
// ---------------------------------------------------------------------------

test("9: 'How much for a clean?' - the owner asks which clean, one tap, and it can be sent", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, "How much for a clean?\n\nSent from my iPhone");
  const before = await row(pg, e.enquiryId);
  await assert.rejects(answer(pg, "user-b", e.enquiryId, "ask_service", "yes"), ForbiddenError);
  assert.deepEqual(await row(pg, e.enquiryId), before);
  await answer(pg, "user-a", e.enquiryId, "ask_service", "yes");
  const s = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(s.recommendation.action, "REQUEST_INFORMATION");
  assert.match(
    s.draft.body,
    /Before I can give you a price, which clean are you after\? I do regular house clean, end of lease clean, oven clean and fridge clean\./,
  );
  const sent = await sendAs(pg, a.businessId, e.enquiryId, s.draft.body);
  assert.equal(sent.ok, true, JSON.stringify(sent));
});

test("9 Steph: 'Nothing bridal, just glam' never asks about bridal makeup", async (t) => {
  const { pg, a } = await setup(
    t,
    ["Bridal makeup $250", "Party makeup $110 per person"].join("\n"),
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "Are you free Saturday 7 November for makeup for 6 of us for a hens party? Nothing bridal, just glam.",
    "Party makeup",
  );
  const items = await ledger(pg, e.enquiryId);
  assert.ok(!items.some((i) => /bridal/i.test(i.text)), JSON.stringify(items));
  // Nor is it a thing they "mention" on the quote's check.
  const flags: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const s = (await row(pg, e.enquiryId)).decision_snapshot;
    flags.push(...(s.coverage?.flagged ?? []).map((f) => f.text));
    await settle(pg, e.enquiryId, {
      answers: { people: "6", "ask:availability": "2026-11-07=later" },
    });
  }
  assert.ok(!flags.some((f) => /bridal/i.test(f)), flags.join(" | "));
});

test("9: a day the owner adds is read on the server and said in the reply; another tenant cannot add one", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "EOL clean 2br unit please. ta Jase",
    "End of lease clean 2 bedroom",
  );
  const before = await row(pg, e.enquiryId);
  await assert.rejects(
    answer(pg, "user-b", e.enquiryId, "date_added:Sunday 27 December", "added"),
    ForbiddenError,
  );
  assert.deepEqual(await row(pg, e.enquiryId), before);
  await assert.rejects(answer(pg, "user-a", e.enquiryId, "date_added:whenever suits", "added"));
  await answer(pg, "user-a", e.enquiryId, "date_added:Sunday 27 December", "added");
  const body = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.match(
    body,
    /You mentioned Sunday 27 December - I'm sorry, I'm not available on Sunday 27 December\./,
  );
  const items = await ledger(pg, e.enquiryId);
  assert.ok(items.some((i) => i.text === "Sunday 27 December" && i.closed));
});

test("9: a 'jobs over $2000' discount taken off goes out through the send path, threshold and all", async (t) => {
  const { pg, a } = await setup(
    t,
    ["Interior painting $32 per sqm", "Jobs over $2000 get $100 off"].join("\n"),
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, please quote painting the whole interior, 90 square metres of walls. Thanks, Sam",
    "Interior painting",
  );
  await settle(pg, e.enquiryId, { checks: [[/over \$2,000/, "apply"]] });
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(sent.ok && sent.amountMinor, 278_000);
  assert.match(body, /\$100 off jobs over \$2,000/);
  // Another tenant cannot take the discount, and nothing moves.
  const before = await row(pg, e.enquiryId);
  await assert.rejects(
    answer(pg, "user-b", e.enquiryId, "rule:discount:over:2000:100", "waive"),
    ForbiddenError,
  );
  assert.deepEqual(await row(pg, e.enquiryId), before);
});
