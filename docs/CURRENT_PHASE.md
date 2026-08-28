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

Do not begin R2B, R2C, R2D, R2E, R2F, Phase 9B or Phase 10 until product management reviews and signs off R2A.

---

# R2A final correction gate after implementation review

Reviewed implementation commits:

- `4fd5f480824001edd5aee8d8c78cdd860ee9e5f4` - accepted server/domain onboarding foundation;
- `8f972914a5df1bac6f964aac657ca987a120f9a3` - live onboarding UI correction reviewed against the actual code.

## Accepted R2A work

The current implementation now correctly provides the main R2A foundation:

- workspace fetch no longer auto-creates a placeholder business;
- zero membership is represented deliberately as `needsOnboarding`;
- initial workspace creation is server-side and concurrency-safe;
- onboarding submits the real entered business profile to the authenticated server operation;
- the route awaits server success and surfaces a retryable error on failure;
- no onboarding channel selection is written as a connected integration;
- the Australia/NZ hard-coded city/timezone map is gone in favour of a confirmable IANA timezone path;
- confirmable fixture pricing/rule/test theatre was removed from the signed-in live onboarding path;
- the canonical action-policy catalogue is product/domain-owned rather than fixture-derived;
- new action authority starts conservatively;
- no fixture enquiries, bookings, knowledge or integrations are created by real workspace creation.

This direction is accepted and must be preserved.

## Remaining blocker

**R2A is NOT signed off yet.**

After the authenticated server `completeOnboarding(...)` call succeeds, `src/routes/onboarding.tsx` still calls the prototype store's `completeOnboarding(...)` action.

That prototype action is not a harmless UI flag. It:

- sets `businessFilter` to fixture id `glow`;
- rewrites the fixture `glow` business object with the real operator's submitted name/location/timezone;
- leaves the signed-in live transition dependent on fixture-backed prototype state;
- makes a real persisted tenant and the demo fixture world appear to be the same client-side business identity until R2B replaces the operator runtime.

This violates the live/demo isolation contract and the rule that server-authoritative tenant state must not be represented by mutated fixture state.

The persisted server creation itself is accepted. The remaining defect is the **post-success live transition**, not the server create contract.

## Smallest authorised correction

Claude may correct **only the post-success onboarding transition and directly necessary focused tests**:

1. On successful authenticated workspace creation, do **not** call the fixture-mutating prototype `completeOnboarding(...)` action.
2. Do not rename, repurpose or select fixture business id `glow` as the newly-created live tenant.
3. Do not create or copy any client-side business, enquiry, booking, Brain, trust or integration state merely to make the operator workspace look populated before R2B.
4. A transient client-only onboarding/navigation marker is allowed if required for routing, but it must carry no authoritative tenant content and must not mutate fixture arrays or fixture identities.
5. If the existing operator route cannot yet be entered without presenting prototype/fixture tenant state, keep the post-create user on a truthful neutral success/loading transition rather than pretending the fixture workspace is their live workspace. The actual signed-in operator read cutover remains R2B.
6. Existing prototype-only onboarding step/source UI state may remain as transient presentation state where it does not become tenant truth.
7. Preserve the already-correct server submit, await-success, retryable failure, IANA timezone, no-fake-integration and no-sample-Brain behaviour from `8f972914...`.
8. Add/update focused tests proving a successful **live** onboarding completion cannot mutate/select `glow`, import fixture tenant data, or mark a fake integration connected; failure must still leave onboarding incomplete.
9. Run the required R2A checks under `docs/TEST_REGRESSION_POLICY.md` and report exact results/baseline classification.

Do not broaden this into the R2B server-authoritative operator-store cutover, R2C Business Brain persistence, arbitrary enquiry ingestion, real channel integrations, or visual redesign.

After this correction, report and stop for product-management review.

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

The recorded repository/runtime baseline includes passing typecheck/build/runtime checks and 12 classified pre-existing platform-harness failures. New R2 work must not hide regressions behind that baseline.

---

# R1 operational/public-traffic items still open

## Old preview credential

**EXTERNAL ROTATION/REVOCATION STILL REQUIRED.**

The historical broker credential must still be revoked/rotated by the external issuing environment.

This blocks deliberate public market traffic, not unrelated R2 engineering once repository/runtime safety is clean.

## Phase 9A final browser visual QA

A real browser/human desktop + phone + reduced-motion check is still required before public traffic/final 9A closure.

This does not block R2 engineering.

## Public claim truth

Before deliberate traffic, public claims must satisfy `docs/PUBLIC_TRAFFIC_GATE.md` and the detailed public-claim review linked there.

Do not mix those corrections into R2A.

---

# Ungated R2 foundation already on main

Useful but not equivalent to R2 phase sign-off:

- `f11c8d4a202b00c9f6b679de61810242c331b9c9` - product-core schema;
- `7cd1ee4c57f18a365447038e11f80f15de4e4535` - RLS lockdown;
- `43a7b287295638fc0cbbf91b88fa86f6be3e521f` - tenancy/repository/workspace boundary;
- `ced20e14fbbb08d4b7fa493c08cb3bdbcc7bd080` - removed live fixture seeding but retained placeholder provisioning;
- `118b2a8e2f1d9dcc2d37a322e6134868372cb06b` - concurrency-safe initial creation foundation;
- `4fd5f480824001edd5aee8d8c78cdd860ee9e5f4` - explicit onboarding creation, zero-membership state and product-owned action catalogue;
- `8f972914a5df1bac6f964aac657ca987a120f9a3` - corrected server-backed live onboarding submit/failure/integration/timezone/sample-theatre behaviour, with the final post-success prototype-state defect held above.

Out-of-phase code or prepared later-phase documents already on `main` remain ungated existing work. They do not alter sequencing or imply sign-off.

---

# Execute R2A correction only

Read:

- `AGENTS.project.md`
- `docs/CURRENT_PHASE.md`
- `docs/phases/PHASE_R2A_REAL_WORKSPACE_ONBOARDING.md`
- `docs/R2_FOUNDATION_REVIEW.md`
- `docs/BETA_READINESS_GATE.md`
- `docs/TEST_REGRESSION_POLICY.md`

Then execute only the final correction gate above.

Important constraints:

- no R2B operator-store cutover yet;
- no arbitrary enquiry AI ingestion yet;
- no Business Brain rule-engine broadening yet;
- no Gmail/Instagram/SMS/payment integrations;
- no fake integration status;
- no demo/sample records or fixture identities presented as live tenant state.

Run focused tests plus the required repository checks, give the exact handoff, then stop.

---

# Deliberate sequence

> **R2A active -> review -> R2B -> review -> R2C -> review -> R2D -> review -> R2E -> review -> R2F -> first-beta engineering gate -> 9B -> 10A -> 10B**

Parallel public market traffic remains blocked until `docs/PUBLIC_TRAFFIC_GATE.md` passes.

External first-cohort product use waits for `docs/BETA_READINESS_GATE.md` after the R2 beta-core sequence is signed off.
