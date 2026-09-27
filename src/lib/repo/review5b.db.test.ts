import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import { saveBusinessDetailsForUser, saveBusinessRuleAndRedecide } from "./business-rule-core.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { answerFactForUser } from "./answer-fact-core.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import {
  applyPracticeSampleInTransaction,
  createPracticeEnquiryInTransaction,
} from "./practice-core.ts";
import { samplePriceFor } from "./practice-price.ts";
import { ForbiddenError } from "./tenancy.server.ts";
import { describeRule, type BusinessRule } from "../../domain/business-rule.ts";
import type { BusinessDetail } from "../../domain/business-detail.ts";
import { readPriceLine } from "../../domain/price-sentence.ts";
import { questionField } from "../../domain/service-questions.ts";

/**
 * Review 5b against a real database: each untrue reply it found now ends true
 * through the same server paths the app calls, and every changed path refuses
 * another tenant and lands nothing (no fact, same revision, same snapshot).
 */

const migrationsDir = join(process.cwd(), "migrations");
const FRI_25_SEP = new Date("2026-09-25T09:00:00+10:00");

async function freshDb(): Promise<PGlite> {
  const pg = new PGlite();
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

async function tenant(pg: PGlite, userId: string, name: string, industry = "painting") {
  await pg.query("insert into app_user (id, email) values ($1, $2)", [userId, `${userId}@test`]);
  return tx(pg, (sql) =>
    createWorkspaceInTransaction(sql, {
      ownerFirstName: "Dean",
      industry,
      baseLocation: "Brisbane",
      timezone: "Australia/Brisbane",
      soloOrTeam: "solo",
      currency: "AUD",
      name,
      userId,
    }),
  );
}

function rule(line: string): BusinessRule {
  const read = readPriceLine(line);
  if (!("rule" in read)) throw new Error(`${line}: ${read.reason}`);
  return read.rule;
}

async function saveRule(pg: PGlite, businessId: string, line: string) {
  const r = rule(line);
  return tx(pg, (sql) =>
    saveBusinessRuleAndRedecide(sql, { businessId, rule: r, readable: describeRule(r) }),
  );
}

async function saveDetails(
  pg: PGlite,
  userId: string,
  businessId: string,
  details: BusinessDetail[],
) {
  return saveBusinessDetailsForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, {
    businessId,
    rules: [],
    details,
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
      now: FRI_25_SEP,
    }),
  );
}

type Snap = {
  recommendation: { action: string; label: string };
  missing: { factField: string; inferred?: { value: string } }[];
  draft: { body: string };
  price?: { amountMinor: number };
  conflicts: string[];
  coverage?: {
    key: string;
    confirmed: boolean;
    lines: { label: string; amountMinor: number }[];
    flagged: { kind: string; text: string; thing?: string; check?: { field: string } }[];
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

async function liveFacts(pg: PGlite, enquiryId: string, field: string) {
  return (
    await pg.query(
      "select value from enquiry_fact where enquiry_id = $1 and field = $2 and superseded = false",
      [enquiryId, field],
    )
  ).rows;
}

const MINIMUM: BusinessDetail = {
  kind: "minimum_charge",
  amount: 450,
  service: "Interior painting",
};

test("3 Mick: the $450 minimum is a check, applied through the answer path; another tenant lands nothing", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await tenant(pg, "user-b", "Bravo Painting");
  await saveRule(pg, a.businessId, "Interior painting $32 per square metre");
  // Another tenant cannot save a rule into this business.
  await assert.rejects(saveDetails(pg, "user-b", a.businessId, [MINIMUM]), ForbiddenError);
  assert.equal(
    (
      await pg.query(
        "select 1 from knowledge_item where business_id = $1 and rule_payload->>'kind' = 'minimum_charge'",
        [a.businessId],
      )
    ).rows.length,
    0,
  );
  await saveDetails(pg, "user-a", a.businessId, [MINIMUM]);
  const e = await enquiry(
    pg,
    a.businessId,
    "Can you paint one room? It's 12 m2. Mick",
    "Interior painting",
  );
  await answer(pg, "user-a", e.enquiryId, "square metres", "12");
  const open = await row(pg, e.enquiryId);
  const check = open.decision_snapshot.coverage?.flagged.find((f) => f.kind === "rule");
  assert.equal(check?.text, "Your minimum for interior painting is $450 - this comes to $384");
  assert.equal(
    (await confirmCoverage(pg, "user-a", e.enquiryId)).ok,
    false,
    "not over an open rule",
  );

  const field = check!.check!.field;
  const before = await row(pg, e.enquiryId);
  await assert.rejects(answer(pg, "user-b", e.enquiryId, field, "waive"), ForbiddenError);
  const after = await row(pg, e.enquiryId);
  assert.equal(after.decision_revision, before.decision_revision);
  assert.deepEqual(after.decision_snapshot, before.decision_snapshot);
  assert.equal((await liveFacts(pg, e.enquiryId, field)).length, 0);
  await assert.rejects(
    answer(pg, "user-a", e.enquiryId, field, "maybe"),
    /Choose whether your rule/,
  );

  await answer(pg, "user-a", e.enquiryId, field, "apply");
  const applied = await row(pg, e.enquiryId);
  assert.equal(applied.decision_snapshot.coverage?.lines[0]?.amountMinor, 45000);
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  const ready = await row(pg, e.enquiryId);
  assert.equal(ready.decision_snapshot.price?.amountMinor, 45000);
  assert.match(ready.decision_snapshot.draft.body, /that comes to \$450 \(minimum charge/);
  const sent = await tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: e.enquiryId,
      businessId: a.businessId,
      userId: "user-a",
      body: ready.decision_snapshot.draft.body,
      channel: "manual",
    }),
  );
  assert.equal(sent.ok, true, JSON.stringify(sent));
});

