import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { saveBusinessRuleAndRedecide } from "./business-rule-core.ts";
import { answerFactForUser } from "./answer-fact-core.ts";
import { ForbiddenError } from "./tenancy.server.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import { describeRule, type BusinessRule } from "../../domain/business-rule.ts";

/**
 * Review pass 4 (36/52 on 84a0145), SERIOUS 1-4 and HIGH 5, against a real
 * database and always with two tenants: a past day is never rolled on to next
 * year, a day ruled out never becomes the job date, a second thing asked for
 * is never silently dropped from a total, a count belongs to the service it
 * was written beside, and a sign-off name and number are read as readings.
 */

const migrationsDir = join(process.cwd(), "migrations");
const SAT_26_SEP = new Date("2026-09-26T09:00:00+10:00");

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

const EOL: BusinessRule = {
  kind: "per_unit",
  service: "End of lease clean",
  amount: 190,
  currency: "AUD",
  unit: "bedroom",
  quantityField: "bedrooms",
};
const OVEN: BusinessRule = {
  kind: "fixed_price",
  service: "Oven clean",
  amount: 120,
  currency: "AUD",
};
const WALLS: BusinessRule = {
  kind: "per_unit",
  service: "Interior wall painting",
  amount: 28,
  currency: "AUD",
  unit: "square metre",
  quantityField: "square metres",
};
const CEILINGS: BusinessRule = {
  kind: "per_unit",
  service: "Ceilings",
  amount: 22,
  currency: "AUD",
  unit: "square metre",
  quantityField: "square metres",
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
      now: SAT_26_SEP,
    }),
  );
}

async function saveRule(pg: PGlite, businessId: string, rule: BusinessRule) {
  return tx(pg, (sql) =>
    saveBusinessRuleAndRedecide(sql, { businessId, rule, readable: describeRule(rule) }),
  );
}

async function answer(pg: PGlite, userId: string, enquiryId: string, field: string, value: string) {
  return answerFactForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, { enquiryId, field, value });
}

type Snap = {
  recommendation: { label: string; action: string; primaryEnabled: boolean };
  missing: { factField: string; inferred?: { value: string; display: string } }[];
  draft: { body: string };
  price?: { amountMinor: number; lines?: { label: string; amountMinor: number }[] };
  extraPending?: { field: string; label: string; kind: string; amountMinor?: number };
};

async function row(pg: PGlite, id: string) {
  const res = await pg.query<{
    decision_state: string;
    decision_snapshot: Snap;
    customer_name: string;
    date_label: string | null;
  }>("select * from enquiry where id = $1", [id]);
  return res.rows[0]!;
}

async function live(pg: PGlite, id: string, field: string) {
  const res = await pg.query<{ value: string; status: string; display_value: string }>(
    "select value, status, display_value from enquiry_fact where enquiry_id = $1 and field = $2 and superseded = false",
    [id, field],
  );
  return res.rows[0];
}

const BREE =
  "Hi, oven clean for my unit please. I needed it done by last Tuesday 22 September - the agent is chasing me. Can you still do it asap?? Bree";

test("SERIOUS 1: a past day is not the job date, is never echoed, and 'asap' is the request", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  await saveRule(pg, a.businessId, OVEN);
  const bree = await enquiry(pg, a.businessId, BREE, "Oven clean");
  const r = await row(pg, bree.enquiryId);
  assert.equal(r.date_label, "ASAP", "no 'Wed 22 Sep' on the row or the header");
  const date = await live(pg, bree.enquiryId, "date");
  assert.equal(date?.value, "asap");
  assert.equal(date?.status, "inferred");
  assert.match(date?.display_value ?? "", /last Tuesday 22 September.*already passed/);
  const body = r.decision_snapshot.draft.body;
  assert.doesNotMatch(body, /22 September|Wednesday|2027/);
  assert.match(body, /I'll let you know the soonest day I can do it\./);
  assert.match(body, /\$120/);
});

