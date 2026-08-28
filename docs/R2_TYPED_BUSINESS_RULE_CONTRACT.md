# Enquiry — First-Beta Typed Business Rule Contract

**Status:** PREPARED ARCHITECTURE CONTRACT  
**Purpose:** Make Business Brain evaluator inputs deterministic without turning Enquiry into a workflow/rules-builder platform.

Execution authority remains `docs/CURRENT_PHASE.md`.

This contract supports:

- R2C typed Business Brain persistence;
- R2D re-evaluation;
- R2E arbitrary enquiry decision compilation.

---

# 1. Design goal

The Business Brain needs two linked representations:

## Human-readable knowledge
What the operator sees:
- title;
- explanation/body;
- source;
- effective dates;
- confidence/state;
- conflict/supersession history.

## Machine-usable rule
What deterministic evaluators consume:
- typed rule kind;
- validated fields;
- conditions;
- output/constraint;
- version;
- linked knowledge/source.

The human-readable record is the explanation/provenance.

The typed rule is the transaction-grade representation.

Neither replaces the other.

---

# 2. Storage principle

Preferred conceptual shape:

`knowledge_item`
- current governance/source record.

Plus one typed payload, either:
- `knowledge_item.compiled_rule jsonb`; or
- a related `business_rule` table.

Product management does not require one storage choice.

Requirements:

- rule payload is schema-versioned;
- one payload belongs to one business;
- linked to knowledge item/source;
- inactive/proposed knowledge cannot silently become active evaluator authority;
- malformed/unknown rule version fails safe;
- audit/history can reconstruct which rule version produced a decision.

---

# 3. Common envelope

Conceptually:

```ts
type BusinessRuleEnvelope = {
  id: string
  businessId: string
  knowledgeItemId: string
  schemaVersion: 1
  kind: BusinessRuleKind
  state: "Proposed" | "Confirmed" | "Active" | "Needs review" | "Superseded" | "Disabled"
  effectiveFrom?: string
  effectiveTo?: string
  highImpact: boolean
  payload: BusinessRulePayload
}
```

Only `Active` rules are transaction-grade evaluator inputs.

A `Confirmed` rule may still require an activation/governance step depending on current Brain semantics.

---

# 4. Rule conditions

Avoid a generic expression language.

Use a bounded condition object.

Conceptually:

```ts
type RuleScope = {
  serviceIds?: string[]
  locationModes?: string[]
  factEquals?: Array<{ field: string; value: string }>
  factIn?: Array<{ field: string; values: string[] }>
  minNumericFact?: Array<{ field: string; value: number }>
  maxNumericFact?: Array<{ field: string; value: number }>
}
```

Important:

- no arbitrary JavaScript;
- no SQL fragments;
- no user-authored expression parser;
- no recursive Boolean rule tree in first beta.

If a first-cohort rule cannot fit bounded conditions, mark Needs human / add a new explicit product rule family only after evidence.

---

# 5. Service alias rule

Purpose:
map customer language to offered service candidates.

```ts
type ServiceAliasRule = {
  kind: "service_alias"
  alias: string
  serviceId: string
  matchMode: "exact" | "normalised" | "semantic_hint"
}
```

`semantic_hint` may help the interpreter propose a candidate.

It does not force a final service mapping if multiple candidates remain materially plausible.

---

# 6. Required-fact rule

Purpose:
state **which decision** needs a fact.

```ts
type RequiredFactRule = {
  kind: "required_fact"
  field: string
  evaluator: EvaluatorType
  scope?: RuleScope
  reason: string
}
```

Critical property:

> Required is evaluator-scoped, not globally required.

Example:
- exact party size may be required for pricing but irrelevant to initial qualification;
- ready-by time may be required for capacity but not travel.

The Decision Engine decides whether unresolved evaluator output is materially blocking the next action.

---

# 7. Fixed price rule

```ts
type FixedPriceRule = {
  kind: "price_fixed"
  serviceId: string
  amountMinor: number
  currency: string
  scope?: RuleScope
  label?: string
}
```

No float currency.

Currency must match/convert only through a deliberate future capability; first beta should not silently mix currencies.

---

# 8. Per-unit price rule

