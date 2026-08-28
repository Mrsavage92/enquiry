# R2 — Persisted Operator Cutover + First-Beta Core

**Status:** PREPARED MANAGEMENT PLAN

**Execution authority:** `docs/CURRENT_PHASE.md`.

R2 exists because the repository now contains a strong server/database foundation, but the signed-in operator product is still fundamentally running from `src/store/prototype-store.ts` and fixture-driven deterministic demo logic.

The landed foundation commits are:

- `f11c8d4a202b00c9f6b679de61810242c331b9c9` — product-core schema;
- `7cd1ee4c57f18a365447038e11f80f15de4e4535` — RLS lockdown;
- `43a7b287295638fc0cbbf91b88fa86f6be3e521f` — tenancy/repository/workspace server boundary.

These commits are useful **ungated existing code**, not proof that Enquiry is now a real persisted beta product.

The current live UI still uses the prototype store heavily across:

- app shell;
- queue/workspace;
- enquiry intelligence/conversation;
- Business Brain;
- bookings;
- trust;
- settings;
- insights;
- onboarding;
- public quote/booking fixture routes.

The current domain re-evaluation and arriving-enquiry behaviour are also fixture-oriented. There is no general arbitrary-enquiry interpretation pipeline yet.

R2 turns the prototype into a truthful first-beta product without turning Enquiry into a CRM/FSM or prematurely building every integration.

Concrete source-review findings that must be read before executing R2 are recorded in:

`docs/R2_FOUNDATION_REVIEW.md`

Decision-engine/Business-Brain production boundaries are additionally reviewed in:

`docs/R2_DECISION_ENGINE_REVIEW.md`

These reviews are supporting evidence; `CURRENT_PHASE.md` remains execution authority.

Detailed prepared slice briefs:

- R2A: `docs/phases/PHASE_R2A_REAL_WORKSPACE_ONBOARDING.md`
- R2B: `docs/phases/PHASE_R2B_SERVER_AUTHORITATIVE_RUNTIME.md`
- R2C: `docs/phases/PHASE_R2C_PERSISTED_BRAIN_TRUST.md`
- R2D: `docs/phases/PHASE_R2D_PERSISTED_ENQUIRY_DECISIONS.md`
- R2E: `docs/phases/PHASE_R2E_ARBITRARY_ENQUIRY_INTERPRETATION.md`
- R2F: `docs/phases/PHASE_R2F_REVIEW_FIRST_BETA_LOOP.md`

Cross-cutting control/eval docs:

- `docs/R2_LIVE_DEMO_SEPARATION_MAP.md`
- `docs/R2_ACTION_SEMANTICS_MATRIX.md`
- `docs/R2_TYPED_BUSINESS_RULE_CONTRACT.md`
- `docs/evals/FIRST_BETA_NON_FIXTURE_EVAL_PACK.md`
- `docs/BETA_TELEMETRY_SPEC.md`

---

# Durable R2 rules

## 1. Server data is authoritative in the signed-in operator app

A client store may cache/render server state and hold transient UI state.

It must not remain the authoritative database for real tenant:

- businesses;
- Business Brain knowledge;
- enquiries;
- facts;
- messages;
- decision snapshots;
- quote versions;
- bookings;
- trust/action-policy state;
- audit history.

Reloading or opening another browser must not silently revert commercial/business state to a fixture/session-storage copy.

## 2. Demo fixtures never silently become a live tenant

`/demo` may remain fixture-driven.

A newly signed-in business must not be provisioned as "Glow & Co" or receive fake customer enquiries/bookings merely to avoid an empty state.

Sample data must be explicitly entered as a demo/sample and must not masquerade as the user's live workspace.

## 3. First beta must process non-fixture enquiries

A product that only replays F01–F20 is a demo, not a beta.

Before the first external cohort, an authorised user must be able to provide a new real/anonymised enquiry that was not pre-coded in fixtures and receive a persisted Decision Object.

## 4. AI interprets; deterministic systems transact

LLM/model output may propose:

- intent;
- extracted facts;
- inferences;
- ambiguities;
- missing facts;
- evaluator applicability;
- draft language.

