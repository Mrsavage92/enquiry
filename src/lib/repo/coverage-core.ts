import type { Sql } from "../db.ts";
import { COVERAGE_FIELD, unsettledFlags, type CoverageFlag } from "../../domain/coverage.ts";
import { applyDecision, isClosed, lockEnquiry } from "./decision-apply.ts";
import { requireEnquiryAccess } from "./tenancy.server.ts";

/**
 * "That's everything": the owner confirming what a price covers, as pure SQL
 * logic, tenant-scoped first.
 *
 * The owner confirms what they SAW: the coverage key and the decision revision
 * on their screen. If either no longer matches what is stored, nothing is
 * written and they are asked to look again - a confirmation can never land on
 * a price that moved underneath it. The confirmation is a `coverage` fact
 * holding the key; any later fact change makes the decision compute a
 * different key, and the confirmation stops counting.
 */

export type ConfirmCoverageInput = { enquiryId: string; key: string; revision: number };

export type ConfirmCoverageResult =
  | { ok: true; businessId: string; enquiryId: string; revision: number; confirmed: boolean }
  | { ok: false; businessId: string; reason: "changed" | "closed" | "unsettled"; message: string };

const CHANGED =
  "The details changed since you looked. Check what the price covers again before you confirm it.";

/** Inside the caller's transaction, for an enquiry already checked to be theirs. */
export async function confirmCoverageInTransaction(
  tx: Sql,
  input: ConfirmCoverageInput & { businessId: string },
): Promise<ConfirmCoverageResult> {
  const { enquiryId, businessId } = input;
  const locked = await lockEnquiry(tx, enquiryId);
  if (!locked || isClosed(locked.lifecycle)) {
    return { ok: false, businessId, reason: "closed", message: "That enquiry is closed." };
  }
  const [row] = await tx<{ key: string | null; flagged: CoverageFlag[] | null }>`
    select decision_snapshot -> 'coverage' ->> 'key' as key,
      decision_snapshot -> 'coverage' -> 'flagged' as flagged
    from enquiry where id = ${enquiryId}
  `;
  const stored = row?.key ?? "";
  if (!stored || stored !== input.key || locked.decisionRevision !== input.revision) {
    return { ok: false, businessId, reason: "changed", message: CHANGED };
  }
  const open = unsettledFlags(row?.flagged ?? []);
  if (open.length > 0) {
    return {
      ok: false,
      businessId,
      reason: "unsettled",
      message: `Settle what they mentioned first: ${open.map((f) => f.thing).join(", ")}.`,
    };
  }
  await tx`
    update enquiry_fact set superseded = true, updated_at = now()
    where enquiry_id = ${enquiryId} and lower(field) = ${COVERAGE_FIELD} and superseded = false
  `;
  await tx`
    insert into enquiry_fact
      (enquiry_id, field, label, value, display_value, status, confidence,
       asserted_by, provenance, customer_specific)
    values (
      ${enquiryId}, ${COVERAGE_FIELD}, ${"What the price covers"}, ${stored},
      ${"You confirmed what the price covers"}, ${"confirmed"}, ${"High"}, ${"user"},
      ${JSON.stringify({
        kind: "user",
        label: "Confirmed by the owner",
        revision: locked.decisionRevision,
      })}::jsonb,
      ${true}
    )
  `;
  const applied = await applyDecision(tx, {
    enquiryId,
    businessId,
    serviceLabel: locked.serviceLabel,
    customerName: locked.customerName,
  });
  return {
    ok: true,
    businessId,
    enquiryId,
    revision: applied.revision,
    confirmed: Boolean(applied.decision.coverage?.confirmed),
  };
}

export async function confirmCoverageForUser(
  sql: Sql,
  runInTransaction: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>,
  userId: string,
  input: ConfirmCoverageInput,
): Promise<ConfirmCoverageResult> {
  const { enquiryId, businessId } = await requireEnquiryAccess(userId, input.enquiryId, sql);
  return runInTransaction((tx) =>
    confirmCoverageInTransaction(tx, { ...input, enquiryId, businessId }),
  );
}

/**
 * The owner pressing "That's everything" on whatever coverage the enquiry
 * currently shows. For flows driven without a screen (tests, the benchmark);
 * a no-op when nothing is priced or it is already confirmed.
 */
export async function confirmShownCoverage(
  tx: Sql,
  enquiryId: string,
): Promise<ConfirmCoverageResult | null> {
  const [row] = await tx<{
    business_id: string;
    revision: number;
    key: string | null;
    confirmed: string | null;
  }>`
    select business_id, decision_revision as revision,
      decision_snapshot -> 'coverage' ->> 'key' as key,
      decision_snapshot -> 'coverage' ->> 'confirmed' as confirmed
    from enquiry where id = ${enquiryId}
  `;
  if (!row?.key || row.confirmed === "true") return null;
  return confirmCoverageInTransaction(tx, {
    enquiryId,
    businessId: row.business_id,
    key: row.key,
    revision: Number(row.revision),
  });
}
