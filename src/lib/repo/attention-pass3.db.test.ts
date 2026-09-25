import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { saveBusinessRuleAndRedecide } from "./business-rule-core.ts";
import { applyDecision, lockEnquiry } from "./decision-apply.ts";
import {
  loadOwnerState,
  saveReplyDraftForUser,
  saveWorkspacePrefsForUser,
} from "./owner-state-core.ts";
import { loadWorkspace, safeBookingUrl } from "./workspace.server.ts";
import { ForbiddenError } from "./tenancy.server.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import { describeRule, type BusinessRule } from "../../domain/business-rule.ts";

/**
 * The third attention pass against a real database, always with two tenants:
 * a count the customer already gave is read (never asked for again), a date
 * question is acknowledged in the reply, an edit made before the facts moved
 * is kept for the owner to choose, and the setup-call link appears only when
 * one is configured.
 */

const migrationsDir = join(process.cwd(), "migrations");

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
  industry: "painting",
  baseLocation: "Brisbane",
  timezone: "Australia/Brisbane",
  soloOrTeam: "solo" as const,
  currency: "AUD",
};

const PER_SQM: BusinessRule = {
  kind: "per_unit",
  service: "Interior painting",
  amount: 30,
  currency: "AUD",
  unit: "square metre",
  quantityField: "square metres",
};

const PER_BEDROOM: BusinessRule = {
  kind: "per_unit",
  service: "End of lease clean",
  amount: 190,
  currency: "AUD",
  unit: "bedroom",
  quantityField: "bedrooms",
};

const KAREN =
  "Hi there, we need the inside of our 3 bedroom house painted before we sell. Walls and ceilings, roughly 120 square metres. Could you do it on Saturday 3 October? We're in Chermside. Cheers, Karen Mills";
const PRIYA =
  "hey mate need an end of lease clean for a 2 bed unit in Nundah, carpets too. Moving out on the 30th. how much and can u do the 1st? - Priya";

async function tenant(pg: PGlite, userId: string, name: string) {
  await pg.query("insert into app_user (id, email) values ($1, $2)", [userId, `${userId}@test`]);
  return tx(pg, (sql) => createWorkspaceInTransaction(sql, { ...PROFILE, name, userId }));
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
      now: new Date("2026-09-25T09:00:00+10:00"),
    }),
  );
}

async function saveRule(pg: PGlite, businessId: string, rule: BusinessRule) {
  return tx(pg, (sql) =>
    saveBusinessRuleAndRedecide(sql, { businessId, rule, readable: describeRule(rule) }),
  );
}

type Snap = {
  recommendation: { label: string; action: string };
  missing: { factField: string; inferred?: { value: string; display: string } }[];
  draft: { body: string };
};

async function row(pg: PGlite, id: string) {
  const res = await pg.query<{
    decision_state: string;
    decision_revision: number;
    decision_snapshot: Snap;
    customer_name: string;
  }>("select * from enquiry where id = $1", [id]);
  return res.rows[0]!;
}

async function liveFacts(pg: PGlite, id: string, field: string) {
  const res = await pg.query<{
    value: string;
    status: string;
    display_value: string;
    asserted_by: string;
    provenance: { kind: string; span: string };
  }>(
    "select value, status, display_value, asserted_by, provenance from enquiry_fact where enquiry_id = $1 and lower(field) = lower($2) and superseded = false",
    [id, field],
  );
  return res.rows;
}

