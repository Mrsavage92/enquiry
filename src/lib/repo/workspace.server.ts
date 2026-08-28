import { getSql } from "@/lib/db";
import type { Booking, Business, Enquiry } from "@/domain/types";
import {
  toActionPolicy,
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
};

const EMPTY: WorkspaceData = { businesses: [], enquiries: [], bookings: [] };

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
export async function loadWorkspace(userId: string): Promise<WorkspaceData> {
  const businessIds = await listUserBusinessIds(userId);
  if (businessIds.length === 0) return EMPTY;

  const sql = await getSql();

  // Ten statements, fixed, regardless of how many businesses or enquiries exist.
  const [
    businessRows,
    serviceRows,
    knowledgeRows,
    integrationRows,
    policyRows,
    learningRows,
    enquiryRows,
    bookingRows,
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

  const enquiries = enquiryRows.map((e) =>
    toEnquiry(e, {
      facts: (factsBy.get(e.id) ?? []).map(toFact),
      conversation: (messagesBy.get(e.id) ?? []).map(toMessage),
      quotes: (quotesBy.get(e.id) ?? []).map(toQuote),
    }),
  );

  return { businesses, enquiries, bookings: bookingRows.map(toBooking) };
}
