import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import { insertManualEnquiry, interpretAndApply } from "./manual-enquiry-core.ts";
import { saveBusinessRuleAndRedecide, saveBusinessRulesAndRedecide } from "./business-rule-core.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import { confirmReviewedSendInTransaction } from "./sent-reply-core.ts";
import { undoRecordedSendInTransaction, UNDO_SEND_WINDOW_MS } from "./undo-send-core.ts";
import {
  createPracticeEnquiryInTransaction,
  deletePracticeEnquiryInTransaction,
  isUniqueViolation,
} from "./practice-core.ts";
import { declineEnquiryInTransaction } from "./close-enquiry-core.ts";
import { applyDecision, lockEnquiry } from "./decision-apply.ts";
import { ForbiddenError, requireBusinessAccess, requireEnquiryAccess } from "./tenancy.server.ts";
import { describeRule, type BusinessRule } from "../../domain/business-rule.ts";

/**
 * The second attention pass against a real database, always with two tenants:
 * saving a price re-decides the owner's open enquiries (and only theirs), a
 * recorded send can be undone exactly (and only by its own business), and a
 * practice enquiry can never be sent and deletes cleanly.
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
  return (async <R>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<R>(text, values);
  }) as never;
}

async function tx<T>(pg: PGlite, fn: (sql: Sql) => Promise<T>): Promise<T> {
  return pg.transaction(async (t) =>
    fn(toSql(async <R>(text: string, params: unknown[]) => (await t.query<R>(text, params)).rows)),
  ) as Promise<T>;
}

const PROFILE = {
  ownerFirstName: "Dean",
  industry: "cleaning",
  baseLocation: "Brisbane",
  timezone: "Australia/Brisbane",
  soloOrTeam: "solo" as const,
  currency: "AUD",
};

const REPAINT: BusinessRule = {
  kind: "fixed_price",
  service: "Exterior repaint",
  amount: 5500,
  currency: "AUD",
};

async function tenant(pg: PGlite, userId: string, name: string) {
  await pg.query("insert into app_user (id, email) values ($1, $2)", [userId, `${userId}@test`]);
  return tx(pg, (sql) => createWorkspaceInTransaction(sql, { ...PROFILE, name, userId }));
}

async function enquiry(pg: PGlite, businessId: string, body: string, serviceLabel = "") {
  return tx(pg, (sql) =>
    insertManualEnquiry(sql, {
      businessId,
      body,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      serviceLabel,
      intakeNote: "",
      now: new Date("2026-09-25T09:00:00+10:00"),
    }),
  );
}

async function row(pg: PGlite, id: string) {
  const res = await pg.query<{
    decision_state: string;
    commercial_state: string;
    responsibility: string;
    value_exact_minor: string | null;
    decision_revision: number;
    decision_snapshot: {
      recommendation: { label: string; action: string; reasonCodes: string[] };
      draft: { body: string };
    };
    customer_name: string;
    date_label: string | null;
    practice: boolean;
  }>("select * from enquiry where id = $1", [id]);
  return res.rows[0];
}

async function saveRule(pg: PGlite, businessId: string, rule: BusinessRule) {
  return tx(pg, (sql) =>
    saveBusinessRuleAndRedecide(sql, { businessId, rule, readable: describeRule(rule) }),
  );
}

test("a new owner's enquiry points at their prices, and saving one updates it", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  const b = await tenant(pg, "user-b", "Bravo Painting");
  const aEnq = await enquiry(
    pg,
    a.businessId,
    "Outside repaint please. Thanks, Karen",
    "Exterior repaint",
  );
  const bEnq = await enquiry(
    pg,
    b.businessId,
    "Outside repaint please. Thanks, Bea",
    "Exterior repaint",
  );

  const before = await row(pg, aEnq.enquiryId);
  assert.equal(before?.decision_snapshot.recommendation.label, "Add your prices");
  assert.deepEqual(before?.decision_snapshot.recommendation.reasonCodes, ["ADD_PRICES"]);

  const saved = await saveRule(pg, a.businessId, REPAINT);
  assert.deepEqual(saved.updatedEnquiryIds, [aEnq.enquiryId]);

  const after = await row(pg, aEnq.enquiryId);
  assert.equal(after?.decision_snapshot.recommendation.action, "SEND_QUOTE");
  assert.equal(after?.decision_state, "ACTION_READY");
  assert.ok(Number(after?.decision_revision) > Number(before?.decision_revision));

  // B's enquiry is B's: A's price never reaches it.
  const other = await row(pg, bEnq.enquiryId);
  assert.equal(other?.decision_snapshot.recommendation.label, "Add your prices");

  // Saving the identical price again changes nothing and rewrites nothing.
  const again = await saveRule(pg, a.businessId, REPAINT);
  assert.equal(again.outcome, "duplicate");
  assert.deepEqual(again.updatedEnquiryIds, []);
});

test("an enquiry waiting on the customer is left exactly as it was sent", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  const e = await enquiry(pg, a.businessId, "Repaint please. Thanks, Karen", "Exterior repaint");
  await pg.query(
    "update enquiry set decision_state = 'WAITING_ON_CLIENT', responsibility = 'CUSTOMER' where id = $1",
    [e.enquiryId],
  );
  const before = await row(pg, e.enquiryId);
  await saveRule(pg, a.businessId, REPAINT);
  const after = await row(pg, e.enquiryId);
  assert.equal(after?.decision_state, "WAITING_ON_CLIENT");
  assert.equal(after?.decision_revision, before?.decision_revision);
});

test("the customer's name and job date are read from a pasted message", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi there, can I get a price for an end of lease clean? House in Kedron, moving out on the 10th of October. Tom",
  );
  const r = await row(pg, e.enquiryId);
  assert.equal(r?.customer_name, "Tom");
  assert.equal(r?.date_label, "Sat 10 Oct");
  const facts = await pg.query<{ value: string; status: string; asserted_by: string }>(
    "select value, status, asserted_by from enquiry_fact where enquiry_id = $1 and field = 'date'",
    [e.enquiryId],
  );
  assert.deepEqual(facts.rows, [
    { value: "2026-10-10", status: "inferred", asserted_by: "system" },
  ]);
});

async function sendAndRecord(pg: PGlite, businessId: string, enquiryId: string) {
  const current = await row(pg, enquiryId);
  const prepared = await tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId,
      businessId,
      userId: "user-a",
      body: current!.decision_snapshot.draft.body,
      channel: "manual",
    }),
  );
  assert.ok(prepared.ok, prepared.ok ? "" : prepared.message);
  if (!prepared.ok) throw new Error("not prepared");
  const recorded = await tx(pg, (sql) =>
    confirmReviewedSendInTransaction(sql, {
      reviewedSendId: prepared.reviewedSendId,
      enquiryId,
      businessId,
      userId: "user-a",
    }),
  );
  assert.ok(recorded.ok && recorded.messageId);
  if (!recorded.ok || !recorded.messageId) throw new Error("not recorded");
  return { reviewedSendId: prepared.reviewedSendId, messageId: recorded.messageId };
}

test("Undo takes a recorded send back exactly, and only for its own business", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  const b = await tenant(pg, "user-b", "Bravo Painting");
  await saveRule(pg, a.businessId, REPAINT);
  const e = await enquiry(pg, a.businessId, "Repaint please. Thanks, Karen", "Exterior repaint");
  const before = await row(pg, e.enquiryId);
  assert.equal(before?.decision_state, "ACTION_READY");

  const { reviewedSendId, messageId } = await sendAndRecord(pg, a.businessId, e.enquiryId);
  const sent = await row(pg, e.enquiryId);
  assert.equal(sent?.decision_state, "WAITING_ON_CLIENT");
  assert.equal(sent?.commercial_state, "QUOTED");
  assert.equal(Number(sent?.value_exact_minor), 550_000);

  // Tenant B cannot reach it through the boundary, and a call that claims B's
  // business changes nothing even with A's ids in hand.
  await assert.rejects(requireEnquiryAccess("user-b", e.enquiryId, toDirect(pg)), ForbiddenError);
  const crossed = await tx(pg, (sql) =>
    undoRecordedSendInTransaction(sql, {
      enquiryId: e.enquiryId,
      businessId: b.businessId,
      messageId,
      userId: "user-b",
    }),
  );
  assert.equal(crossed.ok, false);
  assert.equal((await row(pg, e.enquiryId))?.decision_state, "WAITING_ON_CLIENT");
  // Everything the send created is still there after the cross-tenant attempt.
  assert.equal((await pg.query("select 1 from message where id = $1", [messageId])).rows.length, 1);
  assert.equal(
    (await pg.query("select 1 from quote_version where reviewed_send_id = $1", [reviewedSendId]))
      .rows.length,
    1,
  );
  assert.equal(
    (
      await pg.query("select 1 from reviewed_send where id = $1 and consumed_at is not null", [
        reviewedSendId,
      ])
    ).rows.length,
    1,
  );

  const undone = await tx(pg, (sql) =>
    undoRecordedSendInTransaction(sql, {
      enquiryId: e.enquiryId,
      businessId: a.businessId,
      messageId,
      userId: "user-a",
    }),
  );
  assert.deepEqual(undone, { ok: true });

  const after = await row(pg, e.enquiryId);
  assert.equal(after?.decision_state, before?.decision_state);
  assert.equal(after?.commercial_state, before?.commercial_state);
  assert.equal(after?.responsibility, before?.responsibility);
  assert.equal(after?.value_exact_minor, null);
  const messages = await pg.query("select id from message where id = $1", [messageId]);
  assert.equal(messages.rows.length, 0, "the outbound message is gone");
  const quotes = await pg.query("select id from quote_version where reviewed_send_id = $1", [
    reviewedSendId,
  ]);
  assert.equal(quotes.rows.length, 0, "the quote recorded with it is gone");
  const artefact = await pg.query("select 1 from reviewed_send where id = $1", [reviewedSendId]);
  assert.equal(artefact.rows.length, 0, "the reviewed artefact goes with the send");

  // "The reply is ready to check again" has to be true: reviewing the same
  // text again and recording it works, and is not refused as stale.
  const again = await sendAndRecord(pg, a.businessId, e.enquiryId);
  assert.notEqual(again.reviewedSendId, reviewedSendId);
  assert.equal((await row(pg, e.enquiryId))?.decision_state, "WAITING_ON_CLIENT");
});

test("Undo is refused once anything moved the enquiry after the send", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await saveRule(pg, a.businessId, REPAINT);

  // Declined after the send: the decline stands and the send stays on record.
  const declined = await enquiry(
    pg,
    a.businessId,
    "Repaint please. Thanks, Karen",
    "Exterior repaint",
  );
  const first = await sendAndRecord(pg, a.businessId, declined.enquiryId);
  await tx(pg, (sql) =>
    declineEnquiryInTransaction(sql, {
      enquiryId: declined.enquiryId,
      businessId: a.businessId,
      userId: "user-a",
      reason: "",
    }),
  );
  const refused = await tx(pg, (sql) =>
    undoRecordedSendInTransaction(sql, {
      enquiryId: declined.enquiryId,
      businessId: a.businessId,
      messageId: first.messageId,
      userId: "user-a",
    }),
  );
  assert.equal(refused.ok, false);
  const after = await pg.query<{ lifecycle: string }>(
    "select lifecycle from enquiry where id = $1",
    [declined.enquiryId],
  );
  assert.equal(after.rows[0]?.lifecycle, "DECLINED");
  assert.equal(
    (await pg.query("select 1 from message where id = $1", [first.messageId])).rows.length,
    1,
  );

  // A detail answered after the send (the decision moved on): refused too.
  const answered = await enquiry(
    pg,
    a.businessId,
    "Repaint please. Thanks, Tom",
    "Exterior repaint",
  );
  const second = await sendAndRecord(pg, a.businessId, answered.enquiryId);
  await tx(pg, async (sql) => {
    await sql`
      insert into enquiry_fact (enquiry_id, field, label, value, display_value, status,
        confidence, asserted_by, provenance, customer_specific)
      values (${answered.enquiryId}, ${"storeys"}, ${"storeys"}, ${"2"}, ${"2"},
        ${"confirmed"}, ${"High"}, ${"user"}, ${"{}"}::jsonb, ${true})
    `;
    const locked = await lockEnquiry(sql, answered.enquiryId);
    await applyDecision(sql, {
      enquiryId: answered.enquiryId,
      businessId: a.businessId,
      serviceLabel: locked!.serviceLabel,
      customerName: locked!.customerName,
    });
  });
  const refusedToo = await tx(pg, (sql) =>
    undoRecordedSendInTransaction(sql, {
      enquiryId: answered.enquiryId,
      businessId: a.businessId,
      messageId: second.messageId,
      userId: "user-a",
    }),
  );
  assert.equal(refusedToo.ok, false);
  assert.equal(
    (await pg.query("select 1 from message where id = $1", [second.messageId])).rows.length,
    1,
  );
});

test("saving a price re-decides fifty open enquiries correctly in one go", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  const ids: string[] = [];
  for (let i = 0; i < 50; i += 1) {
    const e = await enquiry(
      pg,
      a.businessId,
      `Repaint number ${i}. Thanks, Karen`,
      "Exterior repaint",
    );
    ids.push(e.enquiryId);
  }
  const other = await enquiry(pg, a.businessId, "Garden job. Thanks, Sam", "Garden tidy");
  const saved = await saveRule(pg, a.businessId, REPAINT);
  assert.equal(
    saved.updatedEnquiryIds.length,
    51,
    "the garden job moves from no prices to no price for it",
  );
  for (const id of ids) {
    const r = await row(pg, id);
    assert.equal(r?.decision_snapshot.recommendation.action, "SEND_QUOTE");
  }
  const g = await row(pg, other.enquiryId);
  assert.equal(g?.decision_snapshot.recommendation.label, "Add a price for this job");
});

test("several prices from one preview save together, for the owner's business only", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  const b = await tenant(pg, "user-b", "Bravo Cleaning");
  const aEnq = await enquiry(pg, a.businessId, "Oven please. Thanks, Karen", "Oven clean");
  const bEnq = await enquiry(pg, b.businessId, "Oven please. Thanks, Bea", "Oven clean");
  // B's user cannot save into A's business at the boundary.
  await assert.rejects(requireBusinessAccess("user-b", a.businessId, toDirect(pg)), ForbiddenError);
  const oven: BusinessRule = {
    kind: "fixed_price",
    service: "Oven clean",
    amount: 80,
    currency: "AUD",
  };
  const lease: BusinessRule = {
    kind: "per_unit",
    service: "End of lease clean",
    amount: 190,
    currency: "AUD",
    unit: "bedroom",
    quantityField: "bedrooms",
  };
  const res = await tx(pg, (sql) =>
    saveBusinessRulesAndRedecide(sql, {
      businessId: a.businessId,
      rules: [oven, lease].map((rule) => ({ rule, readable: describeRule(rule) })),
    }),
  );
  assert.equal(res.saved.length, 2);
  assert.deepEqual(res.updatedEnquiryIds, [aEnq.enquiryId]);
  const active = await pg.query(
    "select 1 from knowledge_item where business_id = $1 and state = 'Active' and rule_payload is not null",
    [a.businessId],
  );
  assert.equal(active.rows.length, 2);
  const none = await pg.query(
    "select 1 from knowledge_item where business_id = $1 and rule_payload is not null",
    [b.businessId],
  );
  assert.equal(none.rows.length, 0);
  assert.equal(
    (await row(pg, bEnq.enquiryId))?.decision_snapshot.recommendation.label,
    "Add your prices",
  );

  // All or nothing: a failure part-way leaves no price saved.
  await assert.rejects(
    tx(pg, (sql) =>
      saveBusinessRulesAndRedecide(sql, {
        businessId: b.businessId,
        rules: [
          { rule: oven, readable: describeRule(oven) },
          { rule: { ...oven, service: null as unknown as string }, readable: "broken" },
        ],
      }),
    ),
  );
  const stillNone = await pg.query(
    "select 1 from knowledge_item where business_id = $1 and rule_payload is not null",
    [b.businessId],
  );
  assert.equal(stillNone.rows.length, 0);
});

test("Undo is refused once the window has passed", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await saveRule(pg, a.businessId, REPAINT);
  const e = await enquiry(pg, a.businessId, "Repaint please. Thanks, Karen", "Exterior repaint");
  const { messageId } = await sendAndRecord(pg, a.businessId, e.enquiryId);
  const late = await tx(pg, (sql) =>
    undoRecordedSendInTransaction(sql, {
      enquiryId: e.enquiryId,
      businessId: a.businessId,
      messageId,
      userId: "user-a",
      now: new Date(Date.now() + UNDO_SEND_WINDOW_MS + 60_000),
    }),
  );
  assert.equal(late.ok, false);
  assert.equal((await row(pg, e.enquiryId))?.decision_state, "WAITING_ON_CLIENT");
});

test("a practice enquiry is never sendable and deletes completely, only by its owner", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  const b = await tenant(pg, "user-b", "Bravo Cleaning");
  await requireBusinessAccess("user-a", a.businessId, toDirect(pg));
  const made = await tx(pg, (sql) =>
    createPracticeEnquiryInTransaction(sql, { businessId: a.businessId }),
  );
  const again = await tx(pg, (sql) =>
    createPracticeEnquiryInTransaction(sql, { businessId: a.businessId }),
  );
  assert.equal(again.enquiryId, made.enquiryId, "asking twice opens the same one");
  assert.equal((await row(pg, made.enquiryId))?.practice, true);

  const prepared = await tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: made.enquiryId,
      businessId: a.businessId,
      userId: "user-a",
      body: "Hi Sam, it is $190.",
      channel: "manual",
    }),
  );
  assert.equal(prepared.ok, false);
  assert.equal(prepared.ok ? "" : prepared.reason, "practice");

  // B cannot reach it, and claiming B's business deletes nothing.
  await assert.rejects(
    requireEnquiryAccess("user-b", made.enquiryId, toDirect(pg)),
    ForbiddenError,
  );
  const crossed = await tx(pg, (sql) =>
    deletePracticeEnquiryInTransaction(sql, {
      businessId: b.businessId,
      enquiryId: made.enquiryId,
    }),
  );
  assert.equal(crossed.ok, false);
  assert.equal((await row(pg, made.enquiryId))?.practice, true, "the practice row survives");
  // Nor can B's user create one in A's business.
  await assert.rejects(requireBusinessAccess("user-b", a.businessId, toDirect(pg)), ForbiddenError);
  // And the database holds one practice row per business, whatever a double click does.
  await assert.rejects(
    pg
      .query("update enquiry set practice = true where business_id = $1 and id <> $2", [
        a.businessId,
        made.enquiryId,
      ])
      .then(async () => {
        const extra = await enquiry(pg, a.businessId, "Second. Thanks, Jo");
        await pg.query("update enquiry set practice = true where id = $1", [extra.enquiryId]);
      }),
    (err: unknown) => isUniqueViolation(err),
  );

  // The practice path can never delete a real enquiry.
  const real = await enquiry(pg, a.businessId, "Real job. Thanks, Karen");
  const refused = await tx(pg, (sql) =>
    deletePracticeEnquiryInTransaction(sql, {
      businessId: a.businessId,
      enquiryId: real.enquiryId,
    }),
  );
  assert.equal(refused.ok, false);
  assert.ok(await row(pg, real.enquiryId));

  const gone = await tx(pg, (sql) =>
    deletePracticeEnquiryInTransaction(sql, {
      businessId: a.businessId,
      enquiryId: made.enquiryId,
    }),
  );
  assert.deepEqual(gone, { ok: true });
  for (const table of ["enquiry", "enquiry_fact", "message", "reviewed_send"]) {
    const column = table === "enquiry" ? "id" : "enquiry_id";
    const left = await pg.query(`select 1 from ${table} where ${column} = $1`, [made.enquiryId]);
    assert.equal(left.rows.length, 0, `${table} still holds the practice enquiry`);
  }
  const audit = await pg.query("select 1 from audit_event where object_id = $1", [made.enquiryId]);
  assert.equal(audit.rows.length, 0);
});

function toDirect(pg: PGlite): Sql {
  return toSql(
    async <R>(text: string, params: unknown[]) => (await pg.query<R>(text, params)).rows,
  );
}

test("a model reading the message can replace the rule-read job date without losing the read", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  const e = await enquiry(pg, a.businessId, "End of lease clean on the 10th of October. Tom");
  const outcome = await interpretAndApply(toDirect(pg), {
    enquiryId: e.enquiryId,
    businessId: a.businessId,
    messageId: e.messageId,
    rawMessage: "End of lease clean on the 10th of October. Tom",
    interpreter: {
      async interpret() {
        return {
          ok: true,
          model: "test-double",
          result: {
            serviceCandidate: null,
            facts: [
              {
                field: "date",
                value: "2026-10-10",
                displayValue: "Sat 10 Oct",
                confidence: "high",
                span: "the 10th of October",
              },
            ],
            ambiguities: [],
            candidateMissingFacts: [],
          },
        };
      },
    },
    runInTransaction: (fn) => tx(pg, fn),
  });
  assert.equal(outcome.ok, true);
  const live = await pg.query<{ status: string; provenance: { kind: string } }>(
    "select status, provenance from enquiry_fact where enquiry_id = $1 and field = 'date' and not superseded",
    [e.enquiryId],
  );
  assert.equal(live.rows.length, 1);
  assert.equal(live.rows[0]?.provenance.kind, "model");
});
