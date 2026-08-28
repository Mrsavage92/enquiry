# R2C — Persist Business Brain, Trust + Decision-Affecting Business State

**Status:** PREPARED — NOT AUTHORISED UNTIL `docs/CURRENT_PHASE.md` ACTIVATES R2C

R2C is the third slice of:

`docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`

Supporting reviews:

- `docs/R2_PRODUCTION_HEURISTIC_SAFETY_AUDIT.md`

- `docs/R2_FOUNDATION_REVIEW.md`
- `docs/R2_DECISION_ENGINE_REVIEW.md`
- `docs/BETA_READINESS_GATE.md`

R2C begins only after R2B is signed off.

---

# Objective

Move business-defining state from client-only prototype mutations into authenticated, tenancy-checked, server-persisted semantics.

R2C is also where Enquiry establishes the **minimum typed Business Brain rule representation** needed by the future arbitrary-enquiry Decision Engine.

This is not a workflow builder and not a complete ingestion/AI phase.

---

# Product invariant

> Human-readable business knowledge is not enough to transact deterministically.

The first-beta Business Brain must preserve:

- readable knowledge;
- source/provenance;
- version/state;
- human confirmation;

and, where the knowledge drives an evaluator, a **small typed machine-usable rule payload**.

AI may help propose a typed rule later.

A rule only becomes authoritative according to the existing Business Brain confirmation model.

---

# 1. Persist trust/business mutations already represented in the product

Minimum live scope:

### Business pause
- outbound;
- all;
- resume.

Use/extend existing `setBusinessPause`.

### Per-action policy
Use/extend `setActionPolicyMode`.

Server must remain the authority.

### Trust mode
If the live UI exposes Private / Observe / Assist / Autopilot, the chosen live tenant mode must persist server-side.

Important:
- global trust mode does not override per-action hard gates;
- `Autopilot` label must not cause unearned action automation;
- decline remains prohibited from auto where product contract says so.

### Voice
Persist voice profile only to the degree it affects prepared communication.

Do not treat tone edits as Business Brain commercial truth.

### Decision-affecting working preferences
Persist only preferences that influence the decision/follow-up engine, such as:
- timezone;
- working days/hours if used by follow-up logic.

Pure UI/device preferences may remain local.

---

# 2. Business Brain rule model

The current `knowledge_item.body` string + regex parsing is not sufficient for first-beta deterministic evaluation.

Introduce a bounded typed representation.

Preferred storage direction:

- keep `knowledge_item` as the governance/readability record;
- add a machine-readable JSON payload or a tightly scoped related table for compiled rule data;
- schema validates rule kind/version/fields;
- rule record links to the knowledge item/source/version.

Do not make the interpreter evaluate arbitrary prose at transaction time as the final authority.

---

# 3. First-beta typed rule families

Implement only the families required for the first-beta phenotypes.

The exact schema may vary, but the semantics must cover:

## Service alias / service mapping
Examples:
- customer phrase -> offered service candidate;
- one alias may map to multiple candidates if ambiguity remains.

## Required fact rule
Must express:
- fact field;
- which evaluator/decision it is required for;
- service/scope condition where needed;
- whether absence is decision-blocking.

Do not make every missing field globally required.

## Pricing
Bounded first-beta forms:
- fixed price;
- per-unit/person/hour;
- minimum quantity/charge;
- simple conditional add-on;
- range/estimate rule;
- not-applicable-at-this-stage.

No arbitrary formula language.

## Travel/location
Simple:
- included area/radius/zone;
- flat/simple band fee;
- outside-area outcome/review;
- minimum job condition where needed.

No fake live routing integration.

## Capacity
Simple:
- solo/team resource count;
- per-unit duration;
- buffer;
- max/threshold;
- another-resource threshold;
- ready-by/deadline feasibility where configured.

Availability remains separate.

## Eligibility / qualification
Simple:
- offered/not offered;
- minimum quantity/value;
- location/service-area eligibility;
- simple job/customer-fit conditions.

## Package/service selection
Deterministic mapping from confirmed facts to one/more valid offers.

## Follow-up timing
Simple rule for when waiting/open work becomes follow-up due.

---

# 4. Rule governance

Every typed rule must retain/link:

- business id;
- knowledge item id;
- source/provenance;
- rule version;
- knowledge state;
- effective dates if relevant;
- high-impact classification.

### High-impact rule classes

At minimum treat these as high-impact:
- pricing;
- deposit/payment;
- cancellation/refund;
- eligibility/decline;
- capacity commitments;
- action authority.

A proposed rule can exist without becoming Active.

The product must preserve:
- Proposed;
- Confirmed;
- Active;
- Needs review;
- Superseded;
- Disabled

or an equivalent coherent lifecycle.

---

# 5. Live Brain actions

