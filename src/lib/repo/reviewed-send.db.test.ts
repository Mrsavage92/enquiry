import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import { confirmReviewedSendInTransaction } from "./sent-reply-core.ts";
import type { Channel } from "../../domain/types.ts";

/**
 * CC1-04, CC1-05 and CC1-06 against a real database.
 *
 * This file replaces `sent-reply.db.test.ts`, which exercised
 * `recordSentReplyInTransaction` - the entry point that took the body from the
 * client and the amount from the enquiry's current snapshot, and so allowed a
 * recorded message and a recorded quote to disagree. That function is gone, so
 * its tests would have been proving dead code. Every invariant it held is
 * re-asserted here against the reviewed-send path, plus the cases the CC1
 * acceptance matrix adds: copy is not a send, a stale approval cannot be
 * paired with a newer amount, and a retry records once.
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

/**
 * The production callers wrap both functions in `withTransaction`. The
 * SAVEPOINT inside the quote-version retry, and `for update`, both require a
 * real transaction block, which `sqlFor` alone does not open.
 */
async function inTransaction<T>(
  pg: PGlite,
  fn: (sql: Sql, run: <R>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  return pg.transaction(async (tx) => {
    const run = async <R>(text: string, params: unknown[] = []): Promise<R[]> => {
      const res = await tx.query<R>(text, params);
      return res.rows;
    };
    return fn(toSql(run), run);
  }) as Promise<T>;
}

type Seed = {
  customerEmail?: string;
  customerPhone?: string | null;
  customerHandle?: string | null;
  action?: string;
  reason?: string;
  draftBody?: string;
  price?: { kind: "EXACT"; amountMinor: number; currency: string } | { kind: "RANGE"; minMinor: number; maxMinor: number; currency: string } | null;
  source?: Channel;
  lifecycle?: string;
  /** Omit to record the owner-confirmed service every quote now requires. */
  confirmService?: boolean;
};

async function seed(pg: PGlite, o: Seed = {}): Promise<{ businessId: string; enquiryId: string }> {
  const biz = await pg.query<{ id: string }>(
    "insert into business (name, industry, owner_first_name) values ($1,$2,$3) returning id",
    ["Glow & Co", "beauty", "Mina"],
  );
  const businessId = biz.rows[0]!.id;
  const snapshot = {
    recommendation: {
      action: o.action ?? "SEND_QUOTE",
      reason: o.reason ?? "4 people at $145 each.",
      label: "Send the quote",
      requiredApproval: true,
      reasonCodes: [],
      primaryEnabled: true,
    },
    draft: { body: o.draftBody ?? DRAFT },
    price: o.price === undefined ? { kind: "EXACT", amountMinor: 58_000, currency: "AUD" } : o.price,
    // What the rule behind that price implies, exactly as
    // `snapshotFromDecision` stores it. Present because the default draft
    // above is the shape the product actually composes - a total AND the unit
    // rate that multiplies out to it - and a seed carrying only the total is
    // what let this suite stay green while every real per-unit quote was
    // refused by the server.
    impliedAmountsMinor: o.price === undefined ? [14_500, 58_000] : undefined,
    evaluators: [],
    explanation: o.reason ?? "4 people at $145 each.",
  };
  const enq = await pg.query<{ id: string }>(
    `insert into enquiry
       (business_id, customer_name, customer_email, customer_phone, customer_handle, source,
        service_label, lifecycle, decision_state, commercial_state, responsibility,
        decision_snapshot, decision_revision, received_at, updated_at)
     values ($1,'Sarah',$2,$3,$4,$5,'Group makeup',$6,'ACTION_READY','QUOTABLE','BUSINESS',
             $7::jsonb, 1, now(), now())
     returning id`,
    [
      businessId,
      o.customerEmail ?? "sarah@example.com",
      o.customerPhone ?? null,
      o.customerHandle ?? null,
      o.source ?? "manual",
      o.lifecycle ?? "OPEN",
      JSON.stringify(snapshot),
    ],
  );
  const enquiryId = enq.rows[0]!.id;
  if (o.confirmService !== false) {
    await pg.query(
      `insert into enquiry_fact
         (enquiry_id, field, label, value, display_value, status, confidence, asserted_by, provenance, customer_specific)
       values ($1,'service','service','Group makeup','Group makeup','confirmed','High','user','{"kind":"user"}'::jsonb,true)`,
      [enquiryId],
    );
  }
  return { businessId, enquiryId };
}

const USER = "user-1";

async function prepare(pg: PGlite, ids: { businessId: string; enquiryId: string }, body: string, channel: Channel = "manual") {
  return inTransaction(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: ids.enquiryId,
      businessId: ids.businessId,
      userId: USER,
      body,
      channel,
    }),
  );
}

