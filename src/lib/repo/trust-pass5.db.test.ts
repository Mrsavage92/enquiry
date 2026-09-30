import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { saveBusinessRuleAndRedecide, saveBusinessRulesAndRedecide } from "./business-rule-core.ts";
import { answerFactForUser } from "./answer-fact-core.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import { ForbiddenError, requireBusinessAccess, requireEnquiryAccess } from "./tenancy.server.ts";
import {
  createPracticeEnquiryInTransaction,
  applyPracticeSampleInTransaction,
} from "./practice-core.ts";
import { describeRule, type BusinessRule } from "../../domain/business-rule.ts";
import { readPriceLine } from "../../domain/price-sentence.ts";
import { EXTRA_CHOICE } from "../../domain/extras.ts";
import type { BusinessDetail } from "../../domain/business-detail.ts";

/**
 * Pass 5, against a real database and always with two tenants: a total is
 * only ever named after the owner confirmed what it covers (enforced by the
 * server, not the screen), every repro from the review now ends in a true
 * reply, and every new or changed server path refuses another tenant and
 * lands nothing for them.
 */

const migrationsDir = join(process.cwd(), "migrations");
const FRI_25_SEP = new Date("2026-09-25T09:00:00+10:00");

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

function sqlFor(pg: PGlite): Sql {
  return toSql(
    async <R>(text: string, params: unknown[]) => (await pg.query<R>(text, params)).rows,
  );
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

async function tenant(pg: PGlite, userId: string, name: string, industry = "cleaning") {
  await pg.query("insert into app_user (id, email) values ($1, $2)", [userId, `${userId}@test`]);
  return tx(pg, (sql) => createWorkspaceInTransaction(sql, { ...PROFILE, industry, name, userId }));
}

function rule(line: string): BusinessRule {
  const read = readPriceLine(line);
  if (!("rule" in read)) throw new Error(`${line}: ${read.reason}`);
  return read.rule;
}

async function saveRule(pg: PGlite, businessId: string, line: string) {
  const r = rule(line);
  return tx(pg, (sql) =>
    saveBusinessRuleAndRedecide(sql, { businessId, rule: r, readable: describeRule(r) }),
  );
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
      now: FRI_25_SEP,
    }),
  );
}

type Snap = {
  recommendation: { action: string; label: string; reasonCodes: string[] };
  missing: { factField: string; inferred?: { value: string } }[];
  draft: { body: string };
  price?: { amountMinor: number };
  coverage?: {
    key: string;
    confirmed: boolean;
    lines: { label: string; amountMinor: number; quantity?: string }[];
    flagged: { text: string }[];
    recurring: boolean;
  };
  extraPending?: { field: string; label: string; kind: string };
  questionPending?: { field: string; thing: string; readAs?: string };
};

async function row(pg: PGlite, id: string) {
  const res = await pg.query<{
    decision_state: string;
    decision_revision: number;
    date_label: string | null;
    customer_name: string;
    decision_snapshot: Snap;
  }>("select * from enquiry where id = $1", [id]);
  return res.rows[0]!;
}

async function answer(pg: PGlite, userId: string, enquiryId: string, field: string, value: string) {
  return answerFactForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, { enquiryId, field, value });
}

async function confirmCoverage(pg: PGlite, userId: string, enquiryId: string) {
  const r = await row(pg, enquiryId);
  return confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, {
    enquiryId,
    key: r.decision_snapshot.coverage?.key ?? "",
    revision: Number(r.decision_revision),
  });
}

async function prepare(pg: PGlite, enquiryId: string, businessId: string, body: string) {
  return tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId,
      businessId,
      userId: "user-a",
      body,
      channel: "manual",
    }),
  );
}

/** Confirm every reading the decision is waiting on, the way the owner taps "Yes". */
async function confirmReadings(pg: PGlite, userId: string, enquiryId: string) {
  for (let i = 0; i < 6; i += 1) {
    const s = (await row(pg, enquiryId)).decision_snapshot;
    const reading = s.missing.find((m) => m.inferred);
    if (reading) {
      await answer(pg, userId, enquiryId, reading.factField, reading.inferred!.value);
      continue;
    }
    if (s.extraPending?.kind === "check") {
      await answer(pg, userId, enquiryId, s.extraPending.field, EXTRA_CHOICE.include);
      continue;
    }
    return;
  }
}