test("3 Whitfield: two storey against 'single storey only' is declined kindly, with no price", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await saveRule(pg, a.businessId, "Exterior painting $38 per square metre");
  await saveDetails(pg, "user-a", a.businessId, [
    {
      kind: "eligibility",
      service: "Exterior painting",
      condition: "single storey",
      text: "Exterior painting only if the house is single storey",
    },
    { kind: "closed_days", days: [0] },
  ]);
  const e = await enquiry(
    pg,
    a.businessId,
    "Two storey brick house, exterior repaint 220 sq m. Could you come for a measure-up on Sunday 11 Oct? Jan Whitfield",
    "Exterior painting",
  );
  await answer(pg, "user-a", e.enquiryId, "square metres", "220");
  const open = await row(pg, e.enquiryId);
  const check = open.decision_snapshot.coverage?.flagged.find((f) => f.kind === "rule");
  assert.equal(check?.text, "Two storey - you said exterior painting only if single storey");
  await answer(pg, "user-a", e.enquiryId, check!.check!.field, "decline");
  const declined = await row(pg, e.enquiryId);
  assert.equal(declined.decision_snapshot.recommendation.action, "DECLINE");
  assert.equal(declined.decision_snapshot.price, undefined);
  assert.match(
    declined.decision_snapshot.draft.body,
    /Sorry, I only do exterior painting if the house is single storey/,
  );
  assert.doesNotMatch(declined.decision_snapshot.draft.body, /\$|confirm whether/);

  // Quote anyway instead: the Sunday is said plainly, never "I'll confirm".
  await answer(pg, "user-a", e.enquiryId, check!.check!.field, "quote");
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  const quoted = await row(pg, e.enquiryId);
  assert.match(
    quoted.decision_snapshot.draft.body,
    /You mentioned Sunday 11 Oct - I don't work Sundays\. Would Monday 12 October suit instead\?/,
  );
});

test("2 Bec: 'this Sunday 4th? or 20/10' keeps both days and offers the one you work", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning", "cleaning");
  await saveRule(pg, a.businessId, "End of lease clean $380");
  await saveDetails(pg, "user-a", a.businessId, [{ kind: "closed_days", days: [0] }]);
  const e = await enquiry(
    pg,
    a.businessId,
    "end of lease clean pls this Sunday 4th? or 20/10 if not. Bec",
    "End of lease clean",
  );
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  const r = await row(pg, e.enquiryId);
  assert.equal(r.date_label, "Sun 4 or Tue 20 Oct");
  assert.match(
    r.decision_snapshot.draft.body,
    /You mentioned Sunday 4th or 20\/10 - I don't work Sundays, so would Tuesday 20 October suit\?/,
  );
});

test("2 Helen and Priya: never a day they did not ask for; a preference is not a date", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning", "cleaning");
  await saveRule(pg, a.businessId, "End of lease clean $380");
  const helen = await enquiry(
    pg,
    a.businessId,
    "Hi, I work from home Monday to Wednesday so Thursday or Friday would suit best, preferably the 18th of December. Could you quote an end of lease clean?\n\nKind regards,\nHelen",
    "End of lease clean",
  );
  const h = await row(pg, helen.enquiryId);
  assert.equal(h.date_label, "Fri 18 Dec");
  assert.doesNotMatch(h.decision_snapshot.draft.body, /Monday/);
  const priya = await enquiry(
    pg,
    a.businessId,
    "do u do regular cleans? fortnightly, 3hrs, tuesdays pref. Thx, Priya 😊",
  );
  const p = await row(pg, priya.enquiryId);
  assert.equal(p.date_label, "Prefers Tuesdays");
  assert.equal(p.customer_name, "Priya");
  assert.equal((await liveFacts(pg, priya.enquiryId, "date")).length, 0);
});

