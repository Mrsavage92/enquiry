import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { applyDecision, isClosed, lockEnquiry } from "./decision-apply.ts";
import { insertManualEnquiry, interpretAndApply } from "./manual-enquiry-core.ts";
import type { EnquiryInterpreter } from "../interpret/types.ts";

/**
 * CC1-06 / P2-01 - a fact change and the decision it implies are one operation.
 *
 * `answerEnquiryFact` and `setEnquiryService` used to write the fact inside a
 * transaction and then recompute the decision outside it, so a failure between
 * the two left new facts sitting under an old decision - the desk asking for a
 * guest count that had already been answered. These tests exercise the same
 * composition the handlers now use: lock, write, `applyDecision`, all in one
 * transaction.
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
  const sql = (async <R>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<R>(text, values);
  }) as never;
  return sql;
}

function sqlFor(pg: PGlite): Sql {
  return toSql(async <T>(text: string, params: unknown[]) => {
    const res = await pg.query<T>(text, params);
    return res.rows;
  });
}

async function inTransaction<T>(pg: PGlite, fn: (sql: Sql) => Promise<T>): Promise<T> {
  return pg.transaction(async (tx) =>
    fn(
      toSql(async <R>(text: string, params: unknown[]) => {
        const res = await tx.query<R>(text, params);
        return res.rows;
      }),
    ),
  ) as Promise<T>;
}

const GROUP_MAKEUP = {
  kind: "per_unit",
  service: "Group makeup",
  amount: 145,
  currency: "AUD",
  unit: "person",
  quantityField: "guests",
};

async function seedWorkspace(pg: PGlite) {
  const biz = await pg.query<{ id: string }>(
    "insert into business (name, industry, owner_first_name) values ($1,$2,$3) returning id",
    ["Glow & Co", "beauty", "Mina"],
  );
  const businessId = biz.rows[0]!.id;
  await pg.query(
    `insert into knowledge_item (business_id, section, title, body, class, state, source, version, rule_payload)
     values ($1,'pricing','Group makeup','seeded','authoritative','Active','{}'::jsonb,'1',$2::jsonb)`,
    [businessId, JSON.stringify(GROUP_MAKEUP)],
  );
  const { enquiryId } = await insertManualEnquiry(sqlFor(pg), {
    businessId,
    body: "makeup for the wedding party",
    customerName: "Sarah",
    customerEmail: "sarah@example.com",
    customerPhone: "",
    serviceLabel: "Group makeup",
    intakeNote: "",
  });
  return { businessId, enquiryId };
}

async function readEnquiry(pg: PGlite, enquiryId: string) {
  const rows = await pg.query<{
    decision_state: string;
    decision_revision: number;
    decision_snapshot: { recommendation: { action: string }; price?: { amountMinor: number } };
  }>(
    "select decision_state, decision_revision, decision_snapshot from enquiry where id = $1",
    [enquiryId],
  );
  return rows.rows[0]!;
}

/** Confirm a fact exactly as `answerEnquiryFact` does: one transaction. */
async function confirmFact(
  pg: PGlite,
  ids: { businessId: string; enquiryId: string },
  field: string,
  value: string,
  failAt?: string,
) {
  return inTransaction(pg, async (sql) => {
    const guarded = failAt
      ? ((async (strings: TemplateStringsArray, ...values: unknown[]) => {
          let text = strings[0] ?? "";
          for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
          if (text.includes(failAt)) throw new Error("injected failure");
          return (
            sql as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown[]>
          )(strings, ...values);
        }) as never as Sql)
      : sql;
    const locked = await lockEnquiry(guarded, ids.enquiryId);
    if (!locked) throw new Error("missing");
    await guarded`
      update enquiry_fact set superseded = true, updated_at = now()
      where enquiry_id = ${ids.enquiryId} and lower(field) = lower(${field})
        and superseded = false
    `;
    await guarded`
      insert into enquiry_fact
        (enquiry_id, field, label, value, display_value, status, confidence,
         asserted_by, provenance, customer_specific)
      values (
        ${ids.enquiryId}, ${field}, ${field}, ${value}, ${value},
        ${"confirmed"}, ${"High"}, ${"user"},
        ${JSON.stringify({ kind: "user" })}::jsonb, ${true}
      )
    `;
    return applyDecision(guarded, {
      enquiryId: ids.enquiryId,
      businessId: ids.businessId,
      serviceLabel: locked.serviceLabel,
      customerName: locked.customerName,
    });
  });
}

test("T01: confirming a fact and re-deciding land together - the decision follows the fact", async () => {
  const pg = await freshDb();
  const ids = await seedWorkspace(pg);
  const before = await readEnquiry(pg, ids.enquiryId);
  assert.equal(before.decision_state, "NEEDS_INFORMATION", "blocked on the guest count");

  const res = await confirmFact(pg, ids, "guests", "4");
  assert.equal(res.decision.action, "SEND_QUOTE");

  const after = await readEnquiry(pg, ids.enquiryId);
  assert.equal(after.decision_state, "ACTION_READY");
  assert.equal(after.decision_snapshot.price?.amountMinor, 58_000);
  assert.equal(after.decision_revision, before.decision_revision + 1);
});

