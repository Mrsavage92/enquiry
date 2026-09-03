import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { recordSentReplyInTransaction } from "./sent-reply-core.ts";

/**
 * Real database-path tests for recording a send.
 *
 * Following `provision.db.test.ts`'s exact pattern: fresh `PGlite()`, every
 * migration applied directly, the core transaction function called directly
 * rather than through the `createServerFn`-wrapped route (which needs a real
 * auth context this test has no reason to fake). The interesting failures
 * here - a missing recipient, a retried request creating two records, an
 * audit row with no reason on it - only a database proves.
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
    customerEmail?: string;
    customerPhone?: string | null;
    customerHandle?: string | null;
    reason?: string;
    action?: string;
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
  const snapshot = {
    recommendation: {
      reason: overrides.reason ?? "4 people at $145 each.",
      action: overrides.action ?? "SEND_QUOTE",
    },
  };
  const enq = await pg.query<{ id: string }>(
    `insert into enquiry
       (business_id, customer_name, customer_email, customer_phone, customer_handle, source,
        service_label, decision_state, commercial_state, responsibility, decision_snapshot)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     returning id`,
    [
      businessId,
      "Sarah",
      overrides.customerEmail ?? "sarah@example.com",
      overrides.customerPhone ?? null,
      overrides.customerHandle ?? null,
      "email",
      "Group makeup",
      "ACTION_READY",
      "QUOTABLE",
      "BUSINESS",
      JSON.stringify(snapshot),
    ],
  );
  return { businessId, enquiryId: enq.rows[0]!.id };
}

test("to_addr is derived server-side from the enquiry's own email for an email channel", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    customerEmail: "sarah@example.com",
  });
  const res = await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
  });
  assert.equal(res.ok, true);
  assert.equal(res.duplicate, false);

  const msg = await pg.query<{ to_addr: string; from_addr: string }>(
    "select to_addr, from_addr from message where enquiry_id = $1",
    [enquiryId],
  );
  assert.equal(msg.rows.length, 1);
  assert.equal(msg.rows[0]!.to_addr, "sarah@example.com");
  assert.equal(msg.rows[0]!.from_addr, "Glow & Co");
});

test("an unresolvable channel yields an empty to_addr, never a fabricated one", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    customerEmail: "",
    customerPhone: null,
    customerHandle: null,
  });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi, following up.",
    channel: "sms",
  });
  const msg = await pg.query<{ to_addr: string }>(
    "select to_addr from message where enquiry_id = $1",
    [enquiryId],
  );
  assert.equal(msg.rows[0]!.to_addr, "", "no phone on file - empty, not invented");
});

test("a repeated clientRequestId creates exactly one outbound message", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg);
  const clientRequestId = "11111111-1111-4111-8111-111111111111";
  const first = await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
    clientRequestId,
    edited: false,
  });
  const second = await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
    clientRequestId,
    edited: false,
  });
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true, "the retry must not create a second message");

  const count = await pg.query<{ n: number }>(
    "select count(*)::int n from message where enquiry_id = $1",
    [enquiryId],
  );
  assert.equal(count.rows[0]!.n, 1);
});

test("a different clientRequestId on the same enquiry is a genuinely new send, not deduped", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg);
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
    clientRequestId: "11111111-1111-4111-8111-111111111111",
  });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Just checking you still want this.",
    channel: "email",
    clientRequestId: "22222222-2222-4222-8222-222222222222",
  });
  const count = await pg.query<{ n: number }>(
    "select count(*)::int n from message where enquiry_id = $1",
    [enquiryId],
  );
  assert.equal(count.rows[0]!.n, 2);
});

test("the audit row names the channel and recipient, and carries the decision reason and edited flag", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    customerEmail: "sarah@example.com",
    reason: "Group makeup: $145/person x 4, minimum 3.",
  });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
    edited: true,
  });
  const ev = await pg.query<{ summary: string; detail: string; object_type: string }>(
    "select summary, detail, object_type from audit_event where business_id = $1",
    [businessId],
  );
  assert.equal(ev.rows.length, 1);
  assert.match(ev.rows[0]!.summary, /Email/);
  assert.match(ev.rows[0]!.summary, /sarah@example\.com/);
  assert.match(ev.rows[0]!.detail, /Group makeup: \$145\/person x 4, minimum 3\./);
  assert.match(ev.rows[0]!.detail, /Edited: true/);
  assert.equal(ev.rows[0]!.object_type, "enquiry");
});

test("a duplicate call writes no second audit row", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg);
  const clientRequestId = "33333333-3333-4333-8333-333333333333";
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
    clientRequestId,
  });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
    clientRequestId,
  });
  const count = await pg.query<{ n: number }>(
    "select count(*)::int n from audit_event where business_id = $1",
    [businessId],
  );
  assert.equal(count.rows[0]!.n, 1);
});

test("a confirmed SEND_QUOTE moves commercial state past QUOTABLE, so the waiting desk can find it", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, { action: "SEND_QUOTE" });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
  });
  const row = await pg.query<{ commercial_state: string; decision_state: string }>(
    "select commercial_state, decision_state from enquiry where id = $1",
    [enquiryId],
  );
  assert.equal(row.rows[0]!.commercial_state, "QUOTED");
  assert.equal(row.rows[0]!.decision_state, "WAITING_ON_CLIENT");
});

test("a confirmed SEND_ESTIMATE moves commercial state to ESTIMATED", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, { action: "SEND_ESTIMATE" });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, roughly $500-600.",
    channel: "email",
  });
  const row = await pg.query<{ commercial_state: string }>(
    "select commercial_state from enquiry where id = $1",
    [enquiryId],
  );
  assert.equal(row.rows[0]!.commercial_state, "ESTIMATED");
});
