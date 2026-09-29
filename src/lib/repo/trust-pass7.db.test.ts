import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import {
  replaceBusinessFactForUser,
  retireBusinessFactForUser,
  saveBusinessDetailsForUser,
} from "./business-rule-core.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { answerFactForUser } from "./answer-fact-core.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import { ForbiddenError } from "./tenancy.server.ts";
import { readBusinessDetails } from "../../domain/business-details-read.ts";
import { questionField } from "../../domain/service-questions.ts";
import { ASK_AVAILABILITY } from "../../domain/customer-asks.ts";

/**
 * Review 6b (41/52 on eed60b9) against a real database: each untrue reply it
 * found ends true through the same server paths the app calls, and every new
 * or changed path refuses another tenant and lands nothing.
 */

const migrationsDir = join(process.cwd(), "migrations");
/** Tuesday 29 September 2026, 8:15pm in Newcastle: when the review ran. */
const TUE_29_SEP = new Date("2026-09-29T20:15:00+10:00");

/** A new database per test, closed when the test ends: many open PGlite instances exhaust memory. */
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

/** What the owner writes in "Add a business detail", saved exactly as the screen saves it. */
async function tell(pg: PGlite, userId: string, businessId: string, text: string) {
  const read = readBusinessDetails(text, TUE_29_SEP);
  assert.equal(
    read.unread.filter((u) => !u.note).length,
    0,
    `unread: ${JSON.stringify(read.unread)}`,
  );
  return saveBusinessDetailsForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, {
    businessId,
    rules: read.prices.map((p) => p.rule),
    details: read.details.map((d) => d.detail),
    said: { rules: read.prices.map((p) => p.line), details: read.details.map((d) => d.line) },
  });
}

async function enquiry(pg: PGlite, businessId: string, body: string, serviceLabel = "") {
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
  recommendation: { action: string; label: string };
  draft: { body: string };
  price?: { amountMinor: number };
  questionPending?: {
    field: string;
    kind?: string;
    when?: string;
    saved?: string;
    readAs?: string;
  };
  coverage?: {
    key: string;
    confirmed: boolean;
    lines: { label: string; amountMinor: number; quantity?: string; rough?: { field: string } }[];
    flagged: {
      kind: string;
      text: string;
      thing?: string;
      check?: { field: string; choices: [string, string][] };
    }[];
  };
};

async function row(pg: PGlite, id: string) {
  const res = await pg.query<{
    decision_revision: number;
    customer_name: string;
    date_label: string | null;
    decision_snapshot: Snap;
  }>("select * from enquiry where id = $1", [id]);
  return res.rows[0]!;
}

async function answer(pg: PGlite, userId: string, enquiryId: string, field: string, value: string) {
  return answerFactForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, { enquiryId, field, value });
}

async function confirmCoverage(pg: PGlite, userId: string, enquiryId: string) {
  const r = await row(pg, enquiryId);
  return confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, {
    enquiryId,
    key: r.decision_snapshot.coverage?.key ?? "",
    revision: Number(r.decision_revision),
  });
}

/** Tap every "From their message: ... Correct?" the decision offers, as the owner would. */
async function confirmReadings(pg: PGlite, userId: string, enquiryId: string) {
  for (let i = 0; i < 4; i += 1) {
    const r = await pg.query<{ field: string; value: string }>(
      `select f.field, f.value from enquiry_fact f join enquiry e on e.id = f.enquiry_id
       where f.enquiry_id = $1 and f.superseded = false and f.status = 'inferred'
         and (e.decision_snapshot->'missing'->0->>'factField') = f.field`,
      [enquiryId],
    );
    const reading = r.rows[0];
    if (!reading) return;
    await answer(pg, userId, enquiryId, reading.field, reading.value);
  }
}

async function knowledge(pg: PGlite, businessId: string) {
  return (
    await pg.query<{ id: string; state: string; body: string; source: { detail?: string } }>(
      "select id, state, body, source from knowledge_item where business_id = $1 order by created_at",
      [businessId],
    )
  ).rows;
}

