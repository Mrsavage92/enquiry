export type LifecycleState =
  | "OPEN"
  | "BOOKED"
  | "DECLINED"
  | "LOST"
  | "CANCELLED";

export type DecisionState =
  | "EVALUATING"
  | "NEEDS_INFORMATION"
  | "NEEDS_HUMAN"
  | "ACTION_READY"
  | "WAITING_ON_CLIENT"
  | "BOOKING_PENDING"
  | "NONE";

export type CommercialState =
  | "UNASSESSED"
  | "ESTIMATED"
  | "QUOTABLE"
  | "QUOTED"
  | "ACCEPTED";

export type Responsibility =
  | "SYSTEM"
  | "BUSINESS"
  | "CUSTOMER"
  | "EXTERNAL_SYSTEM"
  | "NONE";

export type CompositeState = {
  lifecycle: LifecycleState;
  decision: DecisionState;
  commercial: CommercialState;
  responsibility: Responsibility;
};

export type RecommendationAction =
  | "ACKNOWLEDGE"
  | "REQUEST_INFORMATION"
  | "SEND_QUALIFICATION_RESPONSE"
  | "SEND_AVAILABILITY"
  | "SEND_ESTIMATE"
  | "SEND_QUOTE"
  | "RECOMMEND_OFFER"
  | "ROUTE_ENQUIRY"
  | "OFFER_BOOKING"
  | "HANDOFF_BOOKING"
  | "FOLLOW_UP"
  | "WAIT"
  | "DECLINE"
  | "ESCALATE_HUMAN"
  | "NO_ACTION";

export type EvaluatorType =
  | "pricing"
  | "eligibility"
  | "package_selection"
  | "availability"
  | "capacity"
  | "location_travel"
  | "qualification_routing"
  | "deposit_booking_readiness";

export type PricingKind = "EXACT" | "RANGE" | "NOT_QUOTABLE" | "ERROR" | "NOT_APPLICABLE";
export type CapacityKind =
  | "FEASIBLE"
  | "INFEASIBLE"
  | "FEASIBLE_WITH_CONDITION"
  | "UNKNOWN_MISSING_FACTS"
  | "UNKNOWN_INTEGRATION"
  | "NOT_APPLICABLE";
export type EligibilityKind =
  | "PASS"
  | "FAIL"
  | "REQUIRES_EXCEPTION"
  | "UNKNOWN"
  | "NOT_APPLICABLE";
export type GenericEvalKind = "VALIDATED" | "BLOCKED" | "UNKNOWN" | "NOT_APPLICABLE";

export type ConfidenceBand = "High" | "Medium" | "Low";
export type RiskClass = "LOW" | "MEDIUM" | "HIGH" | "PROHIBITED_AUTO";

export type FactAssertion = "customer" | "user" | "system";
export type FactStatus =
  | "confirmed"
  | "inferred"
  | "check_this"
  | "unknown"
  | "conflict"
  | "range";

export type KnowledgeState =
  | "Proposed"
  | "Confirmed"
  | "Active"
  | "Needs review"
  | "Superseded"
  | "Disabled";

export type KnowledgeClass =
  | "authoritative"
  | "operational"
  | "interpretive"
  | "customer_specific";

export type TrustMode = "Private" | "Observe" | "Assist" | "Autopilot";
export type ActionPolicyMode = "Never" | "Ask every time" | "Automatic when safe";

export type Channel =
  | "email"
  | "form"
  | "forward"
  | "manual"
  | "sms"
  | "instagram"
  | "facebook"
  | "comment";

export type Money = {
  amount: number;
  currency: "AUD";
};

export type MoneyRange = {
  min: number;
  max: number;
  currency: "AUD";
};

export type LineItem = {
  id: string;
  label: string;
  amount: number;
  quantity?: number;
  unit?: string;
  ruleId?: string;
};

export type Provenance = {
  kind:
    | "message"
    | "website"
    | "document"
    | "user"
    | "rule"
    | "calendar"
    | "integration"
    // A fact a model proposed from a specific span of a specific message -
    // distinct from "message" (a fact quoted directly), because this one was
    // inferred, and the difference matters when explaining it to the owner.
    | "model";
  label: string;
  at?: string;
  detail?: string;
  /** Set only on kind "model": which inbound message it was read from. */
  messageId?: string;
  /** Set only on kind "model": the exact substring that supports the value. */
  span?: string;
  /** Set only on kind "model": the model id that produced it. */
  model?: string;
};