test("a count the customer wrote is read as inferred and never asked for again", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await saveRule(pg, a.businessId, PER_SQM);
  const karen = await enquiry(pg, a.businessId, KAREN, "Interior painting");

  const [fact] = await liveFacts(pg, karen.enquiryId, "square metres");
  assert.equal(fact?.value, "120");
  assert.equal(fact?.status, "inferred", "a reading, never confirmed by itself");
  assert.equal(fact?.asserted_by, "system");
  assert.equal(fact?.display_value, "roughly 120 square metres");
  assert.equal(fact?.provenance.kind, "message");

  const r = await row(pg, karen.enquiryId);
  assert.equal(r.decision_state, "NEEDS_INFORMATION", "not priced until the owner confirms");
  assert.equal(r.decision_snapshot.missing[0]?.inferred?.value, "120");
  assert.equal(r.decision_snapshot.recommendation.label, "Check the number of square metres");
  assert.doesNotMatch(r.decision_snapshot.draft.body, /how many|let me know/i);
  // The date question is answered honestly: nothing checks availability.
  assert.match(r.decision_snapshot.draft.body, /I'll confirm whether Saturday 3 October works\./);
  assert.equal(r.customer_name, "Karen Mills");

  // The owner confirms their reading: now it prices.
  await tx(pg, async (sql) => {
    await lockEnquiry(sql, karen.enquiryId);
    await sql`update enquiry_fact set superseded = true where enquiry_id = ${karen.enquiryId} and field = ${"square metres"}`;
    await sql`
      insert into enquiry_fact (enquiry_id, field, label, value, display_value, status, confidence, asserted_by, provenance, customer_specific)
      values (${karen.enquiryId}, ${"square metres"}, ${"square metres"}, ${"120"}, ${"120"}, ${"confirmed"}, ${"High"}, ${"user"}, ${JSON.stringify({ kind: "user", label: "Entered by the owner" })}::jsonb, ${true})
    `;
    await applyDecision(sql, {
      enquiryId: karen.enquiryId,
      businessId: a.businessId,
      serviceLabel: "Interior painting",
      customerName: "Karen Mills",
    });
  });
  const priced = await row(pg, karen.enquiryId);
  assert.equal(priced.decision_state, "ACTION_READY");
  assert.match(priced.decision_snapshot.draft.body, /\$3,600/);
});

test("a price added later reads the count from the message, for its own business only", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  const b = await tenant(pg, "user-b", "Bravo Cleaning");
  const priya = await enquiry(pg, a.businessId, PRIYA, "End of lease clean");
  const other = await enquiry(pg, b.businessId, PRIYA, "End of lease clean");

  const before = await row(pg, priya.enquiryId);
  assert.equal(before.customer_name, "Priya", "the dash sign-off gives the name");
  assert.match(before.decision_snapshot.draft.body, /^Hi Priya,/);
  assert.deepEqual(await liveFacts(pg, priya.enquiryId, "bedrooms"), []);

  const saved = await saveRule(pg, a.businessId, PER_BEDROOM);
  assert.deepEqual(saved.updatedEnquiryIds, [priya.enquiryId]);
  const [fact] = await liveFacts(pg, priya.enquiryId, "bedrooms");
  assert.equal(fact?.value, "2");
  assert.equal(fact?.status, "inferred");
  const after = await row(pg, priya.enquiryId);
  assert.equal(after.decision_snapshot.missing[0]?.inferred?.value, "2");

  // B never priced it and never had its message read against A's price.
  assert.deepEqual(await liveFacts(pg, other.enquiryId, "bedrooms"), []);
  assert.equal(
    (await row(pg, other.enquiryId)).decision_snapshot.recommendation.label,
    "Add your prices",
  );
});

test("an owner's own answer is never overwritten by a reading", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  const e = await enquiry(pg, a.businessId, PRIYA, "End of lease clean");
  await pg.query(
    `insert into enquiry_fact (enquiry_id, field, label, value, display_value, status, confidence, asserted_by, provenance, customer_specific)
     values ($1, 'bedrooms', 'bedrooms', '3', '3', 'confirmed', 'High', 'user', '{"kind":"user"}'::jsonb, true)`,
    [e.enquiryId],
  );
  await saveRule(pg, a.businessId, PER_BEDROOM);
  const facts = await liveFacts(pg, e.enquiryId, "bedrooms");
  assert.equal(facts.length, 1);
  assert.equal(facts[0]?.value, "3");
  assert.equal(facts[0]?.status, "confirmed");
  assert.equal((await row(pg, e.enquiryId)).decision_state, "ACTION_READY");
});

