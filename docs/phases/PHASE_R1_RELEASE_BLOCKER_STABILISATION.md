# R1 — Release-Blocker Stabilisation Before Phase 9B

**Status:** ACTIVE MANAGEMENT PLAN

**Execution authority:** `docs/CURRENT_PHASE.md`.

This plan was inserted after the Phase 9A implementation landed and an independent repository review exposed pre-existing build, security-boundary and test-execution problems.

These are not reasons to reopen Enquiry's product thesis. They are release-engineering gates.

**Phase 9B and Phase 10 are paused until the relevant R1 gates pass.**

---

## 1. Verified repo findings

Product management re-checked the actual repository rather than relying only on the review summary.

### R1 finding A — Windows dev/build launcher is broken

Current scripts call:

```text
node scripts/with-app-env.mjs vite ...
```

`scripts/with-app-env.mjs` uses Node `spawn(command, args, { shell: false })`.

On Windows, npm package binaries are exposed through `.cmd` shims, so spawning the bare command `vite` this way can fail with:

```text
spawn vite ENOENT
```

This blocks local `npm run dev` and `npm run build` on the Windows environment used for this project.

This is release-blocking because it prevents a reliable local build/QA loop.

### R1 finding B — the default test command does not execute the full TypeScript suite

The repository currently contains:

- 7 `*.test.mjs` files;
- 16 `*.test.ts` / `*.test.tsx` files.

Current `npm test` runs the script tests, but hard-codes only:

- `src/lib/app-data/app-data.test.ts`;
- `src/lib/auth/gate-identity.test.ts`.

The remaining TypeScript test files are not part of the default test command.

A green `npm test` therefore does not currently mean the product suite is green.

### R1 finding C — a preview OAuth client secret is committed in source

`src/lib/auth/preview.ts` contains a literal `PREVIEW_CLIENT_SECRET`.

Even though the file is intended to be server-only and the credential is described as preview-only / low-privilege, a reusable client secret must not live in repository source.

Removing the literal from HEAD is not sufficient by itself: because the value has already been committed, the credential must be rotated/revoked at the broker/environment side before this issue can be considered closed.

### R1 finding D — operator app routes have no signed-in route gate

`src/routes/_app.tsx` currently renders `AppShell` directly.

`AppShell` itself does not gate on `useCurrentUserState()`.

Therefore operator routes under `/_app`, including enquiries, bookings, insights, business, settings, trust and lab, do not currently require a resolved signed-in user at the route boundary when auth is enabled.

The repo already contains the required auth primitives:

- `useCurrentUserState()`;
- `RedirectToSignIn`;
- `signIn()`;
- `GROK_PROVIDERS`;
- disabled-auth `DEV_USER` fallback.

The correction should use those primitives rather than inventing a second auth system.

### R1 finding E — public quote / booking routes expose short internal IDs

The public no-account routes:

- `/q/$enquiryId`;
- `/book/$bookingId`;

resolve directly from internal prototype IDs such as `f01` / `b1`.

That is acceptable only as an explicitly local/demo fixture mechanism. It is not an acceptable production public-link security model.

Do **not** "fix" this by merely renaming the route parameter or replacing the short ID with another value that is still shipped in the client bundle.

For the current prototype, production exposure should be disabled unless/until a real server-validated opaque capability-link model is deliberately built.

---

# 2. Execution model

R1 is deliberately split.

The implementation agent must execute **only the slice named in `docs/CURRENT_PHASE.md`**, report, and stop.

Sequence:

> **R1A → review → R1B → review → R1C → review → R1D → review → final stabilisation gate → resume Phase 9**

Do not batch all security/build work into one large refactor.

---

# R1A — Cross-platform toolchain + truthful default test command

## Objective

Restore a reliable Windows/POSIX dev/build loop and make `npm test` mean what it appears to mean.

This is the active slice first because every later security change needs a trustworthy verification loop.

## Required behaviour

### A. Cross-platform Vite launching

Fix `scripts/with-app-env.mjs` / package scripts so:

- `npm run dev` launches Vite on Windows;
- `npm run build` launches Vite on Windows;
- `npm run build:dev` works;
- `npm run preview` works;
- POSIX behaviour remains correct;
- `.grok/app-env.json` merge semantics remain unchanged;
- explicit `process.env` values still win;
- signal / child exit propagation remains correct;
- do **not** solve this with `shell: true` plus string concatenation.