export type EnquiryFact = {
  id: string;
  field: string;
  label: string;
  value: string;
  displayValue: string;
  status: FactStatus;
  confidence: ConfidenceBand;
  assertedBy: FactAssertion;
  provenance: Provenance;
  requiredFor?: string[];
  blocking?: boolean;
  teachable?: boolean;
  customerSpecific?: boolean;
  superseded?: boolean;
  alternatives?: string[];
};

export type MissingInformation = {
  factField: string;
  label: string;
  reason: string;
  blocking: boolean;
  unlocks: string;
};

export type EvaluatorResult = {
  type: EvaluatorType;
  status: PricingKind | CapacityKind | EligibilityKind | GenericEvalKind;
  summary: string;
  detail?: string;
  lineItems?: LineItem[];
  total?: Money;
  range?: MoneyRange;
  assumptions?: string[];
  ruleIds?: string[];
  hardConstraints?: { label: string; ok: boolean }[];
  softPreferences?: { label: string; ok: boolean }[];
  alternatives?: string[];
  unknownReason?: string;
};

export type Recommendation = {
  action: RecommendationAction;
  label: string;
  reason: string;
  requiredApproval: boolean;
  reasonCodes: string[];
  primaryEnabled: boolean;
  blockedReason?: string;
};

export type DecisionTrace = {
  factIds: string[];
  ruleIds: string[];
  evaluatorRefs: string[];
  engineVersion: string;
  snapshotAt: string;
};

export type Message = {
  id: string;
  direction: "inbound" | "outbound";
  channel: Channel;
  at: string;
  from: string;
  to: string;
  subject?: string;
  body: string;
  quoted?: boolean;
  quoteId?: string;
  formFields?: { label: string; value: string }[];
  commentContext?: string;
};

export type QuoteVersion = {
  id: string;
  version: number;
  status: "draft" | "sent" | "superseded" | "accepted";
  sentAt?: string;
  total?: Money;
  range?: MoneyRange;
  lineItems: LineItem[];
  assumptions: string[];
  ruleSetVersion: string;
  hold?: Money & { label?: string };
};

export type Draft = {
  id: string;
  action: RecommendationAction;
  subject?: string;
  body: string;
  groundedFacts: string[];
  voiceVersion: string;
};

export type IntegrationHealth = {
  id: string;
  provider: string;
  kind: "email" | "calendar" | "booking" | "payments" | "sms" | "social" | "form";
  status: "connected" | "disconnected" | "error" | "not_connected";
  technicalScopes: string[];
  enquiryUsage: string[];
  lastSuccessAt?: string;
  accountLabel?: string;
};

export type AutomationGate = {
  id: string;
  label: string;
  passing: boolean;
};

export type ActionPolicy = {
  action: RecommendationAction;
  label: string;
  mode: ActionPolicyMode;
  risk: RiskClass;
  evidence?: {
    comparable: number;
    approvedUnchanged: number;
    wordingOnly: number;
    factualCorrections: number;
    commercialClaims: number;
  };
  gates: AutomationGate[];
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  summary: string;
  detail?: string;
  objectType: "enquiry" | "trust" | "brain" | "integration" | "booking";
  objectId?: string;
};

export type LearningSuggestion = {
  id: string;
  businessId: string;
  title: string;
  proposal: string;
  class: KnowledgeClass;
  examples: string[];
  status: "pending" | "accepted" | "dismissed";
  highImpact: boolean;
};

export type KnowledgeItem = {
  id: string;
  businessId: string;
  section:
    | "service"
    | "pricing"
    | "required_fact"
    | "operating"
    | "policy"
    | "capacity"
    | "alias";
  title: string;
  body: string;
  class: KnowledgeClass;
  state: KnowledgeState;
  source: Provenance;
  effectiveFrom?: string;
  effectiveTo?: string;
  version: string;
  stale?: boolean;
  conflictWith?: string;
};

export type Service = {
  id: string;
  name: string;
  customerLabel: string;
  category: string;
  durationMinutes?: number;
  locationModes: string[];
  state: KnowledgeState;
};

