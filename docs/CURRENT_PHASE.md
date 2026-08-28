# Enquiry - Current Implementation Phase

## Current phase

**R1 FINAL - Release stabilisation + Phase 9A runtime gate**

Source of truth:

- `AGENTS.project.md`
- `docs/phases/PHASE_R1_FINAL_STABILISATION_GATE.md`
- `docs/phases/PHASE_R1_RELEASE_BLOCKER_STABILISATION.md`
- `docs/TEST_REGRESSION_POLICY.md`

The implementation agent must execute the **final R1 verification gate only**, report, and stop.

Do not begin R2, Phase 9B or Phase 10 until product management reviews the final gate.

---

# Product gates already signed off

### Phases 1-6
**SIGNED OFF.**

### Phase 8
**SIGNED OFF.**

### Phase 7
**DEFERRED BY DESIGN.** Do not build broader identity matching before beta evidence requires it.

### Phase 9A
**IMPLEMENTATION LANDED; VISUAL DIRECTION ACCEPTED; FINAL RUNTIME SIGN-OFF IS PART OF THIS ACTIVE GATE.**

Implementation commit:

`19843ee61fb7d2508bc0b810e8ead5cd58735ddc`

---

# R1 review state

## R1A - Cross-platform launcher + truthful test discovery

**SIGNED OFF.**

Implementation:

`2f7ab669f0a1679c836941a55d4eaafab7dd9ef5`

The final gate must rerun the then-current complete suite/build/runtime checks rather than relying only on the earlier baseline.

## R1B - Committed preview credential

**CODE REMEDIATION ACCEPTED; EXTERNAL CREDENTIAL ROTATION/REVOCATION STILL REQUIRED.**

Implementation:

`e62c64be034069505623b85d58938578f14984c0`

The old broker auth path and secret are gone from HEAD. Because the credential was committed historically, final R1 cannot be considered operationally closed until it is revoked/rotated at the external broker/environment.

This external action is not replaced by deleting git history or renaming the credential.

## R1C - Operator authentication boundary

**SIGNED OFF after R1C1 correction.**

Core auth implementation:

`e62c64be034069505623b85d58938578f14984c0`

R1C1 correction:

`6af540e9f36261a145354b06f0f587698c47cdb2`

Product-management review confirms:

- one pure same-origin return-path invariant now exists;
- login search handling and Supabase magic-link/OAuth redirect construction use it;
- protocol-relative, backslash authority, absolute/scheme, encoded and malformed forms are rejected/fall back;
- accepted paths are re-serialised from the parsed same-origin URL;
- focused tests cover the named attack forms and assert accepted destinations keep the application origin.

## R1D - Public quote / booking route containment

**SIGNED OFF.**

Implementation:

`c4aed930e5f89f61e772e41ca4255b13eb63e60b`

Product-management review confirms:

- the current short-ID customer pages are explicitly fixture/demo behaviour, not a claimed capability-link security model;
- exposure requires the explicit `VITE_FIXTURE_PUBLIC_LINKS` opt-in **and** an auth-disabled prototype build;
- auth-capable builds fail closed even if the opt-in is set;
- no pseudo-random/client-bundled token workaround was introduced;
- the unavailable state leaks no selected record;
- a real server capability-link system remains deferred unless beta evidence requires it.

### R1D preservation rule for R2

R2 must not later hydrate these public fixture routes from live tenant data.

If the operator client store is changed to cache server data, keep `/q` and `/book` isolated/demo-only or remove them from live builds.

---

# Ungated backend foundation already on main

These commits remain **ungated existing foundation**, not R2 completion:

- `f11c8d4a202b00c9f6b679de61810242c331b9c9` - product-core schema;
- `7cd1ee4c57f18a365447038e11f80f15de4e4535` - RLS lockdown;
- `43a7b287295638fc0cbbf91b88fa86f6be3e521f` - tenancy/repository/workspace server boundary;
- `ced20e14fbbb08d4b7fa493c08cb3bdbcc7bd080` - removed live fixture seeding, but retained auto-placeholder provisioning;
- `118b2a8e2f1d9dcc2d37a322e6134868372cb06b` - made that placeholder provisioning concurrency-safe.

These provisioning commits are **not R2A sign-off**. R2A still requires deliberate persisted onboarding, no auto-provision-on-read, and a product-owned action-policy catalogue rather than fixture-derived definitions.

The detailed product-management review of what still separates this foundation from a real beta is:

`docs/R2_FOUNDATION_REVIEW.md`

The bounded cutover plan is:

`docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`

No R2 slice is authorised yet.

---

# Execute final R1 gate only

Read:

- `AGENTS.project.md`
- `docs/CURRENT_PHASE.md`
- `docs/phases/PHASE_R1_FINAL_STABILISATION_GATE.md`
- `docs/TEST_REGRESSION_POLICY.md`

Run the complete verification required there, including:

- typecheck;
- full test discovery with exact counts/classification;
- build/build:dev;
- dev + preview smoke;
- lint report without unrelated cleanup;
- auth-state matrix;
- return-path abuse cases;
- public customer-route containment;
- tenancy/RLS smoke;
- desktop/phone/reduced-motion Phase 9A QA;
- public claim/truth check.

Report external broker credential rotation as:

- confirmed; or
- still pending.

Do not pretend the code can prove the external credential was revoked.

Then stop.

---

# Deliberate sequence after this gate

If the repository/runtime gate passes:

> **final 9A runtime sign-off -> R2A -> R2B -> R2C -> R2D -> R2E -> R2F -> first-beta core gate -> 9B -> 10A -> 10B**

If the old external broker credential is still awaiting rotation, R2 engineering may proceed, but **deliberate public market traffic stays blocked** until rotation/revocation is confirmed.

Once the full R1 public-safety gate is operationally closed, audience/waitlist traffic may begin in parallel with R2.

External first-cohort product use waits for the R2 beta-core gate.