Preferred implementation characteristics:

- invoke a resolved JavaScript CLI with `process.execPath`, or another shell-free cross-platform mechanism;
- keep command/argument boundaries explicit;
- preserve the current qemu/signal exit-status handling.

Do not refactor unrelated Vite/PWA/auth configuration.

### B. Full test discovery

Replace the hard-coded two-TypeScript-test list with a cross-platform test entrypoint that executes all repository test files intended for the default suite.

Requirements:

- all 7 current `*.test.mjs` files execute;
- all 16 current TypeScript test files execute;
- future matching test files should be picked up automatically;
- no dependence on shell glob expansion;
- no platform-specific quoting assumptions;
- TypeScript tests continue using Node's strip-types mode unless a deliberate test-runner change is justified;
- do not introduce Jest/Vitest merely to solve discovery.

A small Node test-discovery/runner script is acceptable.

## Tests required

Add focused regression tests for the launcher/test-discovery logic where practical.

At minimum prove:

- command resolution does not rely on a Windows `.cmd` shim being spawnable as a bare executable;
- app-env merge behaviour is unchanged;
- existing exit/signal helper tests stay green;
- test discovery includes representative files across `src/domain`, `src/lib` and `scripts`.

## R1A acceptance

- [ ] `npm run typecheck` passes.
- [ ] `npm test` executes the complete intended suite, not a two-file TS subset.
- [ ] `npm run build` reaches and completes the Vite build on Windows.
- [ ] `npm run dev` starts successfully on Windows and can be cleanly stopped.
- [ ] `npm run build:dev` and `npm run preview` use the same safe launcher path.
- [ ] POSIX/qemu-sensitive signal semantics are not regressed.
- [ ] No product/UI/security behaviour is changed in R1A.

### R1A handoff

Report only:

1. root cause fixed;
2. launcher strategy used;
3. default test discovery strategy;
4. exact number of test files/tests executed;
5. typecheck result;
6. build result;
7. dev start/stop result;
8. any newly exposed test failure that was previously hidden.

Then stop.

---

# R1B — Preview credential hygiene

**Do not execute until R1A is signed off.**

## Objective

Remove the committed reusable preview OAuth secret without creating a fake sense of closure.

## Required behaviour

- No literal reusable OAuth client secret remains in repository source.
- Secret material must come from a server-only environment/configuration path.
- Do not move the secret into a `VITE_` variable, client bundle, public JSON, or committed env file.
- If the required secret is absent, federated preview auth must fail closed or use an explicitly approved non-secret development fallback; it must not silently resurrect a committed default secret.
- Production per-app auth injection must continue to work.
- Keep `PREVIEW_CLIENT_ID` only if it is genuinely non-secret.
- Update comments/docs so they no longer instruct future maintainers to bake a secret into source.

## Rotation requirement

The currently exposed preview credential must be rotated/revoked outside this repo.

If the implementation agent cannot perform that broker/environment action, the handoff must say:

> **CODE FIXED — CREDENTIAL ROTATION STILL REQUIRED**

and R1B remains operationally open until product management confirms rotation.

Do not rewrite Git history in this slice unless explicitly instructed; rotation is the required containment.

## R1B acceptance

- [ ] No live reusable preview secret literal remains in HEAD.
- [ ] No secret is moved to client-visible configuration.
- [ ] Missing-secret behaviour is explicit and safe.
- [ ] Production auth configuration still has a valid path.
- [ ] Typecheck/full tests/build pass.
- [ ] Rotation status is explicitly reported.

Then stop.

---

# R1C — Operator app authentication boundary

**Do not execute until R1B is reviewed.**

## Objective

When auth is enabled, signed-out visitors must not enter the operator workspace.

When auth is disabled for the deliberate local prototype mode, the existing `DEV_USER` behaviour may continue.

## Required scope

Protect operator surfaces including:

- `/_app` routes: enquiries, bookings, insights, business, settings, trust, lab;
- `/onboarding`, because it configures business/workspace state.

Keep these public:

- homepage and marketing pages;
- roadmap / updates / early access;
- `/demo`;
- customer-facing quote/booking routes subject to R1D.

## Implementation requirements

Use the existing auth system.

Do not build a second session layer.

The route/UI must distinguish:

