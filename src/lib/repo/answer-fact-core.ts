import type { Sql } from "../db.ts";
import { normaliseFactAnswer, validateFactAnswer, type Decision } from "../../domain/decide.ts";
import { EXTRA_CHOICE, isExtraField } from "../../domain/extras.ts";
import { QUESTION_ANSWER, isQuestionField } from "../../domain/service-questions.ts";
import { COVERAGE_FIELD } from "../../domain/coverage.ts";
import { isRuleChoice, isRuleField } from "../../domain/rule-checks.ts";
import {
  ASK_CHOICE,
  askAnswerProblem,
  askTopic,
  isAskField,
  isReusableTopic,
} from "../../domain/customer-asks.ts";
import {
  describeDetail,
  detailSection,
  detailTitle,
  parseBusinessDetail,
} from "../../domain/business-detail.ts";

/**
 * Fields only their own server functions may write: the coverage confirmation
 * (confirm-coverage) and the practice sample price (practice only). Accepting
 * them here would let any answer box confirm a price or plant a rule.
 */
const RESERVED_FIELDS = new Set([COVERAGE_FIELD, "practice_price"]);

const EXTRA_CHOICES = new Set<string>([
  EXTRA_CHOICE.include,
  EXTRA_CHOICE.leaveOut,
  EXTRA_CHOICE.notAsked,
  EXTRA_CHOICE.covered,
  EXTRA_CHOICE.comeBack,
]);
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
  if (isRuleField(field)) {
    if (value === "apply") return "Your rule applied to this quote";
    if (value === "decline") return "Declined - outside your rule";
    if (value === "quote") return "Quoted - it fits your rule";
    return "Your rule doesn't apply here";
  }
  if (isQuestionField(field)) {
    return value === QUESTION_ANSWER.yes ? "Yes - you do this" : "No - you don't do this";
  }
  if (isAskField(field)) {
    if (value === ASK_CHOICE.later) return "You'll come back to them on it";
    if (value === ASK_CHOICE.ignore) return "Left out of the reply";
    if (value === ASK_CHOICE.yes) return "Yes - you're free";
    if (value === ASK_CHOICE.no) return "No - you're not free";
    return value;
  }
  if (!isExtraField(field)) return value;
  if (value === EXTRA_CHOICE.comeBack) return "Not priced - the reply says you'll come back on it";
  if (value === EXTRA_CHOICE.notAsked) return "They didn't ask for this";
  if (value === EXTRA_CHOICE.covered) return "Part of this price";
  return value === EXTRA_CHOICE.leaveOut ? "Left out - the reply says so" : "Added to the quote";
}

