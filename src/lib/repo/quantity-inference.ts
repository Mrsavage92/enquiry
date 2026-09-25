import type { Sql } from "../db.ts";
import type { Decision } from "../../domain/decide.ts";
import { quantityContextFor, readQuantityFromMessage } from "../../domain/quantity-reader.ts";
import { extraField, extraLabel, isExtraField, readExtraRequests } from "../../domain/extras.ts";
import { stemsOf } from "../../domain/service-words.ts";

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
  /** For a date fact: the customer's words (provenance.span). */
  date_span?: string | null;
  /** For a date fact: a day that has passed or disagrees (provenance.issue). */
  date_issue?: unknown;
};

export type InboundBody = { id: string; body: string };

/** The field and unit a blocked decision is waiting on, when it is a count. */
export function blockedQuantity(
  decision: Decision,
): { field: string; unit: string; service: string; knownServices: string[] } | null {
  if (decision.price.kind !== "BLOCKED") return null;
  const rule = decision.price.rule;
  if (rule.kind !== "per_unit") return null;
  return {
    field: decision.price.missingField,
    unit: rule.unit,
    service: rule.service,
    knownServices: decision.knownServices ?? [],
  };
}

/**
 * Pure: which message gives the count, newest first. With the service and the
 * business's other services, a count is only read when it is tied to this
 * service ("120 square metres of wall" is not the ceilings' count).
 */
export function findQuantityInMessages(
  messages: InboundBody[],
  field: string,
  unit: string,
  service = "",
  knownServices: readonly string[] = [],
): { messageId: string; value: string; span: string; approximate: boolean } | null {
  for (const m of messages) {
    const body = m.body ?? "";
    const context = quantityContextFor(body, service, knownServices);
    const read = readQuantityFromMessage(body, field, unit, context);
    if (read) return { messageId: m.id, ...read };
  }
  return null;
}

/**
 * Pure: what else these messages ask for beside the main service, that has no
 * fact recorded yet.
 */
export function newExtraRequests(
  messages: InboundBody[],
  serviceLabel: string,
  services: readonly string[],
  facts: ReadonlyArray<{ field: string }>,
): { field: string; label: string; span: string; messageId: string }[] {
  if (!serviceLabel.trim()) return [];
  const have = new Set(facts.map((f) => f.field.trim().toLowerCase()));
  // An extra already recorded under another name ("oven cleaning" read before
  // there was a price, "Oven clean" now) is the same request, not a second one.
  const main = new Set(stemsOf(serviceLabel));
  const own = (label: string) => stemsOf(label).filter((s) => !main.has(s));
  const recorded = facts.filter((f) => isExtraField(f.field)).map((f) => own(extraLabel(f.field)));
  const out: { field: string; label: string; span: string; messageId: string }[] = [];
  for (const m of [...messages].reverse()) {
    for (const extra of readExtraRequests(m.body ?? "", serviceLabel, services)) {
      const field = extraField(extra.label);
      if (have.has(field.toLowerCase())) continue;
      const stems = own(extra.label);
      if (recorded.some((r) => r.some((s) => stems.includes(s)))) continue;
      have.add(field.toLowerCase());
      recorded.push(stems);
      out.push({ field, label: extra.label, span: extra.span, messageId: m.id });
    }
  }
  return out;
}

/**
 * Record what else the customer asked for as `inferred` extras. The owner adds
 * each one to the quote or leaves it out; nothing here prices anything.
 * Caller holds the lock.
 */
export async function inferExtras(
  sql: Sql,
  enquiryId: string,
  serviceLabel: string,
  services: readonly string[],
  facts: LiveFact[],
  messages: InboundBody[],
): Promise<LiveFact[]> {
  const found = newExtraRequests(messages, serviceLabel, services, facts);
  const written: LiveFact[] = [];
  for (const extra of found) {
    await sql`
      insert into enquiry_fact
        (enquiry_id, field, label, value, display_value, status, confidence,
         asserted_by, provenance, customer_specific)
      values (
        ${enquiryId}, ${extra.field}, ${extra.label}, ${"include"}, ${extra.span},
        ${"inferred"}, ${"Medium"}, ${"system"},
        ${JSON.stringify({
          kind: "message",
          label: "Read from the customer's message",
          messageId: extra.messageId || undefined,
          span: extra.span,
        })}::jsonb,
        ${true}
      )
    `;
    written.push({
      field: extra.field,
      value: "include",
      status: "inferred",
      display_value: extra.span,
    });
  }
  return written;
}

/** Whether any live fact is an extra, for callers that only need to know. */
export function hasExtras(facts: ReadonlyArray<{ field: string }>): boolean {
  return facts.some((f) => isExtraField(f.field));
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
  const found = findQuantityInMessages(
    messages,
    want.field,
    want.unit,
    want.service,
    want.knownServices,
  );
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