test("1+2 Jess: a misread closed day can be removed, and her reply stops saying it; another tenant cannot", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat");
  await tenant(pg, "user-b", "Bravo");
  await tell(pg, "user-a", a.businessId, "Regular house clean $160\nOven clean $80");
  // What the old reader saved from "Not available Saturday 10 October".
  await saveBusinessDetailsForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    businessId: a.businessId,
    rules: [],
    details: [{ kind: "closed_days", days: [6] }],
    said: { details: ["Not available Saturday 10 October"] },
  });
  const jess = await enquiry(
    pg,
    a.businessId,
    "hey!! need a regular clean for a 4 bed house in Merewether, can u do sat 3 oct?? thx, Jess",
    "Regular house clean",
  );
  assert.equal((await confirmCoverage(pg, "user-a", jess.enquiryId)).ok, true);
  const before = await row(pg, jess.enquiryId);
  assert.match(before.decision_snapshot.draft.body, /I don't work Saturdays/);

  const facts = await knowledge(pg, a.businessId);
  const misread = facts.find((k) => k.body === "You don't work Saturdays")!;
  assert.equal(misread.source.detail, "Not available Saturday 10 October", "the owner's own words");

  // Another tenant: Forbidden, and nothing moves.
  await assert.rejects(
    retireBusinessFactForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-b", {
      businessId: a.businessId,
      knowledgeId: misread.id,
    }),
    ForbiddenError,
  );
  await assert.rejects(
    replaceBusinessFactForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-b", {
      businessId: a.businessId,
      knowledgeId: misread.id,
      rules: [],
      details: [{ kind: "closed_days", days: [0] }],
    }),
    ForbiddenError,
  );
  const unmoved = await row(pg, jess.enquiryId);
  assert.equal(unmoved.decision_revision, before.decision_revision);
  assert.deepEqual(unmoved.decision_snapshot, before.decision_snapshot);
  assert.deepEqual(await knowledge(pg, a.businessId), facts);

  // Edit it to what the owner meant: one closed date, not every Saturday.
  const read = readBusinessDetails("Not available Saturday 10 October", TUE_29_SEP);
  const changed = await replaceBusinessFactForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    businessId: a.businessId,
    knowledgeId: misread.id,
    rules: [],
    details: read.details.map((d) => d.detail),
    said: { details: read.details.map((d) => d.line) },
  });
  assert.ok(changed.updatedEnquiryIds.includes(jess.enquiryId));
  const after = await knowledge(pg, a.businessId);
  assert.equal(after.find((k) => k.id === misread.id)?.state, "Disabled");
  assert.ok(
    after.some((k) => k.state === "Active" && k.body === "Closed on Saturday 10 October 2026 only"),
  );
  assert.equal((await confirmCoverage(pg, "user-a", jess.enquiryId)).ok, true);
  const fixed = await row(pg, jess.enquiryId);
  assert.doesNotMatch(fixed.decision_snapshot.draft.body, /don't work Saturdays/);
  assert.match(
    fixed.decision_snapshot.draft.body,
    /You mentioned Saturday 3 October - I'll confirm/,
  );

  // A Saturday 10 October enquiry is told the truth about that one day.
  const kim = await enquiry(
    pg,
    a.businessId,
    "Could you do a regular clean on Saturday 10 October? Kim",
    "Regular house clean",
  );
  assert.equal((await confirmCoverage(pg, "user-a", kim.enquiryId)).ok, true);
  assert.match(
    (await row(pg, kim.enquiryId)).decision_snapshot.draft.body,
    /I'm not available on Saturday 10 October/,
  );

  // Remove it: retired (not deleted), audited, and Kim's reply updates.
  const closed = (await knowledge(pg, a.businessId)).find(
    (k) => k.state === "Active" && k.body === "Closed on Saturday 10 October 2026 only",
  )!;
  const removed = await retireBusinessFactForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    businessId: a.businessId,
    knowledgeId: closed.id,
  });
  assert.ok(removed.updatedEnquiryIds.includes(kim.enquiryId));
  assert.equal(
    (await knowledge(pg, a.businessId)).find((k) => k.id === closed.id)?.state,
    "Disabled",
  );
  const audit = await pg.query<{ summary: string }>(
    "select summary from audit_event where business_id = $1 and object_id = $2 order by at",
    [a.businessId, closed.id],
  );
  assert.ok(audit.rows.some((r) => r.summary.startsWith("Business detail removed")));
  assert.equal((await confirmCoverage(pg, "user-a", kim.enquiryId)).ok, true);
  assert.doesNotMatch(
    (await row(pg, kim.enquiryId)).decision_snapshot.draft.body,
    /not available on Saturday 10 October/,
  );
});

