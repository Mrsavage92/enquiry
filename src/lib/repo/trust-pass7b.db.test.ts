import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import { replaceBusinessFactForUser, saveBusinessDetailsForUser } from "./business-rule-core.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { answerFactForUser } from "./answer-fact-core.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import { ForbiddenError } from "./tenancy.server.ts";
import { readBusinessDetails } from "../../domain/business-details-read.ts";
import { ASK_AVAILABILITY } from "../../domain/customer-asks.ts";

/**
 * Review of PR #75, against a real database. Every reply-affecting fix is
 * proven THROUGH the send path (`prepareReviewedSendInTransaction`), not only
 * by the draft's text: the app's own reply, with the owner's own answers in
 * it, must be sendable, and must be true.
 */

const migrationsDir = join(process.cwd(), "migrations");
const TUE_29_SEP = new Date("2026-09-29T20:15:00+10:00");

async function freshDb(t: { after: (fn: () => Promise<void>) => void }): Promise<PGlite> {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.waitReady;
  for (const f of readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await pg.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  return pg;
}

function toSql(run: <R>(text: string, params: unknown[]) => Promise<R[]>): Sql {
  return (async <R>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<R>(text, values);
  }) as never;
}

function sqlFor(pg: PGlite): Sql {
  return toSql(
    async <R>(text: string, params: unknown[]) => (await pg.query<R>(text, params)).rows,
  );
}

async function tx<T>(pg: PGlite, fn: (sql: Sql) => Promise<T>): Promise<T> {
  return pg.transaction(async (t) =>
    fn(toSql(async <R>(text: string, params: unknown[]) => (await t.query<R>(text, params)).rows)),
  ) as Promise<T>;
}

async function tenant(pg: PGlite, userId: string, name: string, industry = "cleaning") {
  await pg.query("insert into app_user (id, email) values ($1, $2)", [userId, `${userId}@test`]);
  return tx(pg, (sql) =>
    createWorkspaceInTransaction(sql, {
      ownerFirstName: "Sam",
      industry,
      baseLocation: "Newcastle",
      timezone: "Australia/Sydney",
      soloOrTeam: "solo",
      currency: "AUD",
      name,
      userId,
    }),
  );
}

async function tell(pg: PGlite, businessId: string, text: string) {
  const read = readBusinessDetails(text, TUE_29_SEP);
  assert.equal(
    read.unread.filter((u) => !u.note).length,
    0,
    `unread: ${JSON.stringify(read.unread)}`,
  );
  return saveBusinessDetailsForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    businessId,
    rules: read.prices.map((p) => p.rule),
    details: read.details.map((d) => d.detail),
    said: { rules: read.prices.map((p) => p.line), details: read.details.map((d) => d.line) },
  });
}

async function enquiry(pg: PGlite, businessId: string, body: string, serviceLabel: string) {
  return tx(pg, (sql) =>
    insertManualEnquiry(sql, {
      businessId,
      body,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      serviceLabel,
      intakeNote: "",
      now: TUE_29_SEP,
    }),
  );
}

type Snap = {
  recommendation: { action: string };
  draft: { body: string };
  price?: { amountMinor: number };
  questionPending?: {
    field: string;
    kind?: string;
    days?: { iso: string; closed?: string }[];
    reusable?: boolean;
  };
  coverage?: { key: string; confirmed: boolean; flagged: { kind: string; text: string }[] };
};

async function row(pg: PGlite, id: string) {
  const res = await pg.query<{ decision_revision: number; decision_snapshot: Snap }>(
    "select decision_revision, decision_snapshot from enquiry where id = $1",
    [id],
  );
  return res.rows[0]!;
}

async function answer(pg: PGlite, userId: string, enquiryId: string, field: string, value: string) {
  return answerFactForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, { enquiryId, field, value });
}

