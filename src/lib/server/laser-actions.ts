import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * The copy marks behind "You copied this at 2:14 pm. Sent it?" (doc 50 7.5).
 *
 * Neither records a send or changes a decision. Each runs authMiddleware for a
 * verified user id and re-derives ownership through business_member inside
 * copied-core.ts; the two-tenant test in laser-send.db.test.ts runs the same
 * core functions against a real database.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The owner's clipboard took this exact reviewed text. */
export const markReplyCopied = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const enquiryId = typeof d.enquiryId === "string" ? d.enquiryId : "";
    const reviewedSendId = typeof d.reviewedSendId === "string" ? d.reviewedSendId : "";
    if (!UUID_RE.test(enquiryId)) throw new Error("That enquiry id is not valid.");
    if (!UUID_RE.test(reviewedSendId)) throw new Error("Check the reply before copying it.");
    return { enquiryId, reviewedSendId };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { markCopiedForUser } = await import("@/lib/repo/copied-core");
    return markCopiedForUser(await getSql(), context.userId, data);
  });

/** "Not yet": the copied reply was not sent, so nothing asks about it again. */
export const clearReplyCopied = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const enquiryId = typeof d.enquiryId === "string" ? d.enquiryId : "";
    if (!UUID_RE.test(enquiryId)) throw new Error("That enquiry id is not valid.");
    return { enquiryId };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { clearCopiedForUser } = await import("@/lib/repo/copied-core");
    return clearCopiedForUser(await getSql(), context.userId, data);
  });