// Repro 1 (Raj): doors were saved flat and the total said $1,170 ------------

test("repro 1: 'Doors $90 each' is per door and the total covers 2 rooms, a ceiling and 3 doors: $1,350", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Ridge Painting", "painting");
  await saveRule(pg, a.businessId, "Interior painting $450 per room");
  await saveRule(pg, a.businessId, "Ceiling $180 per room");
  await saveRule(pg, a.businessId, "Doors $90 each");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, can you quote interior painting for 2 rooms, plus the ceiling in 1 room and 3 doors? Could you do Mon 14 Dec? Raj",
    "Interior painting",
  );
  await confirmReadings(pg, "user-a", e.enquiryId);
  const before = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(before.coverage?.confirmed, false);
  assert.deepEqual(
    before.coverage?.lines.map((l) => [l.label, l.quantity, l.amountMinor]),
    [
      ["Interior painting", "2 rooms", 90000],
      ["Ceiling", "1 room", 18000],
      ["Doors", "3 doors", 27000],
    ],
  );
  assert.doesNotMatch(before.draft.body, /\$/);
  const res = await confirmCoverage(pg, "user-a", e.enquiryId);
  assert.equal(res.ok && res.confirmed, true);
  const after = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(after.price?.amountMinor, 135000);
  assert.match(
    after.draft.body,
    /For the interior painting \(2 rooms\), the ceiling \(1 room\) and the doors \(3 doors\), that comes to \$1,350:/,
  );
  assert.doesNotMatch(after.draft.body, /all up|lock it in/i);
});

// Repro 2 (Paul): deck staining was dropped and the reply said "$1,740 all up"

test("repro 2: a service the reader missed is flagged, and the reply says the owner will come back on it", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Ridge Painting", "painting");
  await saveRule(pg, a.businessId, "Exterior painting 65 dollars an hour");
  await saveRule(pg, a.businessId, "Fence painting $35 per metre");
  const e = await enquiry(
    pg,
    a.businessId,
    "Looking to get the outside of the house repainted, and the fence (about 20 metres) as well as the deck, which needs staining. Mon 12 Oct would suit. Paul Nguyen, Nguyen Property Group",
    "Exterior painting",
  );
  const first = await row(pg, e.enquiryId);
  // Hours are the owner's estimate: never asked of the customer.
  assert.equal(first.decision_snapshot.missing[0]?.factField, "hours");
  assert.equal(first.decision_snapshot.recommendation.label, "Estimate the hours");
  assert.doesNotMatch(first.decision_snapshot.draft.body, /how many hours/i);
  await answer(pg, "user-a", e.enquiryId, "hours", "16");
  await confirmReadings(pg, "user-a", e.enquiryId);
  // The deck is read as something else they asked for, with no price: never
  // silently dropped from a total.
  const s = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(s.extraPending?.label, "deck staining");
  assert.equal(s.extraPending?.kind, "no_price");
  assert.equal(s.price, undefined);
  // The owner: "Tell them I'll come back on it".
  await answer(pg, "user-a", e.enquiryId, s.extraPending!.field, EXTRA_CHOICE.comeBack);
  // "repainted ... and the fence" did not name the saved fence price in full,
  // so the reader did not add it - but the coverage check flags it.
  const flagged = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(flagged.coverage?.confirmed, false);
  assert.ok(
    flagged.coverage?.flagged.some((f) => f.text === "They mention fence painting"),
    JSON.stringify(flagged.coverage?.flagged),
  );
  // "They asked for more" -> "Add a line" with the saved fence price.
  await answer(pg, "user-a", e.enquiryId, "extra:Fence painting", EXTRA_CHOICE.include);
  await confirmReadings(pg, "user-a", e.enquiryId);
  const c = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(c.coverage?.confirmed, false);
  assert.deepEqual(
    c.coverage?.lines.map((l) => [l.label, l.quantity, l.amountMinor]),
    [
      ["Exterior painting", "16 hours", 104000],
      ["Fence painting", "about 20 metres (please confirm)", 70000],
    ],
  );
  const res = await confirmCoverage(pg, "user-a", e.enquiryId);
  assert.equal(res.ok, true);
  const body = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.match(body, /I'll come back to you on the deck staining\./);
  assert.match(body, /that comes to about \$1,740, I'll confirm once I've seen the job:/);
  assert.doesNotMatch(body, /all up/);
});

