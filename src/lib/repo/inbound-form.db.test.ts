import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { ForbiddenError } from "./tenancy.server.ts";
import { txRunner } from "./pglite-tx.ts";
import { nullInterpreter } from "../interpret/null-interpreter.ts";
import type { Sql } from "../db.ts";
import {
  IP_LIMIT_PER_HOUR,
  composeInboundBody,
  handleInboundForm,
  inboundKeyStatusForUser,
  normalizeOrigin,
  rotateInboundKeyForUser,
  setInboundOriginsForUser,
  type InboundDeps,
} from "./inbound-form-core.ts";

/**
 * The website form endpoint against a real database: two businesses, each
 * with its own key and allowed origins. What lands in the database is the
 * proof, not the status code alone.
 */

const migrationsDir = join(process.cwd(), "migrations");
const GLOSS = "https://www.glossbeauty.com.au";
const OTHER = "https://www.bravo-cleaning.example";

async function freshDb(t: { after: (fn: () => Promise<void>) => void }): Promise<PGlite> {
  const pg = new PGlite();
  await pg.waitReady;
  t.after(() => pg.close());
  for (const f of readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await pg.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  return pg;
}

function sqlFor(pg: PGlite): Sql {
  return (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return (await pg.query<T>(text, values)).rows;
  }) as never;
}

function depsFor(pg: PGlite): InboundDeps {
  return { sql: sqlFor(pg), runInTransaction: txRunner(pg), interpreter: nullInterpreter };
}

const PROFILE = {
  ownerFirstName: "Louise",
  industry: "beauty",
  baseLocation: "Sunshine Coast",
  timezone: "Australia/Brisbane",
  soloOrTeam: "solo" as const,
  currency: "AUD",
};

async function tenant(pg: PGlite, userId: string, name: string, origin: string) {
  await pg.query("insert into app_user (id, email) values ($1, $2)", [userId, `${userId}@test`]);
  const sql = sqlFor(pg);
  const { businessId } = await createWorkspaceInTransaction(sql, { ...PROFILE, name, userId });
  const { key } = await rotateInboundKeyForUser(sql, userId, businessId);
  await setInboundOriginsForUser(sql, userId, businessId, [origin]);
  return { businessId, key, userId };
}

let counter = 0;
function form(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    submissionId: `sub-${counter}-abcdefgh`,
    name: "Rachel Nguyen",
    email: "rachel@example.com",
    phone: "0400 000 000",
    service: "Bridal Makeup",
    eventDetails: "Date: Saturday 5 December 2026. Ready by 2pm. Party of 3.",
    message: "Hi Louise, I'd love bridal makeup for my wedding and two bridesmaids.",
    privacyConsent: true as const,
    honeypot: "",
    ...overrides,
  };
}

function post(
  body: unknown,
  opts: { key?: string; origin?: string | null; ip?: string } = {},
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.key) headers["X-Enquiry-Key"] = opts.key;
  if (opts.origin !== null) headers.Origin = opts.origin ?? GLOSS;
  headers["X-Real-IP"] = opts.ip ?? "203.0.113.7";
  return new Request("https://enquiry.test/api/inbound/form", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function counts(pg: PGlite, businessId: string) {
  const r = await pg.query<{ enquiries: number; submissions: number; messages: number }>(
    `select
       (select count(*)::int from enquiry where business_id = $1) as enquiries,
       (select count(*)::int from inbound_submission where business_id = $1) as submissions,
       (select count(*)::int from message m join enquiry e on e.id = m.enquiry_id
         where e.business_id = $1) as messages`,
    [businessId],
  );
  return r.rows[0]!;
}

async function totalEnquiries(pg: PGlite): Promise<number> {
  const r = await pg.query<{ n: number }>("select count(*)::int as n from enquiry");
  return r.rows[0]!.n;
}

test("an unknown key gets 401 and nothing is written", async (t) => {
  const pg = await freshDb(t);
  const gloss = await tenant(pg, "user-gloss", "Gloss Beauty", GLOSS);
  const deps = depsFor(pg);

  const forged = "enqin_" + "A".repeat(43);
  for (const req of [
    post(form(), { key: forged }),
    post(form(), { key: "not-a-key" }),
    post(form()),
    post({ ...form(), key: forged }),
  ]) {
    const res = await handleInboundForm(req, deps);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { ok: false });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  }
  assert.equal(await totalEnquiries(pg), 0);
  assert.deepEqual(await counts(pg, gloss.businessId), {
    enquiries: 0,
    submissions: 0,
    messages: 0,
  });
});

