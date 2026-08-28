# Enquiry - Current Implementation Phase

## Current phase

**R1C1 - Same-origin auth return-path correction**

This is a narrow correction gate discovered during product-management review of the already-landed R1C authentication work.

Source of truth:

- `AGENTS.project.md`
- `docs/phases/PHASE_R1C1_SAFE_AUTH_RETURN_PATH.md`
- `docs/phases/PHASE_R1_RELEASE_BLOCKER_STABILISATION.md`
- `docs/TEST_REGRESSION_POLICY.md`

The implementation agent must execute **R1C1 only**, report, and stop.

Do **not** begin R1D, R2, Phase 9B or Phase 10 until product management reviews the actual R1C1 diff.

---

# Product gates already signed off

### Phases 1-6
**SIGNED OFF.** Positioning, signature decision-continuity proof, non-universal commercial UX, public roadmap, Early Access/Updates and roadmap research persistence are complete.

### Phase 8
**SIGNED OFF.** The pre-beta coherence pass established the public/product story: Enquiry is a decision layer, not a quote engine/shared inbox; pricing applies only where relevant; continuity is one enquiry; the endgame remains first interest to booked/lost.

### Phase 7
**DEFERRED BY DESIGN.** Do not build broader identity matching before beta evidence requires it.

### Phase 9A
**IMPLEMENTATION LANDED; VISUAL DIRECTION ACCEPTED; FINAL RUNTIME SIGN-OFF HELD BY R1.**

Implementation commit:

`19843ee61fb7d2508bc0b810e8ead5cd58735ddc`

The paper/ink identity, homepage hierarchy and Ridge proof direction are accepted. Final sign-off waits for the R1 final runtime/security gate.

---

# R1 review state

## R1A - Cross-platform launcher + truthful test discovery

**SIGNED OFF BY PRODUCT MANAGEMENT.**

Implementation:

`2f7ab669f0a1679c836941a55d4eaafab7dd9ef5`

Source review confirms:

- Vite package binaries are resolved to JavaScript entry points and invoked through `process.execPath`, avoiding Windows `.cmd` shim spawning;
- command arguments remain shell-free and explicit;
- `.grok/app-env.json` merge semantics and child signal/exit handling are preserved;
- `npm test` now uses Node-side discovery rather than a shell glob/hard-coded two-file TypeScript list;
- the implementation reported 24 test files executing and exposed pre-existing platform/PWA failures instead of hiding them.

The final R1 gate must still rerun the current complete suite/build/runtime checks on the then-current tree.

## R1B - Committed preview credential

**CODE REMEDIATION ACCEPTED; EXTERNAL CREDENTIAL ROTATION/REVOCATION STILL REQUIRED.**

Implementation:

`e62c64be034069505623b85d58938578f14984c0`

The old Better Auth/Grok-broker preview path and committed reusable secret were removed from HEAD by moving Enquiry to Supabase Auth.

That is not complete containment because the credential remains in Git history. It must be revoked/rotated at the external broker/environment that issued it.

Do not put the old value back into source, documentation, client configuration or a `VITE_` variable.

The final R1 gate cannot close until rotation/revocation is confirmed externally.

## R1C - Operator authentication boundary

**IMPLEMENTATION LANDED; DIRECTION ACCEPTED; CORRECTION REQUIRED BEFORE SIGN-OFF.**

Implementation:

`e62c64be034069505623b85d58938578f14984c0`

Accepted direction:

- Supabase Auth replaces the previous auth stack;
- `/_app` is guarded at the parent layout;
- `/onboarding` is also guarded;
- pending / signed-out / signed-in states are distinguished;
- `/login` exists;
- server functions verify the Supabase bearer token rather than trusting a client user id;
- auth-off + real database fails closed rather than sharing a dev identity.

### R1C1 correction

Review found that `src/routes/login.tsx` treats any string beginning with `/` as a same-origin redirect, while the auth client later passes that value through `new URL(..., window.location.origin)`.

Protocol-relative/backslash authority forms can therefore escape the intended origin.

The correction is fully specified in:

`docs/phases/PHASE_R1C1_SAFE_AUTH_RETURN_PATH.md`

**R1C1 is the only authorised implementation work now.**

## R1D - Public quote / booking link containment

**PREPARED; NOT AUTHORISED YET.**

The current no-account routes still use fixture/internal IDs and prototype-store state:

- `/q/$enquiryId`
- `/book/$bookingId`

R1D must keep that mechanism local/demo-only in production-capable builds.

Do not create fake security by replacing `f01` / `b1` with another client-bundled UUID/string.

A real server-backed capability-link system is a later evidence-driven phase only if beta requires public no-account quote/booking links.

---

# Ungated backend foundation already on main

The following work landed ahead of management sequencing and is recorded as **ungated existing foundation**, not as a completed product phase:

- `f11c8d4a202b00c9f6b679de61810242c331b9c9` - product-core Postgres schema;
- `7cd1ee4c57f18a365447038e11f80f15de4e4535` - RLS lockdown;
- `43a7b287295638fc0cbbf91b88fa86f6be3e521f` - tenancy/repository/workspace server boundary and provisioning.

Product-management review found two important facts:

1. the signed-in operator UI still uses `src/store/prototype-store.ts` heavily and does not yet use `fetchWorkspace` as its authoritative runtime state;
2. normal first-user provisioning currently seeds a real database workspace from demo fixtures, while arbitrary new enquiries are still driven by fixture-specific interpretation/re-evaluation logic.

Therefore this foundation is useful, but **Enquiry is not yet a real persisted first-beta product**.

The bounded cutover plan is prepared in:

`docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`

No R2 slice is authorised until R1 is closed.

---

# Deliberate sequence from here

> **R1C1 active -> review -> R1D -> final R1 gate + credential-rotation confirmation -> final 9A sign-off -> R2A -> R2B -> R2C -> R2D -> R2E -> R2F -> first-beta core gate -> 9B -> 10A -> review -> 10B**

### Parallel market work

Once the R1 public-safety gate is complete and the public waitlist/demo funnel is safe, audience/waitlist validation may begin **while R2 is being built**.

Actual first-cohort product use waits for the R2 beta-core gate.

Phase 10 installability is not a prerequisite for the first five if the web product is otherwise safe, persisted and usable on mobile.

---

# Execute R1C1 only

Read:

- `AGENTS.project.md`
- `docs/CURRENT_PHASE.md`
- `docs/phases/PHASE_R1C1_SAFE_AUTH_RETURN_PATH.md`
- `docs/TEST_REGRESSION_POLICY.md`

Then:

1. implement the one tested same-origin auth return-path invariant;
2. use it in login search handling and auth redirect construction;
3. run typecheck, the full default test suite and production build;
4. report the exact result and baseline failures;
5. stop.

Do not begin anything else.
