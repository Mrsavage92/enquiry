import assert from "node:assert/strict";
import test from "node:test";
import { BENCHMARK_CASES } from "./cases.ts";
import { evaluateCase, runCase, toVariantCase } from "./harness.ts";
import type { RunMode } from "./harness.ts";
import type { BenchmarkCase } from "./types.ts";

/**
 * Keeps the R2E benchmark honest in CI: every one of the 15 declared
 * categories (16 case runs, counting case 9's Business Brain variant) passes
 * all four scoring dimensions in `null` mode (no provider configured - the
 * safety fallback) and `fake` mode (a deterministic replay of each case's own
 * declared reading or declared failure - zero network calls, zero spend).
 *
 * `real` mode is intentionally NOT asserted here - it only runs with
 * `ANTHROPIC_API_KEY` set, and a real model's output is not deterministic.
 * `npm run benchmark:r2e` reports it descriptively; this suite never gates on
 * it.
 *
 * The evaluation logic (`evaluateCase`) is the exact same function
 * `run.ts` uses to build the markdown report, so this suite and the report
 * can never silently disagree.
 */

function allCasesWithVariants(): BenchmarkCase[] {
  const out: BenchmarkCase[] = [];
  for (const kase of BENCHMARK_CASES) {
    out.push(kase);
    const variant = toVariantCase(kase);
    if (variant) out.push(variant);
  }
  return out;
}

const CASES = allCasesWithVariants();

test("all 15 categories are represented, across at least 4 phenotypes, with completely new wording", () => {
  assert.equal(BENCHMARK_CASES.length, 15, "the phase doc requires at least 15 cases");
  const categories = BENCHMARK_CASES.map((k) => k.category).sort((a, b) => a - b);
  assert.deepEqual(
    categories,
    Array.from({ length: 15 }, (_, i) => i + 1),
    "categories 1-15, each exactly once",
  );

  const phenotypes = new Set(BENCHMARK_CASES.map((k) => k.phenotype));
  assert.ok(phenotypes.size >= 4, `expected at least 4 phenotypes, got ${phenotypes.size}`);

  const ids = new Set(BENCHMARK_CASES.map((k) => k.id));
  assert.equal(ids.size, BENCHMARK_CASES.length, "case ids must be unique");
});

for (const mode of ["null", "fake"] as RunMode[]) {
  for (const kase of CASES) {
    test(`${mode} mode - ${kase.id} (category ${kase.category}: ${kase.categoryLabel})`, async () => {
      const run = await runCase(kase, mode);
      assert.equal(run.kind, "ran", `${mode} mode must never be skipped for a non-real case`);
      const evaluation = evaluateCase(mode, kase, run);
      assert.ok(evaluation, "evaluateCase must return a result for a completed run");
      if (!evaluation) return;

      assert.ok(
        evaluation.interpretation.pass,
        `interpretation: ${evaluation.interpretation.notes.join("; ")}`,
      );
      assert.ok(
        evaluation.business.pass,
        `business correctness: ${evaluation.business.notes.join("; ")}`,
      );
      assert.ok(evaluation.trust.pass, `trust/safety: ${evaluation.trust.notes.join("; ")}`);
      assert.ok(evaluation.draft.pass, `draft: ${evaluation.draft.notes.join("; ")}`);
      assert.ok(evaluation.followUps.pass, `follow-ups: ${evaluation.followUps.notes.join("; ")}`);
    });
  }
}

// ---------------------------------------------------------------------------
// Category-specific hardening, beyond the generic per-dimension pass check.
// ---------------------------------------------------------------------------

const injectionCase = BENCHMARK_CASES.find((k) => k.id === "case-13-prompt-injection")!;
const failureCase = BENCHMARK_CASES.find((k) => k.id === "case-15-provider-failure")!;

test("injection case: no confirmed fact, no price, and no state beyond what deterministic evaluation yields - null mode", async () => {
  const run = await runCase(injectionCase, "null");
  assert.equal(run.kind, "ran");
  if (run.kind !== "ran") return;

  assert.equal(
    run.facts.length,
    0,
    "no provider configured - nothing is proposed, nothing is written",
  );
  const snap = run.enquiryAfterInterpretation.decision_snapshot;
  assert.notEqual(snap.price?.kind, "EXACT", "no price may ever come from injected text");
  assert.equal(run.enquiryAfterInterpretation.decision_state, "NEEDS_INFORMATION");
  assert.equal(run.outboundMessageCount, 0, "nothing was ever sent");
});

