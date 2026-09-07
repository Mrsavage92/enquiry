import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { insertManualEnquiry, interpretAndApply } from "./manual-enquiry-core.ts";
import type { EnquiryInterpreter, InterpretationResult } from "../interpret/types.ts";

/**
 * CC1-03 / P1-03 - a model-proposed service is not an owner-confirmed one.
 *
 * The reviewed build let `interpretAndApply` fill a blank `service_label` from
 * a model candidate, deliberately record the matching service fact as
 * `check_this`, and then price it as an EXACT quote anyway - so the desk showed
 * "confirm this service" and "send the quote" for the same enquiry at the same
 * time. These tests hold the two apart against a real database.
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

function sqlFor(pg: PGlite): Sql {
  const run = async <T>(text: string, params: unknown[]): Promise<T[]> => {
    const res = await pg.query<T>(text, params);
    return res.rows;
  };
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<T>(text, values);
  }) as never;
  return sql;
}

const BRIDAL_RULE = {
  kind: "fixed_price",
  service: "Bridal makeup",
  amount: 190,
  currency: "AUD",
};

async function seedBusiness(pg: PGlite): Promise<string> {
  const biz = await pg.query<{ id: string }>(
    "insert into business (name, industry, owner_first_name) values ($1,$2,$3) returning id",
    ["Glow & Co", "beauty", "Mina"],
  );
  return biz.rows[0]!.id;
}

async function seedActiveRule(pg: PGlite, businessId: string, rule: unknown): Promise<void> {
  await pg.query(
    `insert into knowledge_item (business_id, section, title, body, class, state, source, version, rule_payload)
     values ($1, 'pricing', $2, $3, 'authoritative', 'Active', '{}'::jsonb, '1', $4::jsonb)`,
    [businessId, (rule as { service: string }).service, "seeded for test", JSON.stringify(rule)],
  );
}

function fixedInterpreter(result: InterpretationResult): EnquiryInterpreter {
  return {
    async interpret() {
      return { ok: true, result, model: "fake-model-test" };
    },
  };
}

const proposesBridal = (): InterpretationResult => ({
  serviceCandidate: { label: "Bridal makeup", confidence: "high", span: "bridal makeup" },
  facts: [],
  ambiguities: [],
  candidateMissingFacts: [],
});

type EnquiryRow = {
  service_label: string;
  decision_state: string;
  commercial_state: string;
  decision_snapshot: {
    recommendation: { action: string; primaryEnabled: boolean };
    price?: { kind: string; amountMinor: number };
    provisionalPrice?: { amountMinor: number; service: string };
  };
};

async function readEnquiry(pg: PGlite, enquiryId: string): Promise<EnquiryRow> {
  const rows = await pg.query<EnquiryRow>(
    "select service_label, decision_state, commercial_state, decision_snapshot from enquiry where id = $1",
    [enquiryId],
  );
  return rows.rows[0]!;
}

test("A01: a model-proposed fixed-price service is provisional, never a ready quote", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const businessId = await seedBusiness(pg);
  await seedActiveRule(pg, businessId, BRIDAL_RULE);
  const { enquiryId, messageId } = await insertManualEnquiry(sql, {
    businessId,
    body: "Hi, after bridal makeup for my wedding",
    customerName: "Sarah",
    customerEmail: "sarah@example.com",
    customerPhone: "",
    serviceLabel: "", // the operator left it blank; the model fills it
    intakeNote: "",
  });

  await interpretAndApply(sql, {
    enquiryId,
    businessId,
    messageId,
    rawMessage: "Hi, after bridal makeup for my wedding",
    interpreter: fixedInterpreter(proposesBridal()),
  });

  const enq = await readEnquiry(pg, enquiryId);
  assert.equal(enq.service_label, "Bridal makeup", "the model's read is still recorded");

  const svc = await pg.query<{ status: string; asserted_by: string }>(
    "select status, asserted_by from enquiry_fact where enquiry_id = $1 and field = 'service' and superseded = false",
    [enquiryId],
  );
  assert.equal(svc.rows[0]!.status, "check_this");
  assert.equal(svc.rows[0]!.asserted_by, "system");

  assert.notEqual(
    enq.decision_snapshot.recommendation.action,
    "SEND_QUOTE",
    "an unconfirmed service must not present as a ready quote",
  );
  assert.equal(enq.decision_snapshot.recommendation.primaryEnabled, false);
  assert.equal(enq.commercial_state, "UNASSESSED");
  // No authorised price - the figure lives in provisionalPrice, which no send
  // path reads.
  assert.equal(enq.decision_snapshot.price, undefined);
  assert.equal(enq.decision_snapshot.provisionalPrice?.amountMinor, 19_000);
  assert.equal(enq.decision_snapshot.provisionalPrice?.service, "Bridal makeup");
});

test("A03: a service the OWNER typed is recorded as owner-asserted authority, not a bare label", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const businessId = await seedBusiness(pg);
  await seedActiveRule(pg, businessId, BRIDAL_RULE);
  const { enquiryId } = await insertManualEnquiry(sql, {
    businessId,
    body: "she rang about her wedding",
    customerName: "Sarah",
    customerEmail: "sarah@example.com",
    customerPhone: "",
    serviceLabel: "Bridal makeup",
    intakeNote: "typed up from a phone call",
  });

  const svc = await pg.query<{ status: string; asserted_by: string; provenance: { kind: string } }>(
    "select status, asserted_by, provenance from enquiry_fact where enquiry_id = $1 and field = 'service' and superseded = false",
    [enquiryId],
  );
  assert.equal(svc.rows.length, 1, "the owner's own entry must be recorded as a fact");
  assert.equal(svc.rows[0]!.status, "confirmed");
  assert.equal(svc.rows[0]!.asserted_by, "user");
  assert.equal(svc.rows[0]!.provenance.kind, "user");

  const enq = await readEnquiry(pg, enquiryId);
  assert.equal(enq.decision_snapshot.recommendation.action, "SEND_QUOTE");
  assert.equal(enq.decision_snapshot.price?.amountMinor, 19_000);
});

test("A03: a model that never answers leaves the enquiry without a confirmed service", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const businessId = await seedBusiness(pg);
  await seedActiveRule(pg, businessId, BRIDAL_RULE);
  const { enquiryId, messageId } = await insertManualEnquiry(sql, {
    businessId,
    body: "hello?",
    customerName: "Sarah",
    customerEmail: "sarah@example.com",
    customerPhone: "",
    serviceLabel: "",
    intakeNote: "",
  });
  await interpretAndApply(sql, {
    enquiryId,
    businessId,
    messageId,
    rawMessage: "hello?",
    interpreter: {
      async interpret() {
        return { ok: false, reason: "provider_error" };
      },
    },
  });

  const svc = await pg.query(
    "select 1 from enquiry_fact where enquiry_id = $1 and field = 'service'",
    [enquiryId],
  );
  assert.equal(svc.rows.length, 0, "a failed read must not manufacture a service");
  const enq = await readEnquiry(pg, enquiryId);
  assert.notEqual(enq.decision_snapshot.recommendation.action, "SEND_QUOTE");
});

test("A02: confirming the service recomputes to a real quote, and it survives a reload", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const businessId = await seedBusiness(pg);
  await seedActiveRule(pg, businessId, BRIDAL_RULE);
  const { enquiryId, messageId } = await insertManualEnquiry(sql, {
    businessId,
    body: "after bridal makeup",
    customerName: "Sarah",
    customerEmail: "sarah@example.com",
    customerPhone: "",
    serviceLabel: "",
    intakeNote: "",
  });
  await interpretAndApply(sql, {
    enquiryId,
    businessId,
    messageId,
    rawMessage: "after bridal makeup",
    interpreter: fixedInterpreter(proposesBridal()),
  });
  assert.equal((await readEnquiry(pg, enquiryId)).decision_snapshot.price, undefined);

  // The owner confirms, exactly as `setEnquiryService` does.
  await pg.query(
    "update enquiry_fact set superseded = true where enquiry_id = $1 and field = 'service'",
    [enquiryId],
  );
  await pg.query(
    `insert into enquiry_fact
       (enquiry_id, field, label, value, display_value, status, confidence, asserted_by, provenance, customer_specific)
     values ($1,'service','service','Bridal makeup','Bridal makeup','confirmed','High','user','{"kind":"user"}'::jsonb, true)`,
    [enquiryId],
  );
  const { decideEnquiry } = await import("../../domain/decide.ts");
  const { snapshotFromDecision, stateFromDecision } = await import(
    "../../domain/decision-snapshot.ts"
  );
  const facts = await pg.query<{ field: string; value: string; status: string }>(
    "select field, value, status from enquiry_fact where enquiry_id = $1 and superseded = false",
    [enquiryId],
  );
  const decision = decideEnquiry(
    { knowledge: [{ state: "Active", rulePayload: BRIDAL_RULE }] },
    { serviceLabel: "Bridal makeup", facts: facts.rows as never },
  );
  const state = stateFromDecision(decision);
  await pg.query(
    `update enquiry set decision_snapshot = $2::jsonb, decision_state = $3, commercial_state = $4 where id = $1`,
    [
      enquiryId,
      JSON.stringify(snapshotFromDecision(decision)),
      state.decisionState,
      state.commercialState,
    ],
  );

  // Reload from the database, not from memory.
  const after = await readEnquiry(pg, enquiryId);
  assert.equal(after.decision_snapshot.recommendation.action, "SEND_QUOTE");
  assert.equal(after.decision_snapshot.price?.amountMinor, 19_000);
  assert.equal(after.decision_snapshot.provisionalPrice, undefined);
  assert.equal(after.commercial_state, "QUOTABLE");
});

test("A04: a model result arriving after the owner set the service never overrides them", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const businessId = await seedBusiness(pg);
  await seedActiveRule(pg, businessId, BRIDAL_RULE);
  await seedActiveRule(pg, businessId, {
    kind: "fixed_price",
    service: "Bridal trial",
    amount: 90,
    currency: "AUD",
  });
  const { enquiryId, messageId } = await insertManualEnquiry(sql, {
    businessId,
    body: "wedding stuff",
    customerName: "Sarah",
    customerEmail: "sarah@example.com",
    customerPhone: "",
    serviceLabel: "",
    intakeNote: "",
  });

  // The owner settles it while the interpreter call is still in flight.
  await pg.query(
    `insert into enquiry_fact
       (enquiry_id, field, label, value, display_value, status, confidence, asserted_by, provenance, customer_specific)
     values ($1,'service','service','Bridal trial','Bridal trial','confirmed','High','user','{"kind":"user"}'::jsonb, true)`,
    [enquiryId],
  );
  await pg.query("update enquiry set service_label = 'Bridal trial' where id = $1", [enquiryId]);

  await interpretAndApply(sql, {
    enquiryId,
    businessId,
    messageId,
    rawMessage: "wedding stuff",
    interpreter: fixedInterpreter(proposesBridal()),
  });

  const enq = await readEnquiry(pg, enquiryId);
  assert.equal(enq.service_label, "Bridal trial", "the owner's decision stands");
  const svc = await pg.query<{ value: string; status: string; asserted_by: string }>(
    "select value, status, asserted_by from enquiry_fact where enquiry_id = $1 and field = 'service' and superseded = false",
    [enquiryId],
  );
  assert.equal(svc.rows.length, 1);
  assert.equal(svc.rows[0]!.value, "Bridal trial");
  assert.equal(svc.rows[0]!.asserted_by, "user");
  // And the snapshot reflects the owner's service, priced from ITS rule.
  assert.equal(enq.decision_snapshot.price?.amountMinor, 9_000);
});
