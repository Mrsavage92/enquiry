import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { parseBusinessRule } from "@/domain/business-rule";

/**
 * The first-beta loop, server side.
 *
 * A business states its prices, a real enquiry is typed in, Enquiry computes a
 * decision from those prices, the owner sends the reply themselves, and the
 * send is recorded as a fact. Every function is tenancy-checked and every one
 * re-derives ownership from the verified user - none accepts a business or
 * enquiry id at face value.
 */

/**
 * Save a typed pricing rule the business has confirmed.
 *
 * Both halves together: the readable sentence the operator checks, and the
 * machine-usable payload an evaluator can transact against. The payload is
 * validated here rather than trusted, because a rule may have been proposed by
 * a model - and a model may suggest a price, never decide one.
 */
export const saveBusinessRule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const businessId = typeof d.businessId === "string" ? d.businessId : "";
    if (!businessId) throw new Error("A business id is required.");
    const parsed = parseBusinessRule(d.rule);
    if (!parsed.ok) throw new Error(parsed.reason);
    return { businessId, rule: parsed.rule };
  })
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { requireBusinessAccess, recordAudit } = await import("@/lib/repo/tenancy.server");
    const { describeRule } = await import("@/domain/business-rule");
    const businessId = await requireBusinessAccess(context.userId, data.businessId);
    const sql = await getSql();
    const readable = describeRule(data.rule);
    // State is Active because a human confirmed it in the UI; nothing reaches
    // this function without that confirmation.
    const rows = await sql<{ id: string }>`
      insert into knowledge_item
        (business_id, section, title, body, class, state, source, version, rule_payload)
      values (
        ${businessId}, ${"pricing"}, ${data.rule.service}, ${readable},
        ${"authoritative"}, ${"Active"},
        ${JSON.stringify({ kind: "user", label: "Confirmed by the owner" })}::jsonb,
        ${"1"}, ${JSON.stringify(data.rule)}::jsonb
      )
      returning id
    `;
    await recordAudit(businessId, {
      actor: context.userId,
      summary: `Pricing rule confirmed: ${readable}`,
      objectType: "brain",
      objectId: rows[0]?.id,
    });
    return { ok: true as const, id: rows[0]?.id ?? "" };
  });

/**
 * Create an enquiry the owner typed or pasted in.
 *
 * The first-beta ingestion path, and the answer to "there is no way to get a
 * real enquiry into this product". No channel integration is claimed or
 * required: the owner had a conversation somewhere Enquiry cannot see, and
 * types what the customer said.
 *
 * The raw message is persisted in the same transaction as the enquiry, so what
 * the customer actually wrote is never lost behind a machine's reading of it,
 * and a failure cannot leave an enquiry with no message.
 */
