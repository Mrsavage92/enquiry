import type { Sql } from "../db.ts";
import { cleanPrefs, withDefaults, workingHoursChange } from "../../domain/workspace-prefs.ts";
import type { WorkspacePrefs } from "../../domain/types.ts";
import { requireBusinessAccess } from "./tenancy.server.ts";

/**
 * Working hours live in Settings (workspace_prefs), and every change to them
 * is one audit row: a business-screen save, a Settings save, or an Undo. The
 * row's detail starts with `{"kind":"working_hours"` and carries the hours it
 * replaced (`previous`) and the hours it wrote (`next`), so the latest row is
 * always the one change an Undo may walk back, and only while Settings still
 * holds exactly the hours it wrote.
 */

export type Hours = Pick<WorkspacePrefs, "workingDays" | "hoursStart" | "hoursEnd">;

export type HoursChange = { eventId: string; summary: string };

const HOURS_KIND = "working_hours";
const HOURS_DETAIL_PREFIX = `{"kind":"${HOURS_KIND}"%`;

export function hoursOf(raw: unknown): Hours | null {
  if (!raw || typeof raw !== "object") return null;
  const clean = cleanPrefs(raw);
  return clean.workingDays && clean.hoursStart && clean.hoursEnd
    ? { workingDays: clean.workingDays, hoursStart: clean.hoursStart, hoursEnd: clean.hoursEnd }
    : null;
}

export function sameHours(a: Hours, b: Hours): boolean {
  return (
    a.workingDays === b.workingDays && a.hoursStart === b.hoursStart && a.hoursEnd === b.hoursEnd
  );
}

const pick = (p: Hours): Hours => ({
  workingDays: p.workingDays,
  hoursStart: p.hoursStart,
  hoursEnd: p.hoursEnd,
});

/**
 * The record of one hours change. A "stay" (the same hours saved again) is
 * not a change and writes nothing, so it can never stand between a real
 * change and its Undo.
 */
export async function recordHoursChange(
  sql: Sql,
  input: { businessId: string; actor: string; previous: Hours; next: Hours; undoes?: string },
): Promise<HoursChange | null> {
  if (sameHours(input.previous, input.next)) return null;
  const change = workingHoursChange(input.previous, input.next);
  const summary = input.undoes ? `Undone: ${change}` : change;
  const [row] = await sql<{ id: string }>`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${input.businessId}, ${input.actor}, ${summary},
      ${JSON.stringify({
        kind: HOURS_KIND,
        previous: pick(input.previous),
        next: pick(input.next),
        ...(input.undoes ? { undoes: input.undoes } : {}),
      })},
      ${"brain"}, ${null}
    )
    returning id
  `;
  if (!row?.id) throw new Error("Could not record the working hours change.");
  return { eventId: row.id, summary: change };
}

async function lockedPrefs(sql: Sql, businessId: string): Promise<WorkspacePrefs> {
  const rows = await sql<{ prefs: unknown }>`
    select prefs from workspace_prefs where business_id = ${businessId} for update
  `;
  return withDefaults(cleanPrefs(rows[0]?.prefs));
}

async function writePrefs(sql: Sql, businessId: string, prefs: WorkspacePrefs): Promise<void> {
  await sql`
    insert into workspace_prefs (business_id, prefs, updated_at)
    values (${businessId}, ${JSON.stringify(prefs)}::jsonb, now())
    on conflict (business_id) do update set prefs = excluded.prefs, updated_at = now()
  `;
}

/**
 * Set a business's working hours inside the caller's transaction (the
 * business-screen save), keeping every other preference. Returns the change
 * record, or null when the hours were already these.
 */
export async function setWorkingHoursInTransaction(
  sql: Sql,
  input: { businessId: string; actor: string; hours: Hours },
): Promise<HoursChange | null> {
  const previous = await lockedPrefs(sql, input.businessId);
  const next = withDefaults({ ...previous, ...cleanPrefs(pick(input.hours)) });
  if (sameHours(previous, next)) return null;
  await writePrefs(sql, input.businessId, next);
  return recordHoursChange(sql, {
    businessId: input.businessId,
    actor: input.actor,
    previous,
    next,
  });
}

/** The business's hours as Settings holds them now, for the save preview. */
export async function readWorkingHoursForUser(
  sql: Sql,
  userId: string,
  businessIdInput: string,
): Promise<Hours> {
  const businessId = await requireBusinessAccess(userId, businessIdInput, sql);
  const rows = await sql<{ prefs: unknown }>`
    select prefs from workspace_prefs where business_id = ${businessId}
  `;
  return pick(withDefaults(cleanPrefs(rows[0]?.prefs)));
}

export type UndoWorkingHoursResult =
  { ok: true; prefs: WorkspacePrefs; summary: string } | { ok: false; message: string };

const MOVED_ON = "Your hours have changed since then. Set them in Settings instead.";

/**
 * Undo one hours change, named by its record. Refused unless that record is
 * this business's latest hours change and Settings still holds exactly the
 * hours it wrote. Runs in one transaction with the prefs row locked, so two
 * Undos at once put the hours back once.
 */
export async function undoWorkingHoursForUser(
  sql: Sql,
  runInTransaction: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>,
  userId: string,
  input: { businessId: string; eventId: string },
): Promise<UndoWorkingHoursResult> {
  const businessId = await requireBusinessAccess(userId, input.businessId, sql);
  return runInTransaction(async (tx) => {
    const current = await lockedPrefs(tx, businessId);
    const [latest] = await tx<{ id: string; detail: string | null }>`
      select id, detail from audit_event
      where business_id = ${businessId} and object_type = ${"brain"}
        and detail like ${HOURS_DETAIL_PREFIX}
      order by at desc
      limit 1
    `;
    if (!latest || latest.id !== input.eventId) return { ok: false, message: MOVED_ON };
    let recorded: { previous?: unknown; next?: unknown };
    try {
      recorded = JSON.parse(latest.detail ?? "") as typeof recorded;
    } catch (err) {
      console.error("[working-hours] unreadable hours record", latest.id, err);
      return { ok: false, message: "That hours change cannot be undone here. Use Settings." };
    }
    const previous = hoursOf(recorded.previous);
    const wrote = hoursOf(recorded.next);
    if (!previous || !wrote) {
      console.error("[working-hours] hours record without its hours", latest.id);
      return { ok: false, message: "That hours change cannot be undone here. Use Settings." };
    }
    if (sameHours(previous, wrote)) {
      return { ok: false, message: "Nothing changed then, so there is nothing to undo." };
    }
    if (!sameHours(current, wrote)) return { ok: false, message: MOVED_ON };
    const next = withDefaults({ ...current, ...previous });
    await writePrefs(tx, businessId, next);
    const change = await recordHoursChange(tx, {
      businessId,
      actor: userId,
      previous: current,
      next,
      undoes: latest.id,
    });
    return { ok: true, prefs: next, summary: change?.summary ?? workingHoursChange(current, next) };
  });
}
