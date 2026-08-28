# R1 - Implementation status

**Written by the implementation agent, 2026-08-27. For product-management review.**

This file exists because implementation diverged from the R1 sequence and the
phase docs no longer described the repository. It records what actually landed
so the gate can be re-established from a true position rather than a stale one.

---

## Process divergence - read this first

The plan is `R1A -> review -> R1B -> review -> R1C -> review -> R1D -> final gate`.

What happened: **R1A was executed under its brief and handed off correctly.**
Before product management reviewed it, the founder redirected work to backend
implementation (Supabase + Vercel). That work subsumed R1B and R1C as a side
effect rather than executing their briefs, and continued for several commits
while `docs/CURRENT_PHASE.md` still named R1A as active.

The divergence should have been flagged at the point of redirection. It was not.
Nothing below is presented as having passed a gate - only as having landed.

---

## Slice status

| Slice | State | Executed under its brief? |
| --- | --- | --- |
| R1A | Complete | Yes |
| R1B | Code complete, **operationally open** | No - subsumed by the auth swap |
| R1C | Code complete | No - subsumed by the auth swap |
| R1D | Complete | Yes |
| Final R1 gate | **Not run** | - |
| Phase 9A sign-off | Still held | - |

---

## R1A - cross-platform toolchain + truthful test command

Commit `2f7ab66`. Handed off under its brief.

## R1B - preview credential hygiene

Commit `e62c64b`. `src/lib/auth/preview.ts` and its literal OAuth client secret
are deleted, along with the entire Grok broker path that required it. Supabase
Auth needs no secret in repository source. No secret was moved to client-visible
configuration.

> **CODE FIXED - CREDENTIAL ROTATION STILL REQUIRED.**
>
> The value was committed, so it lives in git history. Removing it from HEAD is
> not containment. R1B remains operationally open until the credential is
> revoked at the broker and product management confirms it.

## R1C - operator app authentication boundary

Commit `e62c64b`.

- `RequireAuth` guards the `/_app` layout route, so every operator surface under
  it inherits the gate and a new route cannot be added unprotected by omission.
- `/onboarding` is guarded separately, since it configures workspace state.
- Three states are distinguished: resolving renders nothing, signed out
  redirects, signed in renders. No redirect fires during the pending state, so
  there is no reload flicker.
- `/login` now exists. `gates.tsx` had referenced it since before it was written.
- Auth-disabled prototype mode still works: `useCurrentUserState` returns
  `DEV_USER` and never pends.
- Marketing pages, `/demo`, `/roadmap`, `/updates`, `/early-access` remain public.
- Server-side authorization was not weakened. `authMiddleware` verifies every
  server function call and `requireUserId` still fails closed when auth is off
  against a real database - that branch is now a pure `resolveAccessMode()` with
  exhaustive tests.

## R1D - public quote / booking link containment

`/q/$enquiryId` and `/book/$bookingId` resolved a named customer's quote figure
and booking terms from a short internal id (`f01`, `b1`) shipped in the client
bundle, with no account required.

Contained per the brief - exposure disabled rather than dressed up:

- `fixtureLinksAllowed()` requires BOTH an explicit `VITE_FIXTURE_PUBLIC_LINKS`
  opt-in AND a build that cannot authenticate anyone. Two conditions, so an
  opt-in set by accident on a real deployment still fails closed.
- Both routes fail closed to an "unavailable" screen that leaks no record.
- No client-bundled string is presented as a capability token, and no security
  claim is made in the copy.
- Gate logic is exhaustively tested: exactly one of four input combinations
  opens the link.

A real capability-link system (high-entropy server-minted token, stored hashed,
expirable, revocable, validated on every read) is explicitly **not** built and
remains a future phase if beta evidence justifies it.

---

## Out-of-plan work also on main

Not part of R1. Recorded for accuracy, not offered as gated.

- `f11c8d4` product schema, 18 tables, cohabiting with another product in the
  same Supabase project. Purely additive; the co-resident product's rows were
  counted before and after and are unchanged.
- `7cd1ee4` RLS enabled with no policies on all 18 tables. That project's anon
  key ships in another product's public bundle, so without this it could read
  every Enquiry row.
- `43a7b28` tenancy-scoped data layer and the operator server boundary.
  Membership is resolved from the verified user id; cross-tenant isolation was
  verified against the live database with a second tenant inserted.
- `0682b63`, `8e0b2d4` competitive teardown research doc.

---

## What product management needs to decide

1. Whether R1B/R1C are accepted despite not being executed under their briefs,
   or need re-review against the acceptance criteria.
2. Confirmation of the broker credential rotation, which is the only thing that
   actually closes R1B.
3. Whether the final R1 stabilisation gate runs now, given the backend work
   landed between the slices and changed the runtime it was meant to verify.
4. Whether `docs/CURRENT_PHASE.md` moves to the final gate or back to a review
   of the slices above.

## Known baseline

Typecheck clean. Production build clean. 285 tests, 12 failing - the same 12
that failed at `7cd1ee4`, all in the Grok platform PWA and `.grok/app-env`
harnesses, which depend on a gitignored directory and the sandbox host. Zero
regressions were introduced by any slice above; failing-test sets were diffed
against baseline with timings stripped rather than eyeballed.