async function confirm(pg: PGlite, ids: { businessId: string; enquiryId: string }, reviewedSendId: string, staleAttestation = false) {
  return inTransaction(pg, (sql) =>
    confirmReviewedSendInTransaction(sql, {
      reviewedSendId,
      enquiryId: ids.enquiryId,
      businessId: ids.businessId,
      userId: USER,
      staleAttestation,
    }),
  );
}

/**
 * The shape `composeReply` actually produces for a per-unit quote: the total
 * and the unit rate in one sentence. `composed-draft-send.db.test.ts` drives
 * the real composer end to end; this constant keeps every case in THIS file
 * honest about the body a live enquiry carries, rather than the single-figure
 * body that hid the defect.
 */
const DRAFT = "Hi Sarah,\n\nThat comes to $580. 4 people at $145 each.\n\nMina";

async function counts(pg: PGlite, enquiryId: string) {
  const msg = await pg.query<{ n: number }>(
    "select count(*)::int as n from message where enquiry_id = $1 and direction = 'outbound'",
    [enquiryId],
  );
  const quotes = await pg.query<{ n: number }>(
    "select count(*)::int as n from quote_version where enquiry_id = $1",
    [enquiryId],
  );
  const sent = await pg.query<{ n: number }>(
    "select count(*)::int as n from message where enquiry_id = $1 and sent_at is not null",
    [enquiryId],
  );
  return { messages: msg.rows[0]!.n, quotes: quotes.rows[0]!.n, sent: sent.rows[0]!.n };
}

async function enquiryState(pg: PGlite, enquiryId: string) {
  const rows = await pg.query<{
    responsibility: string;
    decision_state: string;
    commercial_state: string;
    value_exact_minor: number | null;
    decision_revision: number;
  }>(
    "select responsibility, decision_state, commercial_state, value_exact_minor, decision_revision from enquiry where id = $1",
    [enquiryId],
  );
  return rows.rows[0]!;
}

// ---------------------------------------------------------------------------
// CC1-04 - copying is not sending (C01-C06)
// ---------------------------------------------------------------------------

test("C01: preparing a review writes no outbound record and moves no responsibility", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const res = await prepare(pg, ids, DRAFT);
  assert.equal(res.ok, true);

  const after = await counts(pg, ids.enquiryId);
  assert.equal(after.messages, 0, "reviewing is not sending");
  assert.equal(after.quotes, 0);
  const state = await enquiryState(pg, ids.enquiryId);
  assert.equal(state.responsibility, "BUSINESS", "the ball stays with the business");
  assert.notEqual(state.decision_state, "WAITING_ON_CLIENT");
  assert.equal(state.commercial_state, "QUOTABLE", "not QUOTED - nothing was quoted to anyone");
});

test("C01: abandoning after review leaves the enquiry exactly as it was", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const before = await enquiryState(pg, ids.enquiryId);
  await prepare(pg, ids, DRAFT);
  // The owner closes the dialog. Nothing else happens.
  const after = await enquiryState(pg, ids.enquiryId);
  assert.deepEqual(after, before);
  assert.equal((await counts(pg, ids.enquiryId)).messages, 0);
});

