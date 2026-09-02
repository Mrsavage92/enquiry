import type {
  ActionPolicy,
  AuditEvent,
  Booking,
  Business,
  DecisionSnapshot,
  Enquiry,
  EnquiryFact,
  IntegrationHealth,
  KnowledgeItem,
  LearningSuggestion,
  Message,
  QuoteVersion,
  Service,
  VoiceProfile,
} from "@/domain/types";
import { moneyFromColumns, moneyRangeFromColumns } from "./money";

/**
 * Row shapes as Postgres returns them, and the mapping back to domain types.
 *
 * Kept free of any database import so it can be unit-tested against literal
 * rows. The domain layer is the app's crown jewel and it is entirely pure; this
 * module is the seam that keeps it that way, rather than letting `snake_case`
 * row objects leak into evaluators and components.
 */

const iso = (v: Date | string | null | undefined): string =>
  v == null ? "" : v instanceof Date ? v.toISOString() : String(v);

const isoOrUndefined = (v: Date | string | null | undefined): string | undefined =>
  v == null ? undefined : iso(v);

export type BusinessRow = {
  id: string;
  name: string;
  industry: string;
  industry_brain: string;
  city: string;
  timezone: string;
  currency: string;
  solo_or_team: string;
  base_location: string;
  owner_name: string;
  owner_first_name: string;
  website: string | null;
  trust_mode: string;
  paused: boolean;
  pause_level: string;
  voice: unknown;
  required_fact_labels: unknown;
};

export type ServiceRow = {
  id: string;
  name: string;
  customer_label: string;
  category: string;
  duration_minutes: number | null;
  location_modes: string[] | null;
  state: string;
};

export type KnowledgeRow = {
  id: string;
  business_id: string;
  section: string;
  title: string;
  body: string;
  class: string;
  state: string;
  source: unknown;
  effective_from: string | Date | null;
  effective_to: string | Date | null;
  version: string;
  stale: boolean;
  conflict_with: string | null;
};

export type IntegrationRow = {
  id: string;
  provider: string;
  kind: string;
  status: string;
  technical_scopes: string[] | null;
  enquiry_usage: string[] | null;
  last_success_at: string | Date | null;
  account_label: string | null;
};

export type ActionPolicyRow = {
  action: string;
  label: string;
  mode: string;
  risk: string;
  evidence: unknown;
  gates: unknown;
};

export type LearningRow = {
  id: string;
  business_id: string;
  title: string;
  proposal: string;
  class: string;
  examples: string[] | null;
  status: string;
  high_impact: boolean;
};

export type EnquiryRow = {
  id: string;
  business_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_handle: string | null;
  source: string;
  comment_on: string | null;
  service_label: string;
  event_label: string | null;
  date_label: string | null;
  location_label: string | null;
  urgency_label: string | null;
  lifecycle: string;
  decision_state: string;
  commercial_state: string;
  responsibility: string;
  value_exact_minor: number | string | null;
  value_range_min_minor: number | string | null;
  value_range_max_minor: number | string | null;
  currency: string;
  decision_snapshot: unknown;
  duplicate_of: string | null;
  at_risk: boolean;
  follow_up_due: boolean;
  follow_up_reason: string | null;
  snoozed_until: string | Date | null;
  teach_prompt: string | null;
  notes: string | null;
  received_at: string | Date;
  updated_at: string | Date;
};

export type FactRow = {
  id: string;
  field: string;
  label: string;
  value: string;
  display_value: string;
  status: string;
  confidence: string;
  asserted_by: string;
  provenance: unknown;
  required_for: string[] | null;
  blocking: boolean;
  teachable: boolean;
  customer_specific: boolean;
  superseded: boolean;
  alternatives: string[] | null;
};

export type MessageRow = {
  id: string;
  direction: string;
  channel: string;
  at: string | Date;
  from_addr: string;
  to_addr: string;
  subject: string | null;
  body: string;
  quoted: boolean;
  quote_id: string | null;
  form_fields: unknown;
  comment_context: string | null;
};

export type QuoteRow = {
  id: string;
  version: number;
  status: string;
  sent_at: string | Date | null;
  total_minor: number | string | null;
  range_min_minor: number | string | null;
  range_max_minor: number | string | null;
  currency: string;
  line_items: unknown;
  assumptions: string[] | null;
  rule_set_version: string;
  hold_minor: number | string | null;
  hold_label: string | null;
};