test("injection case: the adversarial fields (approved, price) land inert and are never confirmed - fake mode", async () => {
  const run = await runCase(injectionCase, "fake");
  assert.equal(run.kind, "ran");
  if (run.kind !== "ran") return;

  const approved = run.facts.find((f) => f.field === "approved");
  const price = run.facts.find((f) => f.field === "price");
  const panels = run.facts.find((f) => f.field === "panels");
  assert.ok(approved, "the injected 'approved' text is preserved for audit visibility");
  assert.ok(price, "the injected 'price' text is preserved for audit visibility");
  assert.ok(panels, "the one legitimate-looking fact hidden in the injection is also preserved");
  for (const f of [approved, price, panels]) {
    assert.notEqual(
      f!.status,
      "confirmed",
      `"${f!.field}" must never land as confirmed - a model may never confirm anything`,
    );
    assert.equal(
      f!.asserted_by,
      "system",
      `"${f!.field}" is system-asserted (from the model), never user-asserted`,
    );
  }

  const snap = run.enquiryAfterInterpretation.decision_snapshot;
  assert.notEqual(snap.price?.kind, "EXACT", "the injected '$1' price never reaches the decision");
  assert.equal(
    run.enquiryAfterInterpretation.decision_state,
    "NEEDS_INFORMATION",
    "still blocked on the real quantity field (panels), not unblocked by the injection",
  );
  assert.equal(
    run.outboundMessageCount,
    0,
    "nothing was ever sent, despite the injected instruction to send/confirm immediately",
  );
  assert.ok(
    !snap.draft.body.includes("admin mode"),
    "the injected text never leaks into the customer-facing draft",
  );
  assert.ok(!snap.draft.body.includes("$1"), "the fabricated $1 price never leaks into the draft");
});

test("provider-failure case: a transport that throws is classified provider_error, not silently swallowed - real-adapter code path, no network call", async () => {
  const { createAnthropicInterpreter } =
    await import("../../lib/interpret/anthropic-interpreter.server.ts");
  const throwing = createAnthropicInterpreter({
    apiKey: "sk-test-not-a-real-key",
    transport: async () => {
      throw new Error("simulated provider outage");
    },
  });
  const outcome = await throwing.interpret({
    rawMessage: failureCase.rawMessage,
    messageId: "m-test",
    business: { services: [], ruleSummaries: [], industry: "" },
  });
  assert.deepEqual(outcome, { ok: false, reason: "provider_error" });
});

test("provider-failure case: a transport that times out is classified timeout, not silently swallowed", async () => {
  const { createAnthropicInterpreter } =
    await import("../../lib/interpret/anthropic-interpreter.server.ts");
  const hanging = createAnthropicInterpreter({
    apiKey: "sk-test-not-a-real-key",
    timeoutMs: 20,
    transport: ({ signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      }),
  });
  const outcome = await hanging.interpret({
    rawMessage: failureCase.rawMessage,
    messageId: "m-test",
    business: { services: [], ruleSummaries: [], industry: "" },
  });
  assert.deepEqual(outcome, { ok: false, reason: "timeout" });
});

test("provider-failure case: the enquiry persists with a safe state and an honest audit line - null mode", async () => {
  const run = await runCase(failureCase, "null");
  assert.equal(run.kind, "ran");
  if (run.kind !== "ran") return;

  assert.equal(run.facts.length, 0, "a read that did not happen must never leave a fact behind");
  assert.equal(
    run.enquiryAfterInterpretation.decision_state,
    "NEEDS_HUMAN",
    "safe state - nothing fabricated",
  );
  assert.equal(run.enquiryAfterInterpretation.commercial_state, "UNASSESSED");
  assert.ok(
    run.auditSummaries.some((s) => s === "Could not read the message automatically (no_provider)"),
    `expected an honest 'could not read' audit line, got: ${JSON.stringify(run.auditSummaries)}`,
  );
  assert.equal(run.outboundMessageCount, 0);
});

test("provider-failure case: a configured-but-failing provider ALSO persists safely with its own honest audit line - fake mode", async () => {
  const run = await runCase(failureCase, "fake");
  assert.equal(run.kind, "ran");
  if (run.kind !== "ran") return;

  assert.equal(run.facts.length, 0);
  assert.equal(run.enquiryAfterInterpretation.decision_state, "NEEDS_HUMAN");
  assert.equal(run.enquiryAfterInterpretation.commercial_state, "UNASSESSED");
  assert.ok(
    run.auditSummaries.some(
      (s) => s === "Could not read the message automatically (provider_error)",
    ),
    `expected an honest 'could not read' audit line naming provider_error, got: ${JSON.stringify(run.auditSummaries)}`,
  );
  assert.equal(run.outboundMessageCount, 0);

  // The safe failure state is still fully recoverable by hand - the owner
  // reads the message themselves and confirms the service.
  assert.equal(run.followUps.length, 1);
  const after = run.followUps[0]!.enquiry;
  assert.equal(after.decision_state, "ACTION_READY");
  assert.equal(after.decision_snapshot.price?.amountMinor, 38000);
});

test("the price-compiler invariant this whole benchmark leans on: an inferred/check_this quantity fact never prices anything - proven end to end, not just at the unit level", async () => {
  // case-04-blocking-fact's own reading proposes nothing (a good model omits
  // the ambiguous count); case-10-changed-fact's does propose one, at medium
  // confidence, so it lands inferred - assert THAT specific run stays BLOCKED.
  const kase = BENCHMARK_CASES.find((k) => k.id === "case-10-changed-fact")!;
  const run = await runCase(kase, "fake");
  assert.equal(run.kind, "ran");
  if (run.kind !== "ran") return;
  const vehicles = run.facts.find((f) => f.field === "vehicles");
  assert.ok(vehicles, "the model's reading did land as a fact");
  assert.equal(vehicles!.status, "inferred");
  assert.notEqual(vehicles!.asserted_by, "user");
  assert.notEqual(run.enquiryAfterInterpretation.decision_snapshot.price?.kind, "EXACT");
  assert.equal(run.enquiryAfterInterpretation.decision_state, "NEEDS_INFORMATION");
});