test("a valid key creates exactly one enquiry for the right business, decided on arrival", async (t) => {
  const pg = await freshDb(t);
  const gloss = await tenant(pg, "user-gloss", "Gloss Beauty", GLOSS);
  const other = await tenant(pg, "user-other", "Bravo Cleaning", OTHER);
  const deps = depsFor(pg);

  const payload = form();
  const res = await handleInboundForm(post(payload, { key: gloss.key }), deps);
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get("access-control-allow-origin"), GLOSS);

  assert.deepEqual(await counts(pg, gloss.businessId), {
    enquiries: 1,
    submissions: 1,
    messages: 1,
  });
  assert.equal((await counts(pg, other.businessId)).enquiries, 0);

  const e = await pg.query<{
    id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    source: string;
    service_label: string;
    decision_state: string;
    decision_snapshot: Record<string, unknown>;
    intake_note: string;
  }>("select * from enquiry where business_id = $1", [gloss.businessId]);
  const row = e.rows[0]!;
  assert.equal(row.customer_name, "Rachel Nguyen");
  assert.equal(row.customer_email, "rachel@example.com");
  assert.equal(row.customer_phone, "0400 000 000");
  assert.equal(row.source, "form");
  assert.equal(row.intake_note, "Sent from your website form");
  // The customer's pick is never recorded as the owner's confirmed service.
  const ownerService = await pg.query(
    "select 1 from enquiry_fact where enquiry_id = $1 and asserted_by = 'user'",
    [row.id],
  );
  assert.equal(ownerService.rows.length, 0);
  assert.notDeepEqual(row.decision_snapshot, {});

  const m = await pg.query<{ body: string; channel: string; intake: string }>(
    "select body, channel, intake from message where enquiry_id = $1",
    [row.id],
  );
  assert.equal(m.rows[0]!.body, composeInboundBody(payload));
  assert.match(m.rows[0]!.body, /Service: Bridal Makeup/);
  assert.match(m.rows[0]!.body, /Event details: Date: Saturday 5 December 2026/);
  assert.equal(m.rows[0]!.channel, "form");
  assert.equal(m.rows[0]!.intake, "channel");

  const audit = await pg.query<{ summary: string; actor: string }>(
    "select summary, actor from audit_event where business_id = $1 and object_id = $2",
    [gloss.businessId, row.id],
  );
  assert.ok(audit.rows.some((a) => a.summary === "Enquiry arrived from your website form"));
});

test("the website form decides an enquiry exactly as a pasted one does", async (t) => {
  const pg = await freshDb(t);
  const gloss = await tenant(pg, "user-gloss", "Gloss Beauty", GLOSS);
  const deps = depsFor(pg);
  const payload = form();
  await handleInboundForm(post(payload, { key: gloss.key }), deps);
  const pasted = await txRunner(pg)((tx) =>
    insertManualEnquiry(tx, {
      businessId: gloss.businessId,
      body: composeInboundBody(payload),
      customerName: payload.name,
      customerEmail: payload.email,
      customerPhone: payload.phone,
      serviceLabel: "",
      intakeNote: "",
    }),
  );
  const rows = await pg.query<{
    id: string;
    decision_state: string;
    commercial_state: string;
    date_label: string | null;
  }>(
    "select id, decision_state, commercial_state, date_label from enquiry where business_id = $1",
    [gloss.businessId],
  );
  const viaForm = rows.rows.find((r) => r.id !== pasted.enquiryId)!;
  const viaPaste = rows.rows.find((r) => r.id === pasted.enquiryId)!;
  assert.equal(viaForm.decision_state, viaPaste.decision_state);
  assert.equal(viaForm.commercial_state, viaPaste.commercial_state);
  assert.equal(viaForm.date_label, viaPaste.date_label);
  const facts = async (id: string) =>
    (
      await pg.query<{ field: string; value: string; status: string }>(
        "select field, value, status from enquiry_fact where enquiry_id = $1 order by field, value",
        [id],
      )
    ).rows;
  assert.deepEqual(await facts(viaForm.id), await facts(viaPaste.id));
});

test("a replayed submission id creates no duplicate, even when two copies race", async (t) => {
  const pg = await freshDb(t);
  const gloss = await tenant(pg, "user-gloss", "Gloss Beauty", GLOSS);
  const deps = depsFor(pg);
  const payload = form();

  const first = await handleInboundForm(post(payload, { key: gloss.key }), deps);
  const again = await handleInboundForm(post(payload, { key: gloss.key }), deps);
  assert.equal(first.status, 202);
  assert.equal(again.status, 202);
  assert.deepEqual(await again.json(), { ok: true });

  const raced = form();
  const results = await Promise.all([
    handleInboundForm(post(raced, { key: gloss.key }), deps),
    handleInboundForm(post(raced, { key: gloss.key }), deps),
    handleInboundForm(post(raced, { key: gloss.key }), deps),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [202, 202, 202],
  );
  assert.deepEqual(await counts(pg, gloss.businessId), {
    enquiries: 2,
    submissions: 2,
    messages: 2,
  });
});

test("the honeypot is rejected and nothing is written", async (t) => {
  const pg = await freshDb(t);
  const gloss = await tenant(pg, "user-gloss", "Gloss Beauty", GLOSS);
  const deps = depsFor(pg);
  for (const body of [form({ honeypot: "on" }), form({ honeypot: "x", email: "not-an-email" })]) {
    const res = await handleInboundForm(post(body, { key: gloss.key }), deps);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { ok: false });
  }
  assert.deepEqual(await counts(pg, gloss.businessId), {
    enquiries: 0,
    submissions: 0,
    messages: 0,
  });
});

