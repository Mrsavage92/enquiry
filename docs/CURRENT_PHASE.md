# Enquiry - Current Implementation Phase

## Current phase

**R1A - Cross-platform toolchain + truthful default test command**

This release-blocker gate temporarily supersedes Phase 9B.

Source of truth:

- `AGENTS.project.md`
- `docs/phases/PHASE_R1_RELEASE_BLOCKER_STABILISATION.md`
- `docs/TEST_REGRESSION_POLICY.md`

## Completed product gates

### Phases 1-6
**SIGNED OFF.** Positioning, signature decision-continuity proof, non-universal commercial UX, public roadmap, Early Access/Updates and roadmap research persistence are complete.

### Phase 8
**SIGNED OFF as the pre-beta coherence gate.** Public/product story is coherent: Enquiry is a decision layer, not a quote engine/shared inbox; pricing applies only where relevant; continuity is one enquiry; the endgame remains first interest to booked/lost.

### Phase 7
**DEFERRED BY DESIGN.** Do not build broader identity matching before beta evidence requires it.

### Phase 9A
**IMPLEMENTATION LANDED; VISUAL DIRECTION ACCEPTED; FINAL SIGN-OFF HELD BY R1.**

Implementation commit:

`19843ee61fb7d2508bc0b810e8ead5cd58735ddc`

Product-management source review accepts the direction:

- Enquiry's paper/ink identity was evolved, not replaced;
- homepage hierarchy/rhythm improved;
- Ridge remains the first substantial proof;
- changed facts/decision are visually clearer;
- waitlist behaviour and approved product copy remain unchanged;
- no generic AI-site visual clichés were introduced.

Do **not** begin 9B until R1 restores the runtime/build verification loop and Phase 9A receives final sign-off.

---

# Why R1 was inserted

An independent review after 9A exposed pre-existing release-engineering/security issues. Product management verified the relevant repo code directly.

The full plan is:

`docs/phases/PHASE_R1_RELEASE_BLOCKER_STABILISATION.md`

R1 sequence:

> **R1A -> review -> R1B -> review -> R1C -> review -> R1D -> final gate -> resume Phase 9**

Do not batch later R1 slices.

---

# Execute R1A only

## Objective

Fix the cross-platform dev/build launcher and make `npm test` execute the full intended repository test suite.

This slice changes tooling only.

Do not change product behaviour, visual design, auth semantics, public routes, PWA behaviour or Phase 9 copy.

## Verified problem 1 - Windows Vite launch

Current package scripts run commands such as:

```text
node scripts/with-app-env.mjs vite build
```

`with-app-env.mjs` then uses Node `spawn("vite", ..., { shell: false })`.

On Windows this can fail with:

```text
spawn vite ENOENT
```

because npm's Windows binary shim is not safely invoked this way.

### Required fix

Use a shell-free, cross-platform launcher.

Prefer resolving/invoking the JavaScript Vite CLI through Node or another explicit executable/argv mechanism.

Preserve:

- `.grok/app-env.json` merge behaviour;
- explicit process env precedence;
- child exit/signal forwarding;
- existing qemu-sensitive exit-status handling.

Do not solve this with shell string construction.

## Verified problem 2 - default tests omit most TS tests

Repo currently contains:

- **7** `*.test.mjs` files;
- **16** TypeScript test files.

Current `npm test` hard-codes only two TypeScript test files.

### Required fix

Make the default test command discover/run the whole intended suite cross-platform.

Requirements:

- all current script tests execute;
- all current TS/TSX tests execute;
- future matching tests are picked up automatically;
- no shell-glob dependency;
- keep Node strip-types unless a deliberate alternative is justified;
- do not introduce a new test framework merely for discovery.

## Acceptance criteria

- [ ] `npm run typecheck` passes.
- [ ] `npm test` executes the complete intended suite.
- [ ] Exact number of test files/tests executed is reported.
- [ ] `npm run build` completes the Vite build on Windows.
- [ ] `npm run dev` starts on Windows and can be stopped cleanly.
- [ ] `npm run build:dev` and `npm run preview` use the same safe launcher approach.
- [ ] Existing env merge/signal semantics remain correct.
- [ ] No product/UI/security behaviour changes.

## Required handoff

Report only:

1. root cause fixed;
2. launcher strategy used;
3. full-test discovery strategy;
4. files changed;
5. exact test files/tests executed;
6. typecheck result;
7. build result;
8. dev start/stop result;
9. any newly exposed failing test that the old command never ran.

Then stop.

**Do not begin R1B, R1C, R1D, Phase 9B or Phase 10 until product management reviews R1A and updates this file.**