test("3 Priya and Chloe: a wedding or a formal on a closed day is never moved to Monday", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Glow", "beauty");
  await tell(
    pg,
    "user-a",
    a.businessId,
    "Bridal makeup $180\nGuest makeup $110 per person\nWe don't work Saturdays",
  );
  const priya = await enquiry(
    pg,
    a.businessId,
    "Hi lovely! Getting married 19 Dec 💍 need bridal makeup for me. xx Priya",
    "Bridal makeup",
  );
  assert.equal((await confirmCoverage(pg, "user-a", priya.enquiryId)).ok, true);
  const p = await row(pg, priya.enquiryId);
  assert.equal(p.customer_name, "Priya");
  assert.match(
    p.decision_snapshot.draft.body,
    /I'm sorry, I'm not available on Saturday 19 December\. Is there any flexibility on the date\?/,
  );
  assert.doesNotMatch(p.decision_snapshot.draft.body, /Would Monday|suit instead/);
  const chloe = await enquiry(
    pg,
    a.businessId,
    "Hi! Group of us need makeup for our year 12 formal Sat 7 Nov, not sure how many yet. Chloe",
    "Guest makeup",
  );
  const c = await row(pg, chloe.enquiryId);
  assert.match(c.decision_snapshot.draft.body, /I'm not available on Saturday 7 November/);
  assert.doesNotMatch(c.decision_snapshot.draft.body, /Would Monday|suit instead/);
});

test("4 Anh and Jess: a fortnightly discount and a weekend rate are one-tap checks that change the total", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat");
  await tell(
    pg,
    "user-a",
    a.businessId,
    "Regular house clean $160\nFortnightly cleans get 10% off\nWeekend jobs add 20%",
  );
  const anh = await enquiry(
    pg,
    a.businessId,
    "Hi, looking for a fortnightly clean, 3 bed 2 bath, starting Monday 5 October. Anh",
    "Regular house clean",
  );
  await answer(pg, "user-a", anh.enquiryId, "recurring", "yes");
  const open = await row(pg, anh.enquiryId);
  const discount = open.decision_snapshot.coverage?.flagged.find((f) => f.kind === "rule");
  assert.deepEqual(discount?.check?.choices[0], ["apply", "Apply 10% fortnightly discount ($144)"]);
  await answer(pg, "user-a", anh.enquiryId, discount!.check!.field, "apply");
  assert.equal((await confirmCoverage(pg, "user-a", anh.enquiryId)).ok, true);
  const priced = await row(pg, anh.enquiryId);
  assert.equal(priced.decision_snapshot.price?.amountMinor, 14400);
  assert.match(priced.decision_snapshot.draft.body, /that's \$144 per visit/);

  const jess = await enquiry(
    pg,
    a.businessId,
    "need a regular clean, can u do sat 3 oct?? Jess",
    "Regular house clean",
  );
  const j = await row(pg, jess.enquiryId);
  const weekend = j.decision_snapshot.coverage?.flagged.find((f) => f.kind === "rule");
  assert.deepEqual(weekend?.check?.choices[0], ["apply", "Add 20% Saturday rate ($32)"]);
  await answer(pg, "user-a", jess.enquiryId, weekend!.check!.field, "apply");
  assert.equal((await confirmCoverage(pg, "user-a", jess.enquiryId)).ok, true);
  assert.equal((await row(pg, jess.enquiryId)).decision_snapshot.price?.amountMinor, 19200);
});

test("5 Jess: '$160 for up to 3 bedrooms, extra bedrooms $35 each' quotes her 4 bed house $195", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat");
  await tell(
    pg,
    "user-a",
    a.businessId,
    "Regular house clean $160 for up to 3 bedrooms, extra bedrooms $35 each",
  );
  const jess = await enquiry(
    pg,
    a.businessId,
    "hey!! need a regular clean for a 4 bed house in Merewether thx, Jess",
    "Regular house clean",
  );
  await confirmReadings(pg, "user-a", jess.enquiryId);
  assert.equal((await confirmCoverage(pg, "user-a", jess.enquiryId)).ok, true);
  const r = await row(pg, jess.enquiryId);
  assert.equal(r.decision_snapshot.price?.amountMinor, 19500);
  assert.match(r.decision_snapshot.draft.body, /\$195/);
});