test("C03: confirming records one owner-attested outbound message with a real sent_at", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  const res = await confirm(pg, ids, prepared.reviewedSendId);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.duplicate, false);
  assert.equal(res.stale, false);

  const after = await counts(pg, ids.enquiryId);
  assert.equal(after.messages, 1);
  assert.equal(after.sent, 1);
  assert.equal(after.quotes, 1);
  const state = await enquiryState(pg, ids.enquiryId);
  assert.equal(state.responsibility, "CUSTOMER");
  assert.equal(state.decision_state, "WAITING_ON_CLIENT");
  assert.equal(state.commercial_state, "QUOTED");
  assert.equal(state.value_exact_minor, 58_000);
});

test("C03: the audit line names the owner as the sender, never Enquiry", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  if (!prepared.ok) return;
  await confirm(pg, ids, prepared.reviewedSendId);

  const audit = await pg.query<{ summary: string; detail: string; actor: string }>(
    "select summary, detail, actor from audit_event where object_id = $1 order by at desc limit 1",
    [ids.enquiryId],
  );
  const row = audit.rows[0]!;
  assert.match(row.summary, /confirmed sent by the owner/);
  assert.equal(row.actor, USER);
  assert.doesNotMatch(row.summary, /Enquiry sent/);
  assert.match(row.detail, /Reviewed revision: 1/);
});

test("C04: confirming the same reviewed send twice records exactly one message and one quote", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  if (!prepared.ok) return;

  const first = await confirm(pg, ids, prepared.reviewedSendId);
  const second = await confirm(pg, ids, prepared.reviewedSendId);
  assert.equal(first.ok && first.duplicate, false);
  assert.equal(second.ok && second.duplicate, true);

  const after = await counts(pg, ids.enquiryId);
  assert.equal(after.messages, 1, "a retry is the same send, not a second one");
  assert.equal(after.quotes, 1);
});

test("C04: re-preparing the identical review returns the SAME artefact, so a refresh cannot double-send", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const a = await prepare(pg, ids, DRAFT);
  const b = await prepare(pg, ids, DRAFT);
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.equal(a.reviewedSendId, b.reviewedSendId);

  await confirm(pg, ids, a.reviewedSendId);
  // The owner refreshes, the dialog reopens, they confirm again.
  const c = await prepare(pg, ids, DRAFT);
  assert.equal(c.ok, true);
  if (!c.ok) return;
  assert.equal(c.alreadyConfirmed, true, "the artefact reports it is already on file");
  const again = await confirm(pg, ids, c.reviewedSendId);
  assert.equal(again.ok && again.duplicate, true);
  assert.equal((await counts(pg, ids.enquiryId)).messages, 1);
});

test("C04: trailing whitespace and line-ending differences are the same reviewed text", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const a = await prepare(pg, ids, DRAFT);
  const b = await prepare(pg, ids, `${DRAFT.replace(/\n/g, "\r\n")}   `);
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.equal(a.reviewedSendId, b.reviewedSendId);
});

test("C05: two genuinely different follow-ups are both recordable as distinct sends", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, { action: "FOLLOW_UP", price: null });
  const first = await prepare(pg, ids, "Just checking you saw this.");
  const second = await prepare(pg, ids, "Still happy to hold the date.");
  assert.equal(first.ok && second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.notEqual(first.reviewedSendId, second.reviewedSendId);

  await confirm(pg, ids, first.reviewedSendId);
  // Recording the first bumped the revision, so the second is now stale - the
  // owner attests they sent it too.
  const res = await confirm(pg, ids, second.reviewedSendId, true);
  assert.equal(res.ok, true);
  const after = await counts(pg, ids.enquiryId);
  assert.equal(after.messages, 2, "idempotency must not suppress a genuinely different message");
});

// ---------------------------------------------------------------------------
// CC1-05 - one commercial truth (P01-P05)
// ---------------------------------------------------------------------------

test("P01: a body naming a different amount is refused, not recorded with a warning", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const res = await prepare(pg, ids, "Hi Sarah,\n\nThat comes to $500.\n\nMina");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "amount_mismatch");

  // And nothing was written, so there is no inconsistent pair to find later.
  const after = await counts(pg, ids.enquiryId);
  assert.equal(after.messages, 0);
  assert.equal(after.quotes, 0);
  const rows = await pg.query("select 1 from reviewed_send where enquiry_id = $1", [ids.enquiryId]);
  assert.equal(rows.rows.length, 0);
});

