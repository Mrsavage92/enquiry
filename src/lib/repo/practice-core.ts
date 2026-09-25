import type { Sql } from "../db.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { activeRules } from "../../domain/decide.ts";
import { pluraliseUnit, type BusinessRule } from "../../domain/business-rule.ts";
import { tradeExamples } from "../../domain/trade-examples.ts";

/**
 * A practice enquiry a new owner can try before a real customer arrives
 * (attention plan C12).
 *
 * Created only when the owner asks for one - never inserted on their behalf -
 * and marked `practice` so it is labelled everywhere, counted nowhere, and can
 * never be prepared for sending or recorded as sent (reviewed-send-core.ts
 * refuses it). Deleting it removes the row and, by cascade, every fact,
 * message, draft and reviewed artefact hanging off it, plus its audit lines.
 *
 * Both functions assume they are inside a transaction.
 */

/**
 * The practice customer asks about a Saturday a couple of weeks out, written
 * the way customers write it, so the owner sees the job date read from words.
 */
/**
 * What the practice customer asks for: one of the owner's own priced services
 * (a per-unit one with the count written in, so the owner sees a reading
 * checked in one tap), or - with no prices yet - a job in their trade, whose
 * next step is adding prices. Never another trade's job.
 */
export type PracticeJob = { service: string; count?: string };

export function practiceJob(rules: BusinessRule[], industry = ""): PracticeJob {
  const sorted = [...rules].sort((a, b) => a.service.localeCompare(b.service));
  const perUnit = sorted.find((r) => r.kind === "per_unit");
  if (perUnit && perUnit.kind === "per_unit") {
    const n = /square|metre|meter/i.test(perUnit.unit) ? 40 : 3;
    return { service: perUnit.service, count: `${n} ${pluraliseUnit(perUnit.unit, n)}` };
  }
  if (sorted[0]) return { service: sorted[0].service };
  return { service: tradeExamples(industry).service };
}

export function practiceMessage(now = new Date(), job?: PracticeJob): string {
  const day = new Date(now.getTime() + 14 * 86_400_000);
  day.setDate(day.getDate() + ((6 - day.getDay() + 7) % 7));
  const n = day.getDate();
  const tens = n % 100;
  const sfx =
    tens >= 11 && tens <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  const month = day.toLocaleString("en-AU", { month: "long" });
  const what = job
    ? `a price for ${job.service.toLowerCase()}${job.count ? ` - it's ${job.count}` : ""}`
    : "a price for the job";
  return `Hi, could you give me ${what}, and let me know if Saturday the ${n}${sfx} of ${month} works? We are in Kedron. Thanks, Sam`;
}

export const PRACTICE_NAME = "Sam";

export async function createPracticeEnquiryInTransaction(
  sql: Sql,
  input: { businessId: string; now?: Date },
): Promise<{ enquiryId: string; existing: boolean }> {
  // One at a time: asking again opens the one already there. The lock makes
  // two quick clicks queue here instead of racing to insert; the unique index
  // (migrations/0012) is the backstop, handled by the server function.
  await sql`select pg_advisory_xact_lock(hashtext(${`practice:${input.businessId}`}))`;
  const [existing] = await sql<{ id: string }>`
    select id from enquiry
    where business_id = ${input.businessId} and practice = true
    order by received_at desc
    limit 1
  `;
  if (existing) return { enquiryId: existing.id, existing: true };
  const knowledge = await sql<{ state: string; rule_payload: unknown }>`
    select state, rule_payload from knowledge_item
    where business_id = ${input.businessId} and rule_payload is not null
  `;
  const [biz] = await sql<{ industry: string | null }>`
    select industry from business where id = ${input.businessId}
  `;
  const rules = activeRules({
    knowledge: knowledge.map((k) => ({ state: k.state, rulePayload: k.rule_payload })),
  });
  const { enquiryId } = await insertManualEnquiry(sql, {
    businessId: input.businessId,
    body: practiceMessage(input.now, practiceJob(rules, biz?.industry ?? "")),
    customerName: PRACTICE_NAME,
    customerEmail: "",
    customerPhone: "",
    serviceLabel: "",
    intakeNote: "Practice enquiry. Nothing from it is sent or counted.",
    practice: true,
    now: input.now,
  });
  return { enquiryId, existing: false };
}

export async function deletePracticeEnquiryInTransaction(
  sql: Sql,
  input: { businessId: string; enquiryId: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  // `practice = true` in the same statement: this path can never delete a
  // real enquiry, whatever id it is handed.
  const deleted = await sql<{ id: string }>`
    delete from enquiry
    where id = ${input.enquiryId} and business_id = ${input.businessId} and practice = true
    returning id
  `;
  if (deleted.length === 0) {
    return { ok: false, message: "Only a practice enquiry can be deleted." };
  }
  await sql`
    delete from audit_event
    where business_id = ${input.businessId} and object_type = ${"enquiry"}
      and object_id = ${input.enquiryId}
  `;
  return { ok: true };
}

/** The business's practice enquiry, if it has one. */
export async function findPracticeEnquiry(sql: Sql, businessId: string): Promise<string | null> {
  const [row] = await sql<{ id: string }>`
    select id from enquiry where business_id = ${businessId} and practice = true limit 1
  `;
  return row?.id ?? null;
}

/** Postgres unique-violation, e.g. a second practice row for one business. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "23505";
}