Commercial/operational outcomes must then be validated against structured Business Brain rules and deterministic evaluator logic where those rules exist.

Do not let the model directly mutate quote/booking/trust state.

## 5. Review-first beta does not require production channel integrations

Initial beta may use:

- manual paste;
- private/form ingestion;
- manual record of a customer update/reply;
- copy/review of prepared outbound text.

Do not fake Gmail, Instagram, SMS, payment or booking integrations.

Live integrations remain later evidence-driven work.

## 6. Public no-account quote/booking links are not required for first beta

R1D may contain them to local/demo mode.

If later evidence proves no-account public capability links are required, build a dedicated server-backed capability-link system.

---

# R2 sequence

> **R2A → review → R2B → review → R2C → review → R2D → review → R2E → review → R2F → final beta-core gate**

Execute only the slice authorised by `docs/CURRENT_PHASE.md`.

---

# R2A — Real workspace bootstrap + onboarding persistence

## Objective

A new signed-in user gets a real empty/configurable tenant, not a silently seeded fixture workspace.

## Required changes

- Remove automatic fixture seeding from the normal signed-in workspace fetch path.
- If the verified user has no business membership, the product should deliberately route/lead them to real onboarding.
- Onboarding completion must create/persist:
  - business;
  - owner membership;
  - actual business name;
  - city/base location;
  - timezone;
  - solo/team shape;
  - initial voice/preferences that the user genuinely selected.
- Do not mark integrations connected merely because a prototype choice was selected.
- Do not copy F01–F20 enquiries/bookings into the live tenant.
- Any "See sample" action should route to/isolate `/demo`, not contaminate the live business.
- Double submit/retry/concurrent first-load must not create duplicate businesses accidentally.
- Preserve the concurrency-safe per-user transaction lock/re-check landed in `118b2a8e2f1d9dcc2d37a322e6134868372cb06b`, and verify it in supported beta database modes.
- Live provisioning must not depend on fixture `BUSINESSES` as the canonical action-policy catalogue; extract/reuse a domain-owned product catalogue.

## Product honesty

Current onboarding contains sample rules/prices and simulated integration choices.

R2A must distinguish clearly between:

- real user configuration;
- demonstration/sample content;
- future integration choices.

Do not present sample pricing/rules as learned facts about the new business.

## Acceptance

- [ ] Brand-new verified user with zero memberships does not receive Glow & Co.
- [ ] Brand-new user reaches deliberate onboarding/empty-workspace flow.
- [ ] Onboarding creates one tenant and membership server-side.
- [ ] Reload retains the actual business profile.
- [ ] Another tenant cannot read/write it.
- [ ] No fixture enquiries/bookings are written to the live tenant.
- [ ] `/demo` still works independently.
- [ ] Typecheck/full tests/build pass.
- [ ] Live database migration/provisioning test covers retry/idempotency.

Then stop.

---

# R2B — Signed-in workspace read cutover + runtime isolation

## Objective

The guarded operator app renders persisted workspace data rather than fixture/session-storage business data.

## Required behaviour

- `/_app` has one deliberate workspace-loading boundary using the authenticated server path.
- Persisted business/enquiry/booking UUIDs render correctly.
- Loading, empty and failure states are explicit.
- Tenant data is refreshed from the server after reload.
- The live operator app does not auto-play the fixture "arriving enquiry" after 4.8 seconds.
- The live operator app does not silently fall back to F01–F20 when workspace data is empty/error.
- `/demo` keeps its fixture behaviour.

## Client state

It is acceptable to keep Zustand as a UI/cache façade to reduce component churn if:

- live authoritative data is hydrated from the server;
- authoritative business/enquiry/booking arrays are not restored from sessionStorage over newer server data;
- transient UI preferences/filters can remain local;
- demo mode and operator mode are impossible to confuse.

A cleaner operator-specific store/provider is also acceptable, but do not rewrite every component merely for naming purity.

## Acceptance

