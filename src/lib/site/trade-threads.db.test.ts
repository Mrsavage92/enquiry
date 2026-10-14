import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { createWorkspaceInTransaction } from "../repo/provision-core.ts";
import { insertManualEnquiry } from "../repo/manual-enquiry-core.ts";
import { confirmCoverageForUser } from "../repo/coverage-core.ts";
import { toEnquiry, toFact, type EnquiryRow, type FactRow } from "../repo/rows.ts";
import { answer, freshDb, row, sqlFor, tell, tx, type Snap } from "../repo/pass8-db-helpers.ts";
import { promiseVerdict } from "../../domain/labels.ts";
import {
  TRADE_INPUTS,
  TRADE_THREADS_NOW,
  type TradeInput,
  type TradeThreadOutput,
} from "./trade-threads.ts";

/**
 * The "Built for your trade" examples on the home page, regenerated from the
 * real engine. Each input is pasted in the way an owner does it, against a
 * fresh database with every migration, and the owner's next steps are taken
 * one at a time until nothing is left for them: a reading they confirm, a
 * question they answer from their own rule, the check that the price covers
 * everything. The verdict is read the way the desk reads the row.
 *
 * Fails when the shipped text in trade-threads.data.ts drifts from what the
 * engine produces. To accept a deliberate engine change, run:
 *
 *   UPDATE_TRADE_THREADS=1 node --experimental-strip-types \
 *     --import ./scripts/test-resolve-hook.mjs --test src/lib/site/trade-threads.db.test.ts
 *
 * then review the diff before committing it.
 */

const DATA_FILE = new URL("./trade-threads.data.ts", import.meta.url);
const NOW = new Date(TRADE_THREADS_NOW);
const MAX_OWNER_STEPS = 6;

async function verdictOf(pg: PGlite, enquiryId: string) {
  const e = await pg.query<EnquiryRow>("select * from enquiry where id = $1", [enquiryId]);
  const f = await pg.query<FactRow>(
    "select * from enquiry_fact where enquiry_id = $1 and superseded = false",
    [enquiryId],
  );
  const enquiry = toEnquiry(e.rows[0]!, {
    facts: f.rows.map(toFact),
    conversation: [],
    quotes: [],
  });
  return promiseVerdict(enquiry);
}

/** One owner step, or false when nothing is left for them to do. */
async function ownerStep(pg: PGlite, enquiryId: string): Promise<boolean> {
  const current = await row(pg, enquiryId);
  const s = current.decision_snapshot;
  if (s.questionPending) {
    // Answered from the owner's own saved rule when it has one ("We don't do ...").
    await answer(
      pg,
      "user-a",
      enquiryId,
      s.questionPending.field,
      s.questionPending.readAs ?? "yes",
    );
    return true;
  }
  const reading = s.missing.find((m) => m.inferred);
  if (reading) {
    await answer(pg, "user-a", enquiryId, reading.factField, reading.inferred!.value);
    return true;
  }
  if (s.coverage && !s.coverage.confirmed) {
    const res = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
      enquiryId,
      key: s.coverage.key,
      revision: Number(current.decision_revision),
    });
    assert.equal(res.ok, true, JSON.stringify(res));
    return true;
  }
  return false;
}

async function run(
  t: { after: (fn: () => Promise<void>) => void },
  input: TradeInput,
): Promise<TradeThreadOutput> {
  const pg = await freshDb(t);
  await pg.query("insert into app_user (id, email) values ($1, $2)", ["user-a", "user-a@test"]);
  const { businessId } = await tx(pg, (sql) =>
    createWorkspaceInTransaction(sql, {
      ownerFirstName: input.ownerFirstName,
      industry: input.industry,
      baseLocation: "Brisbane",
      timezone: "Australia/Brisbane",
      soloOrTeam: "solo",
      currency: "AUD",
      name: `Sample ${input.tab.toLowerCase()} business`,
      userId: "user-a",
    }),
  );
  await tell(pg, businessId, input.ownerLines.join("\n"));
  const { enquiryId } = await tx(pg, (sql) =>
    insertManualEnquiry(sql, {
      businessId,
      body: input.message,
      customerName: input.customerName,
      customerEmail: "",
      customerPhone: "",
      serviceLabel: input.serviceLabel,
      intakeNote: "",
      now: NOW,
    }),
  );

  const ownerSteps: string[] = [];
  let ownRule: string | undefined;
  for (let i = 0; i < MAX_OWNER_STEPS; i += 1) {
    const s = (await row(pg, enquiryId)).decision_snapshot;
    const label = s.recommendation.label;
    ownRule ??= s.questionPending?.said;
    if (!(await ownerStep(pg, enquiryId))) break;
    ownerSteps.push(label);
  }

  const final = (await row(pg, enquiryId)).decision_snapshot as Snap & {
    recommendation: { reason?: string };
    missing: { reason?: string }[];
  };
  const verdict = await verdictOf(pg, enquiryId);
  const checked = final.missing[0]?.reason ?? ownRule ?? final.recommendation.reason ?? "";
  assert.ok(checked, `${input.id}: the decision names what it checked`);
  return { id: input.id, verdict, checked, ownerSteps, reply: final.draft.body };
}

function render(outputs: TradeThreadOutput[]): string {
  return [
    "// Generated by src/lib/site/trade-threads.db.test.ts from the real engine. Do not edit by hand.",
    'import type { TradeThreadOutput } from "./trade-threads";',
    "",
    `export const GENERATED_THREADS: readonly TradeThreadOutput[] = ${JSON.stringify(outputs, null, 2)};`,
    "",
  ].join("\n");
}

test("the trade examples on the home page are exactly what the engine produces", async (t) => {
  const outputs: TradeThreadOutput[] = [];
  for (const input of TRADE_INPUTS) outputs.push(await run(t, input));

  const expected = render(outputs);
  if (process.env.UPDATE_TRADE_THREADS === "1") writeFileSync(DATA_FILE, expected);

  // One of each answer, so the section shows all three.
  assert.deepEqual(outputs.map((o) => o.verdict.word).sort(), ["No", "Not yet", "Yes"]);
  for (const o of outputs) {
    assert.doesNotMatch(JSON.stringify(o), /\u2014/, `${o.id}: no em dash`);
    assert.doesNotMatch(o.reply, /\bEnquiry\b/, `${o.id}: the reply never names the product`);
  }
  const shipped = readFileSync(DATA_FILE, "utf8").replace(/\r\n/g, "\n");
  assert.equal(
    shipped,
    expected,
    "trade-threads.data.ts has drifted from the engine. Re-run with UPDATE_TRADE_THREADS=1 and review the diff.",
  );
});
