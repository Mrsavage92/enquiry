import type { Sql } from "../db.ts";
import type { EnquiryInterpreter } from "../interpret/types.ts";
import {
  insertManualEnquiry,
  interpretAndApply,
  type InsertManualEnquiryInput,
} from "./manual-enquiry-core.ts";

/**
 * The one way a new enquiry enters the product, whoever brings it in.
 *
 * The owner pasting a message (`createManualEnquiry`) and the business's own
 * website form (`/api/inbound/form`) both call this, so the decision engine
 * runs identically for both: the enquiry and its inbound message are created
 * and decided in one transaction, the arrival is audited, and the message is
 * then read by the interpreter on a best-effort basis that can never lose the
 * enquiry that already committed.
 *
 * `claim` runs first, inside the creating transaction. Returning false aborts
 * creation with nothing written; the inbound form uses it to claim its
 * submission id, so a retried POST cannot create a second enquiry even when
 * two copies arrive at once. `link` runs inside the same transaction once the
 * enquiry exists.
 */
export type IntakeDeps = {
  /** Pool connection, for the audit line and the interpreter's reads. */
  sql: Sql;
  runInTransaction: <T>(fn: (sql: Sql) => Promise<T>) => Promise<T>;
  interpreter: EnquiryInterpreter;
};

export type IntakeAudit = { actor: string; summary: string; detail?: string };

export type IntakeHooks = {
  claim?: (tx: Sql) => Promise<boolean>;
  link?: (tx: Sql, enquiryId: string) => Promise<void>;
};

export type IntakeResult = { created: true; enquiryId: string } | { created: false };

export async function createEnquiryAndRead(
  deps: IntakeDeps,
  input: InsertManualEnquiryInput,
  audit: IntakeAudit,
  hooks: IntakeHooks = {},
): Promise<IntakeResult> {
  const created = await deps.runInTransaction(async (tx) => {
    if (hooks.claim && !(await hooks.claim(tx))) return null;
    const ids = await insertManualEnquiry(tx, input);
    if (hooks.link) await hooks.link(tx, ids.enquiryId);
    return ids;
  });
  if (!created) return { created: false };
  const { enquiryId, messageId } = created;

  await deps.sql`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${input.businessId}, ${audit.actor}, ${audit.summary}, ${audit.detail ?? null},
      ${"enquiry"}, ${enquiryId}
    )
  `;

  // Best-effort reading of the message: a slow, failed, or unconfigured
  // interpreter must never fail this request or lose the enquiry that
  // already committed above. interpretAndApply itself never throws for a
  // classified interpreter failure (it records the honest audit line and
  // returns); this catch is only for an unexpected exception elsewhere in
  // the step (e.g. a query failure while writing facts).
  //
  // Kept as an inline await rather than fired-and-forgotten: the operator
  // gets any read facts on this same response instead of a page reload
  // later, and the interpreter's own timeout (8s) bounds how long that
  // takes - interpretAndApply's internal write guards are what keep this
  // wait safe against a confirm landing on another tab in the meantime.
  try {
    await interpretAndApply(deps.sql, {
      enquiryId,
      businessId: input.businessId,
      messageId,
      rawMessage: input.body,
      interpreter: deps.interpreter,
      // The reads that build the prompt, and the provider call itself, run on
      // the pool - a model taking eight seconds must not hold a transaction
      // open. Everything it writes afterwards runs inside ONE, because a
      // `for update` issued on a pooled connection is released at the end of
      // its own statement and guards nothing.
      runInTransaction: deps.runInTransaction,
    });
  } catch (err) {
    console.error("[interpret] best-effort read of a new enquiry failed:", err);
  }

  return { created: true, enquiryId };
}
