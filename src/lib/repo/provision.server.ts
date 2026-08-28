import { withTransaction, type Sql } from "@/lib/db";
import { initialActionPolicies } from "@/domain/action-catalogue";

/**
 * Creating a real tenant's first workspace (server-only).
 *
 * Two rules govern this file.
 *
 * 1. **Onboarding creates the business, not workspace fetch.** Merely loading
 *    the app must never write a tenant row. An earlier version auto-created a
 *    placeholder "Your business" on first fetch, which left an orphan tenant
 *    behind anyone who signed in and wandered off. Zero memberships is a valid
 *    state that the UI routes to onboarding.
 *
 * 2. **Nothing sample becomes live truth.** No fixture business, customer,
 *    enquiry, rule, integration or automation evidence. The action catalogue
 *    comes from the domain rather than from demo tenants, and every policy
 *    starts granting nothing.
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
export async function createInitialWorkspace(
  input: CreateWorkspaceInput,
): Promise<{ businessId: string; created: boolean }> {
  return withTransaction(async (sql) => {
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
  });
}

/** Whether this user belongs to any workspace. Zero is a valid new account. */
export async function hasWorkspace(userId: string): Promise<boolean> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ business_id: string }>`
    select business_id from business_member where user_id = ${userId} limit 1
  `;
  return Boolean(rows[0]);
}
