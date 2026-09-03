import type { Sql } from "../db.ts";
import type { ConfidenceBand, FactStatus } from "../../domain/types.ts";
import { activeRules, decideEnquiry } from "../../domain/decide.ts";
import { describeRule } from "../../domain/business-rule.ts";
import { snapshotFromDecision, stateFromDecision } from "../../domain/decision-snapshot.ts";
import type { EnquiryInterpreter, InterpretFailureReason } from "../interpret/types.ts";

/**
 * Creating a real enquiry, as pure SQL logic - deliberately separate from
 * `enquiry-actions.ts`, which owns auth and connection management. Kept here,
 * against whatever `sql` the caller passes in, the same way
 * `sent-reply-core.ts` is: so a PGLite test can call it directly and prove
 * what actually lands in the database, not just what the handler claims to do.
 *
 * `insertManualEnquiry` is the part that must run inside a transaction (the
 * enquiry row and its inbound message must both exist or neither does).
 * `interpretAndApply` runs afterwards, deliberately NOT in that transaction -
 * a slow or failing interpretation must never hold the enquiry-creation
 * transaction open, and per R2E it must never be able to lose the enquiry
 * that already committed.
 */

export type InsertManualEnquiryInput = {
  businessId: string;
  body: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceLabel: string;
  intakeNote: string;
};

export type InsertManualEnquiryResult = { enquiryId: string; messageId: string };

/** Decide it on arrival, from this business's own confirmed rules, then persist. */
export async function insertManualEnquiry(
  sql: Sql,
  input: InsertManualEnquiryInput,
): Promise<InsertManualEnquiryResult> {
  const knowledge = await sql<{ state: string; rule_payload: unknown }>`
    select state, rule_payload from knowledge_item
    where business_id = ${input.businessId} and rule_payload is not null
  `;
  const [owner] = await sql<{ owner_first_name: string | null }>`
    select owner_first_name from business where id = ${input.businessId}
  `;
  const decision = decideEnquiry(
    { knowledge: knowledge.map((k) => ({ state: k.state, rulePayload: k.rule_payload })) },
    { serviceLabel: input.serviceLabel, facts: [] },
  );
  const snapshot = snapshotFromDecision(decision, {
    customerName: input.customerName,
    ownerFirstName: owner?.owner_first_name ?? undefined,
    serviceLabel: input.serviceLabel,
  });
  const state = stateFromDecision(decision);

  const rows = await sql<{ id: string }>`
    insert into enquiry (
      business_id, customer_name, customer_email, customer_phone, source,
      service_label, lifecycle, decision_state, commercial_state,
      responsibility, intake_note, decision_snapshot, received_at, updated_at
    ) values (
      ${input.businessId}, ${input.customerName}, ${input.customerEmail},
      ${input.customerPhone || null}, ${"manual"}, ${input.serviceLabel},
      ${"OPEN"}, ${state.decisionState}, ${state.commercialState},
      ${state.responsibility},
      ${input.intakeNote || null}, ${JSON.stringify(snapshot)}::jsonb, now(), now()
    )
    returning id
  `;
  const enquiryId = rows[0]?.id;
  if (!enquiryId) throw new Error("Could not create the enquiry.");

  const msgRows = await sql<{ id: string }>`
    insert into message
      (enquiry_id, direction, channel, at, from_addr, to_addr, body, intake)
    values (
      ${enquiryId}, ${"inbound"}, ${"manual"}, now(),
      ${input.customerEmail || input.customerName || "Customer"}, ${""},
      ${input.body}, ${"manual"}
    )
    returning id
  `;
  const messageId = msgRows[0]?.id;
  if (!messageId) throw new Error("Could not record the inbound message.");

  return { enquiryId, messageId };
}

export type InterpretAndApplyInput = {
  enquiryId: string;
  businessId: string;
  messageId: string;
  rawMessage: string;
  interpreter: EnquiryInterpreter;
};

export type InterpretAndApplyResult =
  | { ok: true; model: string; factsWritten: number; serviceLabelSet: string | null }
  | { ok: false; reason: InterpretFailureReason | "enquiry_missing" };

const norm = (s: string): string => s.trim().toLowerCase();

function toDbConfidence(band: "low" | "medium" | "high"): ConfidenceBand {
  if (band === "high") return "High";
  if (band === "medium") return "Medium";
  return "Low";
}

