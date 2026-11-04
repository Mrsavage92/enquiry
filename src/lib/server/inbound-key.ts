import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * The owner's website form key, server side.
 *
 * Each function runs authMiddleware for a verified user id and re-derives
 * ownership through business_member (requireBusinessAccess) inside
 * inbound-form-core.ts. The two-tenant tests in inbound-form.db.test.ts run
 * the same core functions against a real database.
 */

const idOf = (v: unknown) => (typeof v === "string" ? v.slice(0, 64) : "");

function businessIdFrom(raw: unknown): { businessId: string } {
  const businessId = idOf((raw as Record<string, unknown> | null)?.businessId);
  if (!businessId) throw new Error("A business id is required.");
  return { businessId };
}

/** Whether a key exists, its last four characters and the allowed websites. */
export const getInboundKeyStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(businessIdFrom)
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { inboundKeyStatusForUser } = await import("@/lib/repo/inbound-form-core");
    return inboundKeyStatusForUser(await getSql(), context.userId, data.businessId);
  });

/** Create or replace the key. The new key is shown this once. */
export const rotateInboundKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(businessIdFrom)
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { rotateInboundKeyForUser } = await import("@/lib/repo/inbound-form-core");
    const { recordAudit } = await import("@/lib/repo/tenancy.server");
    const result = await rotateInboundKeyForUser(await getSql(), context.userId, data.businessId);
    await recordAudit(data.businessId, {
      actor: context.userId,
      summary: "Website form key created or replaced",
      detail: `Ends in ${result.keyHint}. Any older key stopped working.`,
      objectType: "integration",
    });
    return result;
  });

/** Set which websites may post with the key. */
export const setInboundOrigins = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const { businessId } = businessIdFrom(raw);
    const origins = (raw as Record<string, unknown>).origins;
    if (!Array.isArray(origins) || origins.length > 20) {
      throw new Error("List the website addresses, one per line.");
    }
    return { businessId, origins: origins.map((o) => (typeof o === "string" ? o : "")) };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { setInboundOriginsForUser } = await import("@/lib/repo/inbound-form-core");
    const origins = await setInboundOriginsForUser(
      await getSql(),
      context.userId,
      data.businessId,
      data.origins,
    );
    return { ok: true as const, origins };
  });
