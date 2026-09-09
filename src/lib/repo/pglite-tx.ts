import type { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";

/**
 * A real transaction runner over a PGLite instance, in the shape
 * `interpretAndApply` and every other transactional core expects.
 *
 * Test and benchmark harnesses used to hand those functions a plain
 * auto-commit `Sql`, which meant a `select ... for update` inside them acquired
 * and released within its own statement and proved nothing about the critical
 * section. Passing this instead makes the harness exercise the same transaction
 * boundary production uses, so a missing one fails a test rather than passing
 * quietly.
 *
 * Not a test file itself: production code (`src/benchmark/r2e/db.ts`) needs it
 * too, and having one definition keeps the harnesses from drifting apart.
 */
export function txRunner(pg: PGlite): <T>(fn: (sql: Sql) => Promise<T>) => Promise<T> {
  return <T>(fn: (sql: Sql) => Promise<T>): Promise<T> =>
    pg.transaction(async (tx) => {
      const sql = (async <R>(strings: TemplateStringsArray, ...values: unknown[]) => {
        let text = strings[0] ?? "";
        for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
        const res = await tx.query<R>(text, values);
        return res.rows;
      }) as never as Sql;
      return fn(sql);
    }) as Promise<T>;
}
