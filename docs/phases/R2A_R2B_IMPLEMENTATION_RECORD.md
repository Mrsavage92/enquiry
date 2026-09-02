# R2A correction + R2B implementation record

**Written by the implementation agent. For Codex review. Not a sign-off.**

## Sequencing note, stated plainly

R2B was implemented while `docs/CURRENT_PHASE.md` still had R2A active and
unsigned. That was the founder's explicit instruction to continue, not an
implementation agent deciding its own gate. Both slices are offered for review
together; neither is self-certified.

---

## R2A correction - live/demo isolation (`b2b59a6`)

Codex's critique named three leaks on the normal post-onboarding path. All three
were real in source and all three are closed.

| Leak | Was | Now |
| --- | --- | --- |
| Demo arrival | Fired on `onboarded` alone | Gated on `demoMode` via a tested domain rule |
| Fixture content | Seeded arrays left in the store | Cleared on live handoff; empty is the honest value |
| Fixture identity | Four components hardcoded `"glow"` | Resolve from the tenant's own businesses |

The account menu and more-sheet had additionally filtered live businesses *down
to* `glow`, so a real uuid workspace vanished from its own selector.

**Proof:** `live-demo-isolation.test.ts` exhausts the arrival gate - no
combination of `onboarded`/`arrivalPlayed`/`framed` lets a live session play it.
`live-handoff.test.ts` mirrors the store's committed patch and first asserts the
seeded boot state **would** leak, so the passing assertion is not vacuous.

---

## R2B - server-authoritative runtime (`954947c`)

Read cutover only. Mutations remain R2C/R2D.

**s1 One boundary.** `WorkspaceBoundary` wraps the guarded app: waits for
verified auth, reads `fetchWorkspace` once, routes a new account to onboarding,
otherwise hydrates. Explicit loading/error/empty states. **No fixture fallback
on failure** - error offers retry and preserves the session.

**s2 Store as cache.** `hydrateFromServer` replaces rather than merges, so a
row deleted server-side cannot linger. `partialize` writes tenant content to
device storage only in demo mode. The prototype persisted a complete snapshot of
businesses/enquiries/bookings/audit, which meant a stale tab could restore
yesterday's data as current, and it could survive a sign-out into whoever used
the browser next. Storage key bumped to `enquiry-proto-v10`.

**s3 Fixture assumptions removed.** `resolveBusiness` replaces the
`BUSINESS_BY_ID` fallback across queue, conversation, intelligence, jump,
job-sheet and teach-dialog. Live resolves only from the authenticated workspace.

**s4 Demo theatre removed.** `Reset prototype` and `Fixture lab` are demo-only.
`Open sample jobs` called `enterSample()`, which overwrites live arrays; a live
operator now goes to the isolated `/demo`.

**s10** R1D containment untouched - `/q` and `/book` remain fixture-gated.

---

## Not done in R2B, deliberately

- **s7 audit history.** `loadWorkspace()` still returns no audit rows, so Trust
  Audit has no real data in live mode. Flagged rather than faked.
- **s5 uuid routing** is structurally correct (ids are opaque strings
  throughout) but has not been exercised against real persisted uuids, because
  no database is attached to the deployment.
- **s9 cross-tab authority** is implemented via the partialize change but
  likewise unexercised.

---

## The honest limit on all of it

`DATABASE_URL` is **not set** on the deployment. The app therefore falls back to
PGLite, which on serverless is per-invocation and in-memory.

So the R2B boundary is built, typechecked, tested and deployed - but it has
never once read a real persisted tenant. Every database claim in this record
was verified by issuing SQL directly to Supabase, not by the application
connecting to it. That gap closes the moment the pooler connection string is
set, and not before.

## Verification

340 tests, 328 pass, the same 12 classified pre-existing platform failures,
zero new regressions against baseline with timings stripped. Typecheck clean,
production build clean, lint at the 10-problem baseline. All nine public routes
200 on the live deployment; R1D containment confirmed live.