/**
 * Supersede-then-insert, but ONLY when the current live row for this field
 * (if any) is not itself `status = 'confirmed'` or `asserted_by = 'user'` - a
 * model may never supersede a human. That guard is evaluated in the SAME
 * statement as the write, not from a value read earlier in the request:
 * `interpretAndApply` awaits an interpreter call that can take up to 8
 * seconds, and a pre-read guard leaves that whole window open for an
 * operator's confirmation (via `answerEnquiryFact` or `setEnquiryService`,
 * from a second tab or a teammate) to be silently clobbered back to an
 * inferred, unconfirmed value with no error and no UI explanation.
 *
 * The `blocked` CTE is read-only but is still evaluated exactly once, against
 * one consistent snapshot, and both the `sup` update and the final insert key
 * off it - so within this one statement there is no window between "check"
 * and "write" for a concurrent confirm to land in.
 *
 * Returns whether a row was actually written, so the caller's `factsWritten`
 * count and audit line reflect what landed, not what was attempted.
 */
async function supersedeAndInsertFact(
  sql: Sql,
  enquiryId: string,
  field: string,
  value: string,
  displayValue: string,
  status: FactStatus,
  confidence: ConfidenceBand,
  provenance: Record<string, unknown>,
): Promise<boolean> {
  const rows = await sql<{ id: string }>`
    with blocked as (
      select 1 from enquiry_fact
      where enquiry_id = ${enquiryId} and lower(field) = lower(${field})
        and superseded = false
        and (status = 'confirmed' or asserted_by = 'user')
    ),
    sup as (
      update enquiry_fact set superseded = true, updated_at = now()
      where enquiry_id = ${enquiryId} and lower(field) = lower(${field})
        and superseded = false
        and not exists (select 1 from blocked)
      returning id
    )
    insert into enquiry_fact
      (enquiry_id, field, label, value, display_value, status, confidence,
       asserted_by, provenance, customer_specific)
    select ${enquiryId}, ${field}, ${field}, ${value}, ${displayValue},
      ${status}, ${confidence}, ${"system"}, ${JSON.stringify(provenance)}::jsonb, ${true}
    where not exists (select 1 from blocked)
    returning id
  `;
  return rows.length > 0;
}

/**
 * Best-effort: read the raw message with whatever interpreter was selected,
 * persist what it proposes as `inferred`/`check_this` facts (NEVER
 * `confirmed` - only `answerEnquiryFact`/`setEnquiryService` may write that),
 * and re-decide so the desk reflects the new (still unconfirmed) evidence.
 *
 * The interpreter call this awaits can take up to 8 seconds. Facts and the
 * service label are read once up front (`enq`, `rules`) to build its prompt,
 * but every WRITE below re-checks the live row at write time rather than
 * trusting that early read - an operator can confirm the very fact this call
 * is about to propose, or set the service, in the seconds this is in flight.
 * See `supersedeAndInsertFact` and the guarded service-label update.
 *
 * Every branch - a real result, a classified failure, an unexpected exception
 * bubbling from a query - is expected to be wrapped by the caller in its own
 * try/catch, because this step must never fail the enquiry-creation request
 * or lose the enquiry that already committed.
 */
