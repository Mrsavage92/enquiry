import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { createWorkspaceInTransaction } from "./provision-core.ts";
import { saveBusinessDetailsForUser } from "./business-rule-core.ts";
import { insertManualEnquiry } from "./manual-enquiry-core.ts";
import { answerFactForUser } from "./answer-fact-core.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import { readBusinessDetails } from "../../domain/business-details-read.ts";
import { noteFor } from "../../domain/business-detail.ts";

/**
 * Shared set-up for the trust pass 8 database tests: a fresh PGlite with every
 * migration, two tenants, owner sentences saved the way the business screen
 * saves them (a line offered as a note is kept as a note), and the send path
 * the owner's own reply goes through.
 */

const migrationsDir = join(process.cwd(), "migrations");

/** Wednesday 30 September 2026, mid-morning in Brisbane: the review's day. */
export const WED_30_SEP = new Date("2026-09-30T10:15:00+10:00");

export async function freshDb(t: { after: (fn: () => Promise<void>) => void }): Promise<PGlite> {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.waitReady;
  for (const f of readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await pg.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  return pg;
}

function toSql(run: <R>(text: string, params: unknown[]) => Promise<R[]>): Sql {
  return (async <R>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return run<R>(text, values);
  }) as never;
}

export function sqlFor(pg: PGlite): Sql {
  return toSql(
    async <R>(text: string, params: unknown[]) => (await pg.query<R>(text, params)).rows,
  );
}

export async function tx<T>(pg: PGlite, fn: (sql: Sql) => Promise<T>): Promise<T> {
  return pg.transaction(async (t) =>
    fn(toSql(async <R>(text: string, params: unknown[]) => (await t.query<R>(text, params)).rows)),
  ) as Promise<T>;
}

export async function tenant(pg: PGlite, userId: string, name: string, industry = "cleaning") {
  await pg.query("insert into app_user (id, email) values ($1, $2)", [userId, `${userId}@test`]);
  return tx(pg, (sql) =>
    createWorkspaceInTransaction(sql, {
      ownerFirstName: "Sam",
      industry,
      baseLocation: "Brisbane",
      timezone: "Australia/Brisbane",
      soloOrTeam: "solo",
      currency: "AUD",
      name,
      userId,
    }),
  );
}

/**
 * Save owner sentences as the business screen does: prices and rules as read,
 * a line offered as a note kept as a note. A line that is neither fails the
 * test, so nothing is ever silently dropped on the way in.
 */
export async function tell(pg: PGlite, businessId: string, text: string, userId = "user-a") {
  const read = readBusinessDetails(text, WED_30_SEP);
  const refused = read.unread.filter((u) => !u.note);
  assert.equal(refused.length, 0, `unread: ${JSON.stringify(refused)}`);
  const notes = read.unread.filter((u) => u.note).map((u) => noteFor(u.line, []));
  return saveBusinessDetailsForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, {
    businessId,
    rules: read.prices.map((p) => p.rule),
    details: [...read.details.map((d) => d.detail), ...notes],
    said: {
      rules: read.prices.map((p) => p.line),
      details: [
        ...read.details.map((d) => d.line),
        ...read.unread.filter((u) => u.note).map((u) => u.line),
      ],
    },
  });
}

export async function enquiry(
  pg: PGlite,
  businessId: string,
  body: string,
  serviceLabel = "",
  now: Date = WED_30_SEP,
) {
  return tx(pg, (sql) =>
    insertManualEnquiry(sql, {
      businessId,
      body,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      serviceLabel,
      intakeNote: "",
      now,
    }),
  );
}

export type Snap = {
  recommendation: { action: string; label: string };
  draft: { body: string };
  price?: { amountMinor: number };
  asked?: { id: string; kind: string; text: string; status: string; line?: string }[];
  dates?: { iso: string; role: string; label: string }[];
  questionPending?: {
    field: string;
    kind?: string;
    thing: string;
    readAs?: string;
    said?: string;
    saved?: string;
    days?: { iso: string; closed?: string }[];
  };
  extraPending?: { field: string; label: string; kind: string; amountMinor?: number };
  missing: { factField: string; inferred?: { value: string } }[];
  coverage?: {
    key: string;
    confirmed: boolean;
    flagged: { kind: string; text: string; thing?: string; check?: { field: string } }[];
    lines: { label: string; amountMinor: number }[];
  };
  checks?: { total: number; done: number };
};

export async function row(pg: PGlite, id: string) {
  const res = await pg.query<{
    decision_revision: number;
    decision_snapshot: Snap;
    date_label: string | null;
    service_label: string;
  }>(
    "select decision_revision, decision_snapshot, date_label, service_label from enquiry where id = $1",
    [id],
  );
  return res.rows[0]!;
}

export async function answer(
  pg: PGlite,
  userId: string,
  enquiryId: string,
  field: string,
  value: string,
) {
  return answerFactForUser(sqlFor(pg), (fn) => tx(pg, fn), userId, { enquiryId, field, value });
}

export async function facts(pg: PGlite, enquiryId: string) {
  return (
    await pg.query<{ field: string; value: string; status: string; display_value: string }>(
      "select field, value, status, display_value from enquiry_fact where enquiry_id = $1 and superseded = false order by field",
      [enquiryId],
    )
  ).rows;
}

/** Confirm every inferred reading the decision is waiting on, as the owner's one tap. */
export async function confirmReadings(pg: PGlite, enquiryId: string) {
  for (let i = 0; i < 6; i += 1) {
    const r = await pg.query<{ field: string; value: string }>(
      `select f.field, f.value from enquiry_fact f join enquiry e on e.id = f.enquiry_id
       where f.enquiry_id = $1 and f.superseded = false and f.status = 'inferred'
         and (e.decision_snapshot->'missing'->0->>'factField') = f.field`,
      [enquiryId],
    );
    const reading = r.rows[0];
    if (!reading) return;
    await answer(pg, "user-a", enquiryId, reading.field, reading.value);
  }
}

/** "That's everything" when a check is showing, then the app's own reply through the send path. */
export async function send(pg: PGlite, businessId: string, enquiryId: string, body?: string) {
  const before = await row(pg, enquiryId);
  if (before.decision_snapshot.coverage && !before.decision_snapshot.coverage.confirmed) {
    const res = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
      enquiryId,
      key: before.decision_snapshot.coverage.key,
      revision: Number(before.decision_revision),
    });
    assert.equal(res.ok, true, JSON.stringify(res));
  }
  const ready = await row(pg, enquiryId);
  const text = body ?? ready.decision_snapshot.draft.body;
  const sent = await tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId,
      businessId,
      userId: "user-a",
      body: text,
      channel: "manual",
    }),
  );
  return { body: text, sent, snapshot: ready.decision_snapshot, row: ready };
}