const EXACTLY = /^\s*(?:it'?s\s+)?exactly\s+/i;

/**
 * Keep the owner's answer as a business answer for its topic: one per topic,
 * the newest standing. Only for questions customers ask again (insurance,
 * licence, how long); a one-off question's answer stays on its enquiry.
 */
async function saveAskAnswer(
  tx: Sql,
  businessId: string,
  topic: string,
  question: string,
  text: string,
): Promise<void> {
  if (!isReusableTopic(topic)) return;
  const detail = parseBusinessDetail({
    kind: "answer",
    topic,
    question: question.trim() || topic,
    text,
  });
  if (!detail.ok) return;
  await tx`
    update knowledge_item
    set state = ${"Superseded"}, effective_to = now(), updated_at = now()
    where business_id = ${businessId} and state = ${"Active"}
      and rule_payload->>'kind' = ${"answer"} and rule_payload->>'topic' = ${topic}
  `;
  await tx`
    insert into knowledge_item
      (business_id, section, title, body, class, state, source, version, rule_payload,
       effective_from)
    values (
      ${businessId}, ${detailSection(detail.detail)}, ${detailTitle(detail.detail)},
      ${describeDetail(detail.detail)}, ${"authoritative"}, ${"Active"},
      ${JSON.stringify({ kind: "user", label: "Confirmed by the owner", detail: text })}::jsonb,
      ${"1"}, ${JSON.stringify(detail.detail)}::jsonb, now()
    )
  `;
}

export async function answerFactForUser(
  sql: Sql,
  runInTransaction: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>,
  userId: string,
  input: AnswerFactInput,
): Promise<AnswerFactResult> {
  const { enquiryId, businessId } = await requireEnquiryAccess(userId, input.enquiryId, sql);
  if (RESERVED_FIELDS.has(input.field.trim().toLowerCase())) {
    throw new Error("That detail can't be set from here.");
  }

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
  // "It's exactly 90": the owner confirms their rough figure is exact, so the
  // reply stops saying "about".
  const exact = EXACTLY.test(input.value);
  const typed = exact ? input.value.replace(EXACTLY, "") : input.value;
  // "three" is 3: a written count is stored as digits, then checked.
  const value = normaliseFactAnswer(brain, input.field, typed);
  if (isAskField(input.field)) {
    const problem = askAnswerProblem(input.field, value);
    if (problem) throw new Error(problem);
  }
  if (isExtraField(input.field) && !EXTRA_CHOICES.has(value)) {
    throw new Error("Choose whether to add it to the quote or leave it out.");
  }
  if (
    isQuestionField(input.field) &&
    value !== QUESTION_ANSWER.yes &&
    value !== QUESTION_ANSWER.no
  ) {
    throw new Error("Answer yes or no.");
  }
  if (input.field.trim().toLowerCase() === "recurring" && value !== "yes" && value !== "no") {
    throw new Error("Answer yes or no.");
  }
  // One of the owner's own rules on this quote: applied, waived, or (for an
  // "only if" rule) quoted anyway or declined. Nothing else is a choice.
  if (isRuleField(input.field) && !isRuleChoice(value)) {
    throw new Error("Choose whether your rule applies to this job.");
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
    // Confirming their own rough figure ("maybe 12sqm") keeps it rough: the
    // reply then says "about", never states it as exact.
    const [reading] = await tx<{ value: string; display_value: string | null }>`
      select value, display_value from enquiry_fact
      where enquiry_id = ${enquiryId} and lower(field) = lower(${input.field})
        and superseded = false and status <> ${"confirmed"}
      limit 1
    `;
    const rough =
      !exact &&
      reading &&
      String(reading.value).trim() === value &&
      /\b(?:about|roughly|around|approx(?:imately)?|maybe|~|nearly|almost|ish)\b|~/i.test(
        reading.display_value ?? "",
      );
    const display = rough ? `about ${value}` : displayFor(input.field, value);
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
        ${enquiryId}, ${input.field}, ${input.field}, ${value}, ${display},
        ${"confirmed"}, ${"High"}, ${"user"},
        ${JSON.stringify({ kind: "user", label: "Confirmed by the owner" })}::jsonb,
        ${true}
      )
    `;
    // The owner's own answer to a question customers ask again is kept as a
    // business answer, offered (never sent) the next time it is asked.
    if (
      isAskField(input.field) &&
      ![ASK_CHOICE.later, ASK_CHOICE.ignore].includes(value as never)
    ) {
      await saveAskAnswer(
        tx,
        businessId,
        askTopic(input.field),
        reading?.display_value ?? "",
        value,
      );
    }
    // Confirming (or correcting) the name read from their message is what
    // lets the reply greet them by it.
    const isName = input.field.trim().toLowerCase() === "name";
    if (isName) {
      await tx`update enquiry set customer_name = ${value}, updated_at = now() where id = ${enquiryId}`;
    }
    return applyDecision(tx, {
      enquiryId,
      businessId,
      // Re-read under the lock rather than trusting the value read before it.
      serviceLabel: locked.serviceLabel,
      customerName: isName ? value : locked.customerName,
    });
  });
  return { businessId, enquiryId, value, decision: result.decision, revision: result.revision };
}
