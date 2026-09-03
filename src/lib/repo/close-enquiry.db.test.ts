import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { declineEnquiryInTransaction } from "./close-enquiry-core.ts";

/**
 * Real database-path tests for declining an enquiry.
 *
 * Following `sent-reply.db.test.ts`'s exact pattern: fresh `PGlite()`, every
 * migration applied directly, the core transaction function called directly
 * rather than through the `createServerFn`-wrapped route. The interesting
 * failures here - a retried close writing a second audit row, a decline that
 * leaves follow_up_due true - only a database proves.
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

function sqlFor(pg: PGlite) {
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

async function seedBusinessAndEnquiry(
  pg: PGlite,
  overrides: {
    lifecycle?: string;
    followUpDue?: boolean;
    atRisk?: boolean;
    commercialState?: string;
  } = {},
): Promise<{ businessId: string; enquiryId: string }> {
  const biz = await pg.query<{ id: string }>(
    "insert into business (name, industry, city, timezone, currency, solo_or_team, base_location, owner_name, owner_first_name) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
    [
      "Glow & Co",
      "beauty",
      "Brisbane",
      "Australia/Brisbane",
      "AUD",
      "solo",
      "New Farm",
      "Mina",
      "Mina",
    ],
  );
  const businessId = biz.rows[0]!.id;
  const enq = await pg.query<{ id: string }>(
    `insert into enquiry
       (business_id, customer_name, customer_email, source, service_label,
        lifecycle, decision_state, commercial_state, responsibility,
        follow_up_due, at_risk, snoozed_until)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning id`,
    [
      businessId,
      "Sarah",
      "sarah@example.com",
      "email",
      "Group makeup",
      overrides.lifecycle ?? "OPEN",
      "ACTION_READY",
      overrides.commercialState ?? "QUOTABLE",
      "BUSINESS",
      overrides.followUpDue ?? true,
      overrides.atRisk ?? true,
      new Date(Date.now() + 86_400_000).toISOString(),
    ],
  );
  return { businessId, enquiryId: enq.rows[0]!.id };
}

test("declining an open enquiry sets lifecycle DECLINED, decision NONE, responsibility NONE", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg);
  const res = await declineEnquiryInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
  });
  assert.equal(res.ok, true);
  assert.equal(res.alreadyDeclined, false);

  const row = await pg.query<{
    lifecycle: string;
    decision_state: string;
    responsibility: string;
  }>("select lifecycle, decision_state, responsibility from enquiry where id = $1", [enquiryId]);
  assert.equal(row.rows[0]!.lifecycle, "DECLINED");
  assert.equal(row.rows[0]!.decision_state, "NONE");
  assert.equal(row.rows[0]!.responsibility, "NONE");
});

test("declining clears follow_up_due, at_risk and snoozed_until", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    followUpDue: true,
    atRisk: true,
  });
  await declineEnquiryInTransaction(sqlFor(pg), { enquiryId, businessId, userId: "u1" });

  const row = await pg.query<{
    follow_up_due: boolean;
    at_risk: boolean;
    snoozed_until: string | null;
  }>("select follow_up_due, at_risk, snoozed_until from enquiry where id = $1", [enquiryId]);
  assert.equal(row.rows[0]!.follow_up_due, false);
  assert.equal(row.rows[0]!.at_risk, false);
  assert.equal(row.rows[0]!.snoozed_until, null);
});

test("declining leaves commercial_state untouched - it is a lifecycle change, not a commercial one", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, { commercialState: "QUOTED" });
  await declineEnquiryInTransaction(sqlFor(pg), { enquiryId, businessId, userId: "u1" });

  const row = await pg.query<{ commercial_state: string }>(
    "select commercial_state from enquiry where id = $1",
    [enquiryId],
  );
  assert.equal(row.rows[0]!.commercial_state, "QUOTED");
});

test("an audit event naming the owner is recorded, with the reason in detail when given", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg);
  await declineEnquiryInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    reason: "Overbooked that week.",
  });

  const ev = await pg.query<{ summary: string; detail: string | null; object_type: string }>(
    "select summary, detail, object_type from audit_event where business_id = $1",
    [businessId],
  );
  assert.equal(ev.rows.length, 1);
  assert.equal(ev.rows[0]!.summary, "Declined by the owner");
  assert.equal(ev.rows[0]!.detail, "Overbooked that week.");
  assert.equal(ev.rows[0]!.object_type, "enquiry");
});

test("no reason given records a null detail, never a fabricated one", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg);
  await declineEnquiryInTransaction(sqlFor(pg), { enquiryId, businessId, userId: "u1" });

  const ev = await pg.query<{ detail: string | null }>(
    "select detail from audit_event where business_id = $1",
    [businessId],
  );
  assert.equal(ev.rows[0]!.detail, null);
});

test("a reason longer than 400 characters is truncated, never stored raw", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg);
  const longReason = "x".repeat(500);
  await declineEnquiryInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    reason: longReason,
  });

  const ev = await pg.query<{ detail: string }>(
    "select detail from audit_event where business_id = $1",
    [businessId],
  );
  assert.equal(ev.rows[0]!.detail!.length, 400);
});

test("declining twice is idempotent - the second call writes no second audit row", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg);
  const first = await declineEnquiryInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    reason: "First reason.",
  });
  const second = await declineEnquiryInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    reason: "Second reason - should not land.",
  });
  assert.equal(first.alreadyDeclined, false);
  assert.equal(second.alreadyDeclined, true);

  const count = await pg.query<{ n: number }>(
    "select count(*)::int n from audit_event where business_id = $1",
    [businessId],
  );
  assert.equal(count.rows[0]!.n, 1, "the second call must not write a second audit row");

  const ev = await pg.query<{ detail: string }>(
    "select detail from audit_event where business_id = $1",
    [businessId],
  );
  assert.equal(ev.rows[0]!.detail, "First reason.");
});

test("declining an enquiry that no longer exists throws rather than silently succeeding", async () => {
  const pg = await freshDb();
  const { businessId } = await seedBusinessAndEnquiry(pg);
  await assert.rejects(
    () =>
      declineEnquiryInTransaction(sqlFor(pg), {
        enquiryId: "00000000-0000-4000-8000-000000000000",
        businessId,
        userId: "u1",
      }),
    /no longer exists/,
  );
});