// Repro 3 (Dave): "windows inside only" was saved as a price, the move-out day
// became the job date and the reply ended "Happy to lock it in".

test("repro 3: a conditional price is never on the total, and the day asked for is the one quoted", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Tidy Nest Cleaning");
  await saveRule(pg, a.businessId, "End of lease clean $190 per bedroom");
  await saveRule(pg, a.businessId, "Oven clean $95");
  assert.ok(!("rule" in readPriceLine("Windows inside only $8 per window")));
  await tx(pg, (sql) =>
    saveBusinessRulesAndRedecide(sql, {
      businessId: a.businessId,
      rules: [],
      details: [{ kind: "note", text: "Windows inside only $8 per window" }],
    }),
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "hey there!! got ur number from my neighbour. need an end of lease clean for a three bedroom townhouse in Chermside + oven + windows (about 12). we move out Mon 5 Oct and the inspection is Wed 7 Oct. can u do Sat 3rd?? cheers, Dave (landlord wants receipts)",
    "End of lease clean",
  );
  const r = await row(pg, e.enquiryId);
  assert.equal(r.date_label, "Sat 3 Oct", "the day asked for, not the move-out or inspection");
  await confirmReadings(pg, "user-a", e.enquiryId);
  const s = (await row(pg, e.enquiryId)).decision_snapshot;
  // Windows have no price: never silently on the total, never silently dropped.
  assert.equal(s.extraPending?.label, "windows");
  assert.equal(s.extraPending?.kind, "no_price");
  assert.equal(s.price, undefined);
  await answer(pg, "user-a", e.enquiryId, s.extraPending!.field, EXTRA_CHOICE.leaveOut);
  const c = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.ok(
    c.coverage?.flagged.some((f) => f.text === "Your note: Windows inside only $8 per window"),
  );
  await confirmCoverage(pg, "user-a", e.enquiryId);
  const body = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.match(
    body,
    /For the end of lease clean \(3 bedrooms\) and the oven clean, that comes to \$665:/,
  );
  assert.match(body, /I haven't included the windows in this price\./);
  // Every day they wrote is said truly: the job's day, what it comes before,
  // and the inspection as theirs - never a day the owner offers to work.
  assert.match(
    body,
    /You mentioned Saturday 3 October, before you move out on Monday 5 October - I'll confirm whether that works\./,
  );
  assert.match(body, /I understand the inspection is on Wednesday 7 October/);
  assert.doesNotMatch(body, /confirm whether Monday|confirm whether Wednesday/);
  assert.doesNotMatch(body, /lock it in|\$761/i);
});

// Repro 4 (Priya): a fortnightly clean was quoted "all up" -----------------

test("repro 4: a recurring job is quoted per visit, with the first-visit extra said separately", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Tidy Nest Cleaning");
  await saveRule(pg, a.businessId, "Regular clean $70 per bedroom");
  await saveRule(pg, a.businessId, "Oven clean $95");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hello! My name is Priya and I've just moved into a rental in Redbank Plains. We'd like a regular clean every fortnight for our 3 bedroom place, plus oven cleaning on the first visit please. Kind regards, Priya Sharma",
    "Regular clean",
  );
  await confirmReadings(pg, "user-a", e.enquiryId);
  const s = (await row(pg, e.enquiryId)).decision_snapshot;
  // How often is a reading the owner confirms, not a label.
  assert.equal(s.coverage?.recurring, false);
  assert.ok(
    s.coverage?.flagged.some((f) => f.text === "They want this every fortnight - correct?"),
  );
  const early = await confirmCoverage(pg, "user-a", e.enquiryId);
  assert.equal(early.ok, false, "an unsettled flag blocks the confirmation on the server");
  await answer(pg, "user-a", e.enquiryId, "recurring", "yes");
  const q = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(q.coverage?.recurring, true);
  await confirmCoverage(pg, "user-a", e.enquiryId);
  const after = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(after.price?.amountMinor, 21000);
  assert.match(after.draft.body, /that's \$210 per visit/);
  assert.match(after.draft.body, /The first visit adds \$95 for the oven clean\./);
  assert.doesNotMatch(after.draft.body, /all up|\$305/);
});

// The server enforces the gate, whatever the screen shows ---------------------

