import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceInTransaction } from "./provision-core.ts";

/**
 * Real database-path tests for initial workspace creation.
 *
 * These run the ACTUAL SQL and the actual advisory-lock/re-check sequence
 * against PGLite - the same embedded Postgres the app uses when no DATABASE_URL
 * is set. Profile-validator tests alone cannot evidence the transaction gate,
 * because the interesting failures are constraint violations and races that only
 * a database can produce.
 */

const migrationsDir = join(process.cwd(), "migrations");

/** Fresh database with every product migration applied. */
async function freshDb(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.waitReady;
  for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  return pg;
}

/** The app's tagged-template Sql surface, bound to one PGLite handle. */
function sqlFor(pg: PGlite) {
  const run = async <T,>(text: string, params: unknown[]): Promise<T[]> => {
    const res = await pg.query<T>(text, params);
    return res.rows;
  };
  const sql = (async <T,>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<T>(text, values);
  }) as never;
  return sql;
}

const PROFILE = {
  name: "Ridge & Co",
  ownerFirstName: "Maya",
  industry: "painting",
  baseLocation: "New Farm",
  timezone: "Australia/Brisbane",
  soloOrTeam: "solo" as const,
  currency: "AUD",
};

async function seedUser(pg: PGlite, id: string) {
  await pg.query("insert into app_user (id, email) values ($1, $2)", [id, `${id}@test`]);
}

test("creation writes business, owner membership and the safe policy catalogue", async () => {
  const pg = await freshDb();
  await seedUser(pg, "u1");
  const res = await createWorkspaceInTransaction(sqlFor(pg), {
    ...PROFILE,
    userId: "u1",
  });
  assert.equal(res.created, true);

  const biz = await pg.query<{ name: string; currency: string; trust_mode: string }>(
    "select name, currency, trust_mode from business where id = $1",
    [res.businessId],
  );
  assert.equal(biz.rows[0]?.name, "Ridge & Co");
  assert.equal(biz.rows[0]?.currency, "AUD");
  assert.equal(biz.rows[0]?.trust_mode, "Observe");

  const member = await pg.query<{ role: string }>(
    "select role from business_member where business_id = $1 and user_id = $2",
    [res.businessId, "u1"],
  );
  assert.equal(member.rows[0]?.role, "owner");

  const auto = await pg.query<{ n: number }>(
    "select count(*)::int n from action_policy where business_id = $1 and mode = 'Automatic when safe'",
    [res.businessId],
  );
  assert.equal(auto.rows[0]?.n, 0, "nothing may start automatic");
});

test("no fixture identity or sample record reaches the new tenant", async () => {
  const pg = await freshDb();
  await seedUser(pg, "u2");
  const { businessId } = await createWorkspaceInTransaction(sqlFor(pg), {
    ...PROFILE,
    userId: "u2",
  });

  for (const table of ["enquiry", "booking", "knowledge_item", "business_service"]) {
    const r = await pg.query<{ n: number }>(
      `select count(*)::int n from ${table} where business_id = $1`,
      [businessId],
    );
    assert.equal(r.rows[0]?.n, 0, `${table} must be empty for a new tenant`);
  }
  const connected = await pg.query<{ n: number }>(
    "select count(*)::int n from integration where business_id = $1",
    [businessId],
  );
  assert.equal(connected.rows[0]?.n, 0, "no integration may exist, connected or otherwise");

  const glow = await pg.query<{ n: number }>(
    "select count(*)::int n from business where name ilike '%glow%'",
  );
  assert.equal(glow.rows[0]?.n, 0, "fixture business 'glow' must never be created");
});

test("a second submit returns the same workspace instead of creating another", async () => {
  const pg = await freshDb();
  await seedUser(pg, "u3");
  const sql = sqlFor(pg);
  const first = await createWorkspaceInTransaction(sql, { ...PROFILE, userId: "u3" });
  const second = await createWorkspaceInTransaction(sql, { ...PROFILE, userId: "u3" });

  assert.equal(first.created, true);
  assert.equal(second.created, false, "the retry must not create a second workspace");
  assert.equal(second.businessId, first.businessId);

  const count = await pg.query<{ n: number }>(
    "select count(*)::int n from business_member where user_id = $1",
    ["u3"],
  );
  assert.equal(count.rows[0]?.n, 1);
});

test("direct onboarding works with no prior workspace fetch, given the user mirror", async () => {
  // The realistic path: sign in, land straight on /onboarding, submit. The only
  // prerequisite is the app_user row, which the server handler now guarantees.
  const pg = await freshDb();
  await seedUser(pg, "u4");
  const res = await createWorkspaceInTransaction(sqlFor(pg), { ...PROFILE, userId: "u4" });
  assert.equal(res.created, true);
});

test("a missing user mirror fails loudly rather than orphaning a business", async () => {
  const pg = await freshDb();
  await assert.rejects(
    () => createWorkspaceInTransaction(sqlFor(pg), { ...PROFILE, userId: "never-mirrored" }),
    /foreign key|violates/i,
    "membership must not be writable for an unknown user",
  );
});

test("creation is recorded in the audit log", async () => {
  const pg = await freshDb();
  await seedUser(pg, "u5");
  const { businessId } = await createWorkspaceInTransaction(sqlFor(pg), {
    ...PROFILE,
    userId: "u5",
  });
  const ev = await pg.query<{ summary: string }>(
    "select summary from audit_event where business_id = $1",
    [businessId],
  );
  assert.equal(ev.rows[0]?.summary, "Workspace created");
});
