import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * The operator app's server boundary.
 *
 * Every function here runs `authMiddleware`, which verifies the caller and puts
 * a trusted `context.userId` in scope. No handler accepts a user id or a
 * business id as an unchecked input - ownership is always re-derived server-side
 * through `business_member`. That is the whole authorization model, so a new
 * function that skips it is a tenancy hole, not a shortcut.
 *
 * `*.server` modules are imported dynamically inside handlers so their Postgres
 * and Node-only dependencies never reach the browser bundle.
 */

/**
 * Everything the signed-in operator can see, provisioning a first workspace if
 * they have none. One call, because that is what the client needs to render.
 */
export const fetchWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { ensureAppUser } = await import("@/lib/repo/tenancy.server");
    const { provisionIfEmpty } = await import("@/lib/repo/provision.server");
    const { loadWorkspace } = await import("@/lib/repo/workspace.server");
    const { getSessionUser } = await import("@/lib/auth/verify.server");

    // Mirror the Supabase identity into app_user so the rest of the schema can
    // carry real foreign keys without reaching into the auth schema.
    const session = await getSessionUser().catch(() => null);
    await ensureAppUser(context.userId, session?.email ?? null);
    // Creates an EMPTY workspace, never a fixture one - AGENTS.project.md s13.
    await provisionIfEmpty(context.userId, session?.email ?? null);

    return loadWorkspace(context.userId);
  });

/**
 * Re-read the workspace without provisioning. Used after a mutation, where a
 * missing workspace means something is wrong rather than something is new.
 */
export const refetchWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { loadWorkspace } = await import("@/lib/repo/workspace.server");
    return loadWorkspace(context.userId);
  });

/** Free-text note on one enquiry. Ownership re-derived, never trusted. */
export const setEnquiryNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const enquiryId = typeof d.enquiryId === "string" ? d.enquiryId : "";
    if (!enquiryId) throw new Error("An enquiry id is required.");
    const note = typeof d.note === "string" ? d.note.slice(0, 4000) : "";
    return { enquiryId, note };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { requireEnquiryAccess, recordAudit } = await import(
      "@/lib/repo/tenancy.server"
    );
    const { enquiryId, businessId } = await requireEnquiryAccess(
      context.userId,
      data.enquiryId,
    );
    const sql = await getSql();
    await sql`
      update enquiry set notes = ${data.note || null}, updated_at = now()
      where id = ${enquiryId}
    `;
    await recordAudit(businessId, {
      actor: context.userId,
      summary: data.note ? "Note updated" : "Note cleared",
      objectType: "enquiry",
      objectId: enquiryId,
    });
    return { ok: true as const };
  });

/**
 * Snooze an enquiry until a given time, or clear the snooze with `null`.
 * Time comes from the client but is only ever stored, never used to make a
 * decision, so an implausible value is a display problem rather than a
 * commercial one.
 */
export const snoozeEnquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const enquiryId = typeof d.enquiryId === "string" ? d.enquiryId : "";
    if (!enquiryId) throw new Error("An enquiry id is required.");
    const until = typeof d.until === "string" && d.until ? d.until : null;
    if (until && Number.isNaN(Date.parse(until))) {
      throw new Error("Snooze time is not a valid date.");
    }
    return { enquiryId, until };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { requireEnquiryAccess, recordAudit } = await import(
      "@/lib/repo/tenancy.server"
    );
    const { enquiryId, businessId } = await requireEnquiryAccess(
      context.userId,
      data.enquiryId,
    );
    const sql = await getSql();
    await sql`
      update enquiry set snoozed_until = ${data.until}, updated_at = now()
      where id = ${enquiryId}
    `;
    await recordAudit(businessId, {
      actor: context.userId,
      summary: data.until ? "Enquiry snoozed" : "Snooze cleared",
      detail: data.until ?? undefined,
      objectType: "enquiry",
      objectId: enquiryId,
    });
    return { ok: true as const };
  });

/** Change how much the business lets Enquiry do on its own, per action class. */
export const setActionPolicyMode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const businessId = typeof d.businessId === "string" ? d.businessId : "";
    const action = typeof d.action === "string" ? d.action : "";
    const mode = typeof d.mode === "string" ? d.mode : "";
    if (!businessId || !action) throw new Error("A business and action are required.");
    // Whitelisted rather than passed through - this column decides what the
    // system may do without asking a human.
    const allowed = ["Never", "Ask every time", "Automatic when safe"];
    if (!allowed.includes(mode)) throw new Error("Unknown autonomy mode.");
    return { businessId, action, mode };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { requireBusinessAccess, recordAudit } = await import(
      "@/lib/repo/tenancy.server"
    );
    const businessId = await requireBusinessAccess(context.userId, data.businessId);
    const sql = await getSql();
    await sql`
      update action_policy set mode = ${data.mode}, updated_at = now()
      where business_id = ${businessId} and action = ${data.action}
    `;
    await recordAudit(businessId, {
      actor: context.userId,
      summary: `Autonomy for ${data.action} set to ${data.mode}`,
      objectType: "trust",
    });
    return { ok: true as const };
  });

/** Pause or resume the business, at the level the operator chose. */
export const setBusinessPause = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const businessId = typeof d.businessId === "string" ? d.businessId : "";
    if (!businessId) throw new Error("A business id is required.");
    const level = typeof d.level === "string" ? d.level : "none";
    if (!["none", "outbound", "all"].includes(level)) {
      throw new Error("Unknown pause level.");
    }
    return { businessId, level, paused: level !== "none" };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { requireBusinessAccess, recordAudit } = await import(
      "@/lib/repo/tenancy.server"
    );
    const businessId = await requireBusinessAccess(context.userId, data.businessId);
    const sql = await getSql();
    await sql`
      update business set paused = ${data.paused}, pause_level = ${data.level},
                          updated_at = now()
      where id = ${businessId}
    `;
    await recordAudit(businessId, {
      actor: context.userId,
      summary: data.paused ? `Paused (${data.level})` : "Resumed",
      objectType: "trust",
    });
    return { ok: true as const };
  });
