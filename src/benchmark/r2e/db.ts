import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../../lib/db.ts";
import { decideEnquiry } from "../../domain/decide.ts";
import { snapshotFromDecision, stateFromDecision } from "../../domain/decision-snapshot.ts";
import { insertManualEnquiry, interpretAndApply } from "../../lib/repo/manual-enquiry-core.ts";
import { nullInterpreter } from "../../lib/interpret/null-interpreter.ts";
import {
  createAnthropicInterpreter,
  type AnthropicTransport,
} from "../../lib/interpret/anthropic-interpreter.server.ts";
import { createInterpreter } from "../../lib/interpret/index.server.ts";
import type {
  EnquiryInterpreter,
  InterpretationResult,
  InterpretFailureReason,
  InterpretOutcome,
} from "../../lib/interpret/types.ts";
import type { BenchmarkCase, BusinessSetup, OperatorInput } from "./types.ts";

/**
 * Everything the benchmark needs against a real database, built the same way
 * `manual-enquiry-core.db.test.ts` does: raw PGLite, every migration applied
 * directly, the core functions called directly (not the `createServerFn`
 * routes, which need a real auth context this harness has no reason to fake).
 *
 * Scoring lives in `evaluate.ts`, which only reads the `CaseRun` shape this
 * file produces - it never touches PGLite or the interpreter directly.
 */

export type RunMode = "null" | "fake" | "real";

/**
 * Case 9's own point: identical wording, a second Business Brain. Turn its
 * `variant` into a full, independent case so it flows through `runCase` /
 * `evaluateCase` exactly like every other case - same message, same operator
 * shape, a different business and a different expected outcome.
 */
export function toVariantCase(kase: BenchmarkCase): BenchmarkCase | null {
  if (!kase.variant) return null;
  return {
    ...kase,
    id: `${kase.id}-variant-b`,
    business: kase.variant.business,
    operator: kase.variant.operator,
    expectedModelReading: kase.variant.expectedModelReading,
    expected: kase.variant.expected,
    nullModeBusiness: undefined,
    followUps: [],
    variant: undefined,
  };
}

const migrationsDir = join(process.cwd(), "migrations");

export async function freshDb(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.waitReady;
  for (const f of readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await pg.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  return pg;
}

export function sqlFor(pg: PGlite): Sql {
  const run = async <T>(text: string, params: unknown[]): Promise<T[]> => {
    const res = await pg.query<T>(text, params);
    return res.rows;
  };
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  (sql as unknown as { query: typeof run }).query = run;
  return sql;
}

export async function seedBusiness(pg: PGlite, setup: BusinessSetup): Promise<string> {
  const biz = await pg.query<{ id: string }>(
    "insert into business (name, industry, city, timezone, currency, solo_or_team, base_location, owner_name, owner_first_name) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
    [
      setup.name,
      setup.industry,
      "Brisbane",
      "Australia/Brisbane",
      "AUD",
      "solo",
      "Brisbane",
      "Jordan",
      "Jordan",
    ],
  );
  const businessId = biz.rows[0]!.id;
  for (const rule of setup.rules) {
    const service = (rule.payload as { service?: unknown }).service;
    await pg.query(
      `insert into knowledge_item (business_id, section, title, body, class, state, source, version, rule_payload)
       values ($1, 'pricing', $2, $3, 'authoritative', $4, '{}'::jsonb, '1', $5::jsonb)`,
      [
        businessId,
        typeof service === "string" ? service : "seeded rule",
        "seeded for the R2E benchmark",
        rule.state ?? "Active",
        JSON.stringify(rule.payload),
      ],
    );
  }
  return businessId;
}

export async function createEnquiry(
  sql: Sql,
  businessId: string,
  operator: OperatorInput,
  rawMessage: string,
): Promise<{ enquiryId: string; messageId: string }> {
  return insertManualEnquiry(sql, {
    businessId,
    body: rawMessage,
    customerName: operator.customerName,
    customerEmail: operator.customerEmail,
    customerPhone: operator.customerPhone ?? "",
    serviceLabel: operator.serviceLabel,
    intakeNote: operator.intakeNote ?? "",
  });
}

/** A deterministic test double that always returns the same reading - never a network call. */
export function fixedInterpreter(result: InterpretationResult, model: string): EnquiryInterpreter {
  return {
    async interpret() {
      return { ok: true, result, model };
    },
  };
}

export function failingInterpreter(reason: InterpretFailureReason): EnquiryInterpreter {
  return {
    async interpret() {
      return { ok: false, reason };
    },
  };
}

/** A transport that always throws, so the real adapter's own classification logic runs with zero network calls and zero spend. */
const throwingTransport: AnthropicTransport = async () => {
  throw new Error("simulated provider failure (R2E benchmark, no network call made)");
};

/**
 * The interpreter for one (case, mode) pair. Real mode returns `null` when no
 * key is configured - the caller must treat that as "skip this mode", not as
 * a stand-in for the null interpreter.
 */
export function interpreterFor(mode: RunMode, kase: BenchmarkCase): EnquiryInterpreter | null {
  if (mode === "null") return nullInterpreter;

  if (mode === "fake") {
    if (kase.simulatedFailureReason) return failingInterpreter(kase.simulatedFailureReason);
    return fixedInterpreter(kase.expectedModelReading!, "fake-model-r2e-benchmark");
  }

  // mode === "real"
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!apiKey.trim()) return null;
  if (kase.simulatedFailureReason) {
    // Exercise the real adapter's own error classification, not the live
    // network - the point of this category is failure handling, not a bet on
    // the live API happening to fail. No spend for this case, key present or not.
    return createAnthropicInterpreter({ apiKey, transport: throwingTransport });
  }
  return createInterpreter();
}

