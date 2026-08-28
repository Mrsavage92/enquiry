import { withTransaction, type Sql } from "@/lib/db";
import type { Booking, Business, Enquiry } from "@/domain/types";
import { BOOKINGS, BUSINESSES, ENQUIRIES } from "@/fixtures";
import { moneyToColumns, toMinor } from "./money";

/**
 * Seeding a new account's first workspace (server-only).
 *
 * A brand new operator signing in to an empty screen cannot tell a working
 * product from a broken one, so the first workspace is seeded from the same
 * demo fixtures the prototype shipped with. It is real data in real tables from
 * the first second - not a special "demo mode" branch that later has to be
 * unpicked.
 *
 * The whole seed is one transaction. A half-seeded workspace (a business with no
 * enquiries, an enquiry with no facts) would look exactly like a product bug.
 */

/** Which fixture business a new account starts from. */
const SEED_BUSINESS_INDEX = 0;

function seedBusiness(): Business {
  const b = BUSINESSES[SEED_BUSINESS_INDEX];
  if (!b) throw new Error("No fixture business available to seed from");
  return b;
}

async function insertBusiness(sql: Sql, b: Business): Promise<string> {
  const rows = await sql<{ id: string }>`
    insert into business (
      name, industry, industry_brain, city, timezone, currency, solo_or_team,
      base_location, owner_name, owner_first_name, website, trust_mode, paused,
      pause_level, voice, required_fact_labels
    ) values (
      ${b.name}, ${b.industry}, ${b.industryBrain}, ${b.city}, ${b.timezone},
      ${b.currency}, ${b.soloOrTeam}, ${b.baseLocation}, ${b.ownerName},
      ${b.ownerFirstName}, ${b.website ?? null}, ${b.trustMode}, ${b.paused},
      ${b.pauseLevel}, ${JSON.stringify(b.voice)}::jsonb,
      ${JSON.stringify(b.requiredFactLabels)}::jsonb
    )
    returning id
  `;
  const id = rows[0]?.id;
  if (!id) throw new Error("Business insert returned no id");
  return id;
}

async function insertBusinessChildren(sql: Sql, businessId: string, b: Business) {
  for (const s of b.services) {
    await sql`
      insert into business_service
        (business_id, name, customer_label, category, duration_minutes, location_modes, state)
      values (${businessId}, ${s.name}, ${s.customerLabel}, ${s.category},
              ${s.durationMinutes ?? null}, ${s.locationModes}, ${s.state})
    `;
  }
  for (const k of b.knowledge) {
    await sql`
      insert into knowledge_item
        (business_id, section, title, body, class, state, source, effective_from,
         effective_to, version, stale)
      values (${businessId}, ${k.section}, ${k.title}, ${k.body}, ${k.class}, ${k.state},
              ${JSON.stringify(k.source ?? {})}::jsonb, ${k.effectiveFrom ?? null},
              ${k.effectiveTo ?? null}, ${k.version}, ${k.stale ?? false})
    `;
  }
  for (const i of b.integrations) {
    await sql`
      insert into integration
        (business_id, provider, kind, status, technical_scopes, enquiry_usage,
         last_success_at, account_label)
      values (${businessId}, ${i.provider}, ${i.kind}, ${i.status},
              ${i.technicalScopes}, ${i.enquiryUsage}, ${i.lastSuccessAt ?? null},
              ${i.accountLabel ?? null})
    `;
  }
  for (const p of b.actionPolicies) {
    await sql`
      insert into action_policy (business_id, action, label, mode, risk, evidence, gates)
      values (${businessId}, ${p.action}, ${p.label}, ${p.mode}, ${p.risk},
              ${JSON.stringify(p.evidence ?? {})}::jsonb,
              ${JSON.stringify(p.gates ?? [])}::jsonb)
      on conflict (business_id, action) do nothing
    `;
  }
  for (const l of b.learningSuggestions) {
    await sql`
      insert into learning_suggestion
        (business_id, title, proposal, class, examples, status, high_impact)
      values (${businessId}, ${l.title}, ${l.proposal}, ${l.class}, ${l.examples},
              ${l.status}, ${l.highImpact})
    `;
  }
}

