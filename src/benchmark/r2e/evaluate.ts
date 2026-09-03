import type { InterpretOutcome } from "../../lib/interpret/types.ts";
import type { BenchmarkCase, ExpectedBusiness } from "./types.ts";
import type { CaseRun, EnquiryRow, RunMode } from "./db.ts";

/**
 * Scoring: four dimensions, checked separately, never collapsed into one
 * score (phase doc section 12). Only reads the `CaseRun` shape `db.ts`
 * produces - no PGLite, no interpreter, imported here.
 */

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
    if (!result.pass) pass = false;
    notes.push(`follow-up "${step.label}": ${result.notes.join("; ")}`);
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