test("P02: a tone-only edit is retained exactly, with the structured amount unchanged", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const edited = "Hi Sarah!\n\nLovely to hear from you. That comes to $580.\n\nWarmly,\nMina";
  const prepared = await prepare(pg, ids, edited);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  await confirm(pg, ids, prepared.reviewedSendId);

  const msg = await pg.query<{ body: string }>(
    "select body from message where enquiry_id = $1 and direction = 'outbound'",
    [ids.enquiryId],
  );
  assert.equal(msg.rows[0]!.body, edited, "the owner's own words are what gets recorded");
  const quote = await pg.query<{ total_minor: number }>(
    "select total_minor from quote_version where enquiry_id = $1",
    [ids.enquiryId],
  );
  assert.equal(quote.rows[0]!.total_minor, 58_000);
});

test("P02: a message naming no money at all is fine - only a disagreement is refused", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, { action: "REQUEST_INFORMATION", price: null });
  const res = await prepare(pg, ids, "Hi Sarah, how many people are we doing?");
  assert.equal(res.ok, true);
});

test("P01: money in the text with no structured amount behind it is refused", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, { action: "REQUEST_INFORMATION", price: null });
  const res = await prepare(pg, ids, "Hi Sarah, it will be about $400.");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "amount_mismatch");
});

test("P03: a review prepared before the facts changed cannot be confirmed as a new send", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  // Another session changes the quantity: the decision, and its revision, move.
  await pg.query(
    `update enquiry set decision_revision = decision_revision + 1,
       decision_snapshot = jsonb_set(decision_snapshot, '{price,amountMinor}', '72500')
     where id = $1`,
    [ids.enquiryId],
  );

  const res = await confirm(pg, ids, prepared.reviewedSendId);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "stale");
  assert.equal(res.reviewedRevision, 1);
  assert.equal(res.currentRevision, 2);
  assert.equal((await counts(pg, ids.enquiryId)).messages, 0);
});

test("P03: old text is NEVER paired with the new amount", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  if (!prepared.ok) return;
  await pg.query(
    `update enquiry set decision_revision = decision_revision + 1,
       decision_snapshot = jsonb_set(decision_snapshot, '{price,amountMinor}', '72500')
     where id = $1`,
    [ids.enquiryId],
  );

  // The owner says they already sent that older approved message.
  const res = await confirm(pg, ids, prepared.reviewedSendId, true);
  assert.equal(res.ok, true);
  const msg = await pg.query<{ body: string }>(
    "select body from message where enquiry_id = $1 and direction = 'outbound'",
    [ids.enquiryId],
  );
  const quote = await pg.query<{ total_minor: number; status: string }>(
    "select total_minor, status from quote_version where enquiry_id = $1",
    [ids.enquiryId],
  );
  assert.match(msg.rows[0]!.body, /\$580/);
  assert.equal(
    quote.rows[0]!.total_minor,
    58_000,
    "the recorded quote is the reviewed one, never the newer snapshot amount",
  );
});

test("P04: attesting to an already-sent older quote records history without advancing the newer decision", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  if (!prepared.ok) return;
  await pg.query(
    `update enquiry set decision_revision = decision_revision + 1,
       decision_snapshot = jsonb_set(decision_snapshot, '{price,amountMinor}', '72500'),
       commercial_state = 'QUOTABLE', responsibility = 'BUSINESS'
     where id = $1`,
    [ids.enquiryId],
  );

  const res = await confirm(pg, ids, prepared.reviewedSendId, true);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.stale, true);

  const state = await enquiryState(pg, ids.enquiryId);
  assert.equal(state.responsibility, "BUSINESS", "the newer decision is not advanced by old news");
  assert.equal(state.commercial_state, "QUOTABLE");
  assert.equal(state.value_exact_minor, null, "the newer enquiry value is untouched");

  // But the send itself is real and on file, flagged as what it is.
  assert.equal((await counts(pg, ids.enquiryId)).messages, 1);
  const quote = await pg.query<{ status: string }>(
    "select status from quote_version where enquiry_id = $1",
    [ids.enquiryId],
  );
  assert.equal(quote.rows[0]!.status, "superseded");
  const audit = await pg.query<{ summary: string; detail: string }>(
    "select summary, detail from audit_event where object_id = $1 order by at desc limit 1",
    [ids.enquiryId],
  );
  assert.match(audit.rows[0]!.summary, /after the enquiry moved on/);
  assert.match(audit.rows[0]!.detail, /left unchanged/);
});

