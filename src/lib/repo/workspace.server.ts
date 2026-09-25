import { getSql } from "@/lib/db";
import type { AuditEvent, Booking, Business, Enquiry, WorkspacePrefs } from "@/domain/types";
import { withFollowUpDue } from "@/domain/time-cues";
import { withDefaults } from "@/domain/workspace-prefs";
import { loadOwnerState } from "./owner-state-core";
import {
  toActionPolicy,
  toAuditEvent,
  toBooking,
  toBusiness,
  toEnquiry,
  toFact,
  toIntegration,
  toKnowledge,
  toLearning,
  toMessage,
  toQuote,
  toService,
  type ActionPolicyRow,
  type AuditRow,
  type BookingRow,
  type BusinessRow,
  type EnquiryRow,
  type FactRow,
  type IntegrationRow,
  type KnowledgeRow,
  type LearningRow,
  type MessageRow,
  type QuoteRow,
  type ServiceRow,
} from "./rows";
import { listUserBusinessIds } from "./tenancy.server";

/**
 * Reading a whole workspace (server-only).
 *
 * The operator app loads everything for the businesses a user belongs to, which
 * is exactly what the prototype store held in memory. That is fine at this size
 * and keeps the client identical to before; it is NOT fine once one business has
 * thousands of enquiries, at which point the queue needs its own paged query
 * rather than this aggregate.
 *
 * Every query is a single statement scoped by `= any(businessIds)`. Nothing here
 * loops over a collection issuing queries - an N+1 across facts and messages
 * would be the obvious way to write this and the obvious way to make it slow.
 */

export type WorkspaceData = {
  businesses: Business[];
  enquiries: Enquiry[];
  bookings: Booking[];
  /**
   * The tenant's REAL audit history. Deliberately separate from the prototype's
   * fixture audit and from instrumentation events - the product promises the
   * operator can ask "why did it do that, and was it allowed to", and mixing
   * three sources into one list with no provenance would make that answer
   * untrustworthy (R2B s7).
   */
  audit: AuditEvent[];
  /** enquiryId -> the reply the owner was part-way through, still valid for the current decision. */
  drafts: Record<string, string>;
  /** enquiryId -> an edit made before the decision moved, for the owner to keep or drop. */
  staleDrafts: Record<string, string>;
  /**
   * Where an owner books a setup call, when one is configured
   * (launch_settings.setup_call_url). Null means no card, anywhere.
   */
  setupCallUrl: string | null;
  /** businessId -> working hours and notice choices. */
  prefs: Record<string, WorkspacePrefs>;
};

const EMPTY: WorkspaceData = {
  businesses: [],
  enquiries: [],
  bookings: [],
  audit: [],
  drafts: {},
  staleDrafts: {},
  setupCallUrl: null,
  prefs: {},
};

/** Group rows by a key, preserving arrival order within each group. */
function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

/**
 * Everything the operator app needs, for every business this user belongs to.
 * Returns empty (not an error) when they belong to none - a brand new account is
 * a legitimate state, handled by provisioning rather than by throwing.
 */
