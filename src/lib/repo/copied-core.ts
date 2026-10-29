import type { Sql } from "../db.ts";
import { requireEnquiryAccess } from "./tenancy.server.ts";

/**
 * "Copied, not marked sent" (doc 50 7.5), as pure SQL logic, tenant-scoped
 * first.
 *
 * Copy records no send. It only marks the exact reviewed text the owner put on
 * their clipboard, so a reload or another device can ask "You copied this at
 * 2:14 pm. Sent it?" once. "Not yet" clears the mark, a recorded send consumes
 * the row, and a mark older than a week is never offered again.
 */

/** How long a copy is offered back: a week, then it is noise. */
export const COPIED_TTL_DAYS = 7;

export type CopiedMark = { reviewedSendId: string; at: string; body: string };

/** Mark one reviewed text as copied. Only an unrecorded artefact of this enquiry. */
export async function markCopiedForUser(
  sql: Sql,
  userId: string,
  input: { enquiryId: string; reviewedSendId: string },
): Promise<{ ok: boolean; at: string | null }> {
  const { enquiryId, businessId } = await requireEnquiryAccess(userId, input.enquiryId, sql);
  const rows = await sql<{ copied_at: string | Date }>`
    update reviewed_send set copied_at = now()
    where id = ${input.reviewedSendId} and enquiry_id = ${enquiryId}
      and business_id = ${businessId} and consumed_at is null
    returning copied_at
  `;
  const at = rows[0]?.copied_at;
  return { ok: Boolean(at), at: at ? new Date(at).toISOString() : null };
}

/** "Not yet": nothing on this enquiry is waiting for a "Sent it?" any more. */
export async function clearCopiedForUser(
  sql: Sql,
  userId: string,
  input: { enquiryId: string },
): Promise<{ cleared: number }> {
  const { enquiryId, businessId } = await requireEnquiryAccess(userId, input.enquiryId, sql);
  const rows = await sql<{ id: string }>`
    update reviewed_send set copied_at = null
    where enquiry_id = ${enquiryId} and business_id = ${businessId}
      and copied_at is not null and consumed_at is null
    returning id
  `;
  return { cleared: rows.length };
}

/**
 * The newest copied, unrecorded text per enquiry, for enquiries the caller has
 * ALREADY been resolved to (loadWorkspace passes the ids it scoped itself).
 */
export async function loadCopied(
  sql: Sql,
  enquiryIds: readonly string[],
  now: Date = new Date(),
): Promise<Record<string, CopiedMark>> {
  if (enquiryIds.length === 0) return {};
  const since = new Date(now.getTime() - COPIED_TTL_DAYS * 24 * 60 * 60 * 1000);
  const rows = await sql<{
    id: string;
    enquiry_id: string;
    copied_at: string | Date;
    body: string;
  }>`
    select id, enquiry_id, copied_at, body from reviewed_send
    where enquiry_id = any(${enquiryIds as string[]}) and copied_at is not null
      and consumed_at is null and copied_at >= ${since.toISOString()}
    order by copied_at desc
  `;
  const out: Record<string, CopiedMark> = {};
  for (const r of rows) {
    if (out[r.enquiry_id]) continue;
    out[r.enquiry_id] = {
      reviewedSendId: r.id,
      at: new Date(r.copied_at).toISOString(),
      body: r.body,
    };
  }
  return out;
}