async function confirmReadings(pg: PGlite, enquiryId: string) {
  for (let i = 0; i < 4; i += 1) {
    const r = await pg.query<{ field: string; value: string }>(
      `select f.field, f.value from enquiry_fact f join enquiry e on e.id = f.enquiry_id
       where f.enquiry_id = $1 and f.superseded = false and f.status = 'inferred'
         and (e.decision_snapshot->'missing'->0->>'factField') = f.field`,
      [enquiryId],
    );
    const reading = r.rows[0];
    if (!reading) return;
    await answer(pg, "user-a", enquiryId, reading.field, reading.value);
  }
}

/** "That's everything" when a check is showing, then the app's own reply through the send path. */
async function send(pg: PGlite, businessId: string, enquiryId: string) {
  const before = await row(pg, enquiryId);
  if (before.decision_snapshot.coverage && !before.decision_snapshot.coverage.confirmed) {
    const res = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
      enquiryId,
      key: before.decision_snapshot.coverage.key,
      revision: Number(before.decision_revision),
    });
    assert.equal(res.ok, true, JSON.stringify(res));
  }
  const ready = await row(pg, enquiryId);
  const body = ready.decision_snapshot.draft.body;
  const sent = await tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId,
      businessId,
      userId: "user-a",
      body,
      channel: "manual",
    }),
  );
  return { body, sent, snapshot: ready.decision_snapshot };
}

test("H1: a Yes is for the day it answered; moving the day opens the question again", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat");
  await tell(pg, a.businessId, "Regular house clean $160");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, are you available Saturday 3 October for a clean? Mia",
    "Regular house clean",
  );
  await answer(pg, "user-a", e.enquiryId, ASK_AVAILABILITY, "2026-10-03=yes");
  const first = await send(pg, a.businessId, e.enquiryId);
  assert.match(first.body, /Yes, I'm available on Saturday 3 October\./);
  assert.equal(first.sent.ok, true, JSON.stringify(first.sent));

  // The owner corrects the day: the Yes never follows it to 17 October.
  await answer(pg, "user-a", e.enquiryId, "date", "2026-10-17");
  const moved = await row(pg, e.enquiryId);
  assert.equal(moved.decision_snapshot.questionPending?.kind, "availability");
  assert.deepEqual(
    moved.decision_snapshot.questionPending?.days?.map((d) => d.iso),
    ["2026-10-17"],
  );
  assert.doesNotMatch(moved.decision_snapshot.draft.body, /available on Saturday 17 October/);
  assert.equal(
    moved.decision_snapshot.price,
    undefined,
    "nothing ready over the reopened question",
  );
  // An answer for the old day no longer counts.
  await assert.rejects(
    answer(pg, "user-a", e.enquiryId, ASK_AVAILABILITY, "2026-10-03=yes"),
    /days they asked about have changed/,
  );
  await answer(pg, "user-a", e.enquiryId, ASK_AVAILABILITY, "2026-10-17=later");
  const later = await send(pg, a.businessId, e.enquiryId);
  assert.match(later.body, /I'll check my calendar for Saturday 17 October and come back to you\./);
  assert.equal(later.sent.ok, true, JSON.stringify(later.sent));
});