/** Wrap an interpreter so its one call inside `interpretAndApply` is captured for the interpretation-dimension check, without a second (possibly paid) call. */
function capture(interpreter: EnquiryInterpreter): {
  interpreter: EnquiryInterpreter;
  get: () => InterpretOutcome | undefined;
} {
  let captured: InterpretOutcome | undefined;
  return {
    interpreter: {
      async interpret(input) {
        const outcome = await interpreter.interpret(input);
        captured = outcome;
        return outcome;
      },
    },
    get: () => captured,
  };
}

export type EnquiryRow = {
  decision_state: string;
  commercial_state: string;
  decision_snapshot: {
    recommendation: { action: string; reason: string; primaryEnabled: boolean };
    explanation: string;
    price?: { kind: string; amountMinor: number; currency: string };
    draft: { body: string };
  };
};

async function readEnquiry(pg: PGlite, enquiryId: string): Promise<EnquiryRow> {
  const rows = await pg.query<EnquiryRow>(
    "select decision_state, commercial_state, decision_snapshot from enquiry where id = $1",
    [enquiryId],
  );
  const row = rows.rows[0];
  if (!row) throw new Error(`Enquiry ${enquiryId} vanished mid-benchmark.`);
  return row;
}

/** Mirrors `answerEnquiryFact`/`setEnquiryService`'s own supersede-confirm-redecide SQL exactly (same reasoning `manual-enquiry-core.db.test.ts`'s own `confirmFact` gives: those are `createServerFn`s that need a real auth context this harness has no reason to fake). */
export async function confirmFact(
  pg: PGlite,
  businessId: string,
  enquiryId: string,
  field: string,
  value: string,
): Promise<void> {
  await pg.query(
    "update enquiry_fact set superseded = true, updated_at = now() where enquiry_id = $1 and lower(field) = lower($2) and superseded = false",
    [enquiryId, field],
  );
  await pg.query(
    `insert into enquiry_fact
      (enquiry_id, field, label, value, display_value, status, confidence, asserted_by, provenance, customer_specific)
     values ($1, $2, $2, $3, $3, 'confirmed', 'High', 'user', $4::jsonb, true)`,
    [enquiryId, field, value, JSON.stringify({ kind: "user", label: "Confirmed by the owner" })],
  );
  if (field === "service") {
    await pg.query("update enquiry set service_label = $1, updated_at = now() where id = $2", [
      value,
      enquiryId,
    ]);
  }
  const enqRows = await pg.query<{ service_label: string; customer_name: string }>(
    "select service_label, customer_name from enquiry where id = $1",
    [enquiryId],
  );
  const enq = enqRows.rows[0]!;
  const factRows = await pg.query<{ field: string; value: string; status: string }>(
    "select field, value, status from enquiry_fact where enquiry_id = $1 and superseded = false",
    [enquiryId],
  );
  const knowledgeRows = await pg.query<{ state: string; rule_payload: unknown }>(
    "select state, rule_payload from knowledge_item where business_id = $1 and rule_payload is not null",
    [businessId],
  );
  const decision = decideEnquiry(
    { knowledge: knowledgeRows.rows.map((k) => ({ state: k.state, rulePayload: k.rule_payload })) },
    { serviceLabel: enq.service_label, facts: factRows.rows as never },
  );
  const snapshot = snapshotFromDecision(decision, {
    customerName: enq.customer_name,
    serviceLabel: enq.service_label,
  });
  const state = stateFromDecision(decision);
  await pg.query(
    `update enquiry set decision_snapshot = $1::jsonb, decision_state = $2, commercial_state = $3,
       responsibility = $4, updated_at = now() where id = $5`,
    [
      JSON.stringify(snapshot),
      state.decisionState,
      state.commercialState,
      state.responsibility,
      enquiryId,
    ],
  );
}

