import type { getSql } from "@/lib/db";
import { cleanPrefs, withDefaults } from "@/domain/workspace-prefs";
import type { WorkspacePrefs } from "@/domain/types";
import { requireBusinessAccess, requireEnquiryAccess } from "./tenancy.server";

/**
 * What an owner leaves behind when they are interrupted (server-only):
 * the reply they were part-way through, their working hours and notice
 * choices, and when they last opened the workspace.
 *
 * Every write resolves ownership from the verified user through
 * business_member before touching a row, exactly like tenancy.server.ts, and
 * every function takes the query surface as a parameter so the boundary is
 * proven against a real database in owner-state.db.test.ts.
 */

type Sql = Awaited<ReturnType<typeof getSql>>;

/** Longest reply body stored. A reply is a message, not a document. */
export const MAX_DRAFT_CHARS = 8000;

export type OwnerState = {
  /** enquiryId -> the owner's own edit, only where it still matches the current decision. */
  drafts: Record<string, string>;
  /** businessId -> preferences, defaults filled in. */
  prefs: Record<string, WorkspacePrefs>;
};

/**
 * Save (or, for an empty body, clear) the reply being edited on one enquiry.
 * The decision revision is read from the enquiry row here, never taken from
 * the client, so a stale tab cannot pin an old edit to a new decision.
 */
export async function saveReplyDraftForUser(
  sql: Sql,
  userId: string,
  enquiryIdInput: string,
  body: string,
): Promise<{ saved: boolean }> {
  const { enquiryId, businessId } = await requireEnquiryAccess(userId, enquiryIdInput, sql);
  const text = body.slice(0, MAX_DRAFT_CHARS);
  if (!text.trim()) {
    await sql`delete from reply_draft where enquiry_id = ${enquiryId}`;
    return { saved: false };
  }
  await sql`
    insert into reply_draft (enquiry_id, business_id, body, decision_revision, updated_by, updated_at)
    select ${enquiryId}, ${businessId}, ${text}, e.decision_revision, ${userId}, now()
    from enquiry e where e.id = ${enquiryId}
    on conflict (enquiry_id) do update set
      body = excluded.body,
      decision_revision = excluded.decision_revision,
      updated_by = excluded.updated_by,
      updated_at = now()
  `;
  return { saved: true };
}

/** Store one business's preferences, after cleaning them. Returns what was stored. */
export async function saveWorkspacePrefsForUser(
  sql: Sql,
  userId: string,
  businessIdInput: string,
  raw: unknown,
): Promise<WorkspacePrefs> {
  const businessId = await requireBusinessAccess(userId, businessIdInput, sql);
  const rows = await sql<{ prefs: unknown }>`
    select prefs from workspace_prefs where business_id = ${businessId}
  `;
  const next = withDefaults({ ...cleanPrefs(rows[0]?.prefs), ...cleanPrefs(raw) });
  await sql`
    insert into workspace_prefs (business_id, prefs, updated_at)
    values (${businessId}, ${JSON.stringify(next)}::jsonb, now())
    on conflict (business_id) do update set prefs = excluded.prefs, updated_at = now()
  `;
  return next;
}

/**
 * Record a visit and return the one before it, so Today can say what changed
 * while the owner was away. Scoped to the member's own row.
 */
export async function markSeenForUser(
  sql: Sql,
  userId: string,
  businessIdInput: string,
): Promise<{ previous: string | null }> {
  const businessId = await requireBusinessAccess(userId, businessIdInput, sql);
  const rows = await sql<{ last_seen_at: string | Date | null }>`
    select last_seen_at from business_member
    where business_id = ${businessId} and user_id = ${userId}
  `;
  await sql`
    update business_member set last_seen_at = now()
    where business_id = ${businessId} and user_id = ${userId}
  `;
  const prev = rows[0]?.last_seen_at;
  return { previous: prev ? new Date(prev).toISOString() : null };
}

/**
 * Drafts and preferences for the businesses a caller has ALREADY been resolved to
 * (loadWorkspace passes the ids it got from business_member). Drafts whose
 * decision has since moved on are left out rather than offered back.
 */
export async function loadOwnerState(sql: Sql, businessIds: string[]): Promise<OwnerState> {
  if (businessIds.length === 0) return { drafts: {}, prefs: {} };
  const [draftRows, prefRows] = await Promise.all([
    sql<{ enquiry_id: string; body: string }>`
      select d.enquiry_id, d.body
      from reply_draft d
      join enquiry e on e.id = d.enquiry_id
      where d.business_id = any(${businessIds})
        and e.business_id = d.business_id
        and e.decision_revision = d.decision_revision
        and e.lifecycle = 'OPEN'
    `,
    sql<{ business_id: string; prefs: unknown }>`
      select business_id, prefs from workspace_prefs where business_id = any(${businessIds})
    `,
  ]);
  const drafts: Record<string, string> = {};
  for (const row of draftRows) drafts[row.enquiry_id] = row.body;
  const prefs: Record<string, WorkspacePrefs> = {};
  for (const id of businessIds) prefs[id] = withDefaults({});
  for (const row of prefRows) prefs[row.business_id] = withDefaults(cleanPrefs(row.prefs));
  return { drafts, prefs };
}
