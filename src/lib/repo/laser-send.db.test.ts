import assert from "node:assert/strict";
import test from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { ForbiddenError } from "./tenancy.server.ts";
import {
  WED_30_SEP,
  answer,
  enquiry,
  freshDb,
  row,
  sendAs,
  sqlFor,
  tell,
  tenant,
  tx,
} from "./pass8-db-helpers.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import { confirmReviewedSendInTransaction } from "./sent-reply-core.ts";
import { undoRecordedSendInTransaction } from "./undo-send-core.ts";
import { clearCopiedForUser, markCopiedForUser } from "./copied-core.ts";
import { loadEnquiry } from "./laser-drive.ts";
import { SCOPE_REMOVED } from "./reviewed-send-core.ts";
import { GREETING_FIELD } from "../../domain/greeting.ts";
import { EXTRA_CHOICE } from "../../domain/extras.ts";

/**
 * The send contract behind the laser screen, against a real database and two
 * tenants: the coverage tap folded into Copy only when the app is sure and only
 * confirmed by the recorded send; the copy marks; the two-signal greeting.
 */

async function shop(t: Parameters<typeof freshDb>[0], lines: string[], industry = "cleaning") {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Alpha Co", industry);
  const b = await tenant(pg, "user-b", "Bravo Co", industry);
  if (lines.length) await tell(pg, a.businessId, lines.join("\n"));
  return { pg, a, b };
}

async function record(
  pg: PGlite,
  businessId: string,
  enquiryId: string,
  id: string,
  stale = false,
) {
  return tx(pg, (sql) =>
    confirmReviewedSendInTransaction(sql, {
      reviewedSendId: id,
      enquiryId,
      businessId,
      userId: "user-a",
      staleAttestation: stale,
    }),
  );
}

async function coverageFacts(pg: PGlite, enquiryId: string) {
  return (
    await pg.query<{ status: string }>(
      "select status from enquiry_fact where enquiry_id = $1 and field = 'coverage' and superseded = false",
      [enquiryId],
    )
  ).rows;
}

test("fold: the folded reply is the reply 'That's everything' would have prepared, word for word", async (t) => {
  const { pg, a } = await shop(t, ["Oven clean $95"]);
  const folded = await enquiry(pg, a.businessId, "Oven clean please. Jo", "Oven clean", WED_30_SEP);
  const plain = await enquiry(pg, a.businessId, "Oven clean please. Jo", "Oven clean", WED_30_SEP);
  const snap = (await row(pg, folded.enquiryId)).decision_snapshot as never as {
    fold?: { body: string; scope: string[]; items: number };
    coverage?: { confirmed: boolean };
  };
  assert.ok(snap.fold, "a clean quote folds");
  assert.equal(snap.coverage?.confirmed, false);
  assert.deepEqual(snap.fold.scope, ["For the oven clean, that comes to $95."]);
  const before = await row(pg, plain.enquiryId);
  const res = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    enquiryId: plain.enquiryId,
    key: before.decision_snapshot.coverage!.key,
    revision: Number(before.decision_revision),
  });
  assert.equal(res.ok, true);
  assert.equal(snap.fold.body, (await row(pg, plain.enquiryId)).decision_snapshot.draft.body);
});