test("6 Rachel: 'maybe 90sqm' is said as about, and one tap makes it exact; another tenant cannot", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat", "painting");
  await tenant(pg, "user-b", "Bravo", "painting");
  await tell(pg, "user-a", a.businessId, "Ceiling painting $18 per square metre");
  const e = await enquiry(
    pg,
    a.businessId,
    "Ceilings need painting but not sure of the size, maybe 90sqm? Rachel",
    "Ceiling painting",
  );
  await confirmReadings(pg, "user-a", e.enquiryId);
  const rough = await row(pg, e.enquiryId);
  const line = rough.decision_snapshot.coverage?.lines[0];
  assert.equal(line?.quantity, "about 90 square metres (please confirm)");
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  const said = await row(pg, e.enquiryId);
  assert.match(
    said.decision_snapshot.draft.body,
    /about \$1,620, I'll confirm once I've seen the job/,
  );

  const before = await row(pg, e.enquiryId);
  await assert.rejects(
    answer(pg, "user-b", e.enquiryId, line!.rough!.field, "exactly 90"),
    ForbiddenError,
  );
  assert.equal((await row(pg, e.enquiryId)).decision_revision, before.decision_revision);

  await answer(pg, "user-a", e.enquiryId, line!.rough!.field, "exactly 90");
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  const exact = await row(pg, e.enquiryId);
  assert.doesNotMatch(exact.decision_snapshot.draft.body, /about \$|about 90|confirm the size/);
  assert.match(exact.decision_snapshot.draft.body, /that comes to \$1,620 \(90 square metres/);
});

test("7a Graham: exterior painting he asked for is declined kindly, the interior quote goes ahead", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat", "painting");
  await tell(
    pg,
    "user-a",
    a.businessId,
    "Interior painting $32 per square metre\nWe don't paint exteriors",
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi mate, after a quote to paint the outside of our house, and the lounge room inside, approx 30 m2. Graham",
    "Interior painting",
  );
  await confirmReadings(pg, "user-a", e.enquiryId);
  const open = await row(pg, e.enquiryId);
  const flag = open.decision_snapshot.coverage?.flagged.find((f) => f.kind === "not_offered");
  assert.equal(flag?.text, "You don't paint exteriors - they asked about it");
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, false, "blocking");
  await answer(pg, "user-a", e.enquiryId, questionField(flag!.thing!), "no");
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  const body = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.match(body, /Sorry, I don't paint exteriors\./);
  assert.match(body, /\$960/);
});

test("7b Lou: 'r u free this sat or sun?' is answered before any reply is ready; another tenant cannot answer it", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat");
  await tenant(pg, "user-b", "Bravo");
  await tell(pg, "user-a", a.businessId, "Regular house clean $160");
  const e = await enquiry(
    pg,
    a.businessId,
    "hey r u free this sat or sun for a clean? 3 bed. Lou",
    "Regular house clean",
  );
  const open = await row(pg, e.enquiryId);
  assert.equal(open.date_label, "Sat 3 or Sun 4 Oct");
  assert.equal(open.decision_snapshot.questionPending?.kind, "availability");
  assert.equal(open.decision_snapshot.questionPending?.when, "Sat 3 or Sun 4 Oct");
  assert.notEqual(open.decision_snapshot.recommendation.action, "SEND_QUOTE");
  assert.equal(open.decision_snapshot.price, undefined, "never reply ready over her question");

  const both = "2026-10-03=yes|2026-10-04=yes";
  await assert.rejects(answer(pg, "user-b", e.enquiryId, ASK_AVAILABILITY, both), ForbiddenError);
  const after = await row(pg, e.enquiryId);
  assert.equal(after.decision_revision, open.decision_revision);
  assert.deepEqual(after.decision_snapshot, open.decision_snapshot);
  await assert.rejects(
    answer(pg, "user-a", e.enquiryId, ASK_AVAILABILITY, "maybe"),
    /Answer yes, no/,
  );

  await answer(pg, "user-a", e.enquiryId, ASK_AVAILABILITY, both);
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  const body = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.match(body, /Yes, I'm available on Saturday 3 and Sunday 4 October\./);
  assert.doesNotMatch(body, /I'll confirm which day/);
});

test("7c Rachel: 'do you have insurance?' is answered once and offered again next time", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat", "painting");
  await tenant(pg, "user-b", "Bravo", "painting");
  await tell(pg, "user-a", a.businessId, "Interior painting $32 per square metre");
  const e = await enquiry(
    pg,
    a.businessId,
    "About 140 square metres of wall to paint inside. Do you have insurance? Rachel",
    "Interior painting",
  );
  // Asked for a count first, nothing is priced; once it is, the question is
  // what stands between the owner and a ready reply.
  await confirmReadings(pg, "user-a", e.enquiryId);
  const open = await row(pg, e.enquiryId);
  const q = open.decision_snapshot.questionPending;
  assert.equal(open.decision_snapshot.price, undefined, "never reply ready over the question");
  assert.equal(q?.kind, "ask");
  assert.equal(q?.field, "ask:insurance");
  await assert.rejects(
    answer(pg, "user-b", e.enquiryId, "ask:insurance", "Yes, fully insured."),
    ForbiddenError,
  );
  assert.equal(
    (await knowledge(pg, a.businessId)).filter((k) => k.body.includes("insured")).length,
    0,
    "another tenant saves no answer",
  );
  await answer(
    pg,
    "user-a",
    e.enquiryId,
    "ask:insurance",
    "Yes, I'm fully insured with $20m public liability.",
  );
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  assert.match(
    (await row(pg, e.enquiryId)).decision_snapshot.draft.body,
    /Yes, I'm fully insured with \$20m public liability\./,
  );
  const next = await enquiry(
    pg,
    a.businessId,
    "Painting two bedrooms, about 50 sqm. Are you insured? Tom",
    "Interior painting",
  );
  await confirmReadings(pg, "user-a", next.enquiryId);
  assert.equal(
    (await row(pg, next.enquiryId)).decision_snapshot.questionPending?.saved,
    "Yes, I'm fully insured with $20m public liability.",
  );
});