test("SERIOUS 1: a weekday that disagrees with its date is flagged, and no date goes in the reply", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  await saveRule(pg, a.businessId, OVEN);
  const e = await enquiry(
    pg,
    a.businessId,
    "Oven clean please. Can you do Wednesday 8 October? - Sam",
    "Oven clean",
  );
  const r = await row(pg, e.enquiryId);
  assert.equal(r.date_label, null);
  const date = await live(pg, e.enquiryId, "date");
  assert.equal(date?.status, "conflict");
  assert.equal(date?.display_value, "They wrote Wednesday 8 October - that date is a Thursday.");
  assert.doesNotMatch(r.decision_snapshot.draft.body, /October|Wednesday|Thursday/);
});

test("SERIOUS 2: a day ruled out never becomes the job date and is recorded as not available", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  await saveRule(pg, a.businessId, OVEN);
  const e = await enquiry(
    pg,
    a.businessId,
    "Oven clean please, any day except Monday 5 October - that day is no good. Jo",
    "Oven clean",
  );
  const r = await row(pg, e.enquiryId);
  assert.equal(r.date_label, null, "never on the row or the quote sheet");
  assert.equal(await live(pg, e.enquiryId, "date"), undefined);
  const out = await live(pg, e.enquiryId, "not_available");
  assert.equal(out?.display_value, "Mon 5 Oct");
  assert.equal(out?.status, "inferred");
  assert.doesNotMatch(r.decision_snapshot.draft.body, /5 October|Monday/);
});

const MEL =
  "Hi, need an end of lease clean for a four bedroom house in Chermside, plus oven please. Keys go back Friday 2 October.\n\ncheers\n\nMel Tran\n0412 555 019";

test("SERIOUS 3 + HIGH 5: the oven is never dropped from the total; the sign-off gives the name and number", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  const b = await tenant(pg, "user-b", "Bravo Cleaning");
  await saveRule(pg, a.businessId, EOL);
  await saveRule(pg, b.businessId, EOL);
  const mel = await enquiry(pg, a.businessId, MEL, "End of lease clean");
  const other = await enquiry(pg, b.businessId, MEL, "End of lease clean");

  const first = await row(pg, mel.enquiryId);
  assert.equal(first.customer_name, "Mel Tran");
  assert.equal((await live(pg, mel.enquiryId, "name"))?.status, "inferred");
  const phone = await live(pg, mel.enquiryId, "phone");
  assert.equal(phone?.value, "0412 555 019");
  assert.equal(phone?.status, "inferred", "the owner checks it before using it");
  assert.equal((await live(pg, mel.enquiryId, "extra:oven cleaning"))?.status, "inferred");

  // The owner checks the bedrooms: the clean is priced, but the oven has no
  // price, so no total is prepared and nothing can be sent.
  await answer(pg, "user-a", mel.enquiryId, "bedrooms", "four");
  const noPrice = await row(pg, mel.enquiryId);
  assert.equal(noPrice.decision_snapshot.extraPending?.kind, "no_price");
  assert.equal(noPrice.decision_snapshot.price, undefined);
  assert.equal(noPrice.decision_snapshot.recommendation.label, "Add a price for oven cleaning");
  const refused = await tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: mel.enquiryId,
      businessId: a.businessId,
      userId: "user-a",
      body: noPrice.decision_snapshot.draft.body,
      channel: "manual",
    }),
  );
  assert.equal(refused.ok, false);

  // Another tenant cannot settle A's extra: refused, and nothing lands.
  await assert.rejects(
    answer(pg, "user-b", mel.enquiryId, "extra:oven cleaning", "leave_out"),
    ForbiddenError,
  );
  assert.equal((await live(pg, mel.enquiryId, "extra:oven cleaning"))?.status, "inferred");

  // A price for the oven arrives: the extra is priced but still the owner's call.
  await saveRule(pg, a.businessId, OVEN);
  const check = await row(pg, mel.enquiryId);
  assert.equal(check.decision_snapshot.extraPending?.kind, "check");
  assert.equal(check.decision_snapshot.extraPending?.amountMinor, 12000);
  assert.equal(check.decision_snapshot.extraPending?.field, "extra:oven cleaning");

  await answer(pg, "user-a", mel.enquiryId, "extra:oven cleaning", "include");
  const priced = await row(pg, mel.enquiryId);
  assert.equal(priced.decision_state, "ACTION_READY");
  assert.equal(priced.decision_snapshot.price?.amountMinor, 88000);
  assert.deepEqual(
    priced.decision_snapshot.price?.lines?.map((l) => l.amountMinor),
    [76000, 12000],
  );
  const reviewed = await tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId: mel.enquiryId,
      businessId: a.businessId,
      userId: "user-a",
      body: priced.decision_snapshot.draft.body,
      channel: "manual",
    }),
  );
  assert.equal(reviewed.ok, true, "the prepared $880 reply passes the amount check");

  // B's identical enquiry never saw A's oven price or A's answers.
  const untouched = await row(pg, other.enquiryId);
  assert.notEqual(untouched.decision_state, "ACTION_READY");
  assert.equal(untouched.decision_snapshot.extraPending, undefined);
});