test("an edit made before the facts moved is kept as stale, only for its owner", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Alpha Painting");
  const b = await tenant(pg, "user-b", "Bravo Painting");
  await saveRule(pg, a.businessId, PER_SQM);
  const e = await enquiry(
    pg,
    a.businessId,
    "Paint the lounge please. Thanks, Karen",
    "Interior painting",
  );

  await saveReplyDraftForUser(sql, "user-a", e.enquiryId, "Hi Karen, my own words.");
  assert.equal(
    (await loadOwnerState(sql, [a.businessId])).drafts[e.enquiryId],
    "Hi Karen, my own words.",
  );

  // A fact changes and the decision is rebuilt.
  await tx(pg, async (t) => {
    await lockEnquiry(t, e.enquiryId);
    await t`
      insert into enquiry_fact (enquiry_id, field, label, value, display_value, status, confidence, asserted_by, provenance, customer_specific)
      values (${e.enquiryId}, ${"square metres"}, ${"square metres"}, ${"40"}, ${"40"}, ${"confirmed"}, ${"High"}, ${"user"}, ${JSON.stringify({ kind: "user" })}::jsonb, ${true})
    `;
    await applyDecision(t, {
      enquiryId: e.enquiryId,
      businessId: a.businessId,
      serviceLabel: "Interior painting",
      customerName: "Karen",
    });
  });
  const state = await loadOwnerState(sql, [a.businessId]);
  assert.equal(state.drafts[e.enquiryId], undefined, "not offered as current");
  assert.equal(state.staleDrafts[e.enquiryId], "Hi Karen, my own words.", "and not dropped");

  const aWs = await loadWorkspace("user-a", sql);
  assert.equal(aWs.staleDrafts[e.enquiryId], "Hi Karen, my own words.");
  const bWs = await loadWorkspace("user-b", sql);
  assert.deepEqual(bWs.staleDrafts, {}, "B never sees A's edit");
  // And B cannot write a draft onto A's enquiry: refused, nothing changed.
  await assert.rejects(
    saveReplyDraftForUser(sql, "user-b", e.enquiryId, "B's words"),
    (err: unknown) => err instanceof ForbiddenError,
  );
  const bodies = await pg.query<{ body: string }>(
    "select body from reply_draft where enquiry_id = $1",
    [e.enquiryId],
  );
  assert.deepEqual(
    bodies.rows.map((r) => r.body),
    ["Hi Karen, my own words."],
  );
  void b;

  // Once a reply is recorded as sent after the edit, the edit is history.
  await pg.query(
    "insert into message (enquiry_id, direction, channel, body, at) values ($1, 'outbound', 'manual', 'sent', now() + interval '1 second')",
    [e.enquiryId],
  );
  assert.equal((await loadOwnerState(sql, [a.businessId])).staleDrafts[e.enquiryId], undefined);
});

test("the setup-call card has a link only when one is configured, and closing it is per business", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Alpha Painting");
  const b = await tenant(pg, "user-b", "Bravo Painting");

  assert.equal((await loadWorkspace("user-a", sql)).setupCallUrl, null, "absent: no card");

  await pg.query("insert into launch_settings (key, value) values ('setup_call_url', $1)", [
    "https://cal.example.com/enquiry/setup",
  ]);
  assert.equal(
    (await loadWorkspace("user-a", sql)).setupCallUrl,
    "https://cal.example.com/enquiry/setup",
  );
  assert.equal((await loadWorkspace("nobody", sql)).setupCallUrl, null, "no workspace, no link");

  await pg.query(
    "update launch_settings set value = 'javascript:alert(1)' where key = 'setup_call_url'",
  );
  assert.equal((await loadWorkspace("user-a", sql)).setupCallUrl, null);
  assert.equal(safeBookingUrl("http://insecure.example.com"), null);
  assert.equal(safeBookingUrl("  "), null);

  // Closing the card is A's choice for A's business.
  const saved = await saveWorkspacePrefsForUser(sql, "user-a", a.businessId, {
    setupCallDismissed: true,
  });
  assert.equal(saved.setupCallDismissed, true);
  const bPrefs = (await loadOwnerState(sql, [b.businessId])).prefs[b.businessId];
  assert.notEqual(bPrefs?.setupCallDismissed, true);
  // B cannot close it for A, or reopen it: refused, and A's choice stands.
  await assert.rejects(
    saveWorkspacePrefsForUser(sql, "user-b", a.businessId, { setupCallDismissed: false }),
    (err: unknown) => err instanceof ForbiddenError,
  );
  assert.equal(
    (await loadOwnerState(sql, [a.businessId])).prefs[a.businessId]?.setupCallDismissed,
    true,
  );
});

