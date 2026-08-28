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

## Remaining blockers

**R2A is NOT signed off yet.**

The first correction fixed the main server submission path, but source review found five remaining R2A truth/safety issues.

### 1. Successful live onboarding still mutates fixture `glow`

After the authenticated server `completeOnboarding(...)` succeeds, `src/routes/onboarding.tsx` still calls the prototype store's `completeOnboarding(...)`.

That prototype action:

- sets `businessFilter: "glow"`;
- rewrites the fixture `glow` business with the real operator's submitted profile;
- mutates prototype business/tenant state;
- leaves the successful live transition coupled to demo identity.

The server workspace may be correct in Postgres, but the browser immediately re-enters fixture-shaped tenant state.

### 2. Direct onboarding can miss the `app_user` foreign-key prerequisite

`fetchWorkspace` mirrors the verified Supabase identity into `app_user`.

`completeOnboarding` currently does not.

A signed-in user can legitimately reach `/onboarding` directly without first completing a workspace GET. In that path, `createInitialWorkspace` can attempt to insert `business_member.user_id` before the corresponding `app_user` row exists.

The onboarding creation path must therefore be self-contained and ensure/upsert the verified app-user mirror before it creates membership.

Do not depend on a previous page/request having run.

### 3. Live onboarding still describes unsupported channel ingestion/sending as working capability

Current source/arrival copy includes language such as:

- "Use my website" / "Upload a price list";
- Email: "Read first. Send stays off.";
- Texts: "Reply on the same number.";
- Instagram: "DMs become jobs.";
- Facebook: "Page DMs become jobs."

The code no longer marks those integrations connected, which is good.

But the live onboarding language still tells the operator that unsupported ingestion/send paths work today.

R2A may keep these only as clearly labelled **preferences/research choices about how enquiries reach the business today / what they want to connect later**, or remove unsupported choices from the live path.

Do not imply production ingestion/send before a provider integration actually exists.

### 4. Completion screen claims non-persisted voice/source state is "on file"

The completion screen says:

- "How it sounds is on file";
- "How work arrives is chosen".

Voice is deliberately not persisted in R2A and the arrival/source selection is currently transient.

That wording is false.

The voice preview also uses illustrative lines that can imply unverified business facts such as availability ("yes, we can cover ... that weekend").

Keep any preview explicitly illustrative and fact-neutral. Do not pull R2C voice/Brain persistence forward merely to preserve this copy.

### 5. Onboarding accepts currencies that the live domain still defines as AUD-only

The server profile validator currently accepts any three-letter currency code.

But the current domain types still define:

- `Money.currency: "AUD"`;
- `MoneyRange.currency: "AUD"`;
- `Business.currency: "AUD"`.

The database can remain currency-capable, but R2A must not present arbitrary multi-currency support before the live domain/evaluators can represent it correctly.

For the Australia-first first beta, the smallest truthful option is to persist/use AUD only in live onboarding and leave global money-domain work for a deliberate later change.

Do not silently cast EUR/GBP/etc. into an AUD-only domain.

## Smallest authorised correction

Claude may correct **only these remaining R2A issues and directly necessary focused tests**:

1. After server `completeOnboarding` succeeds, do not call any prototype action that mutates/selects fixture `glow`, fixture businesses, fixture enquiries/bookings, Brain, trust or integration state.
2. Use the smallest transient client-only completion/navigation marker required until R2B. It may carry onboarding UI state but no authoritative tenant content. If the operator app cannot yet render real server state safely, a truthful neutral success/loading transition is preferable to displaying fixtures.
3. Make the server onboarding path self-contained by ensuring the verified `app_user` mirror row exists before business membership creation. Add a direct-onboarding case with no prior `fetchWorkspace`.
4. Rewrite/remove channel/source copy so unsupported paths are clearly non-connected preferences/future interests. No "reply on the same number", "DMs become jobs", inbox reading, or equivalent current-capability implication.
5. Remove false "on file/chosen" statements. Keep voice preview explicitly illustrative and fact-neutral; do not implement R2C voice/Brain persistence here.
6. Keep live first-beta currency truthfully AUD-only until the domain/evaluators are deliberately made multi-currency. Database columns may remain currency-capable.
7. Add focused tests proving:
   - successful live onboarding never writes/selects `glow` or imports fixture state;
   - direct onboarding works without a prior workspace fetch;
   - no integration is marked connected and unsupported channel copy does not present it as live;
   - only the supported first-beta currency is persisted;
   - server failure remains retryable and does not mark onboarding complete.
8. Execute an actual database-path test for initial workspace creation/idempotency in the supported beta DB mode(s), including the advisory-lock/re-check path. Pure profile-validator tests alone are not sufficient evidence for the transaction gate.
9. Run typecheck, full default tests and build under `docs/TEST_REGRESSION_POLICY.md`.

Do not broaden into R2B workspace hydration, R2C Business Brain/voice persistence, arbitrary enquiry ingestion, provider integration work or visual redesign.

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
