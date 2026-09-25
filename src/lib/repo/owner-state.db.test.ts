import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { ForbiddenError } from "./tenancy.server.ts";
import { loadWorkspace } from "./workspace.server.ts";
import {
  loadOwnerState,
  markSeenForUser,
  saveReplyDraftForUser,
  saveWorkspacePrefsForUser,
} from "./owner-state-core.ts";

/**
 * Drafts, preferences and last-seen are tenant data like any other. Two
 * businesses on one database: each saves its own, neither can write or read
 * the other's, even holding the other's ids.
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
  return (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return (await pg.query<T>(text, values)).rows;
  }) as never;
}

const PROFILE = {
  ownerFirstName: "Owner",
  industry: "painting",
  baseLocation: "Brisbane",
  timezone: "Australia/Brisbane",
  soloOrTeam: "solo" as const,
  currency: "AUD",
};

async function tenant(pg: PGlite, userId: string, name: string, customer: string) {
  await pg.query("insert into app_user (id, email) values ($1, $2)", [userId, `${userId}@test`]);
  const sql = sqlFor(pg);
  const { businessId } = await createWorkspaceInTransaction(sql, { ...PROFILE, name, userId });
  const { enquiryId } = await insertManualEnquiry(sql, {
    businessId,
    body: `Hi, it's ${customer}. Can you quote for two bedrooms?`,
    customerName: customer,
    customerEmail: `${customer.toLowerCase()}@example.com`,
    customerPhone: "",
    serviceLabel: "",
    intakeNote: "",
  });
  return { businessId, enquiryId };
}

test("a reply draft saves, reloads with the workspace, and is refused across tenants", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Alpha Painting", "Aileen");
  const b = await tenant(pg, "user-b", "Bravo Cleaning", "Bruno");

  await saveReplyDraftForUser(sql, "user-a", a.enquiryId, "Hi Aileen, half-written reply");
  await saveReplyDraftForUser(sql, "user-b", b.enquiryId, "Hi Bruno, Bravo's private draft");

  const wsA = await loadWorkspace("user-a", sql);
  assert.equal(wsA.drafts[a.enquiryId], "Hi Aileen, half-written reply");
  const blob = JSON.stringify(wsA);
  assert.ok(!blob.includes("Bravo's private draft"), "B's draft must never reach A");
  assert.ok(!blob.includes(b.enquiryId), "B's enquiry id must not reach A");

  // Knowing B's enquiry id is not permission to write to it.
  await assert.rejects(
    saveReplyDraftForUser(sql, "user-a", b.enquiryId, "overwrite attempt"),
    ForbiddenError,
  );
  const wsB = await loadWorkspace("user-b", sql);
  assert.equal(wsB.drafts[b.enquiryId], "Hi Bruno, Bravo's private draft");
});

test("a draft written against an older decision is not offered back", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Alpha Painting", "Aileen");
  await saveReplyDraftForUser(sql, "user-a", a.enquiryId, "Edit against revision N");
  await pg.query("update enquiry set decision_revision = decision_revision + 1 where id = $1", [
    a.enquiryId,
  ]);
  const ws = await loadWorkspace("user-a", sql);
  assert.equal(ws.drafts[a.enquiryId], undefined);
});

test("an empty body clears the saved draft", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Alpha Painting", "Aileen");
  await saveReplyDraftForUser(sql, "user-a", a.enquiryId, "Something");
  await saveReplyDraftForUser(sql, "user-a", a.enquiryId, "   ");
  const state = await loadOwnerState(sql, [a.businessId]);
  assert.deepEqual(state.drafts, {});
});

test("preferences default to notices off, save per business, and are refused across tenants", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Alpha Painting", "Aileen");
  const b = await tenant(pg, "user-b", "Bravo Cleaning", "Bruno");

  const before = await loadOwnerState(sql, [a.businessId]);
  assert.equal(before.prefs[a.businessId]?.notifyArrival, false);
  assert.equal(before.prefs[a.businessId]?.notifyFollowUp, false);
  assert.equal(before.prefs[a.businessId]?.notifyLearning, false);

  const saved = await saveWorkspacePrefsForUser(sql, "user-a", a.businessId, {
    notifyArrival: true,
    hoursStart: "07:00",
    hoursEnd: "not-a-time",
    injected: "ignored",
  });
  assert.equal(saved.notifyArrival, true);
  assert.equal(saved.hoursStart, "07:00");
  assert.equal(saved.hoursEnd, "17:30", "a malformed value falls back rather than being stored");
  assert.equal((saved as Record<string, unknown>).injected, undefined);

  const wsA = await loadWorkspace("user-a", sql);
  assert.equal(wsA.prefs[a.businessId]?.notifyArrival, true);
  assert.equal(wsA.prefs[b.businessId], undefined, "B's preferences must not reach A");

  await assert.rejects(
    saveWorkspacePrefsForUser(sql, "user-a", b.businessId, { notifyArrival: true }),
    ForbiddenError,
  );
  const wsB = await loadWorkspace("user-b", sql);
  assert.equal(wsB.prefs[b.businessId]?.notifyArrival, false);
});

test("last seen returns the previous visit and is refused across tenants", async () => {
  const pg = await freshDb();
  const sql = sqlFor(pg);
  const a = await tenant(pg, "user-a", "Alpha Painting", "Aileen");
  const b = await tenant(pg, "user-b", "Bravo Cleaning", "Bruno");

  assert.deepEqual(await markSeenForUser(sql, "user-a", a.businessId), { previous: null });
  const second = await markSeenForUser(sql, "user-a", a.businessId);
  assert.ok(second.previous && !Number.isNaN(Date.parse(second.previous)));

  await assert.rejects(markSeenForUser(sql, "user-a", b.businessId), ForbiddenError);
  // B's own first visit is still a first visit: A's refused call wrote nothing.
  assert.deepEqual(await markSeenForUser(sql, "user-b", b.businessId), { previous: null });
});
