import type { Sql } from "../db.ts";
import { confirmShownCoverage } from "./coverage-core.ts";
import { applyDecision, lockEnquiry } from "./decision-apply.ts";
import { unsettledFlags, type CoverageFlag } from "../../domain/coverage.ts";
import { settlingFact } from "../../domain/coverage-testing.ts";

/** For tests: settle every flag the plainest way, as the owner would, then re-decide. */
async function settleFlags(sql: Sql, enquiryId: string): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    const [row] = await sql<{ flagged: CoverageFlag[] | null }>`
      select decision_snapshot -> 'coverage' -> 'flagged' as flagged from enquiry where id = ${enquiryId}
    `;
    const open = unsettledFlags(row?.flagged ?? []);
    if (open.length === 0) return;
    const locked = await lockEnquiry(sql, enquiryId);
    if (!locked) return;
    for (const flag of open) {
      const { field, value } = settlingFact(flag);
      await sql`
        insert into enquiry_fact
          (enquiry_id, field, label, value, display_value, status, confidence, asserted_by,
           provenance, customer_specific)
        values (${enquiryId}, ${field}, ${field}, ${value}, ${value}, ${"confirmed"}, ${"High"},
          ${"user"}, ${JSON.stringify({ kind: "user" })}::jsonb, ${true})
      `;
    }
    await applyDecision(sql, {
      enquiryId,
      businessId: locked.businessId,
      serviceLabel: locked.serviceLabel,
      customerName: locked.customerName,
    });
  }
}

/**
 * For tests that drive a flow without a screen: the owner settling every flag
 * and pressing "That's everything" on whatever each open enquiry of the
 * business currently shows. A no-op on anything not priced or already confirmed.
 */
export async function settleShownCoverage(sql: Sql, businessId: string): Promise<void> {
  const rows = await sql<{ id: string }>`
    select id from enquiry where business_id = ${businessId} and lifecycle = ${"OPEN"}
  `;
  for (const r of rows) {
    await settleFlags(sql, r.id);
    await confirmShownCoverage(sql, r.id);
  }
}