test("fold: copying records nothing; recording confirms the coverage; a reply without its scope is refused", async (t) => {
  const { pg, a } = await shop(t, ["Oven clean $95"]);
  const e = await enquiry(pg, a.businessId, "Oven clean please. Jo", "Oven clean", WED_30_SEP);
  const snap = (await row(pg, e.enquiryId)).decision_snapshot as never as {
    fold: { body: string };
  };
  // A crafted reply naming the total without saying what it covers.
  const bare = "Hi there,\n\nThat's $95.\n\nThanks";
  const refused = await sendAs(pg, a.businessId, e.enquiryId, bare);
  assert.equal(!refused.ok && refused.reason, "scope_removed");
  assert.equal(!refused.ok && refused.message, SCOPE_REMOVED);
  // No money at all and no scope: refused the same way, never a silent covering note.
  const note = await sendAs(
    pg,
    a.businessId,
    e.enquiryId,
    "Hi there,\n\nI'll be in touch.\n\nThanks",
  );
  assert.equal(!note.ok && note.reason, "scope_removed");
  const frozen = await pg.query("select 1 from reviewed_send where enquiry_id = $1", [e.enquiryId]);
  assert.equal(frozen.rows.length, 0, "nothing frozen for a refused reply");

  const ok = await sendAs(pg, a.businessId, e.enquiryId, snap.fold.body);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  if (!ok.ok) return;
  assert.equal(ok.namesAmount, true);
  assert.equal(ok.confirmsCoverage, true);
  assert.equal(ok.amountMinor, 9500);
  assert.deepEqual(await coverageFacts(pg, e.enquiryId), [], "the check alone confirms nothing");

  const done = await record(pg, a.businessId, e.enquiryId, ok.reviewedSendId);
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.deepEqual(await coverageFacts(pg, e.enquiryId), [{ status: "confirmed" }]);
  const state = await pg.query<{ decision_state: string; commercial_state: string }>(
    "select decision_state, commercial_state from enquiry where id = $1",
    [e.enquiryId],
  );
  assert.deepEqual(state.rows[0], {
    decision_state: "WAITING_ON_CLIENT",
    commercial_state: "QUOTED",
  });
});

test("fold: the coverage moved after Copy - refused as stale; 'I already sent that older message' records it without confirming", async (t) => {
  const { pg, a } = await shop(t, ["Oven clean $95"]);
  const e = await enquiry(pg, a.businessId, "Oven clean please. Jo", "Oven clean", WED_30_SEP);
  const body = (
    (await row(pg, e.enquiryId)).decision_snapshot as never as { fold: { body: string } }
  ).fold.body;
  const ok = await sendAs(pg, a.businessId, e.enquiryId, body);
  assert.ok(ok.ok);
  if (!ok.ok) return;
  // Something new is said about the job before the owner taps Yes.
  await answer(pg, "user-a", e.enquiryId, "extra:fridge clean", EXTRA_CHOICE.comeBack);
  const stale = await record(pg, a.businessId, e.enquiryId, ok.reviewedSendId);
  assert.equal(!stale.ok && stale.reason, "stale");
  assert.deepEqual(await coverageFacts(pg, e.enquiryId), []);
  const sent = await pg.query(
    "select 1 from message where enquiry_id = $1 and direction = 'outbound'",
    [e.enquiryId],
  );
  assert.equal(sent.rows.length, 0, "nothing recorded");
  const history = await record(pg, a.businessId, e.enquiryId, ok.reviewedSendId, true);
  assert.equal(history.ok, true, JSON.stringify(history));
  assert.deepEqual(
    await coverageFacts(pg, e.enquiryId),
    [],
    "history never confirms the newer coverage",
  );
});

test("fold: an item read rather than said keeps its own confirm tap", async (t) => {
  const { pg, a } = await shop(t, ["Interior painting $32 per square metre"], "painting");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, could you quote to paint the lounge, maybe 40sqm? Rachel",
    "Interior painting",
    WED_30_SEP,
  );
  for (let i = 0; i < 3; i += 1) {
    const s = (await row(pg, e.enquiryId)).decision_snapshot;
    const reading = s.missing.find((m) => m.inferred);
    if (!reading) break;
    await answer(pg, "user-a", e.enquiryId, reading.factField, reading.inferred!.value);
  }
  const snap = (await row(pg, e.enquiryId)).decision_snapshot as never as {
    fold?: unknown;
    coverage?: { confirmed: boolean };
  };
  assert.equal(snap.coverage?.confirmed, false);
  assert.equal(snap.fold, undefined, "a rough size is never folded into Copy");
  const crafted = "Hi there,\n\nFor the interior painting, that comes to about $1,280.\n\nThanks";
  const refused = await sendAs(pg, a.businessId, e.enquiryId, crafted);
  assert.equal(!refused.ok && refused.reason, "coverage_unconfirmed");
});

