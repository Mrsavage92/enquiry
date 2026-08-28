import type { Sql } from "../db.ts";
import { initialActionPolicies } from "../../domain/action-catalogue.ts";

/**
 * Initial workspace creation, as pure SQL logic.
 *
 * Deliberately separate from `provision.server.ts`, which owns connection and
 * transaction management. Keeping the statements and the lock/re-check sequence
 * here means they can be exercised against a real database in tests - the
 * interesting failures are constraint violations and races, and only a database
 * produces those.
 *
 * Everything here assumes it is ALREADY inside a transaction: the advisory lock
 * is transaction-scoped and would release immediately otherwise.
 */

export type WorkspaceProfile = {
  name: string;
  ownerFirstName: string;
  industry: string;
  baseLocation: string;
  timezone: string;
  soloOrTeam: "solo" | "team";
  currency: string;
};

/** Everything initial creation needs, already validated by the caller. */
export type CreateWorkspaceInput = WorkspaceProfile & { userId: string };

async function insertBusiness(sql: Sql, input: CreateWorkspaceInput): Promise<string> {
  const rows = await sql<{ id: string }>`
    insert into business (
      name, industry, industry_brain, city, timezone, currency, solo_or_team,
      base_location, owner_name, owner_first_name, trust_mode, paused, pause_level
    ) values (
      ${input.name}, ${input.industry}, ${""}, ${input.baseLocation}, ${input.timezone},
      ${input.currency}, ${input.soloOrTeam}, ${input.baseLocation},
      ${input.ownerFirstName}, ${input.ownerFirstName},
      ${"Observe"}, ${false}, ${"none"}
    )
    returning id
  `;
  const id = rows[0]?.id;
  if (!id) throw new Error("Business insert returned no id");
  return id;
}

async function insertInitialPolicies(sql: Sql, businessId: string): Promise<void> {
  for (const p of initialActionPolicies()) {
    await sql`
      insert into action_policy (business_id, action, label, mode, risk, evidence, gates)
      values (
        ${businessId}, ${p.action}, ${p.label}, ${p.mode}, ${p.risk},
        ${"{}"}::jsonb, ${JSON.stringify(p.gates)}::jsonb
      )
      on conflict (business_id, action) do nothing
    `;
  }
}

/**
 * Create this user's initial workspace from completed onboarding and return its
 * id. If a concurrent request already created one, returns that instead of
 * creating a second.
 *
 * Concurrency-safe by construction: a per-user advisory lock is taken FIRST,
 * inside the transaction, and membership is re-checked after acquiring it. A
 * second submit blocks, re-reads, and finds what the first committed.
 *
 * A unique constraint deliberately does not back this. A user may legitimately
 * belong to several businesses later, so "exactly one on first creation" is a
 * rule about timing, not about the shape of the data.
 *
 * One transaction throughout, so a failure can never leave a business without
 * its owner membership or with a half-written policy catalogue - either would
 * lock the owner out of their own tenant.
 */
/**
 * The transaction body, exported so the real SQL and the lock/re-check sequence
 * can be exercised against an actual database rather than inferred from a
 * profile-validator test. Callers must already be inside a transaction - the
 * advisory lock is transaction-scoped and would release immediately otherwise.
 */
export async function createWorkspaceInTransaction(
  sql: Sql,
  input: CreateWorkspaceInput,
): Promise<{ businessId: string; created: boolean }> {
  await sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`;

  const existing = await sql<{ business_id: string }>`
    select business_id from business_member where user_id = ${input.userId} limit 1
  `;
  if (existing[0]) return { businessId: existing[0].business_id, created: false };

  const businessId = await insertBusiness(sql, input);
  await sql`
    insert into business_member (business_id, user_id, role)
    values (${businessId}, ${input.userId}, ${"owner"})
  `;
  await insertInitialPolicies(sql, businessId);
  await sql`
    insert into audit_event (business_id, actor, summary, detail, object_type)
    values (
      ${businessId}, ${input.userId}, ${"Workspace created"},
      ${"Created from onboarding. Every action starts at ask-every-time or never."},
      ${"brain"}
    )
  `;
  return { businessId, created: true };
}

