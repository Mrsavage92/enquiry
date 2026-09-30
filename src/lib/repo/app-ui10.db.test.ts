import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenError } from "./tenancy.server.ts";
import { undoWorkingHoursForUser } from "./owner-state-core.ts";
import {
  WED_30_SEP,
  answer,
  enquiry,
  freshDb,
  row,
  sqlFor,
  tell,
  tenant,
} from "./pass8-db-helpers.ts";
import { readBusinessDetails } from "../../domain/business-details-read.ts";
import { lineChoicesFor } from "../../domain/line-choices.ts";
import { EXTRA_CHOICE } from "../../domain/extras.ts";
import { QUESTION_ANSWER } from "../../domain/service-questions.ts";
import type { PGlite } from "@electric-sql/pglite";

/**
 * The server contracts the enquiry card's new controls lean on (app UI pass
 * 10): each button only sends a value the server accepts, the one-tap
 * "Add your $60 oven clean" adds exactly the saved price, and the working
 * hours Undo is tenant-scoped and puts back only the hours a save replaced.
 */

async function hours(pg: PGlite, businessId: string) {
  const r = await pg.query<{ prefs: Record<string, string> | null }>(
    "select prefs from workspace_prefs where business_id = $1",
    [businessId],
  );
  const p = r.rows[0]?.prefs ?? {};
  return `${p.workingDays ?? ""} ${p.hoursStart ?? ""}-${p.hoursEnd ?? ""}`;
}

const PRICES = ["End of lease clean $380", "Oven degrease $60"].join("\n");

test("the working hours Undo puts back the hours a save replaced; another tenant is refused and moves nothing", async (t) => {
  const pg = await freshDb(t);
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Shine Cleaning");
  const b = await tenant(pg, "user-b", "Other Cleaning");
  await tell(pg, a.businessId, "Mon-Sat 7am-5pm");
  await tell(pg, b.businessId, "Mon-Fri 9am-3pm", "user-b");
  const savedA = await hours(pg, a.businessId);
  assert.equal(savedA, "Monday to Saturday 07:00-17:00");
  const savedB = await hours(pg, b.businessId);

  // Another tenant, holding A's id: Forbidden, and neither business moves.
  await assert.rejects(undoWorkingHoursForUser(sql, "user-b", a.businessId), ForbiddenError);
  assert.equal(await hours(pg, a.businessId), savedA);
  assert.equal(await hours(pg, b.businessId), savedB);

  const undone = await undoWorkingHoursForUser(sql, "user-a", a.businessId);
  assert.equal(undone.ok, true, JSON.stringify(undone));
  assert.equal(await hours(pg, a.businessId), "Monday to Friday 08:00-17:30");
  assert.equal(await hours(pg, b.businessId), savedB);
  if (undone.ok) {
    assert.equal(
      undone.summary,
      "Settings hours change from Monday to Saturday 07:00-17:00 to Monday to Friday 08:00-17:30",
    );
  }
  // The undo is on the record.
  const audit = await pg.query<{ summary: string }>(
    "select summary from audit_event where business_id = $1 and summary like 'Undone:%'",
    [a.businessId],
  );
  assert.equal(audit.rows.length, 1);

  // A second Undo never walks back further than the save it belongs to.
  const again = await undoWorkingHoursForUser(sql, "user-a", a.businessId);
  assert.equal(again.ok, false);
  assert.equal(await hours(pg, a.businessId), "Monday to Friday 08:00-17:30");
});

test("the working hours Undo refuses once Settings has moved on since the save", async (t) => {
  const pg = await freshDb(t);
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Shine Cleaning");
  await tell(pg, a.businessId, "Mon-Sat 7am-5pm");
  await pg.query(
    `update workspace_prefs set prefs = jsonb_set(prefs, '{hoursEnd}', '"16:00"') where business_id = $1`,
    [a.businessId],
  );
  const res = await undoWorkingHoursForUser(sql, "user-a", a.businessId);
  assert.equal(res.ok, false);
  assert.equal(await hours(pg, a.businessId), "Monday to Saturday 07:00-16:00");
});

test("'Add your $60 oven degrease' adds exactly the saved price and settles the mention", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Shine Cleaning");
  await tell(pg, a.businessId, "End of lease clean $380\nOven degrease $60");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, need an end of lease clean for a 2 bedroom unit. The oven is pretty grimy. Jo",
    "End of lease clean",
  );
  const s = (await row(pg, e.enquiryId)).decision_snapshot;
  const oven = s.coverage?.flagged.find((f) => f.kind === "mention" && f.thing === "oven") as
    { offer?: { service: string } } | undefined;
  assert.equal(oven?.offer?.service, "Oven degrease");
  // The field the card's button writes: the saved price the offer names, as
  // lineChoicesFor gives it to the card.
  const rules = readBusinessDetails(PRICES, WED_30_SEP).prices.map((p) => p.rule);
  const facts = (
    await pg.query<{ field: string; value: string; status: string }>(
      "select field, value, status from enquiry_fact where enquiry_id = $1 and superseded = false",
      [e.enquiryId],
    )
  ).rows;
  const choice = lineChoicesFor(
    rules,
    facts,
    "End of lease clean",
    (s.coverage?.lines ?? []).map((l) => l.label),
  ).find((c) => c.rule.service === "Oven degrease");
  const field = choice?.field ?? "extra:oven degrease";
  await answer(pg, "user-a", e.enquiryId, field, EXTRA_CHOICE.include);
  const after = (await row(pg, e.enquiryId)).decision_snapshot;
  const lines = after.coverage?.lines ?? [];
  assert.deepEqual(
    lines.map((l) => [l.label, l.amountMinor]),
    [
      ["End of lease clean", 38000],
      ["Oven degrease", 6000],
    ],
  );
  assert.equal(
    after.coverage?.flagged.some((f) => f.kind === "mention" && f.thing === "oven"),
    false,
    JSON.stringify(after.coverage?.flagged),
  );
});

test("'Come back to them' on a do-you-do question is accepted and settles it; another tenant cannot", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Ridge Painting", "painting");
  await tenant(pg, "user-b", "Other Painting", "painting");
  await tell(pg, a.businessId, "Interior painting $28 per square metre");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, about 40sqm of walls to paint inside. Do you also do exterior painting? Kim",
    "Interior painting",
  );
  const q = (await row(pg, e.enquiryId)).decision_snapshot.questionPending;
  assert.ok(q, "a question is pending");
  const before = await row(pg, e.enquiryId);
  await assert.rejects(
    answer(pg, "user-b", e.enquiryId, q!.field, QUESTION_ANSWER.later),
    ForbiddenError,
  );
  assert.deepEqual((await row(pg, e.enquiryId)).decision_snapshot, before.decision_snapshot);
  await answer(pg, "user-a", e.enquiryId, q!.field, QUESTION_ANSWER.later);
  const s = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.notEqual(s.questionPending?.field, q!.field);
  const item = s.asked?.find((i) => i.id === q!.field);
  assert.equal(item?.status, "come_back", JSON.stringify(s.asked));
});
