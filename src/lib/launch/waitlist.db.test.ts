import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  getWaitlistAnswers,
  joinWaitlistRow,
  leaveWaitlistRow,
  type JoinWaitlistInput,
} from "./waitlist.server.ts";

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

function input(overrides: Partial<JoinWaitlistInput> = {}): JoinWaitlistInput {
  return {
    email: "a@x.com",
    existingId: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    referrer: "",
    linkedin_post_id: "",
    first_touch: "",
    latest_touch: "",
    ...overrides,
  };
}

test("a first join inserts a new row", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const result = await joinWaitlistRow(input({ email: "a@x.com" }), sql);
  assert.equal(result.already, false);
  assert.equal(result.created, true);
  assert.ok(result.id);
  const rows = await pg.query<{ email: string }>("select email from waitlist");
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0]?.email, "a@x.com");
});

test("joining the same email twice updates touch fields instead of duplicating", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const first = await joinWaitlistRow(input({ email: "a@x.com", utm_source: "google" }), sql);
  assert.equal(first.created, true);
  const second = await joinWaitlistRow(
    input({ email: "a@x.com", utm_source: "linkedin", latest_touch: "{}" }),
    sql,
  );
  assert.equal(second.already, true);
  assert.equal(second.created, false);
  assert.equal(second.id, "", "never hands back another person's id");
  const rows = await pg.query<{ n: number }>("select count(*)::int n from waitlist");
  assert.equal(rows.rows[0]?.n, 1);
});

test("changing the email on an existing entry updates that row, not a second one", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const joined = await joinWaitlistRow(input({ email: "typo@x.com" }), sql);
  const fixed = await joinWaitlistRow(
    input({ email: "correct@x.com", existingId: joined.id }),
    sql,
  );
  assert.equal(fixed.id, joined.id, "same row, same id");
  assert.equal(fixed.already, false);
  const rows = await pg.query<{ email: string }>("select email from waitlist");
  assert.equal(rows.rows.length, 1, "no duplicate row was inserted");
  assert.equal(rows.rows[0]?.email, "correct@x.com");
});

test("changing the email to one already used by someone else does not merge or duplicate", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const mine = await joinWaitlistRow(input({ email: "mine@x.com" }), sql);
  await joinWaitlistRow(input({ email: "taken@x.com" }), sql);
  const attempt = await joinWaitlistRow(input({ email: "taken@x.com", existingId: mine.id }), sql);
  // Falls through to the generic path: reads as "already on the list" under
  // the other entry, and my original row is left exactly as it was.
  assert.equal(attempt.already, true);
  const rows = await pg.query<{ email: string }>("select email from waitlist order by email");
  assert.deepEqual(
    rows.rows.map((r) => r.email),
    ["mine@x.com", "taken@x.com"],
  );
});

test("leaving removes the row only for a real id, and is a safe no-op otherwise", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const joined = await joinWaitlistRow(input({ email: "a@x.com" }), sql);
  assert.equal((await leaveWaitlistRow("not-a-uuid", sql)).removed, false);
  assert.equal((await leaveWaitlistRow(joined.id, sql)).removed, true);
  const rows = await pg.query<{ n: number }>("select count(*)::int n from waitlist");
  assert.equal(rows.rows[0]?.n, 0);
});

test("saved qualify answers can be read back for editing, and a bad id reads as none", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const joined = await joinWaitlistRow(input({ email: "a@x.com" }), sql);
  assert.equal(await getWaitlistAnswers("not-a-uuid", sql), null);
  const empty = await getWaitlistAnswers(joined.id, sql);
  assert.deepEqual(empty, {
    business_type: "",
    enquiry_volume: "",
    pain_text: "",
    channels: "",
    beta_interest: "",
  });
  await pg.query(
    `update waitlist set business_type = $1, enquiry_volume = $2, pain_text = $3, channels = $4, beta_interest = $5 where id = $6`,
    ["Painting", "5-20", "Chasing quotes", "Email, Text", "Yes", joined.id],
  );
  const filled = await getWaitlistAnswers(joined.id, sql);
  assert.deepEqual(filled, {
    business_type: "Painting",
    enquiry_volume: "5-20",
    pain_text: "Chasing quotes",
    channels: "Email, Text",
    beta_interest: "Yes",
  });
});
