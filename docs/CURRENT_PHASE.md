# Enquiry - Current Implementation Phase

## Current phase

**R2A - Real workspace bootstrap + persisted onboarding**

Source of truth:

- `AGENTS.project.md`
- `docs/phases/PHASE_R2A_REAL_WORKSPACE_ONBOARDING.md`
- `docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`
- `docs/R2_FOUNDATION_REVIEW.md`
- `docs/TEST_REGRESSION_POLICY.md`
- `docs/BETA_READINESS_GATE.md`

The implementation agent must execute **R2A only**, report, and stop.

Do not begin R2B, R2C, R2D, R2E, R2F, Phase 9B or Phase 10 until product management reviews and signs off R2A.

---

# R2A correction gate after review of `3d0207a502d48e78169bed12f35e4aaf77798418`

## Decision

**R2A is NOT signed off yet.**

The latest correction materially improves the server and onboarding path, but one live/demo isolation defect remains on the actual post-onboarding runtime path.

## Accepted work from `3d0207a...`

Preserve all of the following:

- live onboarding no longer calls prototype `completeOnboarding(...)`;
- direct onboarding ensures the verified `app_user` mirror before membership creation;
- initial workspace creation remains transaction-scoped and concurrency-safe;
- the real SQL creation path now has focused PGLite database tests;
- unsupported email/SMS/Instagram/Facebook options are described as not connected;
- completion copy no longer claims transient voice/source choices are persisted;
- illustrative voice copy no longer asserts availability or other unverified business facts;
- live first-beta currency is truthfully constrained to AUD while the current money domain is AUD-only;
- no fake provider integration is created;
- no fixture enquiry, booking, Brain knowledge or integration record is inserted into the server tenant during workspace creation.

The server/domain direction is accepted and must not be reworked in the next correction.

## Remaining blocker - successful live onboarding still lands on fixture-backed runtime state

`src/routes/onboarding.tsx` now calls `markOnboardedLocally()` after the authenticated server workspace is created, then navigates to `/enquiries`.

That marker is narrower than the old prototype completion action, but the existing prototype store is still initially populated with fixture businesses, enquiries and bookings. `markOnboardedLocally()` only flips local onboarding/demo flags and does not clear or quarantine those fixture arrays.

The live Enquiry workspace still reads `usePrototype(...)` directly. On the normal `/enquiries` path it therefore can render the preloaded fixture enquiries as though they are the newly created tenant's work.

There is a second consequence on the same path: `src/components/enquiry/workspace.tsx` currently schedules `arriveEnquiry()` whenever `onboarded` is true and the arrival has not played. The effect does not require demo mode. After live onboarding, that can inject the hard-coded arriving fixture into a real signed-in session after roughly 4.8 seconds.

This still breaches:

- strict demo/live isolation;
- server-authoritative live tenant truth;
- R2A acceptance that sample records do not leak into a tenant;
- first-beta truthfulness.

It is not acceptable to call the server workspace correct while immediately presenting local fixtures as the operator workspace.

---

# Smallest authorised correction

Claude may correct **only this remaining R2A live/demo transition defect and directly necessary focused tests**.

Required outcome:

1. After successful live onboarding, no fixture business, enquiry, booking, Brain, trust evidence or integration state may be displayed as the newly created tenant's live state.
2. The live post-onboarding transition must not select, mutate, reuse or implicitly rely on fixture `glow` or any other fixture tenant identity.
3. The hard-coded demo arrival mechanism must not fire in a real signed-in tenant/session.
4. Do not implement the wider R2B server-authoritative operator-store hydration in this correction.
5. Until R2B owns real workspace hydration, use the smallest truthful transitional behaviour available. A neutral empty/loading/setup-complete state is acceptable. Displaying fixtures is not.
6. Demo behaviour must continue to work in the explicit demo/sample path.
7. Add focused proof that:
   - successful live onboarding cannot expose existing fixture enquiries/bookings/businesses as live tenant content;
   - `arriveEnquiry()` cannot run on the live post-onboarding path;
   - explicit demo mode still retains its fixture/demo behaviour;
   - server failure remains retryable and cannot mark onboarding complete.
8. Run the focused tests plus typecheck, the full default test command and build under `docs/TEST_REGRESSION_POLICY.md`.

Do not broaden into:

- R2B workspace hydration/read-store cutover;
- R2C Business Brain/trust persistence;
- R2D enquiry mutation cutover;
- R2E arbitrary enquiry interpretation;
- production mailbox/social/SMS/payment/booking integrations;
- visual redesign.

After this correction, report and stop for product-management review.

---

# Test/regression note

Claude reports for `3d0207a...`:

- 317 tests discovered;
- 305 passing;
- the same 12 classified pre-existing failures;
- typecheck clean;
- build clean;
- lint at the existing 10-problem baseline.

GitHub exposes no commit status checks for this commit, so product management has not independently verified those command results through CI. The next handoff must continue to report exact commands and unchanged failure signatures per `docs/TEST_REGRESSION_POLICY.md`.

---

# Completed / reviewed gates

Phases 1-6 and Phase 8 are signed off. Phase 7 remains deferred by design.

R1A, R1C, R1C1 and R1D are signed off. The R1 repository/runtime gate passed.

Historical detail remains in `docs/PHASE_REGISTRY.md` and the R1 gate documents.

---

# Parallel external/public-traffic blockers

These do not idle unrelated R2 engineering once the repository/runtime gate is clean:

- historical preview credential still requires external rotation/revocation before deliberate public traffic;
- Phase 9A still requires final real-browser desktop/phone/reduced-motion visual QA before public traffic;
- public claims must pass `docs/PUBLIC_TRAFFIC_GATE.md` before deliberate market traffic.

Do not mix those corrections into R2A.

---

# Deliberate sequence

> **R2A active -> review -> R2B -> review -> R2C -> review -> R2D -> review -> R2E -> review -> R2F -> first-beta engineering gate -> 9B -> 10A -> 10B**

Out-of-phase code already present on `main` remains ungated existing work and does not change this sequence.

After R2 beta-core is signed off, first external product use is gated by `docs/BETA_READINESS_GATE.md`.

## Current instruction to Claude

Execute only the remaining R2A live/demo transition correction above, run the required checks, give the exact handoff, and stop.