test("namesAmount: a confirmed quote's own reply names it; a covering note does not", async (t) => {
  const { pg, a } = await shop(t, ["Oven clean $95"]);
  const e = await enquiry(pg, a.businessId, "Oven clean please. Jo", "Oven clean", WED_30_SEP);
  const before = await row(pg, e.enquiryId);
  await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    enquiryId: e.enquiryId,
    key: before.decision_snapshot.coverage!.key,
    revision: Number(before.decision_revision),
  });
  const ready = await row(pg, e.enquiryId);
  const named = await sendAs(pg, a.businessId, e.enquiryId, ready.decision_snapshot.draft.body);
  assert.equal(named.ok && named.namesAmount, true);
  assert.equal(named.ok && named.confirmsCoverage, false);
  const note = await sendAs(
    pg,
    a.businessId,
    e.enquiryId,
    "Hi there,\n\nI'll call you today.\n\nThanks",
  );
  assert.equal(note.ok, true, JSON.stringify(note));
  assert.equal(note.ok && note.namesAmount, false);
});

test("copy marks: one tenant only; Not yet clears; a recorded send and a week's age end them", async (t) => {
  const { pg, a } = await shop(t, ["Oven clean $95"]);
  const e = await enquiry(pg, a.businessId, "Oven clean please. Jo", "Oven clean", WED_30_SEP);
  const body = (
    (await row(pg, e.enquiryId)).decision_snapshot as never as { fold: { body: string } }
  ).fold.body;
  const ok = await sendAs(pg, a.businessId, e.enquiryId, body);
  assert.ok(ok.ok);
  if (!ok.ok) return;
  const mark = { enquiryId: e.enquiryId, reviewedSendId: ok.reviewedSendId };

  // The second tenant gets Forbidden, and nothing moves.
  await assert.rejects(markCopiedForUser(sqlFor(pg), "user-b", mark), ForbiddenError);
  await assert.rejects(
    clearCopiedForUser(sqlFor(pg), "user-b", { enquiryId: e.enquiryId }),
    ForbiddenError,
  );
  const untouched = await pg.query("select copied_at from reviewed_send where id = $1", [
    ok.reviewedSendId,
  ]);
  assert.equal(untouched.rows[0] && (untouched.rows[0] as { copied_at: unknown }).copied_at, null);

  const marked = await markCopiedForUser(sqlFor(pg), "user-a", mark);
  assert.equal(marked.ok, true);
  const loaded = (await loadEnquiry(pg, e.enquiryId)).enquiry;
  assert.equal(loaded.copied?.reviewedSendId, ok.reviewedSendId);
  assert.equal(loaded.copied?.body, body.trim());

  // Copying the same text again marks once; the other tenant still sees nothing of it.
  await assert.rejects(markCopiedForUser(sqlFor(pg), "user-b", mark), ForbiddenError);
  const notYet = await clearCopiedForUser(sqlFor(pg), "user-a", { enquiryId: e.enquiryId });
  assert.equal(notYet.cleared, 1);
  assert.equal((await loadEnquiry(pg, e.enquiryId)).enquiry.copied, undefined);

  // A week-old mark is never offered again.
  await markCopiedForUser(sqlFor(pg), "user-a", mark);
  await pg.query("update reviewed_send set copied_at = now() - interval '8 days' where id = $1", [
    ok.reviewedSendId,
  ]);
  assert.equal((await loadEnquiry(pg, e.enquiryId)).enquiry.copied, undefined);

  // A recorded send consumes it.
  await markCopiedForUser(sqlFor(pg), "user-a", mark);
  assert.ok((await loadEnquiry(pg, e.enquiryId)).enquiry.copied);
  const done = await record(pg, a.businessId, e.enquiryId, ok.reviewedSendId);
  assert.equal(done.ok, true);
  assert.equal((await loadEnquiry(pg, e.enquiryId)).enquiry.copied, undefined);
  const again = await markCopiedForUser(sqlFor(pg), "user-a", mark);
  assert.equal(again.ok, false, "a recorded reply is never marked copied");
});