1. session still resolving;
2. signed in;
3. definitely signed out.

Do not redirect during the pending state and cause hard-reload auth flicker.

There is currently no concrete `/login` route despite `gates.tsx` documenting one. R1C should create the smallest deliberate sign-in surface required for the existing `signIn(providerId)` / `GROK_PROVIDERS` flow, or use another existing platform-auth entrypoint only if it is demonstrably present and correct.

When already signed in, visiting the sign-in route should not strand the user there.

### Important security boundary

A client route guard is a UX/access boundary, **not** a substitute for server-side authorization.

Do not weaken/remove `authMiddleware`, request isolation or per-user server scoping.

## R1C acceptance

- [ ] Auth-enabled + pending session: no redirect flash.
- [ ] Auth-enabled + signed out: operator routes are inaccessible and lead to sign-in.
- [ ] Auth-enabled + signed in: operator routes work.
- [ ] Auth-disabled local prototype mode still works as designed.
- [ ] `/onboarding` is protected consistently.
- [ ] Marketing/public pages remain public.
- [ ] Typecheck/full tests/build pass.
- [ ] Add focused auth-boundary tests or a deterministic helper test rather than relying only on manual clicking.

Then stop.

---

# R1D — Public quote / booking link containment

**Do not execute until R1C is reviewed.**

## Objective

Do not expose customer quote/booking data through guessable internal IDs in a production-capable build.

## Current-phase decision

For this prototype stabilisation gate, **contain exposure rather than invent a half-secure client-side token system**.

The acceptable R1D outcome is:

- short internal-ID customer routes may continue only in an explicitly recognised local/demo/fixture mode;
- production-capable/public deployment must not resolve `/q/f01`, `/book/b1`, or equivalent internal IDs;
- the UI must fail closed / show unavailable rather than leak another fixture/customer record;
- no security claim should imply a client-bundled opaque string is a real capability token.

If first-beta evidence later proves no-account public quote links are required, create a dedicated server-backed capability-link phase with:

- high-entropy token generated server-side;
- token stored hashed or otherwise protected appropriately;
- object type/id mapping server-side;
- expiration/revocation;
- minimal public projection;
- token validated on every public read/mutation;
- no internal IDs as public authorization.

That larger capability-link system is **not R1D scope**.

## R1D acceptance

- [ ] Production-capable builds cannot enumerate quote/booking records by short internal IDs.
- [ ] Local/demo fixture flow remains available only where explicitly allowed.
- [ ] No fake "UUID in the client bundle" security workaround.
- [ ] Public copy remains truthful about prototype/payment behaviour.
- [ ] Typecheck/full tests/build pass.

Then stop.

---

# 3. Final R1 stabilisation gate

After R1A–R1D pass:

- rerun the full default test suite;
- run typecheck;
- run production build;
- run dev smoke;
- run lint and classify remaining findings;
- rerun the Phase 9A desktop/phone/reduced-motion visual QA;
- verify no public product truth changed;
- verify no auth/security correction broke waitlist, roadmap or the Ridge proof.

### About the current lint baseline

The independent review reported the same 11 lint findings as before.

Do not turn R1 into a broad lint-cleanup refactor.

Fix lint problems in files touched by R1 when reasonable. Record the remaining baseline separately.

The empty catch in `src/lib/app-data/client.server.ts` is not a reason to broaden R1A. If later cleaned up, preserve the intentional fallback-to-token-hash behaviour.

---

# 4. Phase 9A status

Phase 9A implementation commit:

`19843ee61fb7d2508bc0b810e8ead5cd58735ddc`

Product-management source review accepts the visual direction:

- existing paper/ink identity evolved rather than replaced;
- serif/editorial hierarchy strengthened;
- Ridge remains first substantial proof;
- changed facts/decision are clearer;
- waitlist behaviour/product copy were not changed;
- no generic AI visual clichés were introduced.

However, final Phase 9A sign-off is held until R1A restores the build/dev verification loop and the final R1 gate reruns the visual/runtime checks.

Do not begin 9B merely because the 9A code is already on `main`.

---

# 5. What remains after R1

If R1 passes and Phase 9A is finally signed off:

> **9B → 10A → review → 10B → first-cohort-driven product work**

Phase 7 remains deferred unless real beta evidence makes broader identity continuity necessary.

Do not add new speculative phases during R1.