test("T01: a failure before the snapshot write rolls the fact back too - never a new fact under an old decision", async () => {
  const pg = await freshDb();
  const ids = await seedWorkspace(pg);
  const before = await readEnquiry(pg, ids.enquiryId);

  await assert.rejects(confirmFact(pg, ids, "guests", "4", "set decision_snapshot"));

  const after = await readEnquiry(pg, ids.enquiryId);
  assert.equal(after.decision_state, before.decision_state);
  assert.equal(after.decision_revision, before.decision_revision, "no half-applied revision");

  const facts = await pg.query<{ value: string }>(
    "select value from enquiry_fact where enquiry_id = $1 and field = 'guests' and superseded = false",
    [ids.enquiryId],
  );
  assert.equal(facts.rows.length, 0, "the fact must not survive its own decision failing");
});

test("T01: every snapshot write bumps the revision exactly once", async () => {
  const pg = await freshDb();
  const ids = await seedWorkspace(pg);
  assert.equal((await readEnquiry(pg, ids.enquiryId)).decision_revision, 1);
  await confirmFact(pg, ids, "guests", "4");
  assert.equal((await readEnquiry(pg, ids.enquiryId)).decision_revision, 2);
  await confirmFact(pg, ids, "guests", "6");
  assert.equal((await readEnquiry(pg, ids.enquiryId)).decision_revision, 3);
});

test("T02: an interpreter result landing after an owner's confirm never overwrites it with a stale snapshot", async () => {
  const pg = await freshDb();
  const ids = await seedWorkspace(pg);
  const sql = sqlFor(pg);
  const messageRows = await pg.query<{ id: string }>(
    "select id from message where enquiry_id = $1",
    [ids.enquiryId],
  );

  // The owner confirms while the interpreter call is in flight.
  await confirmFact(pg, ids, "guests", "4");
  const afterConfirm = await readEnquiry(pg, ids.enquiryId);
  assert.equal(afterConfirm.decision_snapshot.recommendation.action, "SEND_QUOTE");

  // The model comes back proposing something else entirely.
  const late: EnquiryInterpreter = {
    async interpret() {
      return {
        ok: true,
        model: "fake-model-test",
        result: {
          serviceCandidate: null,
          facts: [
            {
              field: "guests",
              value: "12",
              displayValue: "12",
              confidence: "high",
              span: "twelve",
            },
          ],
          ambiguities: [],
          candidateMissingFacts: [],
        },
      };
    },
  };
  await interpretAndApply(sql, {
    enquiryId: ids.enquiryId,
    businessId: ids.businessId,
    messageId: messageRows.rows[0]!.id,
    rawMessage: "twelve of us",
    interpreter: late,
  });

  const after = await readEnquiry(pg, ids.enquiryId);
  assert.equal(
    after.decision_snapshot.price?.amountMinor,
    58_000,
    "the owner's confirmed four, not the model's twelve",
  );
  const live = await pg.query<{ value: string; asserted_by: string }>(
    "select value, asserted_by from enquiry_fact where enquiry_id = $1 and field = 'guests' and superseded = false",
    [ids.enquiryId],
  );
  assert.equal(live.rows.length, 1, "no duplicate live fact for the same field");
  assert.equal(live.rows[0]!.value, "4");
  assert.equal(live.rows[0]!.asserted_by, "user");
});

test("T05: an interpreter result landing after the enquiry is closed leaves it closed", async () => {
  const pg = await freshDb();
  const ids = await seedWorkspace(pg);
  const sql = sqlFor(pg);
  const messageRows = await pg.query<{ id: string }>(
    "select id from message where enquiry_id = $1",
    [ids.enquiryId],
  );
  const before = await readEnquiry(pg, ids.enquiryId);
  await pg.query(
    "update enquiry set lifecycle = 'DECLINED', decision_state = 'NONE' where id = $1",
    [ids.enquiryId],
  );

  const res = await interpretAndApply(sql, {
    enquiryId: ids.enquiryId,
    businessId: ids.businessId,
    messageId: messageRows.rows[0]!.id,
    rawMessage: "four of us",
    interpreter: {
      async interpret() {
        return {
          ok: true,
          model: "fake-model-test",
          result: {
            serviceCandidate: null,
            facts: [
              { field: "guests", value: "4", displayValue: "4", confidence: "high", span: "four" },
            ],
            ambiguities: [],
            candidateMissingFacts: [],
          },
        };
      },
    },
  });
  assert.equal(res.ok, true);

  const after = await pg.query<{ lifecycle: string; decision_state: string; decision_revision: number }>(
    "select lifecycle, decision_state, decision_revision from enquiry where id = $1",
    [ids.enquiryId],
  );
  assert.equal(after.rows[0]!.lifecycle, "DECLINED");
  assert.equal(after.rows[0]!.decision_state, "NONE", "a closed enquiry is not re-decided");
  assert.equal(after.rows[0]!.decision_revision, before.decision_revision);

  const audit = await pg.query<{ summary: string }>(
    "select summary from audit_event where object_id = $1 order by at desc limit 1",
    [ids.enquiryId],
  );
  assert.match(audit.rows[0]!.summary, /after the enquiry was closed/);
});

test("isClosed names every lifecycle a late write must not disturb", () => {
  assert.equal(isClosed("OPEN"), false);
  assert.equal(isClosed("DECLINED"), true);
  assert.equal(isClosed("LOST"), true);
  assert.equal(isClosed("BOOKED"), true);
});