test("the server refuses a reply naming a total until coverage is confirmed for this revision", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Tidy Nest Cleaning");
  await saveRule(pg, a.businessId, "Oven clean $95");
  const e = await enquiry(pg, a.businessId, "Oven clean please. Jo", "Oven clean");
  const crafted = "Hi Jo,\n\nFor the oven clean, that comes to $95.\n\nThanks";
  const refused = await prepare(pg, e.enquiryId, a.businessId, crafted);
  assert.equal(refused.ok, false);
  assert.equal(!refused.ok && refused.reason, "coverage_unconfirmed");
  const none = await pg.query("select 1 from reviewed_send where enquiry_id = $1", [e.enquiryId]);
  assert.equal(none.rows.length, 0, "nothing frozen for review");

  // A confirmation for a revision the owner never saw is refused too.
  const r = await row(pg, e.enquiryId);
  const stale = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    enquiryId: e.enquiryId,
    key: r.decision_snapshot.coverage!.key,
    revision: Number(r.decision_revision) - 1,
  });
  assert.equal(stale.ok, false);
  assert.equal((await row(pg, e.enquiryId)).decision_revision, r.decision_revision);

  await confirmCoverage(pg, "user-a", e.enquiryId);
  const ok = await prepare(pg, e.enquiryId, a.businessId, crafted);
  assert.equal(ok.ok, true, JSON.stringify(ok));

  // A later fact change resets it: the same body is refused again.
  await answer(pg, "user-a", e.enquiryId, "extra:fridge clean", EXTRA_CHOICE.comeBack);
  const again = await prepare(pg, e.enquiryId, a.businessId, `${crafted}\n`);
  assert.equal(!again.ok && again.reason, "coverage_unconfirmed");
});

// Two tenants on every new or changed server path ----------------------------

test("confirming coverage for another tenant's enquiry is Forbidden and lands nothing", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  await tenant(pg, "user-b", "Bravo Cleaning");
  await saveRule(pg, a.businessId, "Oven clean $95");
  const e = await enquiry(pg, a.businessId, "Oven clean please", "Oven clean");
  const before = await row(pg, e.enquiryId);
  await assert.rejects(confirmCoverage(pg, "user-b", e.enquiryId), ForbiddenError);
  const after = await row(pg, e.enquiryId);
  assert.equal(after.decision_revision, before.decision_revision);
  assert.deepEqual(after.decision_snapshot, before.decision_snapshot);
  const facts = await pg.query(
    "select 1 from enquiry_fact where enquiry_id = $1 and field = 'coverage'",
    [e.enquiryId],
  );
  assert.equal(facts.rows.length, 0);
});

