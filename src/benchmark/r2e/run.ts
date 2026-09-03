import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BENCHMARK_CASES } from "./cases.ts";
import { runCase, toVariantCase } from "./db.ts";
import type { RunMode } from "./db.ts";
import { evaluateCase } from "./evaluate.ts";
import type { CaseEvaluation } from "./evaluate.ts";
import type { BenchmarkCase } from "./types.ts";

/**
 * The R2E non-fixture benchmark, runnable with one command
 * (`npm run benchmark:r2e`).
 *
 * Three modes, each a full pass over every case against a fresh PGLite
 * database and the REAL deterministic pipeline
 * (`insertManualEnquiry` -> `interpretAndApply` -> `decideEnquiry` ->
 * `composeReply`):
 *
 *   - null: no interpreter configured - today's behaviour, unchanged.
 *   - fake: a deterministic test double replays each case's own declared
 *     reading (or declared failure) - zero network calls, zero spend, runs
 *     every time.
 *   - real: the actual configured Anthropic adapter, only when
 *     `ANTHROPIC_API_KEY` is set. Not set in this environment, so this mode
 *     reports "skipped: no key" below - the code path is exercised nowhere
 *     near this run, and no key is ever read into a log or a report.
 *
 * Four dimensions, scored separately, one table each - phase doc section 12
 * is explicit that these must never collapse into one percentage.
 */

const DIMENSIONS = ["interpretation", "business", "trust", "draft", "followUps"] as const;
type Dimension = (typeof DIMENSIONS)[number];

const DIMENSION_TITLE: Record<Dimension, string> = {
  interpretation: "Interpretation",
  business: "Business correctness",
  trust: "Trust / safety",
  draft: "Draft",
  followUps: "Follow-ups (confirm / change a fact)",
};

const MODES: RunMode[] = ["null", "fake", "real"];
const MODE_TITLE: Record<RunMode, string> = {
  null: "Mode 1 - null interpreter (no provider)",
  fake: "Mode 2 - fake transport (replays each case's declared reading or failure)",
  real: "Mode 3 - real Anthropic adapter (only when ANTHROPIC_API_KEY is set)",
};

type CellResult = { pass: boolean; notes: string[] } | { skipped: true };

async function runAllCasesInMode(
  mode: RunMode,
  allCases: BenchmarkCase[],
): Promise<{ ranAtAll: boolean; perCase: Map<string, CaseEvaluation | { skipped: true }> }> {
  const perCase = new Map<string, CaseEvaluation | { skipped: true }>();
  let ranAtAll = false;
  for (const kase of allCases) {
    const run = await runCase(kase, mode);
    if (run.kind === "skipped") {
      perCase.set(kase.id, { skipped: true });
      continue;
    }
    ranAtAll = true;
    const evaluation = evaluateCase(mode, kase, run);
    if (evaluation) perCase.set(kase.id, evaluation);
  }
  return { ranAtAll, perCase };
}

function cell(
  dimension: Dimension,
  result: CaseEvaluation | { skipped: true } | undefined,
): CellResult {
  if (!result) return { skipped: true };
  if ("skipped" in result) return { skipped: true };
  return result[dimension];
}

function fmtCell(c: CellResult): string {
  if ("skipped" in c) return "skipped";
  return c.pass ? "PASS" : `FAIL - ${c.notes.join("; ")}`;
}

