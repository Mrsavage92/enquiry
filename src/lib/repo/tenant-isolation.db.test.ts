import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import {
  ForbiddenError,
  listUserBusinessIds,
  requireBusinessAccess,
  requireEnquiryAccess,
} from "./tenancy.server.ts";
import { loadWorkspace } from "./workspace.server.ts";

/**
 * Two paying businesses on one database must never see each other.
 *
 * Every server function resolves the caller's businesses through
 * business_member (tenancy.server.ts), and the app connects as the table
 * owner, so RLS is not the safety net: these queries are. This runs the real
 * SQL of the boundary and of the workspace loader against real rows for two
 * tenants, and fails if any of A's reads can reach B.
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
  return (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return (await pg.query<T>(text, values)).rows;
  }) as never;
}

const PROFILE = {
  ownerFirstName: "Owner",
  industry: "painting",
  baseLocation: "Brisbane",
  timezone: "Australia/Brisbane",
  soloOrTeam: "solo" as const,
  currency: "AUD",
};

async function tenant(pg: PGlite, userId: string, name: string, customer: string) {
  await pg.query("insert into app_user (id, email) values ($1, $2)", [userId, `${userId}@test`]);
  const sql = sqlFor(pg);
  const { businessId } = await createWorkspaceInTransaction(sql, { ...PROFILE, name, userId });
  const { enquiryId } = await insertManualEnquiry(sql, {
    businessId,
    body: `Hi, it's ${customer}. Can you quote for two bedrooms?`,
    customerName: customer,
    customerEmail: `${customer.toLowerCase()}@example.com`,
    customerPhone: "",
    serviceLabel: "",
    intakeNote: "",
  });
  return { businessId, enquiryId };
}

test("one business cannot reach another business's data", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Alpha Painting", "Aileen");
  const b = await tenant(pg, "user-b", "Bravo Cleaning", "Bruno");

  assert.deepEqual(await listUserBusinessIds("user-a", sql), [a.businessId]);
  assert.deepEqual(await listUserBusinessIds("user-b", sql), [b.businessId]);

  // Own data: allowed.
  assert.equal(await requireBusinessAccess("user-a", a.businessId, sql), a.businessId);
  assert.equal((await requireEnquiryAccess("user-a", a.enquiryId, sql)).businessId, a.businessId);

  // Other tenant's ids, even when known: refused.
  await assert.rejects(requireBusinessAccess("user-a", b.businessId, sql), ForbiddenError);
  await assert.rejects(requireEnquiryAccess("user-a", b.enquiryId, sql), ForbiddenError);
  await assert.rejects(requireBusinessAccess("user-b", a.businessId, sql), ForbiddenError);
  await assert.rejects(requireEnquiryAccess("user-b", a.enquiryId, sql), ForbiddenError);

  // A signed-in user with no workspace sees nobody's.
  await pg.query("insert into app_user (id, email) values ('user-c', 'c@test')");
  await assert.rejects(requireEnquiryAccess("user-c", a.enquiryId, sql), ForbiddenError);
  assert.deepEqual(await listUserBusinessIds("user-c", sql), []);
});

test("the workspace A loads contains nothing that belongs to B", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Alpha Painting", "Aileen");
  const b = await tenant(pg, "user-b", "Bravo Cleaning", "Bruno");

  const wsA = await loadWorkspace("user-a", sql);
  const blob = JSON.stringify(wsA);
  assert.ok(blob.includes("Alpha Painting") && blob.includes("Aileen"), "A sees its own data");
  assert.ok(!blob.includes("Bravo Cleaning"), "B's business name must not reach A");
  assert.ok(!blob.includes("Bruno"), "B's customer must not reach A");
  assert.ok(!blob.includes(b.businessId), "B's business id must not reach A");
  assert.ok(!blob.includes(b.enquiryId), "B's enquiry id must not reach A");

  const wsC = await loadWorkspace("nobody", sql);
  assert.equal(JSON.stringify(wsC).includes(a.businessId), false);
});
