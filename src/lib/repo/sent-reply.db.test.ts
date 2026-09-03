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
    /** The reply Enquiry itself prepared, if any - omit to leave the snapshot
     *  carrying no draft at all, the same as a hand-authored fixture. */
    draftBody?: string;
    /** The decision snapshot's computed price, if any - omit to leave the
     *  snapshot carrying no price at all (a non-quote action, or a decision
     *  made before this slice existed). */
    price?:
      | { kind: "EXACT"; amountMinor: number; currency: string }
      | { kind: "RANGE"; minMinor: number; maxMinor: number; currency: string };
    engineVersion?: string;
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
    ...(overrides.draftBody !== undefined ? { draft: { body: overrides.draftBody } } : {}),
    ...(overrides.price !== undefined ? { price: overrides.price } : {}),
  };
  const enq = await pg.query<{ id: string }>(
    `insert into enquiry
       (business_id, customer_name, customer_email, customer_phone, customer_handle, source,
        service_label, decision_state, commercial_state, responsibility, decision_snapshot,
        engine_version)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
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
      overrides.engineVersion ?? "1",
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
  });
  const second = await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
    clientRequestId,
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

test("the same clientRequestId reused on a different enquiry creates a second real message, not a false duplicate", async () => {
  // The DB-level backstop is a unique index on (channel, external_id) with no
  // enquiry column - it also has to dedupe inbound provider webhook ids
  // across the whole table. Before this fix a client key reused across two
  // enquiries on the same channel hit that index, was caught as a unique
  // violation, and was reported `duplicate: true` even though the second
  // enquiry's message was never written.
  const pg = await freshDb();
  const { businessId: businessIdA, enquiryId: enquiryA } = await seedBusinessAndEnquiry(pg, {
    customerEmail: "sarah@example.com",
  });
  const { businessId: businessIdB, enquiryId: enquiryB } = await seedBusinessAndEnquiry(pg, {
    customerEmail: "jordan@example.com",
  });
  const clientRequestId = "44444444-4444-4444-8444-444444444444";

  const first = await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId: enquiryA,
    businessId: businessIdA,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
    clientRequestId,
  });
  const second = await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId: enquiryB,
    businessId: businessIdB,
    userId: "u1",
    body: "Hi Jordan, that comes to $720.",
    channel: "email",
    clientRequestId,
  });

  assert.equal(first.duplicate, false);
  assert.equal(
    second.duplicate,
    false,
    "a client key reused on a DIFFERENT enquiry must not read as a duplicate",
  );

  const messages = await pg.query<{ enquiry_id: string; to_addr: string }>(
    "select enquiry_id, to_addr from message where enquiry_id in ($1, $2)",
    [enquiryA, enquiryB],
  );
  assert.equal(messages.rows.length, 2, "both sends must have actually written a message row");
  const forA = messages.rows.find((m) => m.enquiry_id === enquiryA);
  const forB = messages.rows.find((m) => m.enquiry_id === enquiryB);
  assert.equal(forA?.to_addr, "sarah@example.com");
  assert.equal(forB?.to_addr, "jordan@example.com");
});

test("edited is derived server-side as false when the sent body exactly matches Enquiry's prepared draft", async () => {
  const pg = await freshDb();
  const draftBody = "Hi Sarah, that comes to $580.";
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, { draftBody });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: draftBody,
    channel: "email",
  });
  const ev = await pg.query<{ detail: string }>(
    "select detail from audit_event where business_id = $1",
    [businessId],
  );
  assert.match(ev.rows[0]!.detail, /Edited: false/);
});

test("edited stays false across a trailing-whitespace and CRLF-only difference from the prepared draft", async () => {
  const pg = await freshDb();
  const draftBody = "Hi Sarah, that comes to $580.";
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, { draftBody });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "  Hi Sarah, that comes to $580.  \r\n",
    channel: "email",
  });
  const ev = await pg.query<{ detail: string }>(
    "select detail from audit_event where business_id = $1",
    [businessId],
  );
  assert.match(
    ev.rows[0]!.detail,
    /Edited: false/,
    "trimming and line-ending differences alone are not an edit",
  );
});

test("edited is derived server-side as true when the sent body differs from Enquiry's prepared draft", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    draftBody: "Hi Sarah, that comes to $580.",
  });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $650 actually - I miscounted the first time.",
    channel: "email",
  });
  const ev = await pg.query<{ detail: string }>(
    "select detail from audit_event where business_id = $1",
    [businessId],
  );
  assert.match(ev.rows[0]!.detail, /Edited: true/);
});

test("edited is recorded as unknown when the decision snapshot carries no prepared draft to compare against", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg);
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
  });
  const ev = await pg.query<{ detail: string }>(
    "select detail from audit_event where business_id = $1",
    [businessId],
  );
  assert.match(ev.rows[0]!.detail, /Edited: unknown/);
});

test("the audit row names the channel and recipient, and carries the decision reason and edited flag", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    customerEmail: "sarah@example.com",
    reason: "Group makeup: $145/person x 4, minimum 3.",
    draftBody: "Hi Sarah, here is a first draft of the reply.",
  });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
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

test("a quote send writes exactly one quote_version row, version 1, with the right total", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    action: "SEND_QUOTE",
    price: { kind: "EXACT", amountMinor: 58000, currency: "AUD" },
    engineVersion: "3",
  });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
  });
  const rows = await pg.query<{
    version: number;
    status: string;
    total_minor: number;
    currency: string;
    rule_set_version: string;
  }>("select version, status, total_minor, currency, rule_set_version from quote_version where enquiry_id = $1", [
    enquiryId,
  ]);
  assert.equal(rows.rows.length, 1, "exactly one quote_version row");
  assert.equal(rows.rows[0]!.version, 1);
  assert.equal(rows.rows[0]!.status, "sent");
  assert.equal(rows.rows[0]!.total_minor, 58000);
  assert.equal(rows.rows[0]!.currency, "AUD");
  assert.equal(rows.rows[0]!.rule_set_version, "3");
});

test("a second real send writes version 2, not a second version 1", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    action: "SEND_QUOTE",
    price: { kind: "EXACT", amountMinor: 58000, currency: "AUD" },
  });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
    clientRequestId: "55555555-5555-4555-8555-555555555555",
  });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580 - resending as requested.",
    channel: "email",
    clientRequestId: "66666666-6666-4666-8666-666666666666",
  });
  const rows = await pg.query<{ version: number }>(
    "select version from quote_version where enquiry_id = $1 order by version",
    [enquiryId],
  );
  assert.deepEqual(
    rows.rows.map((r) => r.version),
    [1, 2],
  );
});

test("a duplicate clientRequestId writes no additional quote_version row", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    action: "SEND_QUOTE",
    price: { kind: "EXACT", amountMinor: 58000, currency: "AUD" },
  });
  const clientRequestId = "77777777-7777-4777-8777-777777777777";
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
    "select count(*)::int n from quote_version where enquiry_id = $1",
    [enquiryId],
  );
  assert.equal(count.rows[0]!.n, 1, "the retry must not create a second quote_version row");
});

test("a non-quote send writes no quote_version row", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    action: "REQUEST_INFORMATION",
    reason: "Guests decides the price.",
  });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, how many guests will there be?",
    channel: "email",
  });
  const count = await pg.query<{ n: number }>(
    "select count(*)::int n from quote_version where enquiry_id = $1",
    [enquiryId],
  );
  assert.equal(count.rows[0]!.n, 0);
});

test("a quote send updates enquiry.value_exact_minor and currency, so the queue reads it from data", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    action: "SEND_QUOTE",
    price: { kind: "EXACT", amountMinor: 58000, currency: "AUD" },
  });
  const before = await pg.query<{ value_exact_minor: number | null }>(
    "select value_exact_minor from enquiry where id = $1",
    [enquiryId],
  );
  assert.equal(before.rows[0]!.value_exact_minor, null, "unset before the send");
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, that comes to $580.",
    channel: "email",
  });
  const after = await pg.query<{ value_exact_minor: number; currency: string }>(
    "select value_exact_minor, currency from enquiry where id = $1",
    [enquiryId],
  );
  assert.equal(after.rows[0]!.value_exact_minor, 58000);
  assert.equal(after.rows[0]!.currency, "AUD");
});

test("a SEND_ESTIMATE send writes range_min_minor/range_max_minor, not total_minor", async () => {
  const pg = await freshDb();
  const { businessId, enquiryId } = await seedBusinessAndEnquiry(pg, {
    action: "SEND_ESTIMATE",
    price: { kind: "RANGE", minMinor: 72000, maxMinor: 108000, currency: "AUD" },
  });
  await recordSentReplyInTransaction(sqlFor(pg), {
    enquiryId,
    businessId,
    userId: "u1",
    body: "Hi Sarah, roughly $720-$1,080.",
    channel: "email",
  });
  const rows = await pg.query<{
    total_minor: number | null;
    range_min_minor: number;
    range_max_minor: number;
  }>(
    "select total_minor, range_min_minor, range_max_minor from quote_version where enquiry_id = $1",
    [enquiryId],
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0]!.total_minor, null);
  assert.equal(rows.rows[0]!.range_min_minor, 72000);
  assert.equal(rows.rows[0]!.range_max_minor, 108000);

  const enq = await pg.query<{ value_range_min_minor: number; value_range_max_minor: number }>(
    "select value_range_min_minor, value_range_max_minor from enquiry where id = $1",
    [enquiryId],
  );
  assert.equal(enq.rows[0]!.value_range_min_minor, 72000);
  assert.equal(enq.rows[0]!.value_range_max_minor, 108000);
});
