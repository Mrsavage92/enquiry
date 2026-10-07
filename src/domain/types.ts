export type LifecycleState = "OPEN" | "BOOKED" | "DECLINED" | "LOST" | "CANCELLED";

export type DecisionState =
  | "EVALUATING"
  | "NEEDS_INFORMATION"
  | "NEEDS_HUMAN"
  | "ACTION_READY"
  | "WAITING_ON_CLIENT"
  | "BOOKING_PENDING"
  | "NONE";

export type CommercialState = "UNASSESSED" | "ESTIMATED" | "QUOTABLE" | "QUOTED" | "ACCEPTED";

export type Responsibility = "SYSTEM" | "BUSINESS" | "CUSTOMER" | "EXTERNAL_SYSTEM" | "NONE";

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
export type EligibilityKind = "PASS" | "FAIL" | "REQUIRES_EXCEPTION" | "UNKNOWN" | "NOT_APPLICABLE";
export type GenericEvalKind = "VALIDATED" | "BLOCKED" | "UNKNOWN" | "NOT_APPLICABLE";

export type ConfidenceBand = "High" | "Medium" | "Low";
export type RiskClass = "LOW" | "MEDIUM" | "HIGH" | "PROHIBITED_AUTO";

export type FactAssertion = "customer" | "user" | "system";
export type FactStatus = "confirmed" | "inferred" | "check_this" | "unknown" | "conflict" | "range";

export type KnowledgeState =
  "Proposed" | "Confirmed" | "Active" | "Needs review" | "Superseded" | "Disabled";

export type KnowledgeClass = "authoritative" | "operational" | "interpretive" | "customer_specific";

export type TrustMode = "Private" | "Observe" | "Assist" | "Autopilot";
export type ActionPolicyMode = "Never" | "Ask every time" | "Automatic when safe";

export type Channel =
  "email" | "form" | "forward" | "manual" | "sms" | "instagram" | "facebook" | "comment";

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
  /**
   * The value the customer already gave, read from their message and not yet
   * confirmed: the owner checks it rather than asking for it again.
   */
  inferred?: { value: string; display: string };
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
  /** When the owner recorded it as sent (the server's undo clock). */
  sentAt?: string;
  /** A reviewed send backs this message, so it can be undone in the window. */
  reviewed?: boolean;
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
  section: "service" | "pricing" | "required_fact" | "operating" | "policy" | "capacity" | "alias";
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
  | {
      kind: "EXACT";
      amountMinor: number;
      currency: "AUD";
      /** A quote with more than one thing on it: each line, main job first. */
      lines?: { label: string; amountMinor: number; detail?: string }[];
    }
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
  /**
   * An amount Enquiry calculated whose premise the owner has not confirmed.
   *
   * Deliberately NOT `price`: every writer that turns a decision into money -
   * `confirmReviewedSendInTransaction` above all - reads `price`, so a figure that
   * is not yet an authorised commercial decision has to live somewhere those
   * writers cannot mistake for one. The desk renders it as provisional.
   */
  provisionalPrice?: {
    amountMinor: number;
    currency: "AUD";
    premise: "service_unconfirmed";
    service: string;
  };
  /**
   * Every amount this decision legitimately implies, in minor units - the
   * total, the unit rate, and the minimum-billed total where one applies.
   *
   * The reviewed message has to be allowed to say "That comes to $580. 4 people
   * at $145 each." without the unit rate reading as a disagreement, and it has
   * to be refused when it names a figure the decision never implied. Derived
   * from the structured rule, so the check never has to parse prose for
   * authority. Absent on a decision made before this existed, in which case
   * only the structured total is allowed.
   */
  impliedAmountsMinor?: number[];
  /**
   * Stored before pass 10: money the owner typed in their answers, trusted by
   * value. No longer read - a figure is trusted only inside its own sentence.
   */
  ownerAmountsMinor?: number[];
  /**
   * The owner's own sentences that name money, as the reply carries them
   * ("We have $20m public liability."): the send check trusts a figure only
   * inside its own sentence, standing exactly as written.
   */
  ownerAnswerTexts?: string[];
  /**
   * Two things the owner said disagree ("You said you don't do trials, but a
   * makeup trial is on this quote"): nothing is sent or confirmed until they
   * settle it.
   */
  conflict?: string;
  /**
   * Something else the customer asked for that the owner has not settled:
   * add it (or a price for it), or leave it out and tell them. While this is
   * set nothing is ready to send, so no total can silently drop it.
   */
  extraPending?: {
    field: string;
    label: string;
    kind: "check" | "no_price";
    amountMinor?: number;
    span?: string;
  };
  /** Extras the owner chose to leave out; the reply says so. */
  leftOut?: string[];
  /**
   * What the price covers and whether the owner confirmed it for exactly these
   * facts. `price` above is only set once it is confirmed.
   */
  coverage?: import("./coverage.ts").Coverage;
  /**
   * The coverage tap folded into Copy: set only while the coverage above is
   * unconfirmed and the app is sure what the price covers. Carries the reply
   * as it reads once confirmed; recording that reply confirms the coverage.
   */
  fold?: import("./coverage-fold.ts").CoverageFold;
  /** A "do you do X?" the owner has not answered; nothing is ready until they do. */
  questionPending?: import("./decide.ts").QuestionPending;
  /**
   * Every day the customer wrote, with what it is for: the job's own day
   * (`job`, `deadline` or `event`) first, then the trial, the inspection, a
   * second day. For the card's date fields.
   */
  dates?: import("./date-roles.ts").DateMention[];
  /**
   * Everything they asked for or asked about, and where each stands: answered
   * in the reply, left out by the owner, to come back on, or still open. A
   * reply never goes out with one of these missing.
   */
  asked?: import("./asked.ts").AskedItem[];
  /**
   * The owner's checks on this enquiry: how many are settled and how many
   * there are in all, so "Check 2 of 4" never restarts at 1.
   */
  checks?: { done: number; total: number };
  /**
   * A day they asked for is one the owner doesn't work, on a reply that is
   * ready: which days, the work held out of the total for a wedding day that
   * can't be done, and whether anything can be booked. The verdict reads it,
   * so a Sunday wedding is never "Yes - reply ready" as if it could be done.
   */
  closedDay?: import("./decide.ts").ClosedDay;
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
  /** No name was given or read; `customerName` then holds "Customer". */
  nameUnknown?: boolean;
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
  /**
   * A practice enquiry the owner asked to try. Labelled everywhere, counted in
   * nothing, and never sendable (migrations/0012).
   */
  practice?: boolean;
  /**
   * The server's decision revision this copy was read at. A confirmation (what
   * the price covers) names it, so it can never land on a decision that moved.
   */
  decisionRevision?: number;
  /**
   * The owner copied this reviewed text and has not said whether they sent it
   * (doc 50 7.5). Asked once on return; "Not yet" clears it.
   */
  copied?: { reviewedSendId: string; at: string; body: string };
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
  /** The owner closed the "Book a setup call" card on Today. */
  setupCallDismissed?: boolean;
};

export type InstrumentationEvent = {
  id: string;
  fixtureId: string;
  action: string;
  at: number;
};