export type FollowUpOutcome = { label: string; enquiry: EnquiryRow };

export type CaseRun =
  | {
      kind: "ran";
      pg: PGlite;
      businessId: string;
      enquiryId: string;
      messageId: string;
      interpretOutcome: InterpretOutcome;
      enquiryAfterInterpretation: EnquiryRow;
      facts: { field: string; status: string; asserted_by: string }[];
      auditSummaries: string[];
      outboundMessageCount: number;
      followUps: FollowUpOutcome[];
    }
  | { kind: "skipped"; reason: string };

/** Run one case end to end (seed -> insert -> interpret -> follow-ups) in one mode. */
export async function runCase(kase: BenchmarkCase, mode: RunMode): Promise<CaseRun> {
  const interpreter = interpreterFor(mode, kase);
  if (!interpreter) return { kind: "skipped", reason: "no key" };

  const pg = await freshDb();
  const sql = sqlFor(pg);
  const businessId = await seedBusiness(pg, kase.business);
  const { enquiryId, messageId } = await createEnquiry(
    sql,
    businessId,
    kase.operator,
    kase.rawMessage,
  );

  const captured = capture(interpreter);
  await interpretAndApply(sql, {
    enquiryId,
    businessId,
    messageId,
    rawMessage: kase.rawMessage,
    interpreter: captured.interpreter,
  });
  const interpretOutcome = captured.get();
  if (!interpretOutcome)
    throw new Error(`interpretAndApply never called the interpreter for ${kase.id}`);

  const enquiryAfterInterpretation = await readEnquiry(pg, enquiryId);
  const factRows = await pg.query<{ field: string; status: string; asserted_by: string }>(
    "select field, status, asserted_by from enquiry_fact where enquiry_id = $1 and superseded = false",
    [enquiryId],
  );
  const auditRows = await pg.query<{ summary: string }>(
    "select summary from audit_event where object_id = $1 order by at",
    [enquiryId],
  );
  const outboundRows = await pg.query(
    "select 1 from message where enquiry_id = $1 and direction = 'outbound'",
    [enquiryId],
  );

  const followUps: FollowUpOutcome[] = [];
  for (const step of kase.followUps) {
    await confirmFact(pg, businessId, enquiryId, step.field, step.value);
    followUps.push({ label: step.label, enquiry: await readEnquiry(pg, enquiryId) });
  }

  return {
    kind: "ran",
    pg,
    businessId,
    enquiryId,
    messageId,
    interpretOutcome,
    enquiryAfterInterpretation,
    facts: factRows.rows,
    auditSummaries: auditRows.rows.map((r) => r.summary),
    outboundMessageCount: outboundRows.rows.length,
    followUps,
  };
}