test("answering a question or 'come back on it' is tenant-scoped; reserved fields are refused", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  await tenant(pg, "user-b", "Bravo Cleaning");
  await saveRule(pg, a.businessId, "End of lease clean $190 per bedroom");
  await tx(pg, (sql) =>
    saveBusinessRulesAndRedecide(sql, {
      businessId: a.businessId,
      rules: [],
      details: [{ kind: "not_offered", service: "mould removal" }],
    }),
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "End of lease clean for a 2 bedroom unit. Do you do mould removal? Jo",
    "End of lease clean",
  );
  const s = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(s.questionPending?.thing, "mould removal");
  assert.equal(s.questionPending?.readAs, "no");
  assert.equal(s.recommendation.reasonCodes[0], "ANSWER_QUESTION");
  const before = await row(pg, e.enquiryId);
  await assert.rejects(
    answer(pg, "user-b", e.enquiryId, s.questionPending!.field, "no"),
    ForbiddenError,
  );
  await assert.rejects(
    answer(pg, "user-b", e.enquiryId, "extra:deck", EXTRA_CHOICE.comeBack),
    ForbiddenError,
  );
  const untouched = await row(pg, e.enquiryId);
  assert.equal(untouched.decision_revision, before.decision_revision);
  assert.deepEqual(untouched.decision_snapshot, before.decision_snapshot);
  // Reserved: no answer box may confirm coverage or plant a practice price.
  await assert.rejects(answer(pg, "user-a", e.enquiryId, "coverage", "anything"), /can't be set/);
  await assert.rejects(answer(pg, "user-a", e.enquiryId, "practice_price", "{}"), /can't be set/);
  await assert.rejects(
    answer(pg, "user-a", e.enquiryId, s.questionPending!.field, "maybe"),
    /yes or no/,
  );
  assert.equal((await row(pg, e.enquiryId)).decision_revision, before.decision_revision);

  await answer(pg, "user-a", e.enquiryId, s.questionPending!.field, "no");
  await confirmReadings(pg, "user-a", e.enquiryId);
  await confirmCoverage(pg, "user-a", e.enquiryId);
  assert.match(
    (await row(pg, e.enquiryId)).decision_snapshot.draft.body,
    /Sorry, I don't do mould removal\./,
  );
});

test("business details save for the owner's business only, and another tenant lands nothing", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  const b = await tenant(pg, "user-b", "Bravo Cleaning");
  await assert.rejects(requireBusinessAccess("user-b", a.businessId, sqlFor(pg)), ForbiddenError);
  const details: BusinessDetail[] = [
    { kind: "closed_days", days: [0] },
    { kind: "not_offered", service: "mould removal" },
    { kind: "note", text: "Travel fee $40 outside Brisbane northside" },
  ];
  const saved = await tx(pg, (sql) =>
    saveBusinessRulesAndRedecide(sql, { businessId: a.businessId, rules: [], details }),
  );
  assert.equal(saved.detailIds.length, 3);
  const again = await tx(pg, (sql) =>
    saveBusinessRulesAndRedecide(sql, { businessId: a.businessId, rules: [], details }),
  );
  assert.equal(again.detailIds.length, 0, "the same detail twice is one row");
  const bRows = await pg.query("select 1 from knowledge_item where business_id = $1", [
    b.businessId,
  ]);
  const aRows = await pg.query<{ section: string; body: string }>(
    "select section, body from knowledge_item where business_id = $1 order by section, body",
    [a.businessId],
  );
  assert.equal(bRows.rows.length, 0);
  assert.deepEqual(
    aRows.rows.map((r) => [r.section, r.body]),
    [
      ["capacity", "You don't work Sundays"],
      ["policy", "Travel fee $40 outside Brisbane northside"],
      ["service", "You don't offer mould removal"],
    ],
  );
});

test("a sample price is for the practice enquiry only, never a rule, never another tenant's", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  const b = await tenant(pg, "user-b", "Bravo Cleaning");
  const practice = await tx(pg, (sql) =>
    createPracticeEnquiryInTransaction(sql, { businessId: a.businessId, now: FRI_25_SEP }),
  );
  const real = await enquiry(pg, a.businessId, "End of lease clean please, 3 bedrooms. Jo");
  await assert.rejects(
    requireEnquiryAccess("user-b", practice.enquiryId, sqlFor(pg)),
    ForbiddenError,
  );
  const before = await row(pg, practice.enquiryId);
  const crossed = await tx(pg, (sql) =>
    applyPracticeSampleInTransaction(sql, {
      businessId: b.businessId,
      enquiryId: practice.enquiryId,
    }),
  );
  assert.equal(crossed.ok, false);
  const onReal = await tx(pg, (sql) =>
    applyPracticeSampleInTransaction(sql, { businessId: a.businessId, enquiryId: real.enquiryId }),
  );
  assert.equal(onReal.ok, false);
  const still = await row(pg, practice.enquiryId);
  assert.equal(still.decision_revision, before.decision_revision);
  assert.deepEqual(still.decision_snapshot, before.decision_snapshot);

  const used = await tx(pg, (sql) =>
    applyPracticeSampleInTransaction(sql, {
      businessId: a.businessId,
      enquiryId: practice.enquiryId,
    }),
  );
  assert.equal(used.ok, true);
  await confirmReadings(pg, "user-a", practice.enquiryId);
  await confirmCoverage(pg, "user-a", practice.enquiryId);
  const priced = (await row(pg, practice.enquiryId)).decision_snapshot;
  assert.equal(priced.price?.amountMinor, 57000, "3 bedrooms at the $190 sample");
  const rules = await pg.query("select 1 from knowledge_item where business_id = $1", [
    a.businessId,
  ]);
  assert.equal(rules.rows.length, 0, "the sample price never became a business rule");
  const realSnap = (await row(pg, real.enquiryId)).decision_snapshot;
  assert.equal(realSnap.price, undefined, "a real enquiry is never priced by it");
});