test("P05: the recorded body and amount come from the server's artefact, not the caller", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  if (!prepared.ok) return;

  // The confirm call accepts no body, amount, recipient or channel at all -
  // there is no parameter through which a crafted client value could reach the
  // record. Proven by what lands: exactly what was frozen.
  await confirm(pg, ids, prepared.reviewedSendId);
  const msg = await pg.query<{ body: string; to_addr: string; channel: string }>(
    "select body, to_addr, channel from message where enquiry_id = $1 and direction = 'outbound'",
    [ids.enquiryId],
  );
  assert.equal(msg.rows[0]!.body, DRAFT);
  assert.equal(msg.rows[0]!.to_addr, "sarah@example.com");
  assert.equal(msg.rows[0]!.channel, "manual");
});

test("P05: a reviewed send belonging to another enquiry or tenant cannot be confirmed", async () => {
  const pg = await freshDb();
  const a = await seed(pg);
  const b = await seed(pg);
  const prepared = await prepare(pg, a, DRAFT);
  if (!prepared.ok) return;

  const wrongEnquiry = await confirm(pg, { ...a, enquiryId: b.enquiryId }, prepared.reviewedSendId);
  assert.equal(wrongEnquiry.ok, false);
  const wrongTenant = await confirm(pg, { ...a, businessId: b.businessId }, prepared.reviewedSendId);
  assert.equal(wrongTenant.ok, false);
  assert.equal((await counts(pg, a.enquiryId)).messages, 0);
  assert.equal((await counts(pg, b.enquiryId)).messages, 0);
});

test("A03/P05: a quote cannot be prepared when nobody has confirmed the service", async () => {
  const pg = await freshDb();
  // A legacy row: a nonblank service_label, no service fact behind it.
  const ids = await seed(pg, { confirmService: false });
  const res = await prepare(pg, ids, DRAFT);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "service_unconfirmed");
  assert.match(res.message, /Group makeup/);
});

// ---------------------------------------------------------------------------
// Preserved from the superseded sent-reply suite: the recipient is derived
// server-side from the enquiry's own contact fields, and is never invented.
// ---------------------------------------------------------------------------

const RECIPIENT_CASES: {
  name: string;
  seed: Seed;
  channel: Channel;
  expect: string;
}[] = [
  {
    name: "an email channel uses the enquiry's own email",
    seed: { customerEmail: "sarah@example.com" },
    channel: "email",
    expect: "sarah@example.com",
  },
  {
    name: "an sms channel with no phone on file resolves to empty, never a fabricated address",
    seed: { customerEmail: "sarah@example.com", customerPhone: null },
    channel: "sms",
    expect: "",
  },
  {
    name: "a manual send falls back to the email when only email is on file",
    seed: { customerEmail: "sarah@example.com" },
    channel: "manual",
    expect: "sarah@example.com",
  },
  {
    name: "a manual send falls back to the phone when only a phone is on file",
    seed: { customerEmail: "", customerPhone: "0400 000 000" },
    channel: "manual",
    expect: "0400 000 000",
  },
  {
    name: "a manual send falls back to the handle when only a handle is on file",
    seed: { customerEmail: "", customerPhone: null, customerHandle: "@sarah" },
    channel: "manual",
    expect: "@sarah",
  },
  {
    name: "a manual send with no contact at all resolves to empty, never invented",
    seed: { customerEmail: "", customerPhone: null, customerHandle: null },
    channel: "manual",
    expect: "",
  },
];

