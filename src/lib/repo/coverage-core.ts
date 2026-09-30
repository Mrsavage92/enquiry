import type { Sql } from "../db.ts";
import { COVERAGE_FIELD, unsettledFlags, type CoverageFlag } from "../../domain/coverage.ts";
import { applyDecision, isClosed, lockEnquiry } from "./decision-apply.ts";
import { requireEnquiryAccess } from "./tenancy.server.ts";
import { openAsked, type AskedItem } from "../../domain/asked.ts";
import { describeChange, updateEditFigures } from "../../domain/edit-figures.ts";
import type { Decision } from "../../domain/decide.ts";

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
  | {
      ok: true;
      businessId: string;
      enquiryId: string;
      revision: number;
      confirmed: boolean;
      /**
       * The owner's own edit of the reply, kept through the confirmation: its
       * words stay, and only the figures that moved are brought up to date.
       * `changes` says which ("Makeup trial $90 -> $95").
       */
      editKept?: { changes: string[] };
    }
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
  const [row] = await tx<{
    key: string | null;
    flagged: CoverageFlag[] | null;
    asked: AskedItem[] | null;
  }>`
    select decision_snapshot -> 'coverage' ->> 'key' as key,
      decision_snapshot -> 'coverage' -> 'flagged' as flagged,
      decision_snapshot -> 'asked' as asked
    from enquiry where id = ${enquiryId}
  `;
  const stored = row?.key ?? "";
  if (!stored || stored !== input.key || locked.decisionRevision !== input.revision) {
    return { ok: false, businessId, reason: "changed", message: CHANGED };
  }
  // Everything they asked for or about has an answer, a "leave it out" or a
  // "come back": "That's everything" is never said over one still open.
  const unasked = openAsked(row?.asked ?? []).filter(
    (i) => i.kind !== "service" && i.kind !== "date",
  );
  if (unasked.length > 0) {
    return {
      ok: false,
      businessId,
      reason: "unsettled",
      message: `Settle what they asked first: ${unasked.map((i) => i.text).join(", ")}.`,
    };
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
  // The reply the owner is part-way through editing, for this decision.
  const [draft] = await tx<{ body: string }>`
    select body from reply_draft
    where enquiry_id = ${enquiryId} and decision_revision = ${locked.decisionRevision}
  `;
  const applied = await applyDecision(tx, {
    enquiryId,
    businessId,
    serviceLabel: locked.serviceLabel,
    customerName: locked.customerName,
  });
  const editKept = draft ? await keepEdit(tx, enquiryId, draft.body, applied) : undefined;
  return {
    ok: true,
    businessId,
    enquiryId,
    revision: applied.revision,
    confirmed: Boolean(applied.decision.coverage?.confirmed),
    ...(editKept ? { editKept } : {}),
  };
}

/**
 * "That's everything" is about the very reply the owner is editing: their
 * edit stays theirs. It moves to the new decision with only the figures the
 * decision owns brought up to date, never swapped for the prepared text.
 */
async function keepEdit(
  tx: Sql,
  enquiryId: string,
  body: string,
  applied: { decision: Decision; revision: number },
): Promise<{ changes: string[] }> {
  const d = applied.decision;
  const lines =
    d.price.kind !== "EXACT"
      ? []
      : d.lines?.length
        ? d.lines
        : [
            {
              label: d.price.rule.service,
              amountMinor: d.price.amountMinor,
              ...(d.price.rule.kind === "per_unit"
                ? { detail: d.price.workings.replace(/\.$/, "") }
                : {}),
            },
          ];
  const total = d.price.kind === "EXACT" ? d.price.amountMinor : null;
  const updated = updateEditFigures(body, lines, total);
  await tx`
    update reply_draft
    set body = ${updated.body}, decision_revision = ${applied.revision}, updated_at = now()
    where enquiry_id = ${enquiryId}
  `;
  return { changes: updated.changes.map(describeChange) };
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
