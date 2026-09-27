import type { Sql } from "../db.ts";
import { confirmShownCoverage } from "./coverage-core.ts";

/**
 * For tests that drive a flow without a screen: the owner pressing "That's
 * everything" on whatever each open enquiry of the business currently shows.
 * A no-op on anything not priced or already confirmed.
 */
export async function settleShownCoverage(sql: Sql, businessId: string): Promise<void> {
  const rows = await sql<{ id: string }>`
    select id from enquiry where business_id = ${businessId} and lifecycle = ${"OPEN"}
  `;
  for (const r of rows) await confirmShownCoverage(sql, r.id);
}
