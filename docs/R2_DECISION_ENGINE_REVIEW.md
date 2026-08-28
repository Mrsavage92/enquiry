# Enquiry — R2 Decision Engine / Business Brain Review

**Reviewed:** 28 August 2026  
**Purpose:** Prevent the persisted-data cutover from accidentally turning fixture logic into the production Decision Engine.

This is a product-management architecture review. It is not active implementation authority.

Execution remains controlled by `docs/CURRENT_PHASE.md`.

---

# 1. Core finding

The repository has strong **domain shapes and demo behaviours**, but the current deterministic evaluator logic is not yet general enough for arbitrary first-beta enquiries.

The live first-beta target remains:

> **AI interprets. Deterministic systems validate important outcomes.**

To make that true, R2 must introduce one missing bridge:

> **Business Brain knowledge must have a confirmed machine-usable rule representation, not only human-readable text that fixture code regex-parses.**

---

# 2. What exists today

Useful domain structures already exist:

- services;
- Knowledge Items with state/class/source/version;
- Enquiry facts with provenance/status;
- evaluator result families;
- Decision Snapshot;
- recommendation;
- quote versions;
- action policies;
- composite lifecycle/decision/commercial/responsibility state.

These should be preserved unless a specific gap requires extension.

---

# 3. Current evaluator logic is fixture/demo-specific

Examples:

### `src/domain/reeval.ts`

Contains explicit enquiry-ID branches such as:

- F03;
- F09;
- F15;
- F17.

Those are excellent regression fixtures.

They are not a production rule engine.

### `src/domain/brain-apply.ts`

Uses patterns such as:

- matching Knowledge Item titles/body strings;
- parsing `$...` values from prose;
- known fixture/business-specific titles;
- hard-coded examples/assumptions.

Again: valuable demo/eval behaviour, but not a safe arbitrary-business transaction boundary.

### `src/fixtures/arriving.ts`

Hard-codes both the incoming Sofia message and the final resolved Decision Object.

This is a demonstration of the desired outcome, not an interpretation implementation.

---

# 4. Current Business Brain is only partly structured

`KnowledgeItem` has useful governance metadata:

- section;
- class;
- state;
- source;
- effective dates;
- version;
- conflict;
- stale.

But the actual rule is primarily stored in:

`body: string`

That is human-readable knowledge, not necessarily deterministic executable truth.

The database mirrors this.

If a production evaluator has to regex-parse the prose every time it decides a price/capacity rule, the promised boundary:

> AI interprets; deterministic systems transact

has not actually been achieved.

---

# 5. Required first-beta architecture

Do **not** create a visual workflow builder or a universal programming language.

Use a deliberately bounded internal rule model.

Recommended conceptual pipeline:

> source text / operator statement  
> → AI or deterministic parser proposes a typed rule  
> → operator reviews/confirms high-impact rule  
> → typed rule becomes Active  
> → evaluators consume the typed rule deterministically

The original human-readable knowledge + provenance remains visible.

---

# 6. Minimal typed rule families

Support only the rule families required by the first-beta phenotypes.

A possible TypeScript concept:

```ts
type CompiledBusinessRule =
  | FixedPriceRule
  | PerUnitPriceRule
  | MinimumQuantityRule
  | ServiceEligibilityRule
  | RequiredFactRule
  | TravelRule
  | CapacityRule
  | PackageRule
  | FollowUpRule;
```

The exact names/schema may differ.

The important property is:

> evaluator code receives validated typed data, not arbitrary prose.

---

# 7. Rule families in first-beta scope

## Service / alias

Needed to map customer language onto a real offered service.

Examples:

- "bridal party makeup" -> Group mobile makeup;
- "interior repaint" -> Interior painting;
- "brand refresh" -> Brand refresh.

Must preserve ambiguity when more than one mapping is materially plausible.

## Required fact

A fact can be required **for a specific decision/evaluator**, not globally required.

Needed fields include:

- fact field;
- evaluator/decision it unlocks;
- scope/service;
- materiality/condition where applicable.

This is essential for minimum-blocker behaviour.

## Pricing

Initial deterministic shapes can cover:

- fixed price;
- per unit/person/hour;
- minimum charge/quantity;
- simple conditional/add-on;
- range/estimate rule;
- no pricing at this decision stage.

Do not support arbitrary spreadsheet formulas in first beta.

## Travel/location

Initial shapes:

- service area;
- included radius/zone;
- flat band/fee;
- outside area -> decline/review/minimum.

Do not pretend exact route/time integration exists if it does not.

## Capacity

Initial shapes:

- solo/team resource count;
- duration per unit/person;
- buffer;
- hard maximum;
- threshold requiring another resource;
- deadline/window constraints where configured.

Calendar free/busy and resource capacity remain separate.

## Eligibility / qualification

Initial shapes:

- offered/not offered;
- service-area eligibility;
- minimum order/value/quantity;
- simple customer/job-fit condition.

## Package/service selection

Map a set of confirmed facts to one or more valid offers, preserving ambiguity when multiple offers remain materially different.

## Follow-up

Simple rule for when an open/waiting enquiry becomes follow-up due.

