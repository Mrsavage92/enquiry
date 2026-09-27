import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import { loadWorkspace } from "./workspace.server.ts";
import { saveBusinessDetailsForUser } from "./business-rule-core.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { saveBusinessRuleAndRedecide } from "./business-rule-core.ts";
import { answerFactForUser } from "./answer-fact-core.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import { ForbiddenError } from "./tenancy.server.ts";
import { describeRule, type BusinessRule } from "../../domain/business-rule.ts";
import { readPriceLine } from "../../domain/price-sentence.ts";
import { EXTRA_CHOICE } from "../../domain/extras.ts";

/**
 * Review of PR #71, against a real database. Setup as pass 5: and always with two tenants: a total is
 * only ever named after the owner confirmed what it covers (enforced by the
 * server, not the screen), every repro from the review now ends in a true
 * reply, and every new or changed server path refuses another tenant and
 * lands nothing for them.
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

const PROFILE = {
  ownerFirstName: "Dean",
  industry: "cleaning",
  baseLocation: "Brisbane",
  timezone: "Australia/Brisbane",
  soloOrTeam: "solo" as const,
  currency: "AUD",
};

async function tenant(pg: PGlite, userId: string, name: string, industry = "cleaning") {
  await pg.query("insert into app_user (id, email) values ($1, $2)", [userId, `${userId}@test`]);
  return tx(pg, (sql) => createWorkspaceInTransaction(sql, { ...PROFILE, industry, name, userId }));
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
  recommendation: { action: string; label: string; reasonCodes: string[] };
  missing: { factField: string; inferred?: { value: string } }[];
  draft: { body: string };
  price?: { amountMinor: number };
  coverage?: {
    key: string;
    confirmed: boolean;
    lines: { label: string; amountMinor: number; quantity?: string }[];
    flagged: { text: string }[];
    recurring: boolean;
  };
  extraPending?: { field: string; label: string; kind: string };
  questionPending?: { field: string; thing: string; readAs?: string };
};

async function row(pg: PGlite, id: string) {
  const res = await pg.query<{
    decision_state: string;
    decision_revision: number;
    date_label: string | null;
    customer_name: string;
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

async function prepare(pg: PGlite, enquiryId: string, businessId: string, body: string) {
  return tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId,
      businessId,
      userId: "user-a",
      body,
      channel: "manual",
    }),
  );
}

async function legacy(pg: PGlite, enquiryId: string) {
  // A quote decided before the price check existed: a price, SEND_QUOTE, no key.
  await pg.query(
    `update enquiry set decision_state = 'ACTION_READY',
       decision_snapshot = (decision_snapshot - 'coverage')
         || jsonb_build_object('price', jsonb_build_object('kind', 'EXACT', 'amountMinor', 9500, 'currency', 'AUD'))
         || jsonb_build_object('recommendation', (decision_snapshot -> 'recommendation') || '{"action":"SEND_QUOTE"}'::jsonb)
     where id = $1`,
    [enquiryId],
  );
}

test("H1: a legacy open quote with no coverage key becomes confirmable when the workspace is read", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  const b = await tenant(pg, "user-b", "Bravo Cleaning");
  await saveRule(pg, a.businessId, "Oven clean $95");
  await saveRule(pg, b.businessId, "Oven clean $95");
  const e = await enquiry(pg, a.businessId, "Oven clean please. Jo", "Oven clean");
  const other = await enquiry(pg, b.businessId, "Oven clean please. Bea", "Oven clean");
  await legacy(pg, e.enquiryId);
  await legacy(pg, other.enquiryId);
  const body = "Hi Jo,\n\nFor the oven clean, that comes to $95.\n\nThanks";
  const stuck = await prepare(pg, e.enquiryId, a.businessId, body);
  assert.equal(!stuck.ok && stuck.reason, "coverage_unconfirmed");
  assert.equal(
    (await confirmCoverage(pg, "user-a", e.enquiryId)).ok,
    false,
    "no key to confirm yet",
  );

  const otherBefore = await row(pg, other.enquiryId);
  await loadWorkspace("user-a", sqlFor(pg));
  const fixed = await row(pg, e.enquiryId);
  assert.ok(fixed.decision_snapshot.coverage?.key, "the check appears");
  assert.equal(fixed.decision_snapshot.coverage?.confirmed, false);
  // Another tenant's legacy enquiry is not touched by user-a's read.
  const otherAfter = await row(pg, other.enquiryId);
  assert.equal(otherAfter.decision_revision, otherBefore.decision_revision);
  assert.equal(otherAfter.decision_snapshot.coverage, undefined);
  // Idempotent: a second read changes nothing.
  await loadWorkspace("user-a", sqlFor(pg));
  assert.equal((await row(pg, e.enquiryId)).decision_revision, fixed.decision_revision);

  const ok = await confirmCoverage(pg, "user-a", e.enquiryId);
  assert.equal(ok.ok, true);
  const sent = await prepare(pg, e.enquiryId, a.businessId, body);
  assert.equal(sent.ok, true, JSON.stringify(sent));
});

test("L3: A -> B -> A never revives a confirmation given for A", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  await saveRule(pg, a.businessId, "End of lease clean $190 per bedroom");
  const e = await enquiry(pg, a.businessId, "End of lease clean please. Jo", "End of lease clean");
  await answer(pg, "user-a", e.enquiryId, "bedrooms", "3");
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  assert.equal((await row(pg, e.enquiryId)).decision_snapshot.coverage?.confirmed, true);
  await answer(pg, "user-a", e.enquiryId, "bedrooms", "4");
  await answer(pg, "user-a", e.enquiryId, "bedrooms", "3");
  const back = await row(pg, e.enquiryId);
  assert.equal(back.decision_snapshot.coverage?.confirmed, false, "confirmed again or not at all");
  const live = await pg.query(
    "select 1 from enquiry_fact where enquiry_id = $1 and field = 'coverage' and superseded = false",
    [e.enquiryId],
  );
  assert.equal(live.rows.length, 0);
});

test("M1: the server refuses to confirm while a flag is unsettled", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  await saveRule(pg, a.businessId, "End of lease clean $190 per bedroom");
  const e = await enquiry(
    pg,
    a.businessId,
    "End of lease clean for a 3 bedroom house. Also the garage and the deck. Jo",
    "End of lease clean",
  );
  await answer(pg, "user-a", e.enquiryId, "bedrooms", "3");
  const before = await row(pg, e.enquiryId);
  const refused = await confirmCoverage(pg, "user-a", e.enquiryId);
  assert.equal(!refused.ok && refused.reason, "unsettled");
  assert.equal((await row(pg, e.enquiryId)).decision_revision, before.decision_revision);
  await answer(pg, "user-a", e.enquiryId, "extra:garage", EXTRA_CHOICE.comeBack);
  await answer(pg, "user-a", e.enquiryId, "extra:deck", EXTRA_CHOICE.notAsked);
  assert.equal((await confirmCoverage(pg, "user-a", e.enquiryId)).ok, true);
  const body = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.match(body, /I'll come back to you on the garage\./);
  assert.doesNotMatch(body, /deck/);
});

test("M4: an edit naming money in another form, or in words, is caught by the server", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  await saveRule(pg, a.businessId, "Oven clean $95");
  const e = await enquiry(pg, a.businessId, "Oven clean please. Jo", "Oven clean");
  await confirmCoverage(pg, "user-a", e.enquiryId);
  for (const body of ["That comes to 880 AUD.", "That comes to 880.", "That's 880$ all told."]) {
    const res = await prepare(pg, e.enquiryId, a.businessId, body);
    assert.equal(!res.ok && res.reason, "amount_mismatch", body);
  }
  const words = await prepare(pg, e.enquiryId, a.businessId, "About ninety-ish dollars.");
  assert.equal(!words.ok && words.reason, "amount_unreadable");
  assert.ok((await prepare(pg, e.enquiryId, a.businessId, "That comes to 95 AUD.")).ok);
});

test("L8: saving business details through the handler's path is Forbidden for another tenant and lands nothing", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  await tenant(pg, "user-b", "Bravo Cleaning");
  const e = await enquiry(pg, a.businessId, "Oven clean please. Jo", "Oven clean");
  const before = await row(pg, e.enquiryId);
  const input = {
    businessId: a.businessId,
    rules: [
      { kind: "fixed_price" as const, service: "Oven clean", amount: 95, currency: "AUD" as const },
    ],
    details: [{ kind: "closed_days" as const, days: [0] }],
  };
  await assert.rejects(
    saveBusinessDetailsForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-b", input),
    ForbiddenError,
  );
  const none = await pg.query("select 1 from knowledge_item where business_id = $1", [
    a.businessId,
  ]);
  assert.equal(none.rows.length, 0);
  const still = await row(pg, e.enquiryId);
  assert.equal(still.decision_revision, before.decision_revision);
  assert.deepEqual(still.decision_snapshot, before.decision_snapshot);
  const res = await saveBusinessDetailsForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", input);
  assert.equal(res.saved.length, 1);
  assert.equal(res.detailIds.length, 1);
});