- [ ] Signed-in workspace data comes from authenticated server data.
- [ ] Page reload/cross-tab cannot restore stale fixture tenant data over the server.
- [ ] No fake live arrival in operator mode.
- [ ] Empty live tenant is honestly empty.
- [ ] `/demo` remains public/fixture-isolated.
- [ ] Auth/tenancy boundary preserved.
- [ ] Typecheck/full tests/build pass.
- [ ] Focused runtime-mode tests prove demo vs operator isolation.

Then stop.

---

# R2C — Persist business/trust/Brain mutations

## Objective

Business-defining changes survive reload and are applied through tenancy-checked server mutations.

R2C must also establish the minimum machine-usable Business Brain rule representation required by `docs/R2_DECISION_ENGINE_REVIEW.md`; live deterministic evaluators must not rely on repeatedly regex-parsing arbitrary Knowledge Item prose as authority.

## Minimum persistent scope

### Trust/business
- pause/resume;
- trust mode where exposed;
- per-action policy mode;
- relevant working-hour/follow-up preferences if they affect decisions;
- voice profile changes that affect drafts.

### Business Brain
- confirm/activate a proposed knowledge item;
- resolve a knowledge conflict;
- accept/dismiss a learning suggestion;
- explicit "Teach Enquiry" promotion when a correction is meant to become a business rule.

## Requirements

- Every mutation re-derives tenant access server-side.
- High-impact Brain rules cannot become authoritative silently.
- Audit events are appended server-side.
- Where a Brain rule changes an open enquiry's decision, re-evaluation is deterministic and affected persisted Decision Objects are updated consistently.
- Do not mutate live business state only in client memory then "sync later".
- Avoid generic CRUD for arbitrary Brain JSON; preserve typed product semantics.

## Acceptance

- [ ] Required business/trust changes survive reload.
- [ ] Cross-tenant mutation attempts fail.
- [ ] Audit records exist for meaningful mutations.
- [ ] High-impact confirmation rules remain enforced.
- [ ] Rule change affects only relevant enquiries.
- [ ] Existing sent quote versions remain immutable.
- [ ] Typecheck/full tests/build pass.

Then stop.

---

# R2D — Persist enquiry decision-state mutations

## Objective

The core review-first operator loop survives reload and records why state changed.

## Minimum first-beta scope

- correct/confirm an enquiry fact;
- preserve prior fact/provenance by supersession rather than destructive overwrite;
- re-run relevant deterministic evaluators;
- recompute minimum blocker/recommendation;
- save the new Decision Object/snapshot;
- note;
- snooze;
- mark lost/declined;
- release/record follow-up state;
- record a manual customer update/reply to the same enquiry;
- save draft/quote state only where product semantics require persistence;
- create/maintain booked/lost end state as applicable.

## Requirements

- Client does not submit an already-decided commercial result as authority.
- Server receives the factual/user action, validates it, computes/persists the resulting state.
- Decision-changing mutations are transactional where partial writes would create inconsistent state.
- Audit trail identifies actor/action/object.
- Corrections distinguish:
  - just this enquiry;
  - teach the business.
- Unknown/ambiguous remains valid.

## Acceptance

- [ ] Corrected fact survives reload.
- [ ] Old fact provenance remains recoverable.
- [ ] Decision snapshot and relational facts do not disagree after mutation.
- [ ] Minimum blocker changes only when logically affected.
- [ ] Mark lost/decline/follow-up survive reload.
- [ ] Cross-tenant attempts fail without existence leakage.
- [ ] Full tests/build pass.

Then stop.

---

# R2E — Arbitrary manual enquiry ingestion + interpretation

## Objective

Process a new enquiry that does not exist in fixtures.

This is the phase that separates "real beta" from "interactive demo".

## Initial input scope

Support one deliberately narrow real ingestion path first:

> **manual/private paste of a customer enquiry**

Optional basic fields may include:

- customer/display name;
- source label;
- raw customer message;
- known context supplied by operator.

Do not build Gmail/Instagram/SMS APIs here.

## Interpretation contract

A server-side interpretation step may use an LLM/model to produce structured candidates for:

- intent;
- facts;
- inferences;
- ambiguities;
- missing facts;
- possible service/package mapping;
- applicable evaluator families.

Every extracted item must retain provenance back to the submitted message/operator context.

The model must not directly decide/write:

- final price;
- final eligibility;
- final capacity;
- quote sent state;
- booking;
- action authority.

## Deterministic decision compilation

After interpretation:

1. select applicable evaluators from the structured enquiry + Business Brain;
2. run deterministic rules where available;
3. preserve UNKNOWN when a required rule/integration is unavailable;
4. compute the minimum decision blocker;
5. prepare recommended action + rationale;
6. prepare a grounded draft;
7. persist the Decision Object and raw message/provenance.

## Safety

- Customer content is untrusted input.
- Prompt injection in customer text must not change system/business rules or action authority.
- LLM secrets/server keys stay server-only.
- Model failure returns a safe error/needs-human state, not fabricated output.
- Do not claim live integration if the input was pasted.

## Acceptance

Demonstrate at least 10 non-fixture test cases spanning 3 service phenotypes, including:

- missing fact;
- ambiguous intent;
- pricing not applicable;
- pricing exact where a rule genuinely supports it;
- capacity unknown;
- same wording/different Business Brain result;
- one changed fact changes the decision;
- one missing fact does **not** matter;
- malicious/prompt-injection-like customer text;
- model/provider unavailable.

At least one accepted test must use a completely new wording not present in fixture strings.

- [ ] New pasted enquiry persists.
- [ ] Facts/provenance persist.
- [ ] Relevant evaluators only.
- [ ] Deterministic outputs do not trust model commercial claims.
- [ ] Unknown/failure is safe.
- [ ] Full tests/build pass.

Then stop.

---

# R2F — Review-first manual action loop + beta telemetry

## Objective

Let a real beta business complete the enquiry lifecycle without fake production integrations.

## First-beta workflow

1. enquiry ingested manually/private;
2. Enquiry prepares current decision + draft;
3. owner reviews/corrects;
4. owner may copy/use the prepared response externally;
5. Enquiry records an explicit manual "sent/used" action only when the operator confirms it;
6. later customer reply/update can be pasted/recorded into the same enquiry;
7. decision re-compiles;
8. enquiry reaches booked/lost/handoff.

## Do not fake

- email delivery;
- Instagram send;
- SMS send;
- payment;
- calendar booking.

If those integrations are not genuinely connected, label the action as manual/copy/recorded, not "sent by Enquiry".

## Telemetry required for beta learning

Capture product events/counters sufficient to determine:

- recommendation accepted unchanged;
- substantively edited;
- rejected;
- fact correction;
- evaluator correction if exposed;
- minimum-blocker correction;
- action-authority override;
- booked/lost;
- repeat use.

Do not copy raw customer message bodies into general analytics/marketing tooling.

## Acceptance

- [ ] One new non-fixture enquiry can complete the review-first manual loop.
- [ ] Reload preserves each meaningful transition.
- [ ] Customer update reuses same enquiry.
- [ ] Decision can change without losing history.
- [ ] No false "sent/booked/paid by integration" wording.
- [ ] Correction telemetry is usable for first-five evidence.
- [ ] Typecheck/full tests/build pass.
- [ ] Desktop/phone/reduced-motion QA for the first-beta loop.

Then stop.

---

# Final R2 beta-core gate

After R2A–R2F:

- run full tests/typecheck/build;
- verify tenant isolation against at least two test users;
- verify demo/live isolation;
- verify no fixture IDs/data leak into a normal new tenant;
- verify arbitrary manual enquiry path;
- verify correction → re-evaluation → persistence;
- verify review-first action language;
- verify audit trail;
- verify no fake integrations;
- verify waitlist/public site still works;
- document known unsupported capabilities.

At that point Enquiry may be called a **first-beta candidate**.

It is not evidence of market validation until external businesses actually use it.

---

# Explicit non-goals for R2

Do not add:

- Gmail/Microsoft mailbox OAuth;
- Instagram/Facebook production APIs;
- SMS provider;
- payment processing;
- public capability quote/booking links;
- full calendar/booking integration;
- full CRM;
- project/job management;
- native app;
- complex identity graph;
- multi-user roles beyond what first beta genuinely requires;
- speculative workflow builder.

Those remain evidence-driven later work.