test("4 Helen: an interior painting price change leaves her confirmed cleaning quote alone", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha", "cleaning");
  await saveRule(pg, a.businessId, "End of lease clean $380");
  await saveRule(pg, a.businessId, "Interior painting $32 per square metre");
  await saveDetails(pg, "user-a", a.businessId, [
    MINIMUM,
    { kind: "note", text: "Minimum charge for interior painting is $450" },
  ]);
  const e = await enquiry(
    pg,
    a.businessId,
    "End of lease clean please, the fridge too. Helen",
    "End of lease clean",
  );
  await answer(pg, "user-a", e.enquiryId, "extra:fridge", "covered");
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  const before = await row(pg, e.enquiryId);
  assert.equal(before.decision_snapshot.coverage?.confirmed, true);
  assert.deepEqual(before.decision_snapshot.coverage?.flagged, [], "no painting note on a clean");
  await saveRule(pg, a.businessId, "Interior painting $35 per square metre");
  const after = await row(pg, e.enquiryId);
  assert.equal(after.decision_snapshot.coverage?.confirmed, true);
  assert.equal(after.decision_revision, before.decision_revision);
});

test("5: a plain No to 'do you do pressure washing?' prepares the kind reply; another tenant lands nothing", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await tenant(pg, "user-b", "Bravo Painting");
  await saveRule(pg, a.businessId, "Interior painting $32 per square metre");
  const e = await enquiry(pg, a.businessId, "Do you do pressure washing? Driveway only.");
  const field = questionField("pressure washing");
  const before = await row(pg, e.enquiryId);
  await assert.rejects(answer(pg, "user-b", e.enquiryId, field, "no"), ForbiddenError);
  assert.equal((await row(pg, e.enquiryId)).decision_revision, before.decision_revision);
  await answer(pg, "user-a", e.enquiryId, field, "no");
  const r = await row(pg, e.enquiryId);
  assert.equal(r.decision_snapshot.recommendation.action, "DECLINE");
  assert.equal(r.decision_snapshot.recommendation.label, "Send the reply");
  assert.match(r.decision_snapshot.draft.body, /Sorry, I don't do pressure washing\./);
  const sent = await tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: e.enquiryId,
      businessId: a.businessId,
      userId: "user-a",
      body: r.decision_snapshot.draft.body,
      channel: "manual",
    }),
  );
  assert.equal(sent.ok, true, JSON.stringify(sent));
});

test("6: a follow-up is never answered with 'Thanks for getting in touch'", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning", "cleaning");
  await saveRule(pg, a.businessId, "Oven clean $90");
  const jo = await enquiry(
    pg,
    a.businessId,
    "Hi, about the quote you sent last week - could you move it to Saturday instead? Jo",
    "Oven clean",
  );
  assert.doesNotMatch(
    (await row(pg, jo.enquiryId)).decision_snapshot.draft.body,
    /getting in touch/,
  );
  const other = await enquiry(pg, a.businessId, "Oven clean please. Sam", "Oven clean");
  assert.match((await row(pg, other.enquiryId)).decision_snapshot.draft.body, /getting in touch/);
  // Once something was sent on it, the next reply continues the conversation.
  await pg.query(
    "insert into message (enquiry_id, direction, channel, at, from_addr, to_addr, body) values ($1, 'outbound', 'manual', now(), '', '', 'Sent')",
    [other.enquiryId],
  );
  await answer(pg, "user-a", other.enquiryId, "name", "Sam");
  assert.doesNotMatch(
    (await row(pg, other.enquiryId)).decision_snapshot.draft.body,
    /getting in touch/,
  );
});

test("7 Kez: 'windows x12' is read, never asked for; names from pipes and footers", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning", "cleaning");
  await saveRule(pg, a.businessId, "Windows $8 per window");
  const kez = await enquiry(
    pg,
    a.businessId,
    "paint my fence and also do the windows x12 - Kez",
    "Windows",
  );
  const k = await row(pg, kez.enquiryId);
  assert.equal(k.decision_snapshot.missing[0]?.inferred?.value, "12");
  assert.doesNotMatch(k.decision_snapshot.draft.body, /how many windows|full cost/);
  const russo = await enquiry(
    pg,
    a.businessId,
    "Hi there,\n\nWe'd like the windows done.\n\nKind regards,\nMargaret & Tony Russo\n\nSent from my iPad",
  );
  assert.equal((await row(pg, russo.enquiryId)).customer_name, "Margaret & Tony Russo");
  const sarah = await enquiry(
    pg,
    a.businessId,
    "Windows for our office please.\n\nSarah Nguyen | Office Manager | Acme Pty Ltd | 07 3000 1234",
  );
  assert.equal((await row(pg, sarah.enquiryId)).customer_name, "Sarah Nguyen");
});

