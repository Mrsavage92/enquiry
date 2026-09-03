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
import type {
  BenchmarkCase,
  BusinessSetup,
  ExpectedBusiness,
  FollowUpStep,
  OperatorInput,
} from "./types.ts";

/**
 * Everything the benchmark needs against a real database, built the same way
 * `manual-enquiry-core.db.test.ts` does: raw PGLite, every migration applied
 * directly, the core functions called directly (not the `createServerFn`
 * routes, which need a real auth context this harness has no reason to fake).
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

// ---------------------------------------------------------------------------
// Evaluation: four dimensions, scored separately, never collapsed.
// ---------------------------------------------------------------------------

export type DimensionResult = { pass: boolean; notes: string[] };
export type CaseEvaluation = {
  interpretation: DimensionResult;
  business: DimensionResult;
  trust: DimensionResult;
  draft: DimensionResult;
  followUps: DimensionResult;
};

function checkBusiness(actual: EnquiryRow, expected: ExpectedBusiness): DimensionResult {
  const notes: string[] = [];
  let pass = true;
  const snap = actual.decision_snapshot;
  const actualPriceKind =
    snap.price?.kind === "EXACT"
      ? "EXACT"
      : actual.decision_state === "NEEDS_INFORMATION"
        ? "BLOCKED"
        : "NO_RULE";

  if (actualPriceKind !== expected.priceKind) {
    pass = false;
    notes.push(`priceKind expected ${expected.priceKind}, got ${actualPriceKind}`);
  }
  if (snap.recommendation.action !== expected.action) {
    pass = false;
    notes.push(`action expected ${expected.action}, got ${snap.recommendation.action}`);
  }
  if (actual.decision_state !== expected.decisionState) {
    pass = false;
    notes.push(`decisionState expected ${expected.decisionState}, got ${actual.decision_state}`);
  }
  if (actual.commercial_state !== expected.commercialState) {
    pass = false;
    notes.push(
      `commercialState expected ${expected.commercialState}, got ${actual.commercial_state}`,
    );
  }
  if (expected.priceKind === "EXACT") {
    if (snap.price?.amountMinor !== expected.amountMinor) {
      pass = false;
      notes.push(`amountMinor expected ${expected.amountMinor}, got ${snap.price?.amountMinor}`);
    }
  }
  if (expected.priceKind === "BLOCKED" && expected.blockerField) {
    if (!snap.explanation.includes(expected.blockerField)) {
      pass = false;
      notes.push(
        `explanation did not name blocker field "${expected.blockerField}": ${snap.explanation}`,
      );
    }
  }
  if (expected.explanationIncludes && !snap.explanation.includes(expected.explanationIncludes)) {
    pass = false;
    notes.push(`explanation missing "${expected.explanationIncludes}": ${snap.explanation}`);
  }
  if (pass) notes.push(`${actualPriceKind} / ${snap.recommendation.action} - as expected`);
  return { pass, notes };
}

function checkTrust(
  run: Extract<CaseRun, { kind: "ran" }>,
  expected: { neverConfirmedFields: string[]; primaryEnabled: boolean },
): DimensionResult {
  const notes: string[] = [];
  let pass = true;
  for (const field of expected.neverConfirmedFields) {
    const row = run.facts.find((f) => f.field.toLowerCase() === field.toLowerCase());
    if (row && row.status === "confirmed") {
      pass = false;
      notes.push(`"${field}" landed as confirmed - a model must never supply that`);
    }
  }
  const actualPrimary =
    run.enquiryAfterInterpretation.decision_snapshot.recommendation.primaryEnabled;
  if (actualPrimary !== expected.primaryEnabled) {
    pass = false;
    notes.push(`primaryEnabled expected ${expected.primaryEnabled}, got ${actualPrimary}`);
  }
  if (run.outboundMessageCount !== 0) {
    pass = false;
    notes.push(
      `${run.outboundMessageCount} outbound message(s) exist - nothing should ever auto-send`,
    );
  }
  if (pass) notes.push("no field the model proposed was ever confirmed; nothing auto-sent");
  return { pass, notes };
}

function checkDraft(
  body: string,
  expected: { mustContain: string[]; mustNotContain: string[] },
): DimensionResult {
  const notes: string[] = [];
  let pass = true;
  for (const s of expected.mustContain) {
    if (!body.includes(s)) {
      pass = false;
      notes.push(`draft missing required "${s}"`);
    }
  }
  for (const s of expected.mustNotContain) {
    if (body.includes(s)) {
      pass = false;
      notes.push(`draft contains forbidden "${s}"`);
    }
  }
  if (pass) notes.push("grounded in the decision - nothing invented, nothing leaked");
  return { pass, notes };
}

function checkInterpretation(
  mode: RunMode,
  kase: BenchmarkCase,
  outcome: InterpretOutcome,
): DimensionResult {
  const notes: string[] = [];

  if (mode === "null") {
    const pass = outcome.ok === false && outcome.reason === "no_provider";
    notes.push(
      pass
        ? "no provider configured - correctly proposed nothing rather than guessing"
        : `expected {ok:false, reason:"no_provider"}, got ${JSON.stringify(outcome)}`,
    );
    return { pass, notes };
  }

  if (kase.simulatedFailureReason) {
    const pass = outcome.ok === false && outcome.reason === kase.simulatedFailureReason;
    notes.push(
      pass
        ? `failure correctly classified as "${kase.simulatedFailureReason}"`
        : `expected {ok:false, reason:"${kase.simulatedFailureReason}"}, got ${JSON.stringify(outcome)}`,
    );
    return { pass, notes };
  }

  if (mode === "real") {
    // Real model output is non-deterministic - report, do not hard-score.
    notes.push(
      outcome.ok
        ? `real model (${outcome.model}) returned a schema-valid reading`
        : `real model failed: ${outcome.reason}`,
    );
    return { pass: true, notes };
  }

  // mode === "fake", a normal (non-failure) case: the fake transport replays
  // the case's own declared reading verbatim, so this also proves the schema
  // round-trips exactly as declared.
  const exp = kase.expected.interpretation;
  let pass = outcome.ok === true;
  if (!outcome.ok) {
    notes.push(`expected a successful reading, got failure: ${outcome.reason}`);
    return { pass: false, notes };
  }
  const hasCandidate = outcome.result.serviceCandidate !== null;
  if (hasCandidate !== exp.expectServiceCandidate) {
    pass = false;
    notes.push(`expectServiceCandidate ${exp.expectServiceCandidate}, got ${hasCandidate}`);
  }
  const gotFields = outcome.result.facts.map((f) => f.field).sort();
  const wantFields = [...exp.expectFactFields].sort();
  if (JSON.stringify(gotFields) !== JSON.stringify(wantFields)) {
    pass = false;
    notes.push(`fact fields expected [${wantFields.join(", ")}], got [${gotFields.join(", ")}]`);
  }
  const hasAmbiguity = outcome.result.ambiguities.length > 0;
  if (hasAmbiguity !== exp.expectAmbiguity) {
    pass = false;
    notes.push(`expectAmbiguity ${exp.expectAmbiguity}, got ${hasAmbiguity}`);
  }
  const hasMissing = outcome.result.candidateMissingFacts.length > 0;
  if (hasMissing !== exp.expectCandidateMissingFacts) {
    pass = false;
    notes.push(`expectCandidateMissingFacts ${exp.expectCandidateMissingFacts}, got ${hasMissing}`);
  }
  if (pass) notes.push(exp.note);
  return { pass, notes };
}

function checkFollowUps(
  kase: BenchmarkCase,
  run: Extract<CaseRun, { kind: "ran" }>,
): DimensionResult {
  const notes: string[] = [];
  let pass = true;
  for (let i = 0; i < kase.followUps.length; i += 1) {
    const step = kase.followUps[i]!;
    const outcome = run.followUps[i];
    if (!outcome) {
      pass = false;
      notes.push(`follow-up "${step.label}" never ran`);
      continue;
    }
    const result = checkBusiness(outcome.enquiry, step.expectedAfter);
    if (!result.pass) {
      pass = false;
      notes.push(`follow-up "${step.label}": ${result.notes.join("; ")}`);
    } else {
      notes.push(`follow-up "${step.label}": ${result.notes.join("; ")}`);
    }
  }
  if (kase.followUps.length === 0) notes.push("no follow-up declared for this case");
  return { pass, notes };
}

/** Evaluate one finished run against its case, per dimension. Never collapsed into one score. */
export function evaluateCase(
  mode: RunMode,
  kase: BenchmarkCase,
  run: CaseRun,
): CaseEvaluation | null {
  if (run.kind === "skipped") return null;

  const businessExpected =
    mode === "null" && kase.nullModeBusiness ? kase.nullModeBusiness : kase.expected.business;
  const trustExpected =
    mode === "null" && kase.nullModeBusiness
      ? {
          neverConfirmedFields: kase.expected.trust.neverConfirmedFields,
          primaryEnabled: businessExpected.action !== "ESCALATE_HUMAN",
        }
      : kase.expected.trust;
  const draftExpected =
    mode === "null" && kase.nullModeBusiness
      ? { mustContain: [] as string[], mustNotContain: ["$"] }
      : kase.expected.draft;

  return {
    interpretation: checkInterpretation(mode, kase, run.interpretOutcome),
    business: checkBusiness(run.enquiryAfterInterpretation, businessExpected),
    trust: checkTrust(run, trustExpected),
    draft: checkDraft(run.enquiryAfterInterpretation.decision_snapshot.draft.body, draftExpected),
    followUps: checkFollowUps(kase, run),
  };
}

export type { FollowUpStep };