test("H2: Lou's 'sat or sun' never gets a Yes for the Sunday the owner doesn't work", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat");
  await tenant(pg, "user-b", "Bravo");
  await tell(pg, a.businessId, "Regular house clean $160\nWe don't work Sundays");
  const e = await enquiry(
    pg,
    a.businessId,
    "hey r u free this sat or sun for a clean? Lou",
    "Regular house clean",
  );
  const open = await row(pg, e.enquiryId);
  const days = open.decision_snapshot.questionPending?.days ?? [];
  assert.deepEqual(
    days.map((d) => [d.iso, Boolean(d.closed)]),
    [
      ["2026-10-03", false],
      ["2026-10-04", true],
    ],
  );
  await assert.rejects(
    answer(pg, "user-a", e.enquiryId, ASK_AVAILABILITY, "2026-10-03=yes|2026-10-04=yes"),
    /don't work/,
  );
  const before = await row(pg, e.enquiryId);
  await assert.rejects(
    answer(pg, "user-b", e.enquiryId, ASK_AVAILABILITY, "2026-10-03=yes|2026-10-04=no"),
    ForbiddenError,
  );
  assert.deepEqual((await row(pg, e.enquiryId)).decision_snapshot, before.decision_snapshot);
  await answer(pg, "user-a", e.enquiryId, ASK_AVAILABILITY, "2026-10-03=yes|2026-10-04=no");
  const { body, sent } = await send(pg, a.businessId, e.enquiryId);
  assert.match(body, /Yes, I'm available on Saturday 3 October\./);
  assert.match(body, /Sorry, I'm not available on Sunday 4 October\./);
  assert.doesNotMatch(body, /available on Saturday 3 (?:or|and) Sunday/);
  assert.equal(sent.ok, true, JSON.stringify(sent));
});

test("H3: the owner's own answers with money in them send as written", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat", "painting");
  await tell(pg, a.businessId, "Interior painting $32 per square metre");
  const answers: [string, string, RegExp][] = [
    ["Do you have insurance?", "Yes, I'm fully insured with $20m public liability.", /\$20m/],
    ["Do you need a deposit?", "Yes, a $50 deposit secures the day.", /\$50 deposit/],
    ["Do you have insurance?", "Yes - $1.5m cover, and a $2k excess.", /\$1\.5m/],
  ];
  for (const [question, said, shows] of answers) {
    const e = await enquiry(
      pg,
      a.businessId,
      `About 140 square metres of wall to paint inside. ${question} Rachel`,
      "Interior painting",
    );
    await confirmReadings(pg, e.enquiryId);
    const q = (await row(pg, e.enquiryId)).decision_snapshot.questionPending!;
    await answer(pg, "user-a", e.enquiryId, q.field, said);
    const { body, sent } = await send(pg, a.businessId, e.enquiryId);
    assert.match(body, shows);
    assert.match(body, /\$4,480/);
    assert.equal(sent.ok, true, `${said}: ${JSON.stringify(sent)}`);
  }
});

test("M8: a reply still asking for the size says their question is answered with the price, and sends", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat", "painting");
  await tell(pg, a.businessId, "Interior painting $32 per square metre");
  const e = await enquiry(
    pg,
    a.businessId,
    "Our lounge room needs painting. Are you insured? Rachel",
    "Interior painting",
  );
  const r = await row(pg, e.enquiryId);
  assert.equal(r.decision_snapshot.recommendation.action, "REQUEST_INFORMATION");
  const { body, sent } = await send(pg, a.businessId, e.enquiryId);
  assert.match(body, /how many square metres/);
  assert.match(body, /I'll answer your question about insurance with the price\./);
  assert.equal(sent.ok, true, JSON.stringify(sent));
});

test("M2: 'Exactly 3 hours for a house your size' is kept word for word and sends", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat");
  await tell(pg, a.businessId, "Regular house clean $160");
  const e = await enquiry(
    pg,
    a.businessId,
    "Need a regular clean. How long will it take? Jo",
    "Regular house clean",
  );
  await answer(pg, "user-a", e.enquiryId, "ask:duration", "Exactly 3 hours for a house your size");
  const { body, sent } = await send(pg, a.businessId, e.enquiryId);
  assert.match(body, /Exactly 3 hours for a house your size\./);
  assert.equal(sent.ok, true, JSON.stringify(sent));
});