test("9: a real price replaces the practice sample cleanly - never 'two prices disagree'", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  const { enquiryId } = await tx(pg, (sql) =>
    createPracticeEnquiryInTransaction(sql, { businessId: a.businessId, now: FRI_25_SEP }),
  );
  await tx(pg, (sql) =>
    applyPracticeSampleInTransaction(sql, { businessId: a.businessId, enquiryId }),
  );
  const sample = samplePriceFor("painting");
  const read = (await row(pg, enquiryId)).decision_snapshot.missing[0];
  if (read?.inferred) await answer(pg, "user-a", enquiryId, read.factField, read.inferred.value);
  const priced = await row(pg, enquiryId);
  assert.ok(priced.decision_snapshot.coverage, "priced with the sample");
  const real: BusinessRule = { ...sample, amount: sample.amount + 2 } as BusinessRule;
  await tx(pg, (sql) =>
    saveBusinessRuleAndRedecide(sql, {
      businessId: a.businessId,
      rule: real,
      readable: describeRule(real),
    }),
  );
  const after = await row(pg, enquiryId);
  assert.deepEqual(after.decision_snapshot.conflicts, []);
  assert.doesNotMatch(JSON.stringify(after.decision_snapshot), /more than one price|Brain/);
  assert.ok(after.decision_snapshot.coverage, "priced with the real price");
});

// Review of PR #72 ----------------------------------------------------------------

test("PR72 H1: a second minimum for the same jobs keeps the highest; another tenant saves nothing", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await tenant(pg, "user-b", "Bravo Painting");
  const minimums = async () =>
    (
      await pg.query<{ amount: string; state: string }>(
        "select rule_payload->>'amount' as amount, state from knowledge_item where business_id = $1 and rule_payload->>'kind' = 'minimum_charge' order by created_at",
        [a.businessId],
      )
    ).rows.map((r) => `${r.amount}:${r.state}`);
  await saveDetails(pg, "user-a", a.businessId, [{ kind: "minimum_charge", amount: 300 }]);
  await assert.rejects(
    saveDetails(pg, "user-b", a.businessId, [{ kind: "minimum_charge", amount: 900 }]),
    ForbiddenError,
  );
  assert.deepEqual(await minimums(), ["300:Active"]);
  await saveDetails(pg, "user-a", a.businessId, [{ kind: "minimum_charge", amount: 450 }]);
  assert.deepEqual(await minimums(), ["300:Superseded", "450:Active"]);
  await saveDetails(pg, "user-a", a.businessId, [{ kind: "minimum_charge", amount: 200 }]);
  assert.deepEqual(await minimums(), ["300:Superseded", "450:Active"], "a lower one is not saved");
  // Both in one save: only the highest stands.
  await saveDetails(pg, "user-a", a.businessId, [
    { kind: "minimum_charge", amount: 500, service: "Deck staining" },
    { kind: "minimum_charge", amount: 600, service: "Deck staining" },
  ]);
  const deck = await pg.query(
    "select 1 from knowledge_item where business_id = $1 and state = 'Active' and rule_payload->>'service' = 'Deck staining'",
    [a.businessId],
  );
  assert.equal(deck.rows.length, 1);
});

test("PR72: confirming a rough count keeps it rough; another tenant cannot confirm it", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await tenant(pg, "user-b", "Bravo Painting");
  await saveRule(pg, a.businessId, "Interior painting $30 per square metre");
  const e = await enquiry(
    pg,
    a.businessId,
    "interior painting one room, maybe 12sqm. Mick",
    "Interior painting",
  );
  const before = await row(pg, e.enquiryId);
  assert.equal(before.decision_snapshot.missing[0]?.inferred?.value, "12");
  await assert.rejects(answer(pg, "user-b", e.enquiryId, "square metres", "12"), ForbiddenError);
  const still = await row(pg, e.enquiryId);
  assert.equal(still.decision_revision, before.decision_revision);
  assert.deepEqual(still.decision_snapshot, before.decision_snapshot);
  await answer(pg, "user-a", e.enquiryId, "square metres", "12");
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  const body = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.match(body, /about \$360 \(about 12 square metres at \$30 each\)/);
});

test("PR72 H4: a closed-dates day only mentioned is said in the reply", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await saveRule(pg, a.businessId, "Interior painting $30 per square metre");
  await saveDetails(pg, "user-a", a.businessId, [
    { kind: "closed_dates", from: "12-20", to: "01-05" },
  ]);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, need the lounge painted, 10 square metres, on the 22nd of December",
    "Interior painting",
  );
  await answer(pg, "user-a", e.enquiryId, "square metres", "10");
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  assert.match(
    (await row(pg, e.enquiryId)).decision_snapshot.draft.body,
    /I'm not working from 20 December to 5 January\. Would Wednesday 6 January suit instead\?/,
  );
});