test("8+9: names, windows, tomorrow and form fields are read as written", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Fresh Coat", "painting");
  await tell(
    pg,
    "user-a",
    a.businessId,
    "Interior painting $32 per square metre\nCeiling painting $18 per square metre\nRegular house clean $160",
  );
  const b = await enquiry(
    pg,
    a.businessId,
    "Hi, need a regular clean. Any day except Friday works, sometime between 12 and 16 October. cheers, B",
  );
  const br = await row(pg, b.enquiryId);
  assert.equal(br.date_label, "12-16 Oct, not Fri");
  const bFacts = await pg.query<{ field: string; display_value: string }>(
    "select field, display_value from enquiry_fact where enquiry_id = $1",
    [b.enquiryId],
  );
  assert.ok(
    !bFacts.rows.some((f) => /Fri 2 Oct|16 Oct/.test(f.display_value) && f.field !== "date"),
  );

  const dave = await enquiry(pg, a.businessId, "Can you paint a small bathroom, 12sqm, tmrw? Dave");
  assert.equal((await row(pg, dave.enquiryId)).date_label, "Wed 30 Sep");

  const rachel = await enquiry(
    pg,
    a.businessId,
    "Name: Rachel Nguyen\nService: Interior painting\nMessage: We get the keys on the 1st, painting sometime between 2 and 9 November, not weekends.",
  );
  const rr = await row(pg, rachel.enquiryId);
  assert.equal(rr.customer_name, "Rachel Nguyen");
  assert.equal(rr.date_label, "2-9 Nov, not weekends");
  const context = await pg.query<{ display_value: string }>(
    "select display_value from enquiry_fact where enquiry_id = $1 and field = 'date_context'",
    [rachel.enquiryId],
  );
  assert.equal(context.rows[0]?.display_value, "keys Sun 1 Nov");

  // Tom & Sarah: walls are interior painting, the 25 sqm belongs to the ceilings.
  const tom = await enquiry(
    pg,
    a.businessId,
    "Hi there, looking to get 2 bedrooms painted, walls roughly 60m2 plus the ceilings about 25 sqm. Cheers Tom & Sarah",
    "Interior painting",
  );
  await confirmReadings(pg, "user-a", tom.enquiryId);
  const extra = await pg.query<{ field: string }>(
    "select field from enquiry_fact where enquiry_id = $1 and field like 'extra:%' and superseded = false",
    [tom.enquiryId],
  );
  await answer(pg, "user-a", tom.enquiryId, extra.rows[0]!.field, "include");
  await confirmReadings(pg, "user-a", tom.enquiryId);
  const tr = await row(pg, tom.enquiryId);
  const lines = tr.decision_snapshot.coverage?.lines.map((l) => [l.label, l.amountMinor]);
  assert.deepEqual(lines, [
    ["Interior painting", 192000],
    ["Ceiling painting", 45000],
  ]);
  // 10: the walls are part of the interior painting now - never asked again.
  assert.ok(
    !tr.decision_snapshot.coverage?.flagged.some((f) => f.thing === "walls"),
    JSON.stringify(tr.decision_snapshot.coverage?.flagged),
  );
});
