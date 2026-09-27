#!/usr/bin/env node
/**
 * One-off: re-decide every open enquiry that is the owner's turn, business by
 * business, against DATABASE_URL. Written for the pass-5 price check: an open
 * quote decided before it existed has no coverage key, so the owner cannot
 * confirm or send it until it is re-decided. (Reading the workspace also does
 * this lazily; this script does it for everyone at once.)
 *
 *   node --experimental-strip-types --import ./scripts/test-resolve-hook.mjs \
 *     scripts/redecide-open.mjs --dry-run
 *
 * --dry-run  re-decides inside each business's transaction, reports what would
 *            change, then rolls back. Nothing is written.
 *
 * Without --dry-run each business is its own transaction: a failure leaves
 * that business untouched and the others done. Enquiries waiting on the
 * customer, closed or booked are never touched; what was sent stays as sent.
 */
const dryRun = process.argv.includes("--dry-run");

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    "[redecide-open] DATABASE_URL is not set - refusing to run against the in-memory database.",
  );
  process.exit(1);
}

const { getSql, withTransaction } = await import("../src/lib/db.ts");
const { redecideLegacyOpen, redecideOpenEnquiries } =
  await import("../src/lib/repo/decision-apply.ts");

class DryRunRollback extends Error {}

const sql = await getSql();
const businesses = await sql`select id, name from business order by name`;
let total = 0;
let failed = 0;
for (const b of businesses) {
  let changed = [];
  try {
    await withTransaction(async (tx) => {
      const legacy = await redecideLegacyOpen(tx, [b.id]);
      const rest = await redecideOpenEnquiries(tx, b.id);
      changed = [...new Set([...legacy, ...rest])];
      if (dryRun) throw new DryRunRollback();
    });
  } catch (err) {
    if (!(err instanceof DryRunRollback)) {
      failed += 1;
      console.error(
        `[redecide-open] ${b.name} (${b.id}) FAILED, left untouched:`,
        err?.message || err,
      );
      continue;
    }
  }
  total += changed.length;
  console.log(
    `[redecide-open] ${b.name} (${b.id}): ${changed.length} ${dryRun ? "would change" : "re-decided"}`,
  );
}
console.log(
  `[redecide-open] ${dryRun ? "DRY RUN - nothing written. " : ""}${total} enquiries across ${businesses.length} businesses; ${failed} businesses failed.`,
);
process.exit(failed > 0 ? 1 : 0);