test("an invalid payload is refused with no detail and nothing written", async (t) => {
  const pg = await freshDb(t);
  const gloss = await tenant(pg, "user-gloss", "Gloss Beauty", GLOSS);
  const deps = depsFor(pg);
  const bad = [
    form({ email: "rachel@" }),
    form({ message: "" }),
    form({ message: "x".repeat(4001) }),
    form({ name: "x".repeat(161) }),
    form({ submissionId: "short" }),
    form({ privacyConsent: false }),
    "{not json",
  ];
  for (const body of bad) {
    const res = await handleInboundForm(post(body, { key: gloss.key }), deps);
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
    assert.deepEqual(await res.json(), { ok: false });
  }
  const huge = await handleInboundForm(
    post(form({ eventDetails: "y".repeat(20_000) }), { key: gloss.key }),
    deps,
  );
  assert.equal(huge.status, 413);
  assert.equal((await counts(pg, gloss.businessId)).enquiries, 0);
});

test("two tenants: one business's key can never write into the other", async (t) => {
  const pg = await freshDb(t);
  const gloss = await tenant(pg, "user-gloss", "Gloss Beauty", GLOSS);
  const other = await tenant(pg, "user-other", "Bravo Cleaning", OTHER);
  const deps = depsFor(pg);

  // The other business's key, from its own site, lands only in its own business.
  const res = await handleInboundForm(post(form(), { key: other.key, origin: OTHER }), deps);
  assert.equal(res.status, 202);
  assert.equal((await counts(pg, other.businessId)).enquiries, 1);
  assert.equal((await counts(pg, gloss.businessId)).enquiries, 0);

  // Naming Gloss's business id anywhere in the body changes nothing.
  const smuggled = await handleInboundForm(
    post(
      { ...form(), businessId: gloss.businessId, business_id: gloss.businessId },
      { key: other.key, origin: OTHER },
    ),
    deps,
  );
  assert.equal(smuggled.status, 202);
  assert.equal((await counts(pg, gloss.businessId)).enquiries, 0);
  assert.equal((await counts(pg, other.businessId)).enquiries, 2);

  // The other key from Gloss's site is refused: Gloss's origin is not on its list.
  const crossOrigin = await handleInboundForm(
    post(form(), { key: other.key, origin: GLOSS }),
    deps,
  );
  assert.equal(crossOrigin.status, 403);
  assert.equal(crossOrigin.headers.get("access-control-allow-origin"), null);

  // Reusing a submission id Gloss already used is independent per business.
  const shared = form();
  await handleInboundForm(post(shared, { key: gloss.key }), deps);
  await handleInboundForm(post(shared, { key: other.key, origin: OTHER }), deps);
  assert.equal((await counts(pg, gloss.businessId)).enquiries, 1);
  assert.equal((await counts(pg, other.businessId)).enquiries, 3);

  // The owner functions refuse the other member, and change nothing.
  const before = await pg.query("select * from business_inbound where business_id = $1", [
    gloss.businessId,
  ]);
  const sql = sqlFor(pg);
  await assert.rejects(
    rotateInboundKeyForUser(sql, other.userId, gloss.businessId),
    (e) => e instanceof ForbiddenError,
  );
  await assert.rejects(
    setInboundOriginsForUser(sql, other.userId, gloss.businessId, [OTHER]),
    (e) => e instanceof ForbiddenError,
  );
  await assert.rejects(
    inboundKeyStatusForUser(sql, other.userId, gloss.businessId),
    (e) => e instanceof ForbiddenError,
  );
  const after = await pg.query("select * from business_inbound where business_id = $1", [
    gloss.businessId,
  ]);
  assert.deepEqual(after.rows, before.rows);
  const stillWorks = await handleInboundForm(post(form(), { key: gloss.key }), deps);
  assert.equal(stillWorks.status, 202);
});