```ts
type PerUnitPriceRule = {
  kind: "price_per_unit"
  serviceId: string
  unitField: string
  unitAmountMinor: number
  currency: string
  minimumUnits?: number
  maximumUnits?: number
  minimumChargeMinor?: number
  scope?: RuleScope
}
```

Examples:
- per person;
- per room;
- per hour.

If `unitField` is a range, evaluator may produce a range rather than force an exact total.

---

# 9. Conditional add-on rule

Keep first beta simple.

```ts
type PriceAddonRule = {
  kind: "price_addon"
  serviceId?: string
  amountMinor: number
  currency: string
  scope: RuleScope
  label: string
}
```

Examples:
- travel zone fee;
- ceiling add-on if explicitly fixed;
- second-artist fixed fee where configured.

Do not support arbitrary nested formula maths.

---

# 10. Price unavailable / assessment rule

Some services should not produce a first-message price.

```ts
type PriceAssessmentRule = {
  kind: "price_assessment_required"
  serviceId: string
  scope?: RuleScope
  nextAction: "ASK_FACT" | "REQUEST_PHOTOS" | "SITE_VISIT" | "DISCOVERY" | "HUMAN_REVIEW"
  requiredFields?: string[]
  reason: string
}
```

This supports the product law:

> pricing can be not applicable at this decision stage.

---

# 11. Travel/service-area rule

First-beta bounded forms:

```ts
type TravelRule =
  | {
      kind: "travel_zone"
      zoneLabel: string
      locations: string[]
      feeMinor?: number
      currency?: string
      outcome: "ALLOWED" | "REVIEW" | "DECLINE_REVIEW"
    }
  | {
      kind: "travel_distance_band"
      maxDistanceKm: number
      feeMinor?: number
      currency?: string
      outcome: "ALLOWED" | "REVIEW"
    }
```

If exact distance/geocoding is unavailable:
- do not fake it;
- location matching may remain zone/manual;
- evaluator can return UNKNOWN.

No live maps/routing dependency required for first beta.

---

# 12. Capacity rule

Need enough structure to support group/event and planned-trade examples.

```ts
type CapacityRule =
  | {
      kind: "capacity_threshold"
      serviceId?: string
      unitField: string
      maxUnitsPerResource: number
      availableResourceCount: number
      extraResourceThreshold?: number
      scope?: RuleScope
    }
  | {
      kind: "capacity_duration"
      serviceId: string
      unitField: string
      minutesPerUnit: number
      bufferMinutes?: number
      availableResourceCount: number
      scope?: RuleScope
    }
  | {
      kind: "capacity_deadline"
      serviceId?: string
      condition: RuleScope
      requiredResourceCount: number
      reason: string
    }
```

First beta does not need a generic scheduling solver.

Availability and capacity remain separate evaluator families.

---

# 13. Eligibility / qualification rule

```ts
type EligibilityRule = {
  kind: "eligibility"
  serviceId?: string
  scope: RuleScope
  outcome: "ELIGIBLE" | "INELIGIBLE_REVIEW" | "NEEDS_HUMAN"
  reason: string
}
```

Do not let an INELIGIBLE result automatically send a decline.

It changes the recommendation.

Action authority still governs customer action.

---

# 14. Package/service selection rule

Keep deterministic mappings simple:

```ts
type PackageRule = {
  kind: "package"
  serviceId: string
  scope: RuleScope
  packageId: string
  label: string
}
```

If multiple Active rules match materially different packages:
- preserve ambiguity/conflict;
- do not arbitrarily pick the first row.

---

# 15. Follow-up rule

```ts
type FollowUpRule = {
  kind: "follow_up"
  afterHours: number
  onlyWhenResponsibility: "CUSTOMER"
  maxAttempts?: number
  scope?: RuleScope
}
```

Use business timezone/working-hours logic if the product actually supports it.

No auto-lost rule from silence in first beta.

---

# 16. Deposit/booking-fee rule

Because this is high impact, it must be explicit.

```ts
type DepositRule = {
  kind: "deposit"
  serviceId?: string
  type: "fixed" | "percentage"
  amountMinor?: number
  percent?: number
  currency?: string
  scope?: RuleScope
}
```

Always high-impact.

No payment collection is implied.

This only supports quote/booking-ready information.

