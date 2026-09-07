import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import { confirmReviewedSendInTransaction } from "./sent-reply-core.ts";
import { applyDecision, lockEnquiry } from "./decision-apply.ts";

/**
 * The end-to-end shape the CC1 suite was missing.
 *
 * Every other send test writes the message body by hand. That is exactly why
 * they stayed green while the product's OWN composed draft was refused by the
 * server on every per-unit quote: `composeReply` writes "That comes to $580.
 * 4 people at $145 each." and the consistency check compared every dollar
 * figure against the single structured total, so the unit rate looked like a
 * disagreement and the enquiry became unsendable.
 *
 * So this file never writes a body. It drives a real enquiry from
 * `insertManualEnquiry` through the decision, takes whatever draft the product
 * composed, and sends THAT. If the product cannot send its own words, these
 * fail.
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

const PER_PERSON = {
  kind: "per_unit",
  service: "Group makeup",
  amount: 145,
  currency: "AUD",
  unit: "person",
  quantityField: "guests",
};

const PER_PERSON_MIN_3 = { ...PER_PERSON, minimumQuantity: 3 };

const FIXED = {
  kind: "fixed_price",
  service: "Bridal makeup",
  amount: 190,
  currency: "AUD",
};

async function seed(pg: PGlite, rule: unknown, serviceLabel: string) {
  const biz = await pg.query<{ id: string }>(
    "insert into business (name, industry, owner_first_name) values ($1,$2,$3) returning id",
    ["Glow & Co", "beauty", "Mina"],
  );
  const businessId = biz.rows[0]!.id;
  await pg.query(
    `insert into knowledge_item (business_id, section, title, body, class, state, source, version, rule_payload)
     values ($1,'pricing',$2,'seeded','authoritative','Active','{}'::jsonb,'1',$3::jsonb)`,
    [businessId, (rule as { service: string }).service, JSON.stringify(rule)],
  );
  const { enquiryId } = await insertManualEnquiry(sqlFor(pg), {
    businessId,
    body: "Hi, after makeup for the wedding party.",
    customerName: "Sarah Shah",
    customerEmail: "sarah@example.com",
    customerPhone: "",
    serviceLabel,
    intakeNote: "",
  });
  return { businessId, enquiryId };
}

/** Answer the deciding fact exactly as `answerEnquiryFact` does. */
async function confirmFact(
  pg: PGlite,
  ids: { businessId: string; enquiryId: string },
  field: string,
  value: string,
) {
  return inTransaction(pg, async (tx) => {
    const locked = await lockEnquiry(tx, ids.enquiryId);
    if (!locked) throw new Error("missing");
    await tx`
      update enquiry_fact set superseded = true, updated_at = now()
      where enquiry_id = ${ids.enquiryId} and lower(field) = lower(${field}) and superseded = false
    `;
    await tx`
      insert into enquiry_fact
        (enquiry_id, field, label, value, display_value, status, confidence,
         asserted_by, provenance, customer_specific)
      values (
        ${ids.enquiryId}, ${field}, ${field}, ${value}, ${value}, ${"confirmed"},
        ${"High"}, ${"user"}, ${JSON.stringify({ kind: "user" })}::jsonb, ${true}
      )
    `;
    return applyDecision(tx, {
      enquiryId: ids.enquiryId,
      businessId: ids.businessId,
      serviceLabel: locked.serviceLabel,
      customerName: locked.customerName,
    });
  });
}

/** Whatever the product itself prepared. Never a body written by this test. */
async function preparedDraft(pg: PGlite, enquiryId: string): Promise<string> {
  const rows = await pg.query<{ body: string | null }>(
    "select decision_snapshot -> 'draft' ->> 'body' as body from enquiry where id = $1",
    [enquiryId],
  );
  return rows.rows[0]?.body ?? "";
}