for (const c of RECIPIENT_CASES) {
  test(`recipient: ${c.name}`, async () => {
    const pg = await freshDb();
    const ids = await seed(pg, c.seed);
    const prepared = await prepare(pg, ids, DRAFT, c.channel);
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    assert.equal(prepared.recipient, c.expect);

    await confirm(pg, ids, prepared.reviewedSendId);
    const msg = await pg.query<{ to_addr: string }>(
      "select to_addr from message where enquiry_id = $1 and direction = 'outbound'",
      [ids.enquiryId],
    );
    assert.equal(msg.rows[0]!.to_addr, c.expect);
  });
}

test("a send with genuinely no recipient reads as its own clause, not 'to no recipient on file'", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, { customerEmail: "", customerPhone: null, customerHandle: null });
  const prepared = await prepare(pg, ids, DRAFT);
  if (!prepared.ok) return;
  await confirm(pg, ids, prepared.reviewedSendId);
  const audit = await pg.query<{ summary: string }>(
    "select summary from audit_event where object_id = $1 order by at desc limit 1",
    [ids.enquiryId],
  );
  assert.match(audit.rows[0]!.summary, /no recipient on file/);
  assert.doesNotMatch(audit.rows[0]!.summary, /to no recipient on file/);
});

// ---------------------------------------------------------------------------
// Preserved: quote versioning, non-quote sends, estimates.
// ---------------------------------------------------------------------------

test("a quote send writes exactly one quote_version row, version 1, with the right total", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  if (!prepared.ok) return;
  await confirm(pg, ids, prepared.reviewedSendId);
  const rows = await pg.query<{ version: number; status: string; total_minor: number }>(
    "select version, status, total_minor from quote_version where enquiry_id = $1",
    [ids.enquiryId],
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0]!.version, 1);
  assert.equal(rows.rows[0]!.status, "sent");
  assert.equal(rows.rows[0]!.total_minor, 58_000);
});

test("a second real send writes version 2, not a second version 1", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const first = await prepare(pg, ids, DRAFT);
  if (!first.ok) return;
  await confirm(pg, ids, first.reviewedSendId);

  // A revised quote at the same amount, reviewed afresh after the state moved.
  const second = await prepare(pg, ids, `${DRAFT}\n\nP.S. still $580.`);
  if (!second.ok) return;
  await confirm(pg, ids, second.reviewedSendId, true);

  const rows = await pg.query<{ version: number }>(
    "select version from quote_version where enquiry_id = $1 order by version",
    [ids.enquiryId],
  );
  assert.deepEqual(
    rows.rows.map((r) => r.version),
    [1, 2],
  );
});

test("a non-quote send writes no quote_version row at all", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, { action: "REQUEST_INFORMATION", price: null });
  const prepared = await prepare(pg, ids, "Hi Sarah, how many people?");
  if (!prepared.ok) return;
  await confirm(pg, ids, prepared.reviewedSendId);
  const after = await counts(pg, ids.enquiryId);
  assert.equal(after.messages, 1);
  assert.equal(after.quotes, 0);
  const state = await enquiryState(pg, ids.enquiryId);
  assert.notEqual(state.commercial_state, "QUOTED");
});

test("a SEND_ESTIMATE writes a range, not a total", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, {
    action: "SEND_ESTIMATE",
    price: { kind: "RANGE", minMinor: 40_000, maxMinor: 60_000, currency: "AUD" },
    draftBody: "Somewhere between $400 and $600.",
  });
  const prepared = await prepare(pg, ids, "Somewhere between $400 and $600.");
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  await confirm(pg, ids, prepared.reviewedSendId);

  const rows = await pg.query<{
    total_minor: number | null;
    range_min_minor: number | null;
    range_max_minor: number | null;
  }>(
    "select total_minor, range_min_minor, range_max_minor from quote_version where enquiry_id = $1",
    [ids.enquiryId],
  );
  assert.equal(rows.rows[0]!.total_minor, null);
  assert.equal(rows.rows[0]!.range_min_minor, 40_000);
  assert.equal(rows.rows[0]!.range_max_minor, 60_000);
  const state = await enquiryState(pg, ids.enquiryId);
  assert.equal(state.commercial_state, "ESTIMATED");
});

