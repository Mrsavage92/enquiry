import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenError } from "./tenancy.server.ts";
import { saveWorkspacePrefsForUser } from "./owner-state-core.ts";
import { readWorkingHoursForUser, undoWorkingHoursForUser } from "./working-hours-core.ts";
import {
  WED_30_SEP,
  answer,
  enquiry,
  freshDb,
  row,
  sqlFor,
  tell,
  tenant,
  tx,
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

async function hoursEvents(pg: PGlite, businessId: string) {
  return (
    await pg.query<{ id: string }>(
      `select id from audit_event where business_id = $1 and detail like '{"kind":"working_hours"%'`,
      [businessId],
    )
  ).rows.length;
}

const undo = (pg: PGlite, userId: string, businessId: string, eventId: string) =>
  undoWorkingHoursForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, { businessId, eventId });

async function saveHours(pg: PGlite, businessId: string, line: string, userId = "user-a") {
  const res = await tell(pg, businessId, line, userId);
  return res.hours;
}

test("hours Undo names its own save: it puts those hours back once; another tenant is Forbidden and nothing moves", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Shine Cleaning");
  const b = await tenant(pg, "user-b", "Other Cleaning");
  const changeA = await saveHours(pg, a.businessId, "Mon-Sat 7am-5pm");
  await saveHours(pg, b.businessId, "Mon-Fri 9am-3pm", "user-b");
  assert.ok(changeA?.eventId);
  assert.equal(
    changeA!.summary,
    "Settings hours change from Monday to Friday 08:00-17:30 to Monday to Saturday 07:00-17:00",
  );
  const savedB = await hours(pg, b.businessId);
  const eventsA = await hoursEvents(pg, a.businessId);

  await assert.rejects(undo(pg, "user-b", a.businessId, changeA!.eventId), ForbiddenError);
  await assert.rejects(readWorkingHoursForUser(sqlFor(pg), "user-b", a.businessId), ForbiddenError);
  // B naming A's record against B's own business: not B's latest change.
  const cross = await undo(pg, "user-b", b.businessId, changeA!.eventId);
  assert.equal(cross.ok, false);
  assert.equal(await hours(pg, a.businessId), "Monday to Saturday 07:00-17:00");
  assert.equal(await hours(pg, b.businessId), savedB);
  assert.equal(await hoursEvents(pg, a.businessId), eventsA);

  const done = await undo(pg, "user-a", a.businessId, changeA!.eventId);
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.equal(await hours(pg, a.businessId), "Monday to Friday 08:00-17:30");
  assert.equal(await hours(pg, b.businessId), savedB);
  // A second Undo of the same save never walks back further.
  assert.equal((await undo(pg, "user-a", a.businessId, changeA!.eventId)).ok, false);
  assert.equal(await hours(pg, a.businessId), "Monday to Friday 08:00-17:30");
});

test("saving the same hours again changes nothing and leaves the first change undoable", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Shine Cleaning");
  const first = await saveHours(pg, a.businessId, "Mon-Sat 7am-5pm");
  const events = await hoursEvents(pg, a.businessId);
  const again = await saveHours(pg, a.businessId, "Mon-Sat 7am-5pm");
  assert.equal(again, null);
  assert.equal(await hoursEvents(pg, a.businessId), events, "a stay writes no record");
  const done = await undo(pg, "user-a", a.businessId, first!.eventId);
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.equal(await hours(pg, a.businessId), "Monday to Friday 08:00-17:30");
});

test("two hours lines in one save are refused and nothing is written", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Shine Cleaning");
  await assert.rejects(
    tell(pg, a.businessId, "Mon-Sat 7am-5pm\nMon-Fri 9am-3pm"),
    /working hours once/,
  );
  assert.equal(await hours(pg, a.businessId), " -", "Settings never written");
  assert.equal(await hoursEvents(pg, a.businessId), 0);
});

test("an Undo from an older tab, or after a change and a change back in Settings, is refused", async (t) => {
  const pg = await freshDb(t);
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Shine Cleaning");
  const tabOne = await saveHours(pg, a.businessId, "Mon-Sat 7am-5pm");
  const tabTwo = await saveHours(pg, a.businessId, "Mon-Fri 9am-3pm");
  assert.equal((await undo(pg, "user-a", a.businessId, tabOne!.eventId)).ok, false);
  assert.equal(await hours(pg, a.businessId), "Monday to Friday 09:00-15:00");
  // Settings changes the hours, then changes them back to what tab two wrote.
  await saveWorkspacePrefsForUser(sql, "user-a", a.businessId, { hoursEnd: "16:00" });
  await saveWorkspacePrefsForUser(sql, "user-a", a.businessId, { hoursEnd: "15:00" });
  assert.equal(await hours(pg, a.businessId), "Monday to Friday 09:00-15:00");
  assert.equal((await undo(pg, "user-a", a.businessId, tabTwo!.eventId)).ok, false);
  assert.equal(await hours(pg, a.businessId), "Monday to Friday 09:00-15:00");
});

test("two Undos at once put the hours back exactly once", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Shine Cleaning");
  const change = await saveHours(pg, a.businessId, "Mon-Sat 7am-5pm");
  const results = await Promise.all([
    undo(pg, "user-a", a.businessId, change!.eventId),
    undo(pg, "user-a", a.businessId, change!.eventId),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results));
  assert.equal(await hours(pg, a.businessId), "Monday to Friday 08:00-17:30");
  const undone = await pg.query(
    "select id from audit_event where business_id = $1 and summary like 'Undone:%'",
    [a.businessId],
  );
  assert.equal(undone.rows.length, 1);
});

test("an unreadable hours record is refused, never read as nothing to undo", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Shine Cleaning");
  await saveHours(pg, a.businessId, "Mon-Sat 7am-5pm");
  const bad = await pg.query<{ id: string }>(
    `insert into audit_event (business_id, actor, summary, detail, object_type)
     values ($1, 'owner', 'Settings hours change', '{"kind":"working_hours",broken', 'brain')
     returning id`,
    [a.businessId],
  );
  const logged = t.mock.method(console, "error", () => {});
  const res = await undo(pg, "user-a", a.businessId, bad.rows[0]!.id);
  assert.equal(res.ok, false);
  assert.ok(logged.mock.callCount() >= 1);
  assert.equal(await hours(pg, a.businessId), "Monday to Saturday 07:00-17:00");
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
