#!/usr/bin/env node
/**
 * Out-of-band database migrator (node-postgres, `pg`). NOT run by `npm run
 * build` and NOT run on Vercel deploys - the deploy role cannot run DDL, so a
 * build-time migration attempt can only ever fail there. See the "Applying
 * migrations in production" note in docs/phases/LIVE_LOOP_IMPLEMENTATION_RECORD.md.
 *
 * Run this by hand with `npm run db:migrate`, using a DATABASE_URL for the
 * table-owner role (`postgres`), or apply the SQL file directly in the
 * Supabase SQL editor. Either way, do it before the deploy that depends on it.
 *
 * Production connects over DATABASE_URL as `enquiry_app`, which has
 * BYPASSRLS and DML grants (select/insert/update/delete) but owns no table -
 * every table is owned by `postgres`. DDL as `enquiry_app` fails with
 * Postgres error 42501 (insufficient_privilege). So any migration that
 * creates a table must be followed, in the same production apply, by:
 *
 *   grant select, insert, update, delete on <table> to enquiry_app;
 *   alter table <table> enable row level security;
 *
 * RLS-with-no-policies is the standing pattern here (see 0005_rls_lockdown.sql
 * for why) - it denies anon/authenticated outright while enquiry_app's
 * BYPASSRLS grant keeps the app itself unaffected.
 *
 * Applies pending files in ../migrations to DATABASE_URL. Each file is
 * applied in one transaction and recorded in a `_migrations` table, so it
 * runs once and is safe to re-run.
 *
 * The read is non-recursive, so the opt-in auth schema under migrations/auth/
 * is not applied to an app that never asked for sign-in.
 *
 * No DATABASE_URL (local / preview builds) -> skip; the PGLite fallback applies
 * the same files at startup instead (see src/lib/db.ts).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).");
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function main() {
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.log("[migrate] no migrations/ directory — nothing to do.");
    return;
  }
  // An app with no schema of its own must not pay for a database connection.
  if (pendingMigrations(entries, []).length === 0) {
    console.log("[migrate] no migrations — nothing to do.");
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name);

    let count = 0;
    for (const { name } of pendingMigrations(entries, applied)) {
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        await client.query("BEGIN");
        // pg's simple-query protocol runs a whole multi-statement file at once.
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        if (err?.code === "42501") {
          console.error(
            "[migrate] insufficient_privilege (42501): DATABASE_URL is not the table-owner role. " +
              "enquiry_app cannot run DDL - apply this migration by hand as the owner role, then " +
              "grant the table to enquiry_app and enable RLS. See the file header for the exact steps.",
          );
        }
        try {
          await client.query("ROLLBACK");
        } catch {
          // ROLLBACK fails when the connection died — keep the original error.
        }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(
      count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.",
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  // pg errors carry the context needed to debug a bad SQL file.
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  process.exit(1);
});