test("a duplicate confirmation writes no second audit row and no second quote", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  if (!prepared.ok) return;
  await confirm(pg, ids, prepared.reviewedSendId);
  await confirm(pg, ids, prepared.reviewedSendId);

  const audit = await pg.query<{ n: number }>(
    "select count(*)::int as n from audit_event where object_id = $1 and summary like '%confirmed sent%'",
    [ids.enquiryId],
  );
  assert.equal(audit.rows[0]!.n, 1);
  assert.equal((await counts(pg, ids.enquiryId)).quotes, 1);
});

// ---------------------------------------------------------------------------
// CC1-06 - consistent, atomic updates (T01-T05)
// ---------------------------------------------------------------------------

test("T03: a failure part-way through recording rolls the whole send back", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  if (!prepared.ok) return;

  // Fail after the message insert, before the audit row - the window that used
  // to be able to leave a sent message with no record of who sent it or why.
  await assert.rejects(
    inTransaction(pg, async (sql) => {
      const wrapped = ((async (strings: TemplateStringsArray, ...values: unknown[]) => {
        let text = strings[0] ?? "";
        for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
        if (text.includes("insert into audit_event")) throw new Error("injected failure");
        return (sql as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown[]>)(
          strings,
          ...values,
        );
      }) as never) as Sql;
      return confirmReviewedSendInTransaction(wrapped, {
        reviewedSendId: prepared.reviewedSendId,
        enquiryId: ids.enquiryId,
        businessId: ids.businessId,
        userId: USER,
      });
    }),
  );

  const after = await counts(pg, ids.enquiryId);
  assert.equal(after.messages, 0, "no orphan message survives a failed send");
  assert.equal(after.quotes, 0, "no orphan quote survives a failed send");
  const state = await enquiryState(pg, ids.enquiryId);
  assert.equal(state.responsibility, "BUSINESS", "responsibility did not move");

  // And the artefact is unconsumed, so the retry works.
  const retry = await confirm(pg, ids, prepared.reviewedSendId);
  assert.equal(retry.ok, true);
  assert.equal((await counts(pg, ids.enquiryId)).messages, 1);
});

test("T04: two concurrent confirmations of the same send record it once", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  if (!prepared.ok) return;

  const [a, b] = await Promise.all([
    confirm(pg, ids, prepared.reviewedSendId),
    confirm(pg, ids, prepared.reviewedSendId),
  ]);
  const duplicates = [a, b].filter((r) => r.ok && r.duplicate).length;
  assert.equal(duplicates, 1, "exactly one of the two is the duplicate");
  assert.equal((await counts(pg, ids.enquiryId)).messages, 1);
  assert.equal((await counts(pg, ids.enquiryId)).quotes, 1);
});

test("T05: a declined enquiry cannot be quietly re-quoted by an old preview", async () => {
  const pg = await freshDb();
  const ids = await seed(pg);
  const prepared = await prepare(pg, ids, DRAFT);
  if (!prepared.ok) return;

  await pg.query("update enquiry set lifecycle = 'DECLINED' where id = $1", [ids.enquiryId]);

  const res = await confirm(pg, ids, prepared.reviewedSendId);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "closed");
  assert.equal((await counts(pg, ids.enquiryId)).messages, 0);

  const state = await pg.query<{ lifecycle: string }>(
    "select lifecycle from enquiry where id = $1",
    [ids.enquiryId],
  );
  assert.equal(state.rows[0]!.lifecycle, "DECLINED", "a stale write must not reopen it");
});

test("T05: a closed enquiry cannot even have a new send prepared for it", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, { lifecycle: "DECLINED" });
  const res = await prepare(pg, ids, DRAFT);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "closed");
});