Persist the meaningful current Business Brain actions:

### Confirm knowledge
A valid confirmed item may become Active only according to class/state rules.

### Resolve conflict
Choosing one source/rule:
- updates the winning/losing knowledge states;
- does not delete history;
- recompiles the typed rule state;
- re-evaluates affected open enquiries only.

### Learning suggestion
Accept/dismiss:
- persists;
- accepted suggestion does not silently become high-impact Active truth if confirmation is required.

### Teach Enquiry
When an enquiry correction is later promoted:
- create/propose a Business Brain rule;
- do not mutate customer history;
- high-impact confirmation still applies.

R2D will wire the enquiry-side correction path fully.

---

# 6. Re-evaluation after Business Brain changes

When an Active rule changes:

1. identify open enquiries for that business;
2. determine which evaluator dependencies use the changed rule;
3. re-run only affected evaluator families where practical;
4. compile a new persisted decision snapshot/trace;
5. preserve quote history;
6. append audit event.

Do not:
- loop every tenant;
- rewrite closed history;
- destructively overwrite sent quote versions.

For first beta, re-evaluating all **open enquiries in the same business** is acceptable if simpler and bounded, provided cross-business isolation is absolute.

---

# 7. Undo/correction semantics

The prototype has client-only `undoLast()`.

After R2C, any business/trust/Brain mutation that is persisted cannot be cosmetically undone only in Zustand.

For each affected action:
- either provide a real server-side inverse/corrective operation;
- or remove the local Undo affordance for that action.

Audit history should record both original and corrective action.

Do not mutate history out of existence.

---

# 8. Synthetic automation evidence

Live tenant trust UI must not inherit demo evidence such as:
- "74 comparable";
- "72 approved unchanged";
- fixture-generated acceptance history.

For a live tenant:
- evidence starts empty;
- real beta events in R2F later populate it;
- no action auto-graduates because of demo history.

If automation eligibility is shown before sufficient evidence exists, say there is not enough evidence yet.

---

# 9. Audit

Persist meaningful business/trust/Brain actions server-side with:
- actor;
- object type/id;
- summary;
- relevant detail;
- timestamp.

Live Trust Audit should display actual tenant audit rows, not instrumentation events.

Do not log full raw customer content into audit unnecessarily.

---

# 10. Tenancy/security

Every mutation must:
- verify bearer identity through existing auth middleware;
- re-derive business access server-side;
- never trust a client-supplied user id;
- never infer tenancy from a business id alone.

Cross-tenant mutation tests are required for:
- trust mode;
- action policy;
- Brain confirm;
- conflict resolve;
- learning accept/dismiss;
- voice/business preference changes.

---

# 11. Tests

At minimum:

### Business/trust
- pause/resume persists;
- trust mode persists;
- action policy persists;
- prohibited/invalid modes rejected;
- decision-affecting hours/timezone persist.

### Business Brain
- typed rule round-trip;
- proposed vs active state respected;
- high-impact rule cannot silently activate;
- conflict resolution preserves superseded history;
- learning accept/dismiss persists;
- active rule update re-evaluates only correct tenant/open work.

### Rule evaluation
- fixed price rule;
- per-unit/minimum;
- pricing not applicable;
- travel;
- capacity threshold;
- required fact scoped to evaluator;
- same rule data survives reload.

### Safety
- malformed rule payload rejected safely;
- cross-tenant changes fail;
- no synthetic evidence for new business;
- no client-only undo split-brain.

---

# Acceptance

- [ ] Trust/business/decision-affecting preferences persist server-side.
- [ ] Live action policies remain server-authoritative.
- [ ] Business Brain evaluator-driving knowledge has a typed machine-usable representation.
- [ ] Production evaluator authority no longer depends on regex-parsing arbitrary prose.
- [ ] High-impact rule activation remains human-confirmed.
- [ ] Conflict resolution preserves rule history/provenance.
- [ ] Learning accept/dismiss persists.
- [ ] Brain changes re-evaluate affected open enquiries safely.
- [ ] Live tenant automation evidence is real-only.
- [ ] Persisted mutations have coherent audit history.
- [ ] Client-only Undo cannot visually reverse persisted truth.
- [ ] Cross-tenant mutations fail.
- [ ] Typecheck/full tests/build pass or unchanged baseline is classified.
- [ ] No arbitrary customer-message AI ingestion yet.
- [ ] No workflow builder / generic rules language.

---

# Handoff

Report:

1. typed rule storage/schema;
2. supported rule families;
3. rule governance/high-impact handling;
4. persisted trust/business operations;
5. preferences chosen as server vs device local;
6. Brain mutation server functions;
7. re-evaluation strategy;
8. audit model;
9. Undo changes;
10. live automation evidence behaviour;
11. tests/build;
12. anything deferred to R2D/R2E.

Then stop.