---

# 17. Rule union

Conceptually:

```ts
type BusinessRulePayload =
  | ServiceAliasRule
  | RequiredFactRule
  | FixedPriceRule
  | PerUnitPriceRule
  | PriceAddonRule
  | PriceAssessmentRule
  | TravelRule
  | CapacityRule
  | EligibilityRule
  | PackageRule
  | FollowUpRule
  | DepositRule
```

Do not implement unused families merely because they are listed here.

R2C should build only what the first-beta eval/business examples require.

---

# 18. Evaluator input contract

Evaluator receives:

```ts
type EvaluatorInput = {
  businessId: string
  serviceCandidates: ...
  facts: LiveFact[]
  rules: ActiveBusinessRule[]
  externalEvidence: ...
  now: string
}
```

It must not receive:
- raw unvalidated customer prompt as transaction authority;
- Proposed/Superseded rules as active truth;
- rules from another tenant.

---

# 19. Evaluator result contract

Conceptually:

```ts
type EvaluatorResult = {
  type: EvaluatorType
  status:
    | "NOT_APPLICABLE"
    | "NEEDS_FACTS"
    | "VALIDATED"
    | "VALIDATED_WITH_CONDITIONS"
    | "BLOCKED"
    | "UNKNOWN"
  usedFactIds: string[]
  usedRuleIds: string[]
  needsFacts?: string[]
  result?: unknown
  hardConstraints?: string[]
  explanation: string
}
```

Use a more specific typed `result` per evaluator in implementation.

The important traceability fields are:
- facts used;
- rules used;
- needs facts;
- reason.

---

# 20. Minimum blocker algorithm contract

Minimum blocker is not stored as a static required field.

Conceptual process:

1. identify currently applicable evaluators;
2. execute with current facts/rules;
3. collect unresolved evaluator dependencies;
4. evaluate which unresolved outcomes can change the available next actions;
5. choose the smallest fact/question set that unlocks the next material decision;
6. if a business-rule conflict rather than customer fact is blocking, surface **Needs business review**, not a customer question.

This is why E01 and E02 in the non-fixture eval pack must differ despite identical customer wording.

---

# 21. Rule conflict contract

If two Active/current rules conflict:

- evaluator status = BLOCKED / Needs review;
- both source ids preserved;
- do not use recency as implicit precedence unless the Business Brain explicitly has that precedence rule;
- recommendation points to business review;
- no customer-facing exact commercial action authorised.

Conflict resolution creates a new rule state/version and re-evaluates affected open enquiries.

---

# 22. Rule versioning and DecisionTrace

Every persisted decision snapshot should be able to say:

- engine/compiler version;
- interpreter/model version where relevant;
- fact ids/versions;
- rule ids/versions;
- evaluator results;
- snapshot time.

Do not put model provider chain-of-thought in the trace.

Store product-relevant rationale/provenance only.

---

# 23. Confirmation contract

Potential sources:
- owner typed;
- website;
- uploaded price list;
- imported document;
- AI interpretation.

High-impact typed rule proposal:

> source evidence  
> → proposed readable knowledge + typed payload  
> → owner reviews  
> → confirmed/active

AI proposal is not authority.

---

# 24. Schema migration compatibility

During R2C:

- existing fixture/demo knowledge can remain old shape in demo runtime;
- live real tenant rules use the typed schema;
- avoid destructive migration of all fixtures merely to satisfy production storage;
- eval fixtures may gradually use the same contract where useful.

The live Decision Engine must not fall back to regex-prose interpretation when typed rule is missing and then silently transact.

Missing typed rule -> UNKNOWN / Needs Brain setup/human.

---

# 25. Security

Validate typed rule payload server-side.

Never trust client JSON to set:
- business id;
- Active state;
- high-impact false;
- action authority;
- arbitrary SQL/expression.

Tenant access + rule kind schema validation + governance state are mandatory.

---

# 26. First-beta stop rule

If a real rule requires a construct outside this bounded contract:

1. do not add a generic expression language;
2. capture the real business example;
3. decide whether:
   - existing family can be extended simply;
   - new explicit rule family is justified;
   - human review remains appropriate.

The product learns from evidence rather than becoming a no-code automation builder.