function buildTable(
  dimension: Dimension,
  allCases: BenchmarkCase[],
  results: Record<
    RunMode,
    { ranAtAll: boolean; perCase: Map<string, CaseEvaluation | { skipped: true }> }
  >,
): string {
  const rows = allCases.map((kase) => {
    const cells = MODES.map((mode) => fmtCell(cell(dimension, results[mode].perCase.get(kase.id))));
    return `| ${kase.id} | ${kase.category} | ${kase.categoryLabel} | ${kase.phenotype} | ${cells.join(" | ")} |`;
  });
  return [
    `### ${DIMENSION_TITLE[dimension]}`,
    "",
    "| case | # | category | phenotype | null | fake | real |",
    "|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

function countPass(
  dimension: Dimension,
  mode: RunMode,
  allCases: BenchmarkCase[],
  results: Record<
    RunMode,
    { ranAtAll: boolean; perCase: Map<string, CaseEvaluation | { skipped: true }> }
  >,
): string {
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  for (const kase of allCases) {
    const c = cell(dimension, results[mode].perCase.get(kase.id));
    if ("skipped" in c) skipped += 1;
    else if (c.pass) pass += 1;
    else fail += 1;
  }
  return `${pass} pass / ${fail} fail / ${skipped} skipped`;
}

async function main(): Promise<void> {
  const allCases: BenchmarkCase[] = [];
  for (const kase of BENCHMARK_CASES) {
    allCases.push(kase);
    const variant = toVariantCase(kase);
    if (variant) allCases.push(variant);
  }

  console.log(
    `[benchmark:r2e] ${BENCHMARK_CASES.length} declared cases, ${allCases.length} runs (including the case 9 Business Brain variant)`,
  );

  const results: Record<
    RunMode,
    { ranAtAll: boolean; perCase: Map<string, CaseEvaluation | { skipped: true }> }
  > = {
    null: { ranAtAll: false, perCase: new Map() },
    fake: { ranAtAll: false, perCase: new Map() },
    real: { ranAtAll: false, perCase: new Map() },
  };

  for (const mode of MODES) {
    console.log(`[benchmark:r2e] running ${MODE_TITLE[mode]} ...`);
    results[mode] = await runAllCasesInMode(mode, allCases);
    console.log(
      results[mode].ranAtAll
        ? `[benchmark:r2e]   ran ${allCases.length} cases`
        : `[benchmark:r2e]   SKIPPED (no ANTHROPIC_API_KEY configured)`,
    );
  }

  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const modeHeaderLines = MODES.map((mode) => {
    if (mode === "real" && !hasKey)
      return `- **${MODE_TITLE[mode]}**: SKIPPED - no ANTHROPIC_API_KEY set in this environment.`;
    const ran = results[mode].ranAtAll;
    return `- **${MODE_TITLE[mode]}**: ${ran ? "RAN" : "SKIPPED"} - ${allCases.length} case runs.`;
  });

  const dimensionSummary = DIMENSIONS.filter((d) => d !== "followUps").map((d) => {
    const parts = MODES.map((m) => `${m}: ${countPass(d, m, allCases, results)}`);
    return `- **${DIMENSION_TITLE[d]}**: ${parts.join(" | ")}`;
  });

  const categoryList = BENCHMARK_CASES.map(
    (k) => `${k.category}. ${k.categoryLabel} - \`${k.id}\` (${k.phenotype})`,
  ).join("\n");

  const tables = DIMENSIONS.map((d) => buildTable(d, allCases, results)).join("\n\n");

  const date = new Date().toISOString().slice(0, 10);
  const report = [
    `# R2E non-fixture benchmark - ${date}`,
    "",
    "One command: `npm run benchmark:r2e`. Every case runs the real deterministic pipeline (`insertManualEnquiry` -> `interpretAndApply` -> `decideEnquiry` -> `composeReply`) against a fresh PGLite database. Only the interpreter is swapped between three modes. Four dimensions, scored separately per phase-doc section 12 - never collapsed into one percentage.",
    "",
    "## Modes",
    "",
    ...modeHeaderLines,
    "",
    "## Summary (pass / fail / skipped, across all case runs)",
    "",
    ...dimensionSummary,
    "",
    "## The 15 categories (phase doc section 11)",
    "",
    categoryList,
    "",
    "Case 9 additionally runs a second Business Brain against the identical message (`case-09-different-brain-variant-b`), for 16 total case runs.",
    "",
    "## Results, one table per dimension",
    "",
    tables,
    "",
    "## Notes",
    "",
    "- `null` and `fake` modes never make a network call and never require a key; they run in this repository today.",
    "- `real` mode uses `createInterpreter()` (the actual server-selected adapter) for every case except the provider-failure case, which injects a throwing transport into the real adapter so its own error classification is verified deterministically rather than gambling on the live API happening to fail - no spend for that case regardless of whether a key is present.",
    "- Business-correctness and trust/safety are structurally mode-invariant for most cases: a model-sourced fact can never reach `status: confirmed` (`manual-enquiry-core.ts`), so the deterministic price/decision layer produces the same safe outcome whether the interpreter succeeds, fails, or is absent. Two cases (`case-06-ambiguous-service`, `case-14-malformed-message`) genuinely diverge in `null` mode because the operator left the service blank and only a successful reading fills it in - both declare a `nullModeBusiness` override so the report reflects the real, different, still-safe outcome instead of a false mismatch.",
    '- `case-11-conflicting-rule` demonstrates the mechanism that exists today for a conflicting rule (marking it "Needs review" removes it from `activeRules()` entirely, so nothing stale is ever used silently). It does not exercise two simultaneously-Active rules for the same service - `selectRule` has no conflict-detection logic and would silently pick the first array match without escalating. That is a real gap against the phase doc\'s intent, not a passing case, and is not claimed as handled.',
    "",
  ].join("\n");

  const outDir = join(process.cwd(), "docs", "benchmarks");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `r2e-${date}.md`);
  writeFileSync(outPath, report, "utf8");
  console.log(`[benchmark:r2e] wrote ${outPath}`);
}

main().catch((err) => {
  console.error("[benchmark:r2e] failed:", err);
  process.exitCode = 1;
});
