import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { verifyStripeSignature } from "./stripe-signature.ts";
import {
  applyFoundingEvent,
  foundingGateOn,
  isFoundingMember,
  readFoundingEvent,
} from "./founding.server.ts";

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

const SECRET = "whsec_test_secret";
function sign(body: string, t: number, secret = SECRET) {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

test("a Stripe signature is accepted only when genuine and fresh", () => {
  const body = JSON.stringify({ type: "checkout.session.completed" });
  const now = 1_790_000_000;
  assert.equal(verifyStripeSignature(body, sign(body, now), SECRET, now), true);
  assert.equal(verifyStripeSignature(body, sign(body, now, "wrong"), SECRET, now), false);
  assert.equal(verifyStripeSignature(`${body} `, sign(body, now), SECRET, now), false);
  assert.equal(verifyStripeSignature(body, sign(body, now - 301), SECRET, now), false, "replay");
  assert.equal(verifyStripeSignature(body, null, SECRET, now), false);
  assert.equal(verifyStripeSignature(body, sign(body, now), "", now), false, "no secret");
  assert.equal(verifyStripeSignature(body, "t=abc,v1=zz", SECRET, now), false);
});

test("only checkout completion and subscription changes are read", () => {
  const joined = readFoundingEvent({
    type: "checkout.session.completed",
    data: {
      object: {
        customer_details: { email: "  Owner@Example.COM " },
        customer: "cus_1",
        subscription: "sub_1",
      },
    },
  });
  assert.deepEqual(joined, {
    kind: "joined",
    email: "owner@example.com",
    customerId: "cus_1",
    subscriptionId: "sub_1",
  });
  assert.deepEqual(
    readFoundingEvent({ type: "customer.subscription.deleted", data: { object: { id: "sub_1" } } }),
    { kind: "status", subscriptionId: "sub_1", status: "cancelled" },
  );
  assert.equal(readFoundingEvent({ type: "invoice.paid", data: { object: {} } }).kind, "ignored");
  assert.equal(
    readFoundingEvent({ type: "checkout.session.completed", data: { object: {} } }).kind,
    "ignored",
    "no email, no member",
  );
});

test("paying makes a member, cancelling removes access, replays change nothing", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const paid = readFoundingEvent({
    type: "checkout.session.completed",
    data: {
      object: { customer_details: { email: "a@x.com" }, customer: "cus_a", subscription: "sub_a" },
    },
  });
  assert.equal(await isFoundingMember("a@x.com", sql), false);
  assert.equal(await applyFoundingEvent(paid, sql), "joined");
  assert.equal(await applyFoundingEvent(paid, sql), "joined", "Stripe retry");
  assert.equal(await isFoundingMember("A@X.com", sql), true);
  const n = await pg.query<{ n: number }>("select count(*)::int n from founding_member");
  assert.equal(n.rows[0]?.n, 1);

  await applyFoundingEvent({ kind: "status", subscriptionId: "sub_a", status: "past_due" }, sql);
  assert.equal(await isFoundingMember("a@x.com", sql), true, "a failed card keeps access");
  await applyFoundingEvent({ kind: "status", subscriptionId: "sub_a", status: "cancelled" }, sql);
  assert.equal(await isFoundingMember("a@x.com", sql), false);
  assert.equal(
    await applyFoundingEvent(
      { kind: "status", subscriptionId: "sub_unknown", status: "active" },
      sql,
    ),
    "ignored",
  );
});

test("the gate is off until the owner turns it on", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  assert.equal(await foundingGateOn(sql), false);
  await pg.query("insert into launch_settings (key, value) values ('founding_gate', 'on')");
  assert.equal(await foundingGateOn(sql), true);
});