---

# 8. Rule governance

Every compiled rule must still retain/link:

- source/provenance;
- human-readable explanation;
- version;
- state;
- effective dates if relevant;
- business id;
- high-impact classification.

### High-impact

At minimum:

- price;
- deposit/payment;
- cancellation/refund;
- eligibility/decline;
- capacity commitments;
- autonomous action permission

must not become authoritative silently.

AI may propose the rule.

The owner confirms it.

---

# 9. Interpreter contract

R2E's arbitrary-message interpreter should output **candidate understanding**, not a commercial decision.

A suitable conceptual output:

```ts
type InterpretationResult = {
  intent: ...
  facts: CandidateFact[]
  inferences: CandidateInference[]
  ambiguities: Ambiguity[]
  mentionedServices: ServiceCandidate[]
  candidateMissingFacts: string[]
  suggestedEvaluatorFamilies: EvaluatorType[]
  provenance: ...
}
```

Important:

- `suggestedEvaluatorFamilies` is advisory;
- final applicability belongs to the deterministic compiler/router;
- price/capacity/eligibility conclusions from the model are ignored as authority;
- customer prompt injection cannot alter Business Brain/system policy.

---

# 10. Deterministic evaluator contract

Each evaluator should return a typed result and explicit dependency state.

Conceptually:

```ts
type Evaluation = {
  status: ...
  usedFactIds: string[]
  usedRuleIds: string[]
  needsFacts?: string[]
  hardConstraints?: ...
  result?: ...
  explanation: string
}
```

This gives the Decision Engine enough information to compute:

- what ran;
- why;
- what is unknown;
- which fact genuinely blocks progress;
- provenance/Why;
- change impact.

---

# 11. Minimum blocker

Do not implement minimum blocker as:

> first missing required field.

A missing fact is a blocker only if one or more currently relevant evaluators cannot determine the next safe action without it.

First-beta practical algorithm:

1. run all currently applicable evaluators with known facts/rules;
2. collect evaluator-declared `needsFacts`;
3. determine which unresolved evaluator outcomes materially change the available recommendation/action;
4. ask for the smallest fact/set that unlocks that material decision;
5. if multiple questions are genuinely required together, say so rather than pretending one is enough.

Example:

Five vs six people:

- if all configured rules produce same result for 5/6, exact count is not blocking;
- if six triggers a second resource/minimum/package, count is blocking.

The evaluator/rule owns that materiality — not a generic form-field schema.

---

# 12. Decision Object persistence

The current domain spreads canonical Decision Object concepts across:

- facts;
- missing;
- evaluator results;
- recommendation;
- Why/provenance;
- action policy;
- composite state.

That is acceptable if the persisted API remains coherent.

However R2 should ensure the live decision snapshot has explicit version/trace information sufficient to reconstruct:

- which facts;
- which rule versions;
- which evaluators;
- which engine/compiler version;
- when the snapshot was produced.

The existing `DecisionTrace` type should be used or deliberately integrated rather than remaining dead conceptual code.

Do not force a large naming refactor solely to make the type names match strategy documents.

---

# 13. Corrections

When a customer/operator correction lands:

1. preserve old fact as superseded/history;
2. insert/confirm the new fact with provenance;
3. determine which evaluator dependencies changed;
4. re-run relevant evaluators;
5. compile a new Decision Snapshot/trace;
6. preserve immutable sent quote history;
7. append audit event.

If the operator chooses **Teach Enquiry**:

- produce/modify a proposed Business Brain rule separately;
- high-impact rule still waits for confirmation;
- do not mutate all historical customer facts.

---

# 14. Model-provider boundary

Do not bake one model vendor throughout the domain.

Use one server-only interpreter adapter/interface.

Requirements:

- model name/config server-side;
- schema-validated structured output;
- timeout/retry policy;
- no API key in client;
- safe failure to human/unknown;
- raw customer text treated as untrusted;
- provider response logged only to the privacy level deliberately approved;
- deterministic evaluator can be tested without calling the model.

Before R2E becomes active, product management should verify the current best model/API choice for structured extraction against cost/reliability.

The first beta does not need multi-provider routing.

---

# 15. Acceptance target before R2E can pass

The arbitrary-message path must prove at least:

- 10 non-fixture examples;
- 3 service phenotypes;
- new wording not copied from fixtures;
- same message + different Business Brain -> different decision;
- missing fact that matters;
- missing fact that does not matter;
- pricing not applicable;
- exact price from confirmed typed rule;
- unknown capacity/integration;
- prompt-injection-like customer content;
- model/provider failure.

The deterministic compiler/evaluators should be testable with a mocked/preconstructed `InterpretationResult`.

Model quality and business-rule correctness must not be collapsed into one opaque end-to-end score.

---

# 16. What not to build

Do not turn this into:

- visual workflow builder;
- generic rules programming language exposed to users;
- arbitrary user JavaScript;
- autonomous model-written SQL/transactions;
- one giant tenant prompt;
- per-tenant fine tuning;
- vector-search-everything architecture;
- agent swarm;
- full scheduling engine.

First beta needs a trustworthy narrow compiler, not an AI platform.
