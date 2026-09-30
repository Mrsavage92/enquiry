import type { getSql } from "@/lib/db";
import { cleanPrefs, withDefaults, workingHoursChange } from "@/domain/workspace-prefs";
import type { WorkspacePrefs } from "@/domain/types";
import { requireBusinessAccess, requireEnquiryAccess } from "./tenancy.server";
import { describeChange, editFigureChanges, type PricedLine } from "@/domain/edit-figures";

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
  /**
   * enquiryId -> an edit written against an earlier decision. Never dropped
   * silently: the desk shows it beside the new prepared reply and the owner
   * chooses which to keep.
   */
  staleDrafts: Record<string, string>;
  /**
   * enquiryId -> the figures an edit (current or out of date) names that the
   * quote now says differently: "Makeup trial $90 -> $95". Empty when none.
   */
  draftChanges: Record<string, string[]>;
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

type Hours = Pick<WorkspacePrefs, "workingDays" | "hoursStart" | "hoursEnd">;

function hoursOf(raw: unknown): Hours | null {
  if (!raw || typeof raw !== "object") return null;
  const clean = cleanPrefs(raw);
  return clean.workingDays && clean.hoursStart && clean.hoursEnd
    ? { workingDays: clean.workingDays, hoursStart: clean.hoursStart, hoursEnd: clean.hoursEnd }
    : null;
}

const sameHours = (a: Hours, b: Hours) =>
  a.workingDays === b.workingDays && a.hoursStart === b.hoursStart && a.hoursEnd === b.hoursEnd;

export type UndoWorkingHoursResult =
  { ok: true; prefs: WorkspacePrefs; summary: string } | { ok: false; message: string };

/**
 * Put back the working hours a business-screen save replaced. The hours it
 * replaced are read from that save's own audit record (business-rule-core.ts
 * saveWorkingHours), never from the caller, and only while Settings still
 * holds the hours that save wrote: a later change is never undone by an old
 * Undo. Tenant-scoped first; the undo is itself on the record.
 */
export async function undoWorkingHoursForUser(
  sql: Sql,
  userId: string,
  businessIdInput: string,
): Promise<UndoWorkingHoursResult> {
  const businessId = await requireBusinessAccess(userId, businessIdInput, sql);
  const [event] = await sql<{ detail: string | null }>`
    select detail from audit_event
    where business_id = ${businessId} and object_type = ${"brain"}
      and summary like ${"Settings hours %"}
    order by at desc
    limit 1
  `;
  let recorded: { previous?: unknown; next?: unknown } = {};
  try {
    recorded = JSON.parse(event?.detail ?? "{}") as typeof recorded;
  } catch {
    recorded = {};
  }
  const previous = hoursOf(recorded.previous);
  const saved = hoursOf(recorded.next);
  if (!previous || !saved) {
    return { ok: false, message: "There is no working hours change to undo." };
  }
  const rows = await sql<{ prefs: unknown }>`
    select prefs from workspace_prefs where business_id = ${businessId}
  `;
  const current = withDefaults(cleanPrefs(rows[0]?.prefs));
  if (!sameHours(current, saved)) {
    return {
      ok: false,
      message: "Your hours have changed since then. Set them in Settings instead.",
    };
  }
  const next = withDefaults({ ...current, ...previous });
  await sql`
    insert into workspace_prefs (business_id, prefs, updated_at)
    values (${businessId}, ${JSON.stringify(next)}::jsonb, now())
    on conflict (business_id) do update set prefs = excluded.prefs, updated_at = now()
  `;
  const summary = workingHoursChange(current, next);
  await sql`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${businessId}, ${userId}, ${`Undone: ${summary}`},
      ${JSON.stringify({ undone: { previous: current, restored: previous } })},
      ${"brain"}, ${null}
    )
  `;
  return { ok: true, prefs: next, summary };
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
  if (businessIds.length === 0) return { drafts: {}, staleDrafts: {}, draftChanges: {}, prefs: {} };
  const [draftRows, prefRows] = await Promise.all([
    // An edit is current when its decision has not moved. One whose decision
    // has moved is still returned, as stale, unless the enquiry is waiting on
    // the customer or a reply was recorded as sent after the edit - then the
    // edit has been dealt with and offering it back would be noise.
    sql<{
      enquiry_id: string;
      body: string;
      current: boolean;
      price: { amountMinor?: number; lines?: PricedLine[] } | null;
      coverage_lines: PricedLine[] | null;
    }>`
      select d.enquiry_id, d.body, (e.decision_revision = d.decision_revision) as current,
        e.decision_snapshot -> 'price' as price,
        e.decision_snapshot -> 'coverage' -> 'lines' as coverage_lines
      from reply_draft d
      join enquiry e on e.id = d.enquiry_id
      where d.business_id = any(${businessIds})
        and e.business_id = d.business_id
        and e.lifecycle = 'OPEN'
        and (
          e.decision_revision = d.decision_revision
          or (
            e.decision_state <> 'WAITING_ON_CLIENT'
            and not exists (
              select 1 from message m
              where m.enquiry_id = e.id and m.direction = 'outbound' and m.at >= d.updated_at
            )
          )
        )
    `,
    sql<{ business_id: string; prefs: unknown }>`
      select business_id, prefs from workspace_prefs where business_id = any(${businessIds})
    `,
  ]);
  const drafts: Record<string, string> = {};
  const staleDrafts: Record<string, string> = {};
  const draftChanges: Record<string, string[]> = {};
  for (const row of draftRows) {
    if (row.current) drafts[row.enquiry_id] = row.body;
    else staleDrafts[row.enquiry_id] = row.body;
    // What the edit says against what the quote says now: the lines of a
    // priced quote, or the lines still waiting on "That's everything".
    const lines = row.price?.lines ?? row.coverage_lines ?? [];
    const total =
      typeof row.price?.amountMinor === "number"
        ? row.price.amountMinor
        : row.coverage_lines?.length
          ? row.coverage_lines.reduce((s, l) => s + l.amountMinor, 0)
          : null;
    const changes = editFigureChanges(row.body, lines, total).map(describeChange);
    if (changes.length) draftChanges[row.enquiry_id] = changes;
  }
  const prefs: Record<string, WorkspacePrefs> = {};
  for (const id of businessIds) prefs[id] = withDefaults({});
  for (const row of prefRows) prefs[row.business_id] = withDefaults(cleanPrefs(row.prefs));
  return { drafts, staleDrafts, draftChanges, prefs };
}