test("SERIOUS 3: leaving the extra out puts an honest line in the reply", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  await saveRule(pg, a.businessId, EOL);
  const mel = await enquiry(pg, a.businessId, MEL, "End of lease clean");
  await answer(pg, "user-a", mel.enquiryId, "bedrooms", "4");
  await answer(pg, "user-a", mel.enquiryId, "extra:oven cleaning", "leave_out");
  const r = await row(pg, mel.enquiryId);
  assert.equal(r.decision_state, "ACTION_READY");
  assert.equal(r.decision_snapshot.price?.amountMinor, 76000);
  assert.match(r.decision_snapshot.draft.body, /I haven't included oven cleaning in this price\./);
  await assert.rejects(
    answer(pg, "user-a", mel.enquiryId, "extra:oven cleaning", "maybe"),
    /add it to the quote or leave it out/,
  );
});

const PAINT =
  "Hi, we need the inside done - one hundred and twenty square metres of wall, plus the ceilings in the lounge, about 45 sqm. Thanks, Karen";

test("SERIOUS 4: each count belongs to its own service, and both get a line", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Painting");
  await saveRule(pg, a.businessId, WALLS);
  await saveRule(pg, a.businessId, CEILINGS);
  const k = await enquiry(pg, a.businessId, PAINT, "Interior wall painting");
  const walls = await live(pg, k.enquiryId, "square metres");
  assert.equal(walls?.value, "120", "never the ceilings' 45");
  assert.equal(walls?.display_value, "one hundred and twenty square metres");
  assert.equal((await live(pg, k.enquiryId, "extra:Ceilings"))?.status, "inferred");

  await answer(pg, "user-a", k.enquiryId, "square metres", "120");
  const extra = await row(pg, k.enquiryId);
  assert.equal(extra.decision_snapshot.extraPending?.label, "Ceilings");
  await answer(pg, "user-a", k.enquiryId, "extra:Ceilings", "include");
  const ceilings = await row(pg, k.enquiryId);
  assert.equal(ceilings.decision_snapshot.missing[0]?.factField, "square metres for ceilings");
  assert.equal(ceilings.decision_snapshot.missing[0]?.inferred?.value, "45");
  await answer(pg, "user-a", k.enquiryId, "square metres for ceilings", "45");
  const done = await row(pg, k.enquiryId);
  assert.equal(done.decision_state, "ACTION_READY");
  assert.equal(done.decision_snapshot.price?.amountMinor, 120 * 2800 + 45 * 2200);
});

test("HIGH 9: a written answer is stored as digits; another tenant's answer is Forbidden and lands nothing", async () => {
  const pg = await freshDb();
  const a = await tenant(pg, "user-a", "Alpha Cleaning");
  await tenant(pg, "user-b", "Bravo Cleaning");
  await saveRule(pg, a.businessId, EOL);
  const e = await enquiry(
    pg,
    a.businessId,
    "End of lease clean please, how much? Jo",
    "End of lease clean",
  );
  await assert.rejects(answer(pg, "user-b", e.enquiryId, "bedrooms", "3"), ForbiddenError);
  assert.equal(await live(pg, e.enquiryId, "bedrooms"), undefined);
  const res = await answer(pg, "user-a", e.enquiryId, "bedrooms", "three");
  assert.equal(res.value, "3");
  assert.equal((await live(pg, e.enquiryId, "bedrooms"))?.value, "3");
  assert.equal((await row(pg, e.enquiryId)).decision_snapshot.price?.amountMinor, 57000);
});
