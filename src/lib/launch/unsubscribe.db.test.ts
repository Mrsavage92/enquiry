import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { openUnsubscribeToken, sealUnsubscribeToken } from "./unsubscribe-token.ts";
import {
  resetUnsubscribeSecretCache,
  unsubscribeByToken,
  unsubscribeLinks,
  unsubscribeSecret,
} from "./unsubscribe.server.ts";
import { joinWaitlistRow, type JoinWaitlistInput } from "./waitlist.server.ts";

const SECRET = "test-secret-0123456789abcdef";
const ID = "3f0c9c3e-6a4f-4d55-9a53-1f7b2b6f6c10";
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

function input(email: string): JoinWaitlistInput {
  return {
    email,
    existingId: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    referrer: "",
    linkedin_post_id: "",
    first_touch: "",
    latest_touch: "",
  };
}

function flipChar(token: string, index: number): string {
  const c = token[index];
  return `${token.slice(0, index)}${c === "A" ? "B" : "A"}${token.slice(index + 1)}`;
}

test("a sealed token opens to its waitlist id and hides it", () => {
  const token = sealUnsubscribeToken(ID, SECRET);
  assert.equal(openUnsubscribeToken(token, SECRET), ID);
  assert.ok(!token.includes(ID), "the row id is not readable in the token");
  assert.match(token, /^[A-Za-z0-9_-]+$/, "safe to put in a URL");
  assert.notEqual(sealUnsubscribeToken(ID, SECRET), token, "each seal is unique");
});

test("forged, tampered, truncated or foreign tokens never open", () => {
  const token = sealUnsubscribeToken(ID, SECRET);
  assert.equal(openUnsubscribeToken(token, "another-secret"), null, "other secret");
  assert.equal(openUnsubscribeToken(token, ""), null, "no secret");
  for (const index of [0, 13, Math.floor(token.length / 2), token.length - 1]) {
    assert.equal(openUnsubscribeToken(flipChar(token, index), SECRET), null, `byte ${index}`);
  }
  assert.equal(openUnsubscribeToken(token.slice(0, -4), SECRET), null, "truncated");
  assert.equal(openUnsubscribeToken("", SECRET), null, "empty");
  assert.equal(openUnsubscribeToken(ID, SECRET), null, "a bare id is not a token");
  assert.equal(openUnsubscribeToken("a@x.com", SECRET), null, "an email is not a token");
  assert.equal(openUnsubscribeToken(Buffer.from(ID).toString("base64url"), SECRET), null);
  assert.equal(openUnsubscribeToken("x".repeat(500), SECRET), null, "oversized");
});

test("sealing refuses a missing secret or a non-id", () => {
  assert.throws(() => sealUnsubscribeToken(ID, ""));
  assert.throws(() => sealUnsubscribeToken("a@x.com", SECRET));
});

test("the secret is created once in launch_settings and then reused", async () => {
  const previous = process.env.WAITLIST_UNSUBSCRIBE_SECRET;
  delete process.env.WAITLIST_UNSUBSCRIBE_SECRET;
  resetUnsubscribeSecretCache();
  try {
    const pg = await freshDb();
    const sql = sqlFor(pg);
    const first = await unsubscribeSecret(sql);
    const second = await unsubscribeSecret(sql);
    assert.equal(first.length, 64);
    assert.equal(first, second);
    const rows = await pg.query("select key from launch_settings where key = 'waitlist_unsubscribe_secret'");
    assert.equal(rows.rows.length, 1);
  } finally {
    resetUnsubscribeSecretCache();
    if (previous !== undefined) process.env.WAITLIST_UNSUBSCRIBE_SECRET = previous;
  }
});

test("an existing secret is read, not replaced, and then served from cache", async () => {
  const previous = process.env.WAITLIST_UNSUBSCRIBE_SECRET;
  delete process.env.WAITLIST_UNSUBSCRIBE_SECRET;
  resetUnsubscribeSecretCache();
  try {
    const pg = await freshDb();
    await pg.query(
      "insert into launch_settings (key, value) values ('waitlist_unsubscribe_secret', 'seeded')",
    );
    let queries = 0;
    const base = sqlFor(pg) as unknown as (s: TemplateStringsArray, ...v: unknown[]) => unknown;
    const counting = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      queries += 1;
      return base(strings, ...values);
    }) as never;
    assert.equal(await unsubscribeSecret(counting), "seeded");
    assert.equal(queries, 1, "one read, no insert");
    assert.equal(await unsubscribeSecret(counting), "seeded");
    assert.equal(queries, 1, "the second call is served from cache even with db passed");
  } finally {
    resetUnsubscribeSecretCache();
    if (previous !== undefined) process.env.WAITLIST_UNSUBSCRIBE_SECRET = previous;
  }
});

test("an unsubscribe link deletes exactly its own row, without signing in", async () => {
  resetUnsubscribeSecretCache();
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const mine = await joinWaitlistRow(input("mine@x.com"), sql);
  const other = await joinWaitlistRow(input("other@x.com"), sql);
  const links = await unsubscribeLinks(mine.id, "https://site.test", sql);
  assert.ok(links);
  assert.ok(!links.page.includes("mine@x.com"));
  const token = decodeURIComponent(new URL(links.page).searchParams.get("t") ?? "");
  assert.equal(new URL(links.oneClick).searchParams.get("t"), token, "both links share a token");

  assert.equal(await unsubscribeByToken(flipChar(token, 20), sql), "invalid");
  assert.equal((await pg.query("select id from waitlist")).rows.length, 2, "tampered: no delete");

  assert.equal(await unsubscribeByToken(token, sql), "removed");
  const left = await pg.query<{ id: string }>("select id from waitlist");
  assert.deepEqual(
    left.rows.map((r) => r.id),
    [other.id],
    "only the named row is gone",
  );
  assert.equal(await unsubscribeByToken(token, sql), "already-removed", "a second click is safe");
  assert.equal((await pg.query("select id from waitlist")).rows.length, 1);
});