async function confirmFact(
  pg: PGlite,
  enquiryId: string,
  businessId: string,
  field: string,
  value: string,
) {
  await tx(pg, async (t) => {
    await lockEnquiry(t, enquiryId);
    await t`update enquiry_fact set superseded = true where enquiry_id = ${enquiryId} and lower(field) = lower(${field}) and superseded = false`;
    await t`
      insert into enquiry_fact (enquiry_id, field, label, value, display_value, status, confidence, asserted_by, provenance, customer_specific)
      values (${enquiryId}, ${field}, ${field}, ${value}, ${value}, ${"confirmed"}, ${"High"}, ${"user"}, ${JSON.stringify({ kind: "user" })}::jsonb, ${true})
    `;
    await applyDecision(t, {
      enquiryId,
      businessId,
      serviceLabel: "Interior painting",
      customerName: "Karen Mills",
    });
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

test("a reply resting on an unconfirmed reading is refused by the server", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await saveRule(pg, a.businessId, PER_SQM);
  const karen = await enquiry(pg, a.businessId, KAREN, "Interior painting");
  const snap = (await row(pg, karen.enquiryId)).decision_snapshot as Snap & {
    recommendation: { primaryEnabled: boolean };
  };
  assert.equal(snap.recommendation.primaryEnabled, false);

  const res = await prepare(pg, karen.enquiryId, a.businessId, snap.draft.body);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, "unconfirmed_reading");
  const artefacts = await pg.query("select id from reviewed_send where enquiry_id = $1", [
    karen.enquiryId,
  ]);
  assert.equal(artefacts.rows.length, 0, "nothing frozen for review");

  // Confirmed, it prepares.
  await confirmFact(pg, karen.enquiryId, a.businessId, "square metres", "120");
  const ok = await prepare(
    pg,
    karen.enquiryId,
    a.businessId,
    (await row(pg, karen.enquiryId)).decision_snapshot.draft.body,
  );
  assert.equal(ok.ok, true);
});

test("a kept edit naming the old price in any money format is refused", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await saveRule(pg, a.businessId, PER_SQM);
  const karen = await enquiry(pg, a.businessId, KAREN, "Interior painting");
  await confirmFact(pg, karen.enquiryId, a.businessId, "square metres", "120");
  // The facts move: 140 square metres, $4,200. The owner kept an edit that
  // still carries the old $3,600 somewhere, written a different way.
  await confirmFact(pg, karen.enquiryId, a.businessId, "square metres", "140");
  for (const old of ["$ 3600", "3,600 dollars", "AUD 3600", "A$3600", "3.6k", "$3.6k", "3k"]) {
    const body = `Hi Karen, that comes to $4,200 (it was ${old} before). 140 square metres at $30 each.`;
    const res = await prepare(pg, karen.enquiryId, a.businessId, body);
    assert.equal(res.ok, false, old);
    if (!res.ok) assert.equal(res.reason, "amount_mismatch", old);
  }
  const fine = await prepare(
    pg,
    karen.enquiryId,
    a.businessId,
    "Hi Karen, that comes to $4,200. 140 square metres at $30 each.",
  );
  assert.equal(fine.ok, true);
});