test("Q05/C03: a per-unit quote can be sent using the draft the product itself composed", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, PER_PERSON, "Group makeup");
  await confirmFact(pg, ids, "guests", "4");

  const draft = await preparedDraft(pg, ids.enquiryId);
  // The shape that broke it: a total and a unit rate in one sentence.
  assert.match(draft, /\$580/, "the composed draft names the total");
  assert.match(draft, /\$145/, "and the unit rate, which is the whole point");

  const prepared = await inTransaction(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: ids.enquiryId,
      businessId: ids.businessId,
      userId: "user-1",
      body: draft,
      channel: "manual",
    }),
  );
  assert.equal(
    prepared.ok,
    true,
    `the product must be able to send its own unedited words: ${JSON.stringify(prepared)}`,
  );
  if (!prepared.ok) return;

  const res = await inTransaction(pg, (sql) =>
    confirmReviewedSendInTransaction(sql, {
      reviewedSendId: prepared.reviewedSendId,
      enquiryId: ids.enquiryId,
      businessId: ids.businessId,
      userId: "user-1",
    }),
  );
  assert.equal(res.ok, true);

  const quote = await pg.query<{ total_minor: number; status: string }>(
    "select total_minor, status from quote_version where enquiry_id = $1",
    [ids.enquiryId],
  );
  assert.equal(quote.rows[0]!.total_minor, 58_000, "recorded at the structured total, not the rate");
  assert.equal(quote.rows[0]!.status, "sent");
  const msg = await pg.query<{ body: string }>(
    "select body from message where enquiry_id = $1 and direction = 'outbound'",
    [ids.enquiryId],
  );
  assert.equal(msg.rows[0]!.body.trim(), draft.trim(), "recorded verbatim");
});

test("Q06/C03: a minimum-billed quote can be sent using its own composed draft", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, PER_PERSON_MIN_3, "Group makeup");
  await confirmFact(pg, ids, "guests", "2");

  const draft = await preparedDraft(pg, ids.enquiryId);
  // "2 people, billed at the 3 person minimum, at $145 each." beside a $435 total.
  assert.match(draft, /\$435/);
  assert.match(draft, /\$145/);

  const prepared = await inTransaction(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: ids.enquiryId,
      businessId: ids.businessId,
      userId: "user-1",
      body: draft,
      channel: "manual",
    }),
  );
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) return;
  assert.equal(prepared.amountMinor, 43_500);
});

test("C03: a fixed-price quote can be sent using its own composed draft", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, FIXED, "Bridal makeup");
  const draft = await preparedDraft(pg, ids.enquiryId);
  assert.match(draft, /\$190/);

  const prepared = await inTransaction(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: ids.enquiryId,
      businessId: ids.businessId,
      userId: "user-1",
      body: draft,
      channel: "manual",
    }),
  );
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
});

test("P01: editing the total in the composed draft is still refused", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, PER_PERSON, "Group makeup");
  await confirmFact(pg, ids, "guests", "4");
  const draft = await preparedDraft(pg, ids.enquiryId);

  const edited = draft.replace("$580", "$500");
  assert.match(edited, /\$500/);
  const prepared = await inTransaction(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: ids.enquiryId,
      businessId: ids.businessId,
      userId: "user-1",
      body: edited,
      channel: "manual",
    }),
  );
  assert.equal(prepared.ok, false, "an edited total must not become a recorded quote");
  if (prepared.ok) return;
  assert.equal(prepared.reason, "amount_mismatch");
});

test("P01: quietly replacing the total with the unit rate is refused too", async () => {
  // The subtle one: every figure left in the body is a figure the decision
  // implies, but the total the quote will be recorded at is no longer stated.
  const pg = await freshDb();
  const ids = await seed(pg, PER_PERSON, "Group makeup");
  await confirmFact(pg, ids, "guests", "4");
  const draft = await preparedDraft(pg, ids.enquiryId);

  const edited = draft.replace("$580", "$145");
  const prepared = await inTransaction(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: ids.enquiryId,
      businessId: ids.businessId,
      userId: "user-1",
      body: edited,
      channel: "manual",
    }),
  );
  assert.equal(prepared.ok, false, JSON.stringify(prepared));
});

test("P02: a tone-only edit around the composed figures still sends", async () => {
  const pg = await freshDb();
  const ids = await seed(pg, PER_PERSON, "Group makeup");
  await confirmFact(pg, ids, "guests", "4");
  const draft = await preparedDraft(pg, ids.enquiryId);

  const edited = `Hi Sarah!\n\nLovely to hear from you.\n\n${draft}\n\nWarmly, Mina`;
  const prepared = await inTransaction(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: ids.enquiryId,
      businessId: ids.businessId,
      userId: "user-1",
      body: edited,
      channel: "manual",
    }),
  );
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
});