export type BookingRow = {
  id: string;
  business_id: string;
  enquiry_id: string | null;
  customer_name: string;
  service_label: string;
  starts_at: string | Date;
  duration_minutes: number | null;
  location: string | null;
  travel_minutes: number | null;
  value_minor: number | string | null;
  currency: string;
  status: string;
  handoff: string | null;
  deposit_paid: boolean;
};

export type AuditRow = {
  id: string;
  at: string | Date;
  actor: string;
  summary: string;
  detail: string | null;
  object_type: string;
  object_id: string | null;
};

export function toAuditEvent(r: AuditRow): AuditEvent {
  return {
    id: r.id,
    at: iso(r.at),
    actor: r.actor,
    summary: r.summary,
    detail: r.detail ?? undefined,
    objectType: r.object_type as AuditEvent["objectType"],
    objectId: r.object_id ?? undefined,
  };
}

export function toService(r: ServiceRow): Service {
  return {
    id: r.id,
    name: r.name,
    customerLabel: r.customer_label,
    category: r.category,
    durationMinutes: r.duration_minutes ?? undefined,
    locationModes: r.location_modes ?? [],
    state: r.state as Service["state"],
  };
}

export function toKnowledge(r: KnowledgeRow): KnowledgeItem {
  return {
    id: r.id,
    businessId: r.business_id,
    section: r.section as KnowledgeItem["section"],
    title: r.title,
    body: r.body,
    class: r.class as KnowledgeItem["class"],
    state: r.state as KnowledgeItem["state"],
    source: (r.source ?? {}) as KnowledgeItem["source"],
    effectiveFrom: isoOrUndefined(r.effective_from),
    effectiveTo: isoOrUndefined(r.effective_to),
    version: r.version,
    stale: r.stale || undefined,
    conflictWith: r.conflict_with ?? undefined,
  };
}

export function toIntegration(r: IntegrationRow): IntegrationHealth {
  return {
    id: r.id,
    provider: r.provider,
    kind: r.kind as IntegrationHealth["kind"],
    status: r.status as IntegrationHealth["status"],
    technicalScopes: r.technical_scopes ?? [],
    enquiryUsage: r.enquiry_usage ?? [],
    lastSuccessAt: isoOrUndefined(r.last_success_at),
    accountLabel: r.account_label ?? undefined,
  };
}

export function toActionPolicy(r: ActionPolicyRow): ActionPolicy {
  return {
    action: r.action as ActionPolicy["action"],
    label: r.label,
    mode: r.mode as ActionPolicy["mode"],
    risk: r.risk as ActionPolicy["risk"],
    evidence: (r.evidence ?? undefined) as ActionPolicy["evidence"],
    gates: (r.gates ?? []) as ActionPolicy["gates"],
  };
}

export function toLearning(r: LearningRow): LearningSuggestion {
  return {
    id: r.id,
    businessId: r.business_id,
    title: r.title,
    proposal: r.proposal,
    class: r.class as LearningSuggestion["class"],
    examples: r.examples ?? [],
    status: r.status as LearningSuggestion["status"],
    highImpact: r.high_impact,
  };
}

export function toBusiness(
  r: BusinessRow,
  parts: {
    services: Service[];
    knowledge: KnowledgeItem[];
    integrations: IntegrationHealth[];
    actionPolicies: ActionPolicy[];
    learningSuggestions: LearningSuggestion[];
  },
): Business {
  return {
    id: r.id,
    name: r.name,
    industry: r.industry,
    industryBrain: r.industry_brain,
    city: r.city,
    timezone: r.timezone,
    currency: r.currency as Business["currency"],
    soloOrTeam: r.solo_or_team as Business["soloOrTeam"],
    baseLocation: r.base_location,
    ownerName: r.owner_name,
    ownerFirstName: r.owner_first_name,
    website: r.website ?? undefined,
    trustMode: r.trust_mode as Business["trustMode"],
    paused: r.paused,
    pauseLevel: r.pause_level as Business["pauseLevel"],
    voice: (r.voice ?? {}) as VoiceProfile,
    requiredFactLabels: (r.required_fact_labels ?? {}) as Business["requiredFactLabels"],
    ...parts,
  };
}

export function toFact(r: FactRow): EnquiryFact {
  return {
    id: r.id,
    field: r.field,
    label: r.label,
    value: r.value,
    displayValue: r.display_value,
    status: r.status as EnquiryFact["status"],
    confidence: r.confidence as EnquiryFact["confidence"],
    assertedBy: r.asserted_by as EnquiryFact["assertedBy"],
    provenance: (r.provenance ?? {}) as EnquiryFact["provenance"],
    requiredFor: r.required_for ?? undefined,
    blocking: r.blocking || undefined,
    teachable: r.teachable || undefined,
    customerSpecific: r.customer_specific || undefined,
    superseded: r.superseded || undefined,
    alternatives: r.alternatives ?? undefined,
  };
}

