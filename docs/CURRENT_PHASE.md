# Enquiry - Current Implementation Phase

## Current phase

**R2A - Real workspace bootstrap + persisted onboarding**

Source of truth:

- `AGENTS.project.md`
- `docs/phases/PHASE_R2A_REAL_WORKSPACE_ONBOARDING.md`
- `docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`
- `docs/R2_FOUNDATION_REVIEW.md`
- `docs/TEST_REGRESSION_POLICY.md`

The implementation agent must execute **R2A only**, report, and stop.

Do not begin R2B, R2C, R2D, R2E, R2F, Phase 9B or Phase 10 until product management reviews R2A.

---

# R2A correction gate after implementation review

Reviewed implementation commit:

`4fd5f480824001edd5aee8d8c78cdd860ee9e5f4`

The server/domain foundation in that commit is accepted directionally:

- workspace fetch no longer auto-creates a placeholder business;
- zero membership is represented explicitly as `needsOnboarding`;
- initial workspace creation is server-side and concurrency-safe;
- the action-policy catalogue is product/domain-owned rather than fixture-derived;
- initial action authority is conservative;
- no fixture enquiries/bookings/knowledge/integrations are provisioned by the new create path.

**R2A is NOT signed off yet.**

The live onboarding route still uses `usePrototype` as its completion authority. Its `finish()` path still:

- writes voice to fixture business id `glow`;
- marks email/SMS/Instagram/Facebook connected through prototype-store actions without a provider handshake;
- calls the prototype store's local `completeOnboarding(...)` rather than the server `completeOnboarding` operation;
- immediately navigates to `/enquiries` without awaiting persisted workspace creation;
- contains hard-coded city/timezone choices instead of using/confirming the persisted IANA timezone path;
- presents sample pricing/rule review/test content inside the signed-in live onboarding flow in a way that can be mistaken for the new tenant's learned Business Brain.

This fails the R2A acceptance requirements that onboarding completion persist the real user-entered profile, failure not produce optimistic client-only success, unsupported integrations not be marked connected, and sample rules/prices not become live-business truth.

## Smallest authorised correction

Claude may correct **only the live onboarding completion path and its directly necessary live/demo separation**:

1. Make the signed-in onboarding route submit the real user-entered business profile to the authenticated server `completeOnboarding` operation.
2. Await server success before treating onboarding as complete or navigating to the operator workspace.
3. Surface a retryable failure and leave onboarding incomplete if server creation fails.
4. Do not call prototype `connectIntegration` or persist/display any selected channel as `connected` without a real provider handshake. A channel selection may remain a clearly non-connected preference only if it is not represented as integration state.
5. Do not write onboarding voice/profile data against fixture business id `glow` in live mode. Persist only R2A-authorised profile fields; machine-usable Business Brain/voice rule persistence remains R2C unless an existing R2A field is already part of the server create contract.
6. Remove or explicitly isolate the sample pricing/rule/test theatre from the live tenant onboarding path so it cannot be confirmed into, or presented as learned truth for, the new tenant. `/demo` remains the fixture demonstration surface.
7. Use a browser-detected/confirmable IANA timezone path or equivalent general input accepted by the existing server validator. Do not retain an Australia/NZ city map as the live architectural source of truth.
8. Ensure a verified zero-membership user is deliberately led to onboarding without performing the wider R2B server-authoritative operator-store cutover.
9. Add focused tests for the corrected live onboarding submit/success/failure/no-fake-integration behaviour and re-run the R2A repository checks under `docs/TEST_REGRESSION_POLICY.md`.

Do not broaden this correction into R2B operator-store cutover, R2C Business Brain persistence, arbitrary enquiry ingestion, real channel integrations, or visual redesign.

After implementing this correction, report and stop for product-management review.

---

# Completed / reviewed gates

### Phases 1-6
**SIGNED OFF.**

### Phase 8
**SIGNED OFF.**

### Phase 7
**DEFERRED BY DESIGN.**

### R1A
**SIGNED OFF.**

### R1C + R1C1
**SIGNED OFF.**

### R1D
**SIGNED OFF**, including follow-up hook-order correction:

- containment: `c4aed930e5f89f61e772e41ca4255b13eb63e60b`
- hook-order correction: `2cc5e94257c646443ed94a5fd3067b2b77549659`