export type VoiceProfile = {
  warmth: string;
  formality: string;
  energy: string;
  directness: string;
  salesPressure: string;
  greeting: string;
  paragraphLength: string;
  bullets: boolean;
  signOff: string;
  preferredPhrases: string[];
  avoidedPhrases: string[];
  emoji: "none" | "occasional" | "frequent";
  priceStyle: string;
  followUpPressure: string;
  summary: string;
  version: string;
};

export type Business = {
  id: string;
  name: string;
  industry: string;
  industryBrain: string;
  city: string;
  timezone: string;
  currency: "AUD";
  soloOrTeam: "solo" | "team";
  baseLocation: string;
  ownerName: string;
  ownerFirstName: string;
  website?: string;
  services: Service[];
  knowledge: KnowledgeItem[];
  voice: VoiceProfile;
  integrations: IntegrationHealth[];
  trustMode: TrustMode;
  paused: boolean;
  pauseLevel: "none" | "outbound" | "all";
  actionPolicies: ActionPolicy[];
  learningSuggestions: LearningSuggestion[];
  requiredFactLabels: Record<string, string[]>;
};

export type Booking = {
  id: string;
  enquiryId: string;
  businessId: string;
  customerName: string;
  serviceLabel: string;
  when: string;
  durationMinutes?: number;
  location?: string;
  travelMinutes?: number;
  value?: Money;
  status: "pending" | "confirmed" | "external_pending" | "cancelled";
  handoff?: string;
  depositPaid?: boolean;
};

export type ChangeDiff = {
  factLabel: string;
  from: string;
  to: string;
};

/**
 * What the decision computed, before anything is sent.
 *
 * A real `quote_version` row only exists once a quote is actually sent - this
 * is the figure the *pending* recommendation carries, so the approval preview
 * has a real number to show for an enquiry that has never been sent yet.
 * `quotes` (below) still wins once a real row exists; this is the fallback
 * that lets a live, un-sent enquiry read from data rather than staying blank.
 */
export type DecisionPrice =
  | { kind: "EXACT"; amountMinor: number; currency: "AUD" }
  | { kind: "RANGE"; minMinor: number; maxMinor: number; currency: "AUD" };

export type DecisionSnapshot = {
  evaluators: EvaluatorResult[];
  missing: MissingInformation[];
  conflicts: string[];
  recommendation: Recommendation;
  explanation: string;
  why: WhyItem[];
  confidence: ConfidenceBand;
  risk: RiskClass;
  draft: Draft;
  quotes: QuoteVersion[];
  automationEligible: boolean;
  failedGates: string[];
  serviceComposition: string[];
  changeDiff?: ChangeDiff[];
  price?: DecisionPrice;
};

export type WhyItem = {
  id: string;
  claim: string;
  evidence: string;
  provenance: Provenance;
};

export type Enquiry = {
  id: string;
  fixtureId: string;
  businessId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerHandle?: string;
  source: Channel;
  commentOn?: "instagram" | "facebook";
  serviceLabel: string;
  eventLabel?: string;
  dateLabel?: string;
  locationLabel?: string;
  urgencyLabel?: string;
  state: CompositeState;
  valueExact?: Money;
  valueRange?: MoneyRange;
  facts: EnquiryFact[];
  conversation: Message[];
  decision: DecisionSnapshot;
  duplicateOf?: string;
  atRisk?: boolean;
  followUpDue?: boolean;
  followUpReason?: string;
  snoozedUntil?: string;
  receivedAt: string;
  updatedAt: string;
  teachPrompt?: string;
  notes?: string;
};

export type BrainChangePreview = {
  id: string;
  businessId: string;
  knowledgeId: string;
  input: string;
  title: string;
  current: string;
  next: string;
  appliesTo: string;
  effectiveFrom: string;
  section: KnowledgeItem["section"];
  class: KnowledgeClass;
  highImpact: boolean;
  affected: {
    enquiryId: string;
    customerName: string;
    from: string;
    to: string;
    applies: boolean;
    note?: string;
  }[];
};

export type AutomatedSend = {
  enquiryId: string;
  customerName: string;
  businessId: string;
  action: RecommendationAction;
  at: string;
  reason: string;
};

export type WorkspacePrefs = {
  hoursStart: string;
  hoursEnd: string;
  workingDays: string;
  timezone?: string;
  notifyArrival: boolean;
  notifyFollowUp: boolean;
  notifyLearning: boolean;
};

export type InstrumentationEvent = {
  id: string;
  fixtureId: string;
  action: string;
  at: number;
};