export function toMessage(r: MessageRow): Message {
  return {
    id: r.id,
    direction: r.direction as Message["direction"],
    channel: r.channel as Message["channel"],
    at: iso(r.at),
    from: r.from_addr,
    to: r.to_addr,
    subject: r.subject ?? undefined,
    body: r.body,
    quoted: r.quoted || undefined,
    quoteId: r.quote_id ?? undefined,
    formFields: (r.form_fields ?? undefined) as Message["formFields"],
    commentContext: r.comment_context ?? undefined,
  };
}

export function toQuote(r: QuoteRow): QuoteVersion {
  const hold = moneyFromColumns(r.hold_minor, r.currency);
  return {
    id: r.id,
    version: r.version,
    status: r.status as QuoteVersion["status"],
    sentAt: isoOrUndefined(r.sent_at),
    total: moneyFromColumns(r.total_minor, r.currency),
    range: moneyRangeFromColumns(r.range_min_minor, r.range_max_minor, r.currency),
    lineItems: (r.line_items ?? []) as QuoteVersion["lineItems"],
    assumptions: r.assumptions ?? [],
    ruleSetVersion: r.rule_set_version,
    hold: hold ? { ...hold, label: r.hold_label ?? undefined } : undefined,
  };
}

export function toBooking(r: BookingRow): Booking {
  return {
    id: r.id,
    enquiryId: r.enquiry_id ?? "",
    businessId: r.business_id,
    customerName: r.customer_name,
    serviceLabel: r.service_label,
    when: iso(r.starts_at),
    durationMinutes: r.duration_minutes ?? undefined,
    location: r.location ?? undefined,
    travelMinutes: r.travel_minutes ?? undefined,
    value: moneyFromColumns(r.value_minor, r.currency),
    status: r.status as Booking["status"],
    handoff: r.handoff ?? undefined,
    depositPaid: r.deposit_paid || undefined,
  };
}

export function toEnquiry(
  r: EnquiryRow,
  parts: { facts: EnquiryFact[]; conversation: Message[]; quotes: QuoteVersion[] },
): Enquiry {
  // The snapshot is derived and stored whole. Quotes live relationally because
  // they are versioned and sent, so they are stitched back in here.
  const snapshot = (r.decision_snapshot ?? {}) as Partial<DecisionSnapshot>;
  return {
    id: r.id,
    // The prototype keyed fixtures by a short id; persisted enquiries are keyed
    // by their uuid, and fixtureId is retained only so seeded demo rows can
    // still be traced back to the fixture they came from.
    fixtureId: r.id,
    businessId: r.business_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone ?? undefined,
    customerHandle: r.customer_handle ?? undefined,
    source: r.source as Enquiry["source"],
    commentOn: (r.comment_on ?? undefined) as Enquiry["commentOn"],
    serviceLabel: r.service_label,
    eventLabel: r.event_label ?? undefined,
    dateLabel: r.date_label ?? undefined,
    locationLabel: r.location_label ?? undefined,
    urgencyLabel: r.urgency_label ?? undefined,
    state: {
      lifecycle: r.lifecycle as Enquiry["state"]["lifecycle"],
      decision: r.decision_state as Enquiry["state"]["decision"],
      commercial: r.commercial_state as Enquiry["state"]["commercial"],
      responsibility: r.responsibility as Enquiry["state"]["responsibility"],
    },
    valueExact: moneyFromColumns(r.value_exact_minor, r.currency),
    valueRange: moneyRangeFromColumns(
      r.value_range_min_minor,
      r.value_range_max_minor,
      r.currency,
    ),
    facts: parts.facts,
    conversation: parts.conversation,
    decision: { ...(snapshot as DecisionSnapshot), quotes: parts.quotes },
    duplicateOf: r.duplicate_of ?? undefined,
    atRisk: r.at_risk || undefined,
    followUpDue: r.follow_up_due || undefined,
    followUpReason: r.follow_up_reason ?? undefined,
    snoozedUntil: isoOrUndefined(r.snoozed_until),
    receivedAt: iso(r.received_at),
    updatedAt: iso(r.updated_at),
    teachPrompt: r.teach_prompt ?? undefined,
    notes: r.notes ?? undefined,
  };
}
