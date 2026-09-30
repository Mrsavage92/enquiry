import assert from "node:assert/strict";
import test from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { ForbiddenError, requireEnquiryAccess } from "./tenancy.server.ts";
import { confirmReviewedSendInTransaction } from "./sent-reply-core.ts";
import {
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