export async function interpretAndApply(
  sql: Sql,
  input: InterpretAndApplyInput,
): Promise<InterpretAndApplyResult> {
  const [serviceRows, knowledgeRows, bizRows, enqRows] = await Promise.all([
    sql<{ customer_label: string; name: string }>`
      select customer_label, name from business_service where business_id = ${input.businessId}
    `,
    sql<{ state: string; rule_payload: unknown }>`
      select state, rule_payload from knowledge_item
      where business_id = ${input.businessId} and rule_payload is not null
    `,
    sql<{ industry: string; owner_first_name: string | null }>`
      select industry, owner_first_name from business where id = ${input.businessId}
    `,
    sql<{ service_label: string; customer_name: string }>`
      select service_label, customer_name from enquiry where id = ${input.enquiryId}
    `,
  ]);

  const enq = enqRows[0];
  if (!enq) return { ok: false, reason: "enquiry_missing" };

  const knowledge = knowledgeRows.map((k) => ({ state: k.state, rulePayload: k.rule_payload }));
  const rules = activeRules({ knowledge });
  const ruleSummaries = rules.map(describeRule);
  const services = serviceRows.map((s) => s.customer_label || s.name).filter((s) => s.trim());
  const biz = bizRows[0];

  const outcome = await input.interpreter.interpret({
    rawMessage: input.rawMessage,
    messageId: input.messageId,
    business: { services, ruleSummaries, industry: biz?.industry ?? "" },
  });

  if (!outcome.ok) {
    await sql`
      insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
      values (
        ${input.businessId}, ${"system"},
        ${`Could not read the message automatically (${outcome.reason})`},
        ${null},
        ${"enquiry"}, ${input.enquiryId}
      )
    `;
    return { ok: false, reason: outcome.reason };
  }

  const { result, model } = outcome;
  let factsWritten = 0;
  let serviceLabelSet: string | null = null;

  for (const fact of result.facts) {
    const status: FactStatus = fact.confidence === "low" ? "check_this" : "inferred";
    const written = await supersedeAndInsertFact(
      sql,
      input.enquiryId,
      fact.field,
      fact.value,
      fact.displayValue || fact.value,
      status,
      toDbConfidence(fact.confidence),
      {
        kind: "model",
        label: "Read from the customer's message",
        messageId: input.messageId,
        span: fact.span,
        model,
      },
    );
    if (written) factsWritten += 1;
  }

  // Only apply a proposed service when the field matches an Active rule for
  // this business AND is still blank - never a guess the pricing compiler
  // could act on without the owner having seen it. "Still blank" is re-checked
  // INSIDE this update, not from `enq.service_label` read up to 8 seconds ago:
  // the operator may have set it via `setEnquiryService` while the interpreter
  // call was in flight, and a pre-read check would silently overwrite that.
  if (result.serviceCandidate) {
    const candidate = result.serviceCandidate;
    const match = rules.find((r) => norm(r.service) === norm(candidate.label));
    if (match) {
      const updated = await sql<{ id: string }>`
        update enquiry set service_label = ${match.service}, updated_at = now()
        where id = ${input.enquiryId}
          and (service_label is null or btrim(service_label) = '')
        returning id
      `;
      if (updated.length > 0) {
        serviceLabelSet = match.service;
        const written = await supersedeAndInsertFact(
          sql,
          input.enquiryId,
          "service",
          match.service,
          match.service,
          // Always check_this, regardless of the candidate's own confidence -
          // getting the service wrong cascades into which quantity field is
          // even asked for, so this one always gets a second look.
          "check_this",
          toDbConfidence(candidate.confidence),
          {
            kind: "model",
            label: "Read from the customer's message",
            messageId: input.messageId,
            span: candidate.span,
            model,
          },
        );
        if (written) factsWritten += 1;
      }
    }
  }

  // Re-decide from what's actually true after the guarded writes above - never
  // from `enq`, which can be up to 8 seconds stale by the time we get here.
  const [freshEnq] = await sql<{ service_label: string; customer_name: string }>`
    select service_label, customer_name from enquiry where id = ${input.enquiryId}
  `;
  const factRows = await sql<{ field: string; value: string; status: string }>`
    select field, value, status from enquiry_fact
    where enquiry_id = ${input.enquiryId} and superseded = false
  `;
  const effectiveServiceLabel = freshEnq?.service_label ?? enq.service_label;
  const decision = decideEnquiry(
    { knowledge },
    { serviceLabel: effectiveServiceLabel, facts: factRows as never },
  );
  const snapshot = snapshotFromDecision(decision, {
    customerName: freshEnq?.customer_name ?? enq.customer_name,
    ownerFirstName: biz?.owner_first_name ?? undefined,
    serviceLabel: effectiveServiceLabel,
  });
  const state = stateFromDecision(decision);
  await sql`
    update enquiry
    set decision_snapshot = ${JSON.stringify(snapshot)}::jsonb,
        decision_state = ${state.decisionState},
        commercial_state = ${state.commercialState},
        responsibility = ${state.responsibility},
        updated_at = now()
    where id = ${input.enquiryId}
  `;

  await sql`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${input.businessId}, ${"system"},
      ${`Enquiry read the message: ${factsWritten} fact${factsWritten === 1 ? "" : "s"} suggested`},
      ${`Model: ${model}`},
      ${"enquiry"}, ${input.enquiryId}
    )
  `;

  return { ok: true, model, factsWritten, serviceLabelSet };
}