export const createManualEnquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const str = (v: unknown, max: number) => (typeof v === "string" ? v : "").trim().slice(0, max);
    const businessId = str(d.businessId, 64);
    const body = str(d.body, 8000);
    if (!businessId) throw new Error("A business id is required.");
    if (!body) throw new Error("Paste what the customer said.");
    return {
      businessId,
      body,
      customerName: str(d.customerName, 160),
      customerEmail: str(d.customerEmail, 320),
      customerPhone: str(d.customerPhone, 40),
      serviceLabel: str(d.serviceLabel, 200),
      intakeNote: str(d.intakeNote, 400),
    };
  })
  .handler(async ({ context, data }) => {
    const { getSql, withTransaction } = await import("@/lib/db");
    const { requireBusinessAccess, recordAudit } = await import("@/lib/repo/tenancy.server");
    const { decideEnquiry } = await import("@/domain/decide");
    const { snapshotFromDecision, stateFromDecision } = await import("@/domain/decision-snapshot");
    const businessId = await requireBusinessAccess(context.userId, data.businessId);

    // Decide it on arrival, from this business's own confirmed rules. An
    // enquiry stored with no decision is an enquiry the desk cannot show and
    // the owner cannot act on - the whole point is that it arrives already
    // worked out, or already knowing what it needs.
    const sqlRead = await getSql();
    const knowledge = await sqlRead<{ state: string; rule_payload: unknown }>`
      select state, rule_payload from knowledge_item
      where business_id = ${businessId} and rule_payload is not null
    `;
    const decision = decideEnquiry(
      { knowledge: knowledge.map((k) => ({ state: k.state, rulePayload: k.rule_payload })) },
      { serviceLabel: data.serviceLabel, facts: [] },
    );
    const snapshot = snapshotFromDecision(decision);
    const state = stateFromDecision(decision);

    const enquiryId = await withTransaction(async (sql) => {
      const rows = await sql<{ id: string }>`
        insert into enquiry (
          business_id, customer_name, customer_email, customer_phone, source,
          service_label, lifecycle, decision_state, commercial_state,
          responsibility, intake_note, decision_snapshot, received_at, updated_at
        ) values (
          ${businessId}, ${data.customerName}, ${data.customerEmail},
          ${data.customerPhone || null}, ${"manual"}, ${data.serviceLabel},
          ${"OPEN"}, ${state.decisionState}, ${state.commercialState},
          ${state.responsibility},
          ${data.intakeNote || null}, ${JSON.stringify(snapshot)}::jsonb, now(), now()
        )
        returning id
      `;
      const id = rows[0]?.id;
      if (!id) throw new Error("Could not create the enquiry.");
      await sql`
        insert into message
          (enquiry_id, direction, channel, at, from_addr, to_addr, body, intake)
        values (
          ${id}, ${"inbound"}, ${"manual"}, now(),
          ${data.customerEmail || data.customerName || "Customer"}, ${""},
          ${data.body}, ${"manual"}
        )
      `;
      return id;
    });

    await recordAudit(businessId, {
      actor: context.userId,
      summary: "Enquiry added by hand",
      detail: data.intakeNote || undefined,
      objectType: "enquiry",
      objectId: enquiryId,
    });
    return { ok: true as const, enquiryId };
  });

/**
 * Record that the owner actually sent a reply.
 *
 * Enquiry does not send anything in first beta. The owner copies the prepared
 * text, sends it from their own mailbox or phone, and confirms here. That
 * confirmation becomes a real outbound row with a real `sent_at`.
 *
 * The prototype instead pushed a fake outbound message into a client array and
 * marked the quote sent - indistinguishable, from the operator's side, from
 * having actually sent it, and gone on reload. This is the honest version, and
 * it is the difference between the product's central claim being true or theatre.
 */
export const recordSentReply = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const enquiryId = typeof d.enquiryId === "string" ? d.enquiryId : "";
    const body = (typeof d.body === "string" ? d.body : "").trim().slice(0, 8000);
    if (!enquiryId) throw new Error("An enquiry id is required.");
    if (!body) throw new Error("Nothing to record as sent.");
    const channel = typeof d.channel === "string" ? d.channel : "manual";
    const allowed = [
      "email",
      "form",
      "forward",
      "manual",
      "sms",
      "instagram",
      "facebook",
      "comment",
    ];
    return { enquiryId, body, channel: allowed.includes(channel) ? channel : "manual" };
  })
  .handler(async ({ context, data }) => {
    const { withTransaction } = await import("@/lib/db");
    const { requireEnquiryAccess, recordAudit } = await import("@/lib/repo/tenancy.server");
    const { enquiryId, businessId } = await requireEnquiryAccess(context.userId, data.enquiryId);
    await withTransaction(async (sql) => {
      await sql`
        insert into message
          (enquiry_id, direction, channel, at, from_addr, to_addr, body, intake, sent_at, sent_by)
        values (
          ${enquiryId}, ${"outbound"}, ${data.channel}, now(), ${""}, ${""},
          ${data.body}, ${"manual"}, now(), ${context.userId}
        )
      `;
      // The ball is now with the customer, not the business.
      await sql`
        update enquiry
        set responsibility = ${"CUSTOMER"}, decision_state = ${"WAITING_ON_CLIENT"},
            updated_at = now()
        where id = ${enquiryId}
      `;
    });
    await recordAudit(businessId, {
      actor: context.userId,
      summary: "Reply confirmed sent by the owner",
      objectType: "enquiry",
      objectId: enquiryId,
    });
    return { ok: true as const };
  });
