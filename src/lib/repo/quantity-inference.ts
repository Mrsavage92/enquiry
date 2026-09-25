import type { Sql } from "../db.ts";
import type { Decision } from "../../domain/decide.ts";
import { readQuantityFromMessage } from "../../domain/quantity-reader.ts";

/**
 * The count a price needs, read from what the customer already wrote.
 *
 * Runs whenever a decision is blocked on a quantity nobody has recorded yet -
 * on arrival, when a price is added later, when the service is set - so an
 * enquiry never ends on "ask them for the square metres" over a message that
 * gave them. Stored as `inferred` with the customer's own words as provenance;
 * the price compiler will not use it until the owner confirms it.
 *
 * Assumes it runs inside the caller's transaction, after `lockEnquiry`.
 */

export type LiveFact = {
  field: string;
  value: string;
  status: string;
  display_value?: string | null;
  /** For a date fact: the customer asked about the day (provenance.asked). */
  date_asked?: string | boolean | null;
};

export type InboundBody = { id: string; body: string };

/** The field and unit a blocked decision is waiting on, when it is a count. */
export function blockedQuantity(decision: Decision): { field: string; unit: string } | null {
  if (decision.price.kind !== "BLOCKED") return null;
  const rule = decision.price.rule;
  if (rule.kind !== "per_unit") return null;
  return { field: decision.price.missingField, unit: rule.unit };
}

/** Pure: which message gives the count, newest first. */
export function findQuantityInMessages(
  messages: InboundBody[],
  field: string,
  unit: string,
): { messageId: string; value: string; span: string; approximate: boolean } | null {
  for (const m of messages) {
    const read = readQuantityFromMessage(m.body ?? "", field, unit);
    if (read) return { messageId: m.id, ...read };
  }
  return null;
}

/**
 * Write the inferred fact when the decision is blocked on a count the messages
 * give and nothing is recorded for that field. Returns the fact as the decision
 * reads it, or null when nothing was written.
 */
export async function inferBlockedQuantity(
  sql: Sql,
  enquiryId: string,
  decision: Decision,
  facts: LiveFact[],
  messages: InboundBody[],
): Promise<LiveFact | null> {
  const want = blockedQuantity(decision);
  if (!want) return null;
  const field = want.field.trim().toLowerCase();
  // Anything already recorded for this field wins: an owner's answer, an
  // earlier reading, a model's proposal. This only ever fills a gap.
  if (facts.some((f) => f.field.trim().toLowerCase() === field)) return null;
  const found = findQuantityInMessages(messages, want.field, want.unit);
  if (!found) return null;
  await sql`
    insert into enquiry_fact
      (enquiry_id, field, label, value, display_value, status, confidence,
       asserted_by, provenance, customer_specific)
    values (
      ${enquiryId}, ${want.field}, ${want.field}, ${found.value}, ${found.span},
      ${"inferred"}, ${found.approximate ? "Medium" : "High"}, ${"system"},
      ${JSON.stringify({
        kind: "message",
        label: "Read from the customer's message",
        messageId: found.messageId,
        span: found.span,
      })}::jsonb,
      ${true}
    )
  `;
  return { field: want.field, value: found.value, status: "inferred", display_value: found.span };
}

/** Inbound message bodies for these enquiries, newest first, in one query. */
export async function inboundBodies(sql: Sql, ids: string[]): Promise<Map<string, InboundBody[]>> {
  const out = new Map<string, InboundBody[]>();
  if (ids.length === 0) return out;
  const rows = await sql<{ id: string; enquiry_id: string; body: string | null }>`
    select id, enquiry_id, body from message
    where enquiry_id = any(${ids}::uuid[]) and direction = ${"inbound"}
    order by at desc
  `;
  for (const r of rows) {
    const list = out.get(r.enquiry_id) ?? [];
    list.push({ id: r.id, body: r.body ?? "" });
    out.set(r.enquiry_id, list);
  }
  return out;
}