const TOM_EMAIL =
  "Hi, oven clean please, the oven's pretty grubby.\n\nThanks\nTom Nguyen\ntom.nguyen92@example.com";
const TOM_ONLY = "Hi, oven clean please, the oven's pretty grubby.\n\nThanks\nTom Nguyen";

test("greeting: a read name greets only when a second signal agrees; the owner can switch either way", async (t) => {
  const { pg, a } = await shop(t, ["Oven clean $95"]);
  const agreed = await enquiry(pg, a.businessId, TOM_EMAIL, "Oven clean", WED_30_SEP);
  const single = await enquiry(pg, a.businessId, TOM_ONLY, "Oven clean", WED_30_SEP);
  const name = async (id: string) =>
    (
      await pg.query<{ status: string; value: string }>(
        "select status, value from enquiry_fact where enquiry_id = $1 and field = 'name' and superseded = false",
        [id],
      )
    ).rows[0];
  const body = async (id: string) => {
    const s = (await row(pg, id)).decision_snapshot as never as {
      fold?: { body: string };
      draft: { body: string };
    };
    return s.fold?.body ?? s.draft.body;
  };
  assert.equal((await name(agreed.enquiryId))?.status, "inferred");
  assert.match(await body(agreed.enquiryId), /^Hi Tom,/, "sign-off and email agree");
  assert.match(await body(single.enquiryId), /^Hi there,/, "the sign-off alone is not enough");

  // "Greet as Tom?" and "Use Hi there" are fact writes, tenant-scoped.
  await assert.rejects(
    answer(pg, "user-b", single.enquiryId, GREETING_FIELD, "name"),
    ForbiddenError,
  );
  await assert.rejects(answer(pg, "user-a", single.enquiryId, GREETING_FIELD, "Tom"), /greets/);
  await answer(pg, "user-a", single.enquiryId, GREETING_FIELD, "name");
  assert.match(await body(single.enquiryId), /^Hi Tom,/);
  await answer(pg, "user-a", agreed.enquiryId, GREETING_FIELD, "there");
  assert.match(await body(agreed.enquiryId), /^Hi there,/);
  const customer = await pg.query<{ customer_name: string }>(
    "select customer_name from enquiry where id = $1",
    [agreed.enquiryId],
  );
  assert.equal(customer.rows[0]?.customer_name, "Tom Nguyen", "the choice never reaches the name");
  assert.equal((await name(single.enquiryId))?.status, "inferred", "nothing confirms it early");

  // Recording a reply that greets by the read name confirms the reading; Undo still works.
  const text = await body(single.enquiryId);
  const prepared = await sendAs(pg, a.businessId, single.enquiryId, text);
  assert.ok(prepared.ok, JSON.stringify(prepared));
  if (!prepared.ok) return;
  const done = await record(pg, a.businessId, single.enquiryId, prepared.reviewedSendId);
  assert.ok(done.ok && done.messageId);
  assert.equal((await name(single.enquiryId))?.status, "confirmed");
  const undone = await tx(pg, (sql) =>
    undoRecordedSendInTransaction(sql, {
      enquiryId: single.enquiryId,
      businessId: a.businessId,
      messageId: done.ok ? done.messageId! : "",
      userId: "user-a",
    }),
  );
  assert.equal(undone.ok, true, JSON.stringify(undone));
  assert.equal((await name(single.enquiryId))?.status, "confirmed", "the customer has seen it");
});
