import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { saveBusinessRuleInTransaction } from "./business-rule-core.ts";
import { activeRules, decideEnquiry } from "../../domain/decide.ts";
import type { BusinessRule } from "../../domain/business-rule.ts";

/**
 * CC1-02 / S05 - saving a price must not leave two live prices behind.
 *
 * Real database path, because the defect is a database state (two rows both
 * `state = 'Active'` for one service) that only shows itself at quote time.
 * A domain-level assertion about `matchRule` cannot prove the rows.
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

async function seedBusiness(pg: PGlite): Promise<string> {
  const rows = await pg.query<{ id: string }>(
    `insert into business (name, industry, owner_first_name) values ($1,$2,$3) returning id`,
    ["Glow Test", "beauty", "Sam"],
  );
  return rows.rows[0]!.id;
}

async function liveRules(pg: PGlite, businessId: string): Promise<BusinessRule[]> {
  const rows = await pg.query<{ state: string; rule_payload: unknown }>(
    `select state, rule_payload from knowledge_item
     where business_id = $1 and rule_payload is not null`,
    [businessId],
  );
  return activeRules({
    knowledge: rows.rows.map((r) => ({ state: r.state, rulePayload: r.rule_payload })),
  });
}

const bridal190: BusinessRule = {
  kind: "fixed_price",
  service: "Bridal makeup",
  amount: 190,
  currency: "AUD",
};
const bridal240: BusinessRule = { ...bridal190, amount: 240 };

test("S05: correcting a price supersedes the old one - exactly one Active rule survives", async () => {
  const pg = await freshDb();
  const businessId = await seedBusiness(pg);
  const sql = sqlFor(pg);

  const first = await saveBusinessRuleInTransaction(sql, {
    businessId,
    rule: bridal190,
    readable: "Bridal makeup: $190",
  });
  assert.equal(first.outcome, "created");

  const second = await saveBusinessRuleInTransaction(sql, {
    businessId,
    rule: bridal240,
    readable: "Bridal makeup: $240",
  });
  assert.equal(second.outcome, "superseded");
  assert.deepEqual(second.supersededIds, [first.id]);

  const rules = await liveRules(pg, businessId);
  assert.equal(rules.length, 1, "two Active prices for one service is the defect");
  assert.equal(rules[0]!.amount, 240);
});

test("S05: the superseded price stays on file with the date it stopped applying", async () => {
  const pg = await freshDb();
  const businessId = await seedBusiness(pg);
  const sql = sqlFor(pg);

  const first = await saveBusinessRuleInTransaction(sql, {
    businessId,
    rule: bridal190,
    readable: "Bridal makeup: $190",
  });
  await saveBusinessRuleInTransaction(sql, {
    businessId,
    rule: bridal240,
    readable: "Bridal makeup: $240",
  });

  const rows = await pg.query<{ state: string; effective_to: string | null; body: string }>(
    `select state, effective_to, body from knowledge_item where id = $1`,
    [first.id],
  );
  const old = rows.rows[0]!;
  assert.equal(old.state, "Superseded", "pricing history must not be discarded");
  assert.ok(old.effective_to, "a retired price records when it stopped applying");
  assert.equal(old.body, "Bridal makeup: $190");
});

test("S05: an identical duplicate save changes nothing and creates no new version", async () => {
  const pg = await freshDb();
  const businessId = await seedBusiness(pg);
  const sql = sqlFor(pg);

  const first = await saveBusinessRuleInTransaction(sql, {
    businessId,
    rule: bridal190,
    readable: "Bridal makeup: $190",
  });
  const again = await saveBusinessRuleInTransaction(sql, {
    businessId,
    rule: { ...bridal190 },
    readable: "Bridal makeup: $190",
  });

  assert.equal(again.outcome, "duplicate");
  assert.equal(again.id, first.id);
  const all = await pg.query<{ n: number }>(
    `select count(*)::int as n from knowledge_item where business_id = $1 and rule_payload is not null`,
    [businessId],
  );
  assert.equal(all.rows[0]!.n, 1, "saving the same price twice must not grow the history");
});

test("S05: a different service is added alongside, not superseded", async () => {
  const pg = await freshDb();
  const businessId = await seedBusiness(pg);
  const sql = sqlFor(pg);

  await saveBusinessRuleInTransaction(sql, {
    businessId,
    rule: bridal190,
    readable: "Bridal makeup: $190",
  });
  const other = await saveBusinessRuleInTransaction(sql, {
    businessId,
    rule: { kind: "fixed_price", service: "Bridal trial", amount: 90, currency: "AUD" },
    readable: "Bridal trial: $90",
  });

  assert.equal(other.outcome, "created");
  assert.deepEqual(other.supersededIds, []);
  const rules = await liveRules(pg, businessId);
  assert.equal(rules.length, 2);
});

test("S03/S05: a legacy pair of competing Active prices is a conflict at quote time, never a coin toss", async () => {
  // Rows written before supersession existed - the state the fix cannot undo
  // retroactively, and must therefore refuse to price rather than pick one.
  const pg = await freshDb();
  const businessId = await seedBusiness(pg);
  for (const [amount, version] of [
    [190, "1"],
    [240, "2"],
  ] as const) {
    await pg.query(
      `insert into knowledge_item
         (business_id, section, title, body, class, state, version, rule_payload)
       values ($1,'pricing','Bridal makeup',$2,'authoritative','Active',$3,$4::jsonb)`,
      [
        businessId,
        `Bridal makeup: $${amount}`,
        version,
        JSON.stringify({ ...bridal190, amount }),
      ],
    );
  }

  const rules = await liveRules(pg, businessId);
  assert.equal(rules.length, 2, "the legacy state under test is two live prices");

  const decision = decideEnquiry(
    {
      knowledge: rules.map((rulePayload) => ({ state: "Active", rulePayload })),
    },
    { serviceLabel: "Bridal makeup", facts: [] },
  );
  assert.equal(decision.price.kind, "AMBIGUOUS_SERVICE");
  assert.notEqual(decision.action, "SEND_QUOTE");

  // And reversing the row order gives the same answer.
  const reversed = decideEnquiry(
    { knowledge: [...rules].reverse().map((rulePayload) => ({ state: "Active", rulePayload })) },
    { serviceLabel: "Bridal makeup", facts: [] },
  );
  assert.deepEqual(reversed, decision);
});
