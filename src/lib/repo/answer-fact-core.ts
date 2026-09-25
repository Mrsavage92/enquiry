import type { Sql } from "../db.ts";
import { normaliseFactAnswer, validateFactAnswer, type Decision } from "../../domain/decide.ts";
import { EXTRA_CHOICE, isExtraField } from "../../domain/extras.ts";
import { applyDecision, isClosed, lockEnquiry } from "./decision-apply.ts";
import { requireEnquiryAccess } from "./tenancy.server.ts";

/**
 * The owner answering one fact on one enquiry, as pure SQL logic against
 * whatever `sql` the caller passes - so a PGLite test proves what lands in the
 * database, and that another tenant's attempt lands nothing.
 *
 * Tenant-scoped first: `requireEnquiryAccess` runs before anything is read or
 * written, and every query after it uses the checked id it returns.
 */

export type AnswerFactInput = { enquiryId: string; field: string; value: string };

export type AnswerFactResult = {
  businessId: string;
  enquiryId: string;
  /** What was stored: a written count is stored as digits. */
  value: string;
  decision: Decision;
  revision: number;
};

/** How an owner's choice about an extra reads back in the case file. */
function displayFor(field: string, value: string): string {
  if (!isExtraField(field)) return value;
  return value === EXTRA_CHOICE.leaveOut ? "Left out - the reply says so" : "Added to the quote";
}

export async function answerFactForUser(
  sql: Sql,
  runInTransaction: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>,
  userId: string,
  input: AnswerFactInput,
): Promise<AnswerFactResult> {
  const { enquiryId, businessId } = await requireEnquiryAccess(userId, input.enquiryId, sql);

  const [enq] = await sql<{ service_label: string }>`
    select service_label from enquiry where id = ${enquiryId}
  `;
  if (!enq) throw new Error("That enquiry no longer exists.");

  // Refuse to record a confirmation of something that cannot mean what it
  // claims to. "5-6" is a range the owner has in mind, not a quantity, and
  // storing it `confirmed` asserts they settled a number they did not settle.
  // Checked here, at the write, as well as in the compiler that reads it - a
  // UI-side input restriction is not an invariant.
  const knowledge = await sql<{ state: string; rule_payload: unknown }>`
    select state, rule_payload from knowledge_item
    where business_id = ${businessId} and rule_payload is not null
  `;
  const brain = {
    knowledge: knowledge.map((k) => ({ state: k.state, rulePayload: k.rule_payload })),
  };
  // "three" is 3: a written count is stored as digits, then checked.
  const value = normaliseFactAnswer(brain, input.field, input.value);
  if (
    isExtraField(input.field) &&
    value !== EXTRA_CHOICE.include &&
    value !== EXTRA_CHOICE.leaveOut
  ) {
    throw new Error("Choose whether to add it to the quote or leave it out.");
  }
  const problem = validateFactAnswer(brain, enq.service_label ?? "", input.field, value);
  if (problem) throw new Error(problem);

  // The answer, the decision it unlocks and the revision bump are one
  // transaction - see `setEnquiryService` for the failure this closes.
  const result = await runInTransaction(async (tx) => {
    const locked = await lockEnquiry(tx, enquiryId);
    if (!locked) throw new Error("That enquiry no longer exists.");
    if (isClosed(locked.lifecycle)) {
      throw new Error("That enquiry is closed. Reopen it before answering.");
    }
    // One live answer per field: an earlier one is superseded, not deleted,
    // so the case file still shows what was believed and when.
    await tx`
      update enquiry_fact set superseded = true, updated_at = now()
      where enquiry_id = ${enquiryId} and lower(field) = lower(${input.field})
        and superseded = false
    `;
    await tx`
      insert into enquiry_fact
        (enquiry_id, field, label, value, display_value, status, confidence,
         asserted_by, provenance, customer_specific)
      values (
        ${enquiryId}, ${input.field}, ${input.field}, ${value}, ${displayFor(input.field, value)},
        ${"confirmed"}, ${"High"}, ${"user"},
        ${JSON.stringify({ kind: "user", label: "Confirmed by the owner" })}::jsonb,
        ${true}
      )
    `;
    return applyDecision(tx, {
      enquiryId,
      businessId,
      // Re-read under the lock rather than trusting the value read before it.
      serviceLabel: locked.serviceLabel,
      customerName: locked.customerName,
    });
  });
  return { businessId, enquiryId, value, decision: result.decision, revision: result.revision };
}