async function insertEnquiry(
  sql: Sql,
  businessId: string,
  e: Enquiry,
): Promise<string> {
  const exact = moneyToColumns(e.valueExact);
  const currency = e.valueExact?.currency ?? e.valueRange?.currency ?? "AUD";
  // The snapshot is stored whole minus quotes, which are relational because they
  // are versioned and sent. Stitched back together on read.
  const { quotes: _quotes, ...snapshot } = e.decision ?? { quotes: [] };
  const rows = await sql<{ id: string }>`
    insert into enquiry (
      business_id, customer_name, customer_email, customer_phone, customer_handle,
      source, comment_on, service_label, event_label, date_label, location_label,
      urgency_label, lifecycle, decision_state, commercial_state, responsibility,
      value_exact_minor, value_range_min_minor, value_range_max_minor, currency,
      decision_snapshot, at_risk, follow_up_due, follow_up_reason, snoozed_until,
      teach_prompt, notes, received_at, updated_at
    ) values (
      ${businessId}, ${e.customerName}, ${e.customerEmail}, ${e.customerPhone ?? null},
      ${e.customerHandle ?? null}, ${e.source}, ${e.commentOn ?? null}, ${e.serviceLabel},
      ${e.eventLabel ?? null}, ${e.dateLabel ?? null}, ${e.locationLabel ?? null},
      ${e.urgencyLabel ?? null}, ${e.state.lifecycle}, ${e.state.decision},
      ${e.state.commercial}, ${e.state.responsibility},
      ${exact.minor}, ${e.valueRange ? toMinor(e.valueRange.min) : null},
      ${e.valueRange ? toMinor(e.valueRange.max) : null}, ${currency},
      ${JSON.stringify(snapshot)}::jsonb, ${e.atRisk ?? false}, ${e.followUpDue ?? false},
      ${e.followUpReason ?? null}, ${e.snoozedUntil ?? null}, ${e.teachPrompt ?? null},
      ${e.notes ?? null}, ${e.receivedAt}, ${e.updatedAt}
    )
    returning id
  `;
  const id = rows[0]?.id;
  if (!id) throw new Error("Enquiry insert returned no id");

  for (const f of e.facts) {
    await sql`
      insert into enquiry_fact
        (enquiry_id, field, label, value, display_value, status, confidence,
         asserted_by, provenance, required_for, blocking, teachable,
         customer_specific, superseded, alternatives)
      values (${id}, ${f.field}, ${f.label}, ${f.value}, ${f.displayValue}, ${f.status},
              ${f.confidence}, ${f.assertedBy}, ${JSON.stringify(f.provenance ?? {})}::jsonb,
              ${f.requiredFor ?? []}, ${f.blocking ?? false}, ${f.teachable ?? false},
              ${f.customerSpecific ?? false}, ${f.superseded ?? false},
              ${f.alternatives ?? []})
      on conflict do nothing
    `;
  }
  for (const m of e.conversation) {
    await sql`
      insert into message
        (enquiry_id, direction, channel, at, from_addr, to_addr, subject, body,
         quoted, form_fields, comment_context)
      values (${id}, ${m.direction}, ${m.channel}, ${m.at}, ${m.from}, ${m.to},
              ${m.subject ?? null}, ${m.body}, ${m.quoted ?? false},
              ${m.formFields ? JSON.stringify(m.formFields) : null}::jsonb,
              ${m.commentContext ?? null})
    `;
  }
  for (const q of e.decision?.quotes ?? []) {
    const total = moneyToColumns(q.total);
    await sql`
      insert into quote_version
        (enquiry_id, version, status, sent_at, total_minor, range_min_minor,
         range_max_minor, currency, line_items, assumptions, rule_set_version,
         hold_minor, hold_label)
      values (${id}, ${q.version}, ${q.status}, ${q.sentAt ?? null}, ${total.minor},
              ${q.range ? toMinor(q.range.min) : null},
              ${q.range ? toMinor(q.range.max) : null},
              ${q.total?.currency ?? q.range?.currency ?? "AUD"},
              ${JSON.stringify(q.lineItems ?? [])}::jsonb, ${q.assumptions ?? []},
              ${q.ruleSetVersion}, ${q.hold ? toMinor(q.hold.amount) : null},
              ${q.hold?.label ?? null})
      on conflict (enquiry_id, version) do nothing
    `;
  }
  return id;
}

async function insertBooking(
  sql: Sql,
  businessId: string,
  enquiryId: string | null,
  b: Booking,
) {
  const value = moneyToColumns(b.value);
  await sql`
    insert into booking
      (business_id, enquiry_id, customer_name, service_label, starts_at,
       duration_minutes, location, travel_minutes, value_minor, currency, status,
       handoff, deposit_paid)
    values (${businessId}, ${enquiryId}, ${b.customerName}, ${b.serviceLabel}, ${b.when},
            ${b.durationMinutes ?? null}, ${b.location ?? null}, ${b.travelMinutes ?? null},
            ${value.minor}, ${b.value?.currency ?? "AUD"}, ${b.status},
            ${b.handoff ?? null}, ${b.depositPaid ?? false})
  `;
}

/**
 * Create this user's first workspace and make them its owner.
 *
 * Idempotent at the caller's level: `provisionIfEmpty` checks membership first,
 * so a double-submit or a retried request cannot produce two workspaces.
 * Returns the new business id.
 */
export async function provisionWorkspace(userId: string): Promise<string> {
  const fixture = seedBusiness();
  const seedEnquiries = ENQUIRIES.filter((e) => e.businessId === fixture.id);
  const seedBookings = BOOKINGS.filter((b) => b.businessId === fixture.id);

  return withTransaction(async (sql) => {
    const businessId = await insertBusiness(sql, fixture);
    await sql`
      insert into business_member (business_id, user_id, role)
      values (${businessId}, ${userId}, ${"owner"})
      on conflict (business_id, user_id) do nothing
    `;
    await insertBusinessChildren(sql, businessId, fixture);

    // Fixture enquiry ids are short strings ("f01"); the real rows get uuids, so
    // map old id -> new id to keep bookings attached to the right enquiry.
    const idMap = new Map<string, string>();
    for (const e of seedEnquiries) {
      idMap.set(e.id, await insertEnquiry(sql, businessId, e));
    }
    for (const b of seedBookings) {
      await insertBooking(sql, businessId, idMap.get(b.enquiryId) ?? null, b);
    }

    await sql`
      insert into audit_event (business_id, actor, summary, object_type)
      values (${businessId}, ${"system"}, ${"Workspace created"}, ${"brain"})
    `;
    return businessId;
  });
}

/**
 * Provision only when this user has no workspace yet. Returns the business id
 * they should land in, existing or freshly created.
 */
export async function provisionIfEmpty(userId: string): Promise<string | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const existing = await sql<{ business_id: string }>`
    select business_id from business_member where user_id = ${userId} limit 1
  `;
  if (existing[0]) return existing[0].business_id;
  return provisionWorkspace(userId);
}
