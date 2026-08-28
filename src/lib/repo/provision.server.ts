import { withTransaction } from "@/lib/db";
import { createWorkspaceInTransaction, type CreateWorkspaceInput } from "./provision-core";

export type { WorkspaceProfile, CreateWorkspaceInput } from "./provision-core";
export { createWorkspaceInTransaction } from "./provision-core";

/**
 * Creating a real tenant's first workspace (server-only).
 *
 * Onboarding creates the business, never workspace fetch: merely loading the app
 * must not write a tenant row. An earlier version auto-created a placeholder
 * "Your business" on first fetch, leaving an orphan tenant behind anyone who
 * signed in and wandered off. Zero memberships is a valid state the UI routes to
 * onboarding.
 *
 * Nothing sample becomes live truth - no fixture business, customer, enquiry,
 * rule, integration or automation evidence. The SQL lives in `provision-core`.
 */
export async function createInitialWorkspace(
  input: CreateWorkspaceInput,
): Promise<{ businessId: string; created: boolean }> {
  return withTransaction((sql) => createWorkspaceInTransaction(sql, input));
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