test("LOW: an answer to a question they never asked is refused; a saved answer is audited", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat");
  await tell(pg, a.businessId, "Regular house clean $160");
  const e = await enquiry(pg, a.businessId, "Need a regular clean. Jo", "Regular house clean");
  await assert.rejects(
    answer(pg, "user-a", e.enquiryId, "ask:insurance", "Yes, insured."),
    /didn't ask that question/,
  );
  const f = await enquiry(
    pg,
    a.businessId,
    "Need a regular clean. Are you insured? Jo",
    "Regular house clean",
  );
  assert.equal((await row(pg, f.enquiryId)).decision_snapshot.questionPending?.reusable, true);
  await answer(pg, "user-a", f.enquiryId, "ask:insurance", "Yes, fully insured.");
  const audit = await pg.query<{ summary: string }>(
    "select summary from audit_event where business_id = $1 and summary like 'Answer saved%'",
    [a.businessId],
  );
  assert.equal(audit.rows[0]?.summary, "Answer saved for next time: Are you insured?");
});

test("M9: editing a saved answer keeps it an answer, with its money", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat");
  await tenant(pg, "user-b", "Bravo");
  await tell(pg, a.businessId, "Regular house clean $160");
  const e = await enquiry(
    pg,
    a.businessId,
    "Need a regular clean. Are you insured? Jo",
    "Regular house clean",
  );
  await answer(pg, "user-a", e.enquiryId, "ask:insurance", "Yes, fully insured.");
  const [saved] = (
    await pg.query<{ id: string; rule_payload: Record<string, string> }>(
      "select id, rule_payload from knowledge_item where business_id = $1 and state = 'Active' and rule_payload->>'kind' = 'answer'",
      [a.businessId],
    )
  ).rows;
  const changed = { ...saved!.rule_payload, text: "Yes, insured with $20m public liability." };
  await assert.rejects(
    replaceBusinessFactForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-b", {
      businessId: a.businessId,
      knowledgeId: saved!.id,
      rules: [],
      details: [changed as never],
    }),
    ForbiddenError,
  );
  await replaceBusinessFactForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    businessId: a.businessId,
    knowledgeId: saved!.id,
    rules: [],
    details: [changed as never],
  });
  const now = (
    await pg.query<{ rule_payload: Record<string, string> }>(
      "select rule_payload from knowledge_item where business_id = $1 and state = 'Active' and rule_payload->>'kind' = 'answer'",
      [a.businessId],
    )
  ).rows;
  assert.equal(now.length, 1);
  assert.equal(now[0]!.rule_payload.topic, "insurance");
  assert.equal(now[0]!.rule_payload.text, "Yes, insured with $20m public liability.");
});

test("M3: a repeat discount comes off before the minimum; the total never ends under it", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat");
  await tell(
    pg,
    a.businessId,
    // A minimum for every job only when the owner says so (trust pass 8).
    "Regular house clean $120\nMinimum charge $150 on every job\nWeekly cleans get 20% off",
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, looking for a weekly clean please. Kim",
    "Regular house clean",
  );
  await answer(pg, "user-a", e.enquiryId, "recurring", "yes");
  for (let i = 0; i < 3; i += 1) {
    const r = await row(pg, e.enquiryId);
    const check = (r.decision_snapshot.coverage?.flagged ?? []).find(
      (f) => f.kind === "rule",
    ) as unknown as { check?: { field: string } } | undefined;
    if (!check?.check) break;
    await answer(pg, "user-a", e.enquiryId, check.check.field, "apply");
  }
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(snapshot.price?.amountMinor, 15000, body);
  assert.equal(sent.ok, true, JSON.stringify(sent));
});

test("M4: 'every 3 weeks' is not fortnightly - no discount check, a note for the owner", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat");
  await tell(pg, a.businessId, "Regular house clean $160\nFortnightly cleans get 10% off");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, could you come every 3 weeks for a clean? Kim",
    "Regular house clean",
  );
  await answer(pg, "user-a", e.enquiryId, "recurring", "yes");
  const r = await row(pg, e.enquiryId);
  const flags = r.decision_snapshot.coverage?.flagged ?? [];
  assert.ok(!flags.some((f) => f.kind === "rule"), JSON.stringify(flags));
  assert.ok(flags.some((f) => /fortnightly discount is not offered/.test(f.text)));
  const { snapshot, sent } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(snapshot.price?.amountMinor, 16000);
  assert.equal(sent.ok, true);
});