export async function loadWorkspace(
  userId: string,
  db?: Awaited<ReturnType<typeof getSql>>,
): Promise<WorkspaceData> {
  const businessIds = await listUserBusinessIds(userId, db);
  if (businessIds.length === 0) return EMPTY;

  const sql = db ?? (await getSql());

  // Ten statements (plus two for owner state), fixed, regardless of how many businesses or enquiries exist.
  const [
    businessRows,
    serviceRows,
    knowledgeRows,
    integrationRows,
    policyRows,
    learningRows,
    enquiryRows,
    bookingRows,
    auditRows,
  ] = await Promise.all([
    sql<BusinessRow>`select * from business where id = any(${businessIds}) order by name`,
    sql<ServiceRow & { business_id: string }>`
      select * from business_service where business_id = any(${businessIds}) order by name`,
    sql<KnowledgeRow>`
      select * from knowledge_item where business_id = any(${businessIds}) order by title`,
    sql<IntegrationRow & { business_id: string }>`
      select * from integration where business_id = any(${businessIds}) order by provider`,
    sql<ActionPolicyRow & { business_id: string }>`
      select * from action_policy where business_id = any(${businessIds}) order by action`,
    sql<LearningRow>`
      select * from learning_suggestion where business_id = any(${businessIds})
      order by created_at desc`,
    sql<EnquiryRow>`
      select * from enquiry where business_id = any(${businessIds}) order by received_at desc`,
    sql<BookingRow>`
      select * from booking where business_id = any(${businessIds}) order by starts_at`,
    sql<AuditRow>`
      select id, at, actor, summary, detail, object_type, object_id
      from audit_event where business_id = any(${businessIds})
      order by at desc limit 200`,
  ]);

  const enquiryIds = enquiryRows.map((e) => e.id);

  // Children of enquiries: one statement each, empty-guarded so an empty `any()`
  // never reaches Postgres.
  const [factRows, messageRows, quoteRows] = enquiryIds.length
    ? await Promise.all([
        sql<FactRow & { enquiry_id: string }>`
          select * from enquiry_fact where enquiry_id = any(${enquiryIds})
          order by created_at`,
        sql<MessageRow & { enquiry_id: string }>`
          select * from message where enquiry_id = any(${enquiryIds}) order by at`,
        sql<QuoteRow & { enquiry_id: string }>`
          select * from quote_version where enquiry_id = any(${enquiryIds}) order by version`,
      ])
    : [[], [], []];

  const servicesBy = groupBy(serviceRows, (r) => r.business_id);
  const knowledgeBy = groupBy(knowledgeRows, (r) => r.business_id);
  const integrationsBy = groupBy(integrationRows, (r) => r.business_id);
  const policiesBy = groupBy(policyRows, (r) => r.business_id);
  const learningBy = groupBy(learningRows, (r) => r.business_id);
  const factsBy = groupBy(factRows, (r) => r.enquiry_id);
  const messagesBy = groupBy(messageRows, (r) => r.enquiry_id);
  const quotesBy = groupBy(quoteRows, (r) => r.enquiry_id);

  const businesses = businessRows.map((b) =>
    toBusiness(b, {
      services: (servicesBy.get(b.id) ?? []).map(toService),
      knowledge: (knowledgeBy.get(b.id) ?? []).map(toKnowledge),
      integrations: (integrationsBy.get(b.id) ?? []).map(toIntegration),
      actionPolicies: (policiesBy.get(b.id) ?? []).map(toActionPolicy),
      learningSuggestions: (learningBy.get(b.id) ?? []).map(toLearning),
    }),
  );

  const owner = await loadOwnerState(sql, businessIds);

  // A quiet customer comes back to the owner from what is on record - the
  // last reply sent and the business's own working hours - on every read, on
  // every device. Not from whichever browser tab happened to be open.
  const now = new Date();
  const enquiries = enquiryRows.map((e) =>
    withFollowUpDue(
      toEnquiry(e, {
        facts: (factsBy.get(e.id) ?? []).map(toFact),
        conversation: (messagesBy.get(e.id) ?? []).map(toMessage),
        quotes: (quotesBy.get(e.id) ?? []).map(toQuote),
      }),
      owner.prefs[e.business_id] ?? withDefaults({}),
      now,
    ),
  );

  return {
    businesses,
    enquiries,
    bookings: bookingRows.map(toBooking),
    audit: auditRows.map(toAuditEvent),
    drafts: owner.drafts,
    staleDrafts: owner.staleDrafts,
    setupCallUrl: await readSetupCallUrl(sql),
    prefs: owner.prefs,
  };
}

/**
 * The setup-call booking link, only when one is configured and is a plain
 * https URL. Anything else - no row, an empty value, another scheme - is no
 * link, so the card never appears pointing at nothing.
 */
export async function readSetupCallUrl(
  sql: Awaited<ReturnType<typeof getSql>>,
): Promise<string | null> {
  try {
    const rows = await sql<{ value: string }>`
      select value from launch_settings where key = ${"setup_call_url"} limit 1
    `;
    return safeBookingUrl(rows[0]?.value);
  } catch (err) {
    // No card is the safe answer, but say why in the server log.
    console.error("[workspace] could not read setup_call_url:", err);
    return null;
  }
}

export function safeBookingUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