### R1 repository/runtime stabilisation
**PASSED.**

Verification result:

`docs/phases/R1_FINAL_GATE_RESULT.md`

Implementation-agent evidence reports:

- typecheck pass;
- production build pass;
- build:dev pass;
- dev start/stop pass;
- preview smoke pass;
- 27 test files / 295 tests discovered;
- 283 pass / 12 classified pre-existing platform-harness failures;
- no R1 product regressions against the recorded baseline;
- public short-ID customer routes contained in a running preview;
- tenant/RLS/server-only data boundary smoke passed.

The remaining 12 red tests are tracked baseline/platform debt, not accepted as hidden regressions.

---

# R1 operational/public-traffic items still open

## Old preview credential

**EXTERNAL ROTATION/REVOCATION STILL REQUIRED.**

The old committed broker credential is removed from current code/client output, but only the issuing external broker/environment can revoke the historical value.

This blocks **deliberate public market traffic**, not R2 engineering.

## Phase 9A final browser visual QA

The visual direction remains accepted from source review.

A real browser/human desktop + phone + reduced-motion check is still required before public traffic/final 9A closure.

This does not block R2 engineering.

## Public claim truth

Before deliberate traffic, current homepage wording:

> Building with service businesses.

and:

> We’re building with service businesses...

must be narrowed unless independent external businesses are genuinely participating.

Product-management decision: until then, use truthful **for service businesses** wording.

This is tracked in:

`docs/PUBLIC_TRAFFIC_GATE.md`

Do not mix this small public-traffic correction into R2A.

---

# Ungated R2 foundation already on main

Useful but **not R2A sign-off**:

- `f11c8d4a202b00c9f6b679de61810242c331b9c9` - product-core schema;
- `7cd1ee4c57f18a365447038e11f80f15de4e4535` - RLS lockdown;
- `43a7b287295638fc0cbbf91b88fa86f6be3e521f` - tenancy/repository/workspace boundary;
- `ced20e14fbbb08d4b7fa493c08cb3bdbcc7bd080` - removed live fixture seeding but retained auto-placeholder provisioning;
- `118b2a8e2f1d9dcc2d37a322e6134868372cb06b` - made that placeholder provisioning concurrency-safe.

Product-management review accepts the direction of removing fixture tenant data and the concurrency lock.

**Authoritative clarification for R2A:** older supporting/registry text that says normal provisioning still seeds fixture enquiries/bookings/knowledge/integrations is superseded by the commits above. Claude must not re-solve that historical defect. The remaining bootstrap defect is automatic placeholder business creation on workspace fetch, plus the real persisted onboarding and catalogue/trust requirements below.

R2A still must:

- stop auto-provisioning a business merely because workspace data is fetched;
- make zero-membership a valid onboarding state;
- persist the actual onboarding business profile;
- keep initial creation concurrency-safe;
- move the canonical action-policy catalogue out of demo fixtures;
- avoid fake connected integrations;
- keep `/demo` isolated.

---

# Execute R2A only

Read:

- `AGENTS.project.md`
- `docs/CURRENT_PHASE.md`
- `docs/phases/PHASE_R2A_REAL_WORKSPACE_ONBOARDING.md`
- `docs/R2_FOUNDATION_REVIEW.md`
- `docs/BETA_READINESS_GATE.md`
- `docs/TEST_REGRESSION_POLICY.md`

Then execute the bounded R2A correction gate above.

Important constraints:

- no R2B operator-store cutover yet;
- no arbitrary enquiry AI ingestion yet;
- no Business Brain rule-engine broadening yet;
- no Gmail/Instagram/SMS/payment integrations;
- no fake integration status;
- no demo/sample records in live tenant state.

Run focused tests plus the required repository checks, give the exact handoff, then stop.

---

# Deliberate sequence

> **R2A active -> review -> R2B -> review -> R2C -> review -> R2D -> review -> R2E -> review -> R2F -> first-beta engineering gate -> 9B -> 10A -> 10B**

Parallel public market traffic remains blocked until `docs/PUBLIC_TRAFFIC_GATE.md` passes.

External first-cohort product use waits for `docs/BETA_READINESS_GATE.md`.