test("CORS is answered from each business's own allowed origins", async (t) => {
  const pg = await freshDb(t);
  const gloss = await tenant(pg, "user-gloss", "Gloss Beauty", GLOSS);
  await setInboundOriginsForUser(sqlFor(pg), gloss.userId, gloss.businessId, [
    "https://glossbeauty.com.au/",
    "https://www.glossbeauty.com.au",
  ]);
  const deps = depsFor(pg);
  const preflight = (origin: string) =>
    handleInboundForm(
      new Request("https://enquiry.test/api/inbound/form", {
        method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
      }),
      deps,
    );
  for (const ok of ["https://glossbeauty.com.au", GLOSS]) {
    const res = await preflight(ok);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-origin"), ok);
    assert.match(res.headers.get("access-control-allow-headers") ?? "", /X-Enquiry-Key/);
  }
  const evil = await preflight("https://evil.example");
  assert.equal(evil.headers.get("access-control-allow-origin"), null);

  const refused = await handleInboundForm(
    post(form(), { key: gloss.key, origin: "https://evil.example" }),
    deps,
  );
  assert.equal(refused.status, 403);
  assert.equal((await counts(pg, gloss.businessId)).enquiries, 0);

  // A non-browser caller sends no Origin; the key alone authorises it.
  const server = await handleInboundForm(post(form(), { key: gloss.key, origin: null }), deps);
  assert.equal(server.status, 202);
});

test("rotating the key stops the old one at once and keeps the origins", async (t) => {
  const pg = await freshDb(t);
  const gloss = await tenant(pg, "user-gloss", "Gloss Beauty", GLOSS);
  const sql = sqlFor(pg);
  const deps = depsFor(pg);
  const rotated = await rotateInboundKeyForUser(sql, gloss.userId, gloss.businessId);
  assert.notEqual(rotated.key, gloss.key);
  assert.equal((await handleInboundForm(post(form(), { key: gloss.key }), deps)).status, 401);
  assert.equal((await handleInboundForm(post(form(), { key: rotated.key }), deps)).status, 202);

  const status = await inboundKeyStatusForUser(sql, gloss.userId, gloss.businessId);
  assert.equal(status.hasKey, true);
  assert.equal(status.keyHint, rotated.key.slice(-4));
  assert.deepEqual(status.allowedOrigins, [GLOSS]);

  // Only the hash is stored.
  const stored = await pg.query<{ key_hash: string }>(
    "select key_hash from business_inbound where business_id = $1",
    [gloss.businessId],
  );
  assert.notEqual(stored.rows[0]!.key_hash, rotated.key);
  assert.ok(!JSON.stringify(stored.rows).includes(rotated.key));
});

test("submissions are rate-limited per visitor and the in-memory limiter refuses first", async (t) => {
  const pg = await freshDb(t);
  const gloss = await tenant(pg, "user-gloss", "Gloss Beauty", GLOSS);
  const deps = depsFor(pg);
  for (let i = 0; i < IP_LIMIT_PER_HOUR; i += 1) {
    const res = await handleInboundForm(post(form(), { key: gloss.key, ip: "198.51.100.9" }), deps);
    assert.equal(res.status, 202);
  }
  const limited = await handleInboundForm(
    post(form(), { key: gloss.key, ip: "198.51.100.9" }),
    deps,
  );
  assert.equal(limited.status, 429);
  const otherVisitor = await handleInboundForm(
    post(form(), { key: gloss.key, ip: "198.51.100.10" }),
    deps,
  );
  assert.equal(otherVisitor.status, 202);
  assert.equal((await counts(pg, gloss.businessId)).enquiries, IP_LIMIT_PER_HOUR + 1);

  const blocked = await handleInboundForm(post(form(), { key: gloss.key }), {
    ...deps,
    allowIp: () => false,
  });
  assert.equal(blocked.status, 429);
});

test("origins are normalised and anything that is not a website is refused", async (t) => {
  assert.equal(normalizeOrigin("https://www.glossbeauty.com.au/"), GLOSS);
  assert.equal(normalizeOrigin(" https://glossbeauty.com.au "), "https://glossbeauty.com.au");
  assert.equal(normalizeOrigin("http://localhost:5173"), "http://localhost:5173");
  assert.equal(normalizeOrigin("http://glossbeauty.com.au"), null);
  assert.equal(normalizeOrigin("https://glossbeauty.com.au/contact"), null);
  assert.equal(normalizeOrigin("javascript:alert(1)"), null);
  assert.equal(normalizeOrigin("*"), null);

  const pg = await freshDb(t);
  const sql = sqlFor(pg);
  await pg.query("insert into app_user (id, email) values ('u1', 'u1@test')");
  const { businessId } = await createWorkspaceInTransaction(sql, {
    ...PROFILE,
    name: "No key yet",
    userId: "u1",
  });
  await assert.rejects(setInboundOriginsForUser(sql, "u1", businessId, [GLOSS]), /key first/);
  await rotateInboundKeyForUser(sql, "u1", businessId);
  await assert.rejects(setInboundOriginsForUser(sql, "u1", businessId, ["*"]), /not a website/);
});
