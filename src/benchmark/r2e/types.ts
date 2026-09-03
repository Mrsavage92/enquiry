import type { InterpretationResult, InterpretFailureReason } from "../../lib/interpret/types.ts";

/**
 * The 15-case non-fixture benchmark (R2E phase doc, sections 11-12).
 *
 * Every case runs the REAL deterministic pipeline - `insertManualEnquiry`,
 * `interpretAndApply`, `decideEnquiry`, `composeReply` - against a fresh
 * PGLite database, never a mock of the domain logic. Only the interpreter
 * (the model call) is swapped between three modes: null (no provider),
 * fake/expected (a canned reading or a canned failure, replayed with zero
 * network calls), and real (the actual configured Anthropic adapter, only
 * when `ANTHROPIC_API_KEY` is set).
 *
 * A case declares what "a good model" should read (`expectedModelReading`)
 * OR, for the provider-failure category, what failure it simulates
 * (`simulatedFailureReason`) - never both. The four scoring dimensions
 * (interpretation, business correctness, trust/safety, draft) are kept
 * separate on purpose (phase doc section 12): nothing here collapses to one
 * percentage.
 */

export type ServicePhenotype =
  "wedding-event" | "home-service" | "creative-professional" | "other-service";

/** A typed rule payload, in exactly the shape `parseBusinessRule` accepts. */
export type RulePayload = Record<string, unknown>;

export type RuleSeed = {
  payload: RulePayload;
  /** Defaults to "Active". "Needs review" proves a flagged/conflicting rule is never used silently. */
  state?: "Active" | "Needs review";
};

export type OperatorInput = {
  /** "" lets the interpreter propose it; the deterministic engine never guesses one on its own. */
  serviceLabel: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  intakeNote?: string;
};

export type BusinessSetup = {
  name: string;
  industry: string;
  rules: RuleSeed[];
};

/** What the interpretation dimension checks about the model's own reading. */
export type ExpectedInterpretation = {
  /** One line: what a competent reading of this message should capture. Reported, not mechanically asserted (no `intent` field exists on the real schema). */
  note: string;
  expectServiceCandidate: boolean;
  /** Fact fields the reading must include. */
  expectFactFields: string[];
  expectAmbiguity: boolean;
  expectCandidateMissingFacts: boolean;
};

export type PriceKind = "EXACT" | "BLOCKED" | "NO_RULE";
export type DecisionAction = "SEND_QUOTE" | "REQUEST_INFORMATION" | "ESCALATE_HUMAN";
export type DecisionStateName = "ACTION_READY" | "NEEDS_INFORMATION" | "NEEDS_HUMAN";
export type CommercialStateName = "QUOTABLE" | "UNASSESSED";

/** What the business-correctness dimension checks about the persisted decision. */
export type ExpectedBusiness = {
  priceKind: PriceKind;
  action: DecisionAction;
  decisionState: DecisionStateName;
  commercialState: CommercialStateName;
  /** Required when priceKind is EXACT. */
  amountMinor?: number;
  /** Required when priceKind is BLOCKED. */
  blockerField?: string;
  /** Substring the explanation must contain. Omit for a loose check (only shape asserted). */
  explanationIncludes?: string;
};

/** What the trust/safety dimension checks. */
export type ExpectedTrust = {
  /** Fields from the model reading that must never carry status "confirmed" after this run. */
  neverConfirmedFields: string[];
  primaryEnabled: boolean;
};

/** What the draft dimension checks - grounded content only. */
export type ExpectedDraft = {
  mustContain: string[];
  mustNotContain: string[];
};

export type FollowUpStep = {
  label: string;
  field: string;
  value: string;
  expectedAfter: ExpectedBusiness;
};

export type CaseExpected = {
  interpretation: ExpectedInterpretation;
  business: ExpectedBusiness;
  trust: ExpectedTrust;
  draft: ExpectedDraft;
};

export type BenchmarkCase = {
  id: string;
  /** 1-15, matching the phase doc's section 11 list, in order. */
  category: number;
  categoryLabel: string;
  phenotype: ServicePhenotype;
  /** Why this case exists / what it proves. */
  note: string;
  business: BusinessSetup;
  operator: OperatorInput;
  rawMessage: string;
  /** Set for every case except the provider-failure one. */
  expectedModelReading?: InterpretationResult;
  /** Set only for the provider-failure case. */
  simulatedFailureReason?: InterpretFailureReason;
  expected: CaseExpected;
  /**
   * Business-correctness/trust the run must show immediately after
   * interpretation when the interpreter is NULL (unconfigured) rather than
   * the fake/real one - only needed when the operator left the service blank
   * and a successful reading would have filled it (cases where that changes
   * BLOCKED vs NO_RULE). Omitted when null and fake/real modes converge.
   */
  nullModeBusiness?: ExpectedBusiness;
  followUps: FollowUpStep[];
  /** Only case 9: identical wording, a second Business Brain, a different result. */
  variant?: {
    business: BusinessSetup;
    operator: OperatorInput;
    expectedModelReading?: InterpretationResult;
    expected: CaseExpected;
  };
};
