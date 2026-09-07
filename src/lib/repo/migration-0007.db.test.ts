import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

/**
 * CC1 migration safety: 0007 applied to a database that already holds data.
 *
 * Every other database test in this repository builds a schema from empty, so
 * none of them would notice a migration that is only correct on a fresh
 * database. This one applies 0002-0006, fills it with representative rows of
 * the kind a real workspace already holds - enquiries with decision snapshots,
 * sent messages, quote versions - and only then applies 0007.
 *
 * What it must prove: nothing existing is lost or altered, the new revision
 * column arrives with a usable default on every existing row, and the legacy
 * rows are left in a state the new code reads correctly rather than one it
 * silently promotes.
 */

const migrationsDir = join(process.cwd(), "migrations");

function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function dbAtMigration(upTo: string): Promise<PGlite> {
  const pg = new PGlite();
  await pg.waitReady;
  for (const f of migrationFiles()) {
    await pg.exec(readFileSync(join(migrationsDir, f), "utf8"));
    if (f === upTo) break;
  }
  return pg;
}

async function apply(pg: PGlite, file: string): Promise<void> {
  await pg.exec(readFileSync(join(migrationsDir, file), "utf8"));
}

const LATEST = "0007_reviewed_sends_and_revisions.sql";
const PREVIOUS = "0006_typed_rules_and_real_sends.sql";

/** Rows of the shape a workspace created before CC1 existed already holds. */
async function seedLegacy(pg: PGlite) {
  const biz = await pg.query<{ id: string }>(
    "insert into business (name, industry, owner_first_name) values ($1,$2,$3) returning id",
    ["Glow & Co", "beauty", "Mina"],
  );
  const businessId = biz.rows[0]!.id;
  const snapshot = {
    recommendation: { action: "SEND_QUOTE", reason: "4 people at $145 each.", primaryEnabled: true },
    draft: { body: "Hi Sarah, that comes to $580." },
    price: { kind: "EXACT", amountMinor: 58_000, currency: "AUD" },
  };
  const enq = await pg.query<{ id: string }>(
    `insert into enquiry
       (business_id, customer_name, customer_email, source, service_label, lifecycle,
        decision_state, commercial_state, responsibility, decision_snapshot, received_at, updated_at)
     values ($1,'Sarah','sarah@example.com','manual','Group makeup','OPEN',
             'WAITING_ON_CLIENT','QUOTED','CUSTOMER',$2::jsonb, now(), now())
     returning id`,
    [businessId, JSON.stringify(snapshot)],
  );
  const enquiryId = enq.rows[0]!.id;
  // A message the previous code had already recorded as sent.
  await pg.query(
    `insert into message (enquiry_id, direction, channel, at, from_addr, to_addr, body, intake, sent_at, sent_by)
     values ($1,'outbound','manual', now(), 'Glow & Co','sarah@example.com','Hi Sarah, that comes to $580.','manual', now(), 'user-1')`,
    [enquiryId],
  );
  await pg.query(
    `insert into quote_version (enquiry_id, version, status, sent_at, total_minor, currency, line_items, rule_set_version)
     values ($1, 1, 'sent', now(), 58000, 'AUD', '[]'::jsonb, '0')`,
    [enquiryId],
  );
  return { businessId, enquiryId };
}

test("0007 applies cleanly to a database that already holds enquiries, sends and quotes", async () => {
  const pg = await dbAtMigration(PREVIOUS);
  const ids = await seedLegacy(pg);
  await apply(pg, LATEST);

  const enq = await pg.query<{ n: number }>("select count(*)::int as n from enquiry");
  const msg = await pg.query<{ n: number }>("select count(*)::int as n from message");
  const quotes = await pg.query<{ n: number }>("select count(*)::int as n from quote_version");
  assert.equal(enq.rows[0]!.n, 1, "no existing enquiry may be lost");
  assert.equal(msg.rows[0]!.n, 1, "no historically sent message may be lost");
  assert.equal(quotes.rows[0]!.n, 1, "no historical quote may be lost");
  assert.ok(ids.enquiryId);
});

test("0007 leaves every existing row's commercial content byte-for-byte unchanged", async () => {
  const pg = await dbAtMigration(PREVIOUS);
  await seedLegacy(pg);
  const before = await pg.query("select body, sent_at, sent_by, to_addr from message order by at");
  const quotesBefore = await pg.query(
    "select version, status, total_minor, currency from quote_version order by version",
  );
  await apply(pg, LATEST);
  const after = await pg.query("select body, sent_at, sent_by, to_addr from message order by at");
  const quotesAfter = await pg.query(
    "select version, status, total_minor, currency from quote_version order by version",
  );
  assert.deepEqual(after.rows, before.rows, "a migration must not rewrite what was sent");
  assert.deepEqual(quotesAfter.rows, quotesBefore.rows, "nor what was quoted");
});

test("0007 gives every existing enquiry a usable decision_revision without inventing history", async () => {
  const pg = await dbAtMigration(PREVIOUS);
  await seedLegacy(pg);
  await apply(pg, LATEST);
  const rows = await pg.query<{ decision_revision: number }>(
    "select decision_revision from enquiry",
  );
  assert.equal(rows.rows[0]!.decision_revision, 0, "legacy rows start at zero, not a made-up count");

  const nulls = await pg.query<{ n: number }>(
    "select count(*)::int as n from enquiry where decision_revision is null",
  );
  assert.equal(nulls.rows[0]!.n, 0, "every writer's `+ 1` must be well defined");
});

test("0007 adds no reviewed_send rows of its own - history is reported, never fabricated", async () => {
  const pg = await dbAtMigration(PREVIOUS);
  await seedLegacy(pg);
  await apply(pg, LATEST);
  const rows = await pg.query<{ n: number }>("select count(*)::int as n from reviewed_send");
  assert.equal(
    rows.rows[0]!.n,
    0,
    "a message sent before reviewed sends existed has no reviewed artefact, and one must not be invented for it",
  );
  const linked = await pg.query<{ reviewed_send_id: string | null }>(
    "select reviewed_send_id from message",
  );
  assert.equal(linked.rows[0]!.reviewed_send_id, null);
});

test("0007 is idempotent - re-running it changes nothing", async () => {
  const pg = await dbAtMigration(PREVIOUS);
  await seedLegacy(pg);
  await apply(pg, LATEST);
  await pg.query("update enquiry set decision_revision = 7");
  await apply(pg, LATEST);
  const rows = await pg.query<{ decision_revision: number }>(
    "select decision_revision from enquiry",
  );
  assert.equal(rows.rows[0]!.decision_revision, 7, "a re-run must not reset live values");
});

test("the reviewed_send identity index rejects a second artefact for the same enquiry and text", async () => {
  const pg = await dbAtMigration(LATEST);
  const ids = await seedLegacy(pg);
  const insert = () =>
    pg.query(
      `insert into reviewed_send
         (enquiry_id, business_id, reviewed_by, decision_revision, action, channel, body, body_hash)
       values ($1,$2,'user-1',1,'SEND_QUOTE','manual','text','hash-1')`,
      [ids.enquiryId, ids.businessId],
    );
  await insert();
  await assert.rejects(insert(), /duplicate key|unique/i);
});
