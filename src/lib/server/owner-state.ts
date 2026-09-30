import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * Pause and resume, server side.
 *
 * Each function runs authMiddleware for a verified user id and re-derives
 * ownership through business_member inside owner-state-core.ts. None accepts a
 * business or enquiry id at face value; the two-tenant test in
 * owner-state.db.test.ts runs the same core functions against a real database.
 */

const idOf = (v: unknown) => (typeof v === "string" ? v.slice(0, 64) : "");

/** Save the reply being edited, or clear it with an empty body. */
export const saveReplyDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const enquiryId = idOf(d.enquiryId);
    if (!enquiryId) throw new Error("An enquiry id is required.");
    const body = typeof d.body === "string" ? d.body : "";
    return { enquiryId, body };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { saveReplyDraftForUser } = await import("@/lib/repo/owner-state-core");
    return saveReplyDraftForUser(await getSql(), context.userId, data.enquiryId, data.body);
  });

/** Store working hours and notice choices for one business. */
export const saveWorkspacePrefs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const businessId = idOf(d.businessId);
    if (!businessId) throw new Error("A business id is required.");
    return { businessId, prefs: d.prefs };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { saveWorkspacePrefsForUser } = await import("@/lib/repo/owner-state-core");
    const prefs = await saveWorkspacePrefsForUser(
      await getSql(),
      context.userId,
      data.businessId,
      data.prefs,
    );
    return { ok: true as const, prefs };
  });

/** Record this visit; returns the previous one for "since you were last here". */
export const markWorkspaceSeen = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const businessId = idOf(d.businessId);
    if (!businessId) throw new Error("A business id is required.");
    return { businessId };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { markSeenForUser } = await import("@/lib/repo/owner-state-core");
    return markSeenForUser(await getSql(), context.userId, data.businessId);
  });

/**
 * Undo one working hours change, named by its record (the id the business
 * save returned). Tenant-scoped and transactional in working-hours-core.ts.
 */
export const undoWorkingHours = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const businessId = idOf(d.businessId);
    const eventId = idOf(d.eventId);
    if (!businessId) throw new Error("A business id is required.");
    if (!eventId) throw new Error("Say which hours change to undo.");
    return { businessId, eventId };
  })
  .handler(async ({ context, data }) => {
    const { getSql, withTransaction } = await import("@/lib/db");
    const { undoWorkingHoursForUser } = await import("@/lib/repo/working-hours-core");
    return undoWorkingHoursForUser(await getSql(), withTransaction, context.userId, data);
  });

/** The business's working hours as Settings holds them now, for the save preview. */
export const currentWorkingHours = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const businessId = idOf(d.businessId);
    if (!businessId) throw new Error("A business id is required.");
    return { businessId };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { readWorkingHoursForUser } = await import("@/lib/repo/working-hours-core");
    return readWorkingHoursForUser(await getSql(), context.userId, data.businessId);
  });
