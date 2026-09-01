# Enquiry - Independent Progress Critique

> This file is an independent, evidence-based management review of the Enquiry repository. It is updated weekly. It is useful context for Claude, Codex, and other agents, but it is not implementation authority.
>
> `docs/CURRENT_PHASE.md` remains the authority for the active slice, sequencing, acceptance criteria, and sign-off.
>
> **Ownership:** Codex owns the independent progress, evidence, risk, and phase-review layer. Claude, Cursor, or another implementation agent may execute an authorised slice, but must not self-certify completion or advance sequencing.

## Review metadata

- Review date: 2026-09-01
- Review type: live Codex management pass
- Repository: [Mrsavage92/enquiry](https://github.com/Mrsavage92/enquiry)
- Current repository head observed: [57c72fb - assign progress review ownership to Codex](https://github.com/Mrsavage92/enquiry/commit/57c72fb6a0c86c63d34951567838671d51b3fcaf)
- Latest substantive product commit observed: [4ec4430 - reclaim the dead space above the fold](https://github.com/Mrsavage92/enquiry/commit/4ec443021391e2069ba149b5f894cf20f51f27cb)
- Latest R2A implementation correction reviewed: [3d0207a](https://github.com/Mrsavage92/enquiry/commit/3d0207a502d48e78169bed12f35e4aaf77798418)
- Primary sources:
  - [Current phase](./CURRENT_PHASE.md)
  - [Phase registry](./PHASE_REGISTRY.md)
  - [R2A active brief](./phases/PHASE_R2A_REAL_WORKSPACE_ONBOARDING.md)
  - [R2 foundation review](./R2_FOUNDATION_REVIEW.md)
  - [Test and regression policy](./TEST_REGRESSION_POLICY.md)
  - Connected Notion Enquiry Product HQ, strategy, decision, roadmap, validation, and growth material

## Executive verdict

**The product direction remains correct. The implementation is not ready to advance.**

The repository and connected product material still describe the intended product: a cross-industry enquiry decision layer that turns messy inbound messages into an understood, explainable, business-specific next action, ending in a booked or lost enquiry. The boundary remains clear: Enquiry is not a generic CRM, shared inbox, workflow builder, AI receptionist, or all-in-one operations suite.

The current issue is execution truth. R2A remains active and unsigned off because the normal live post-onboarding path can still expose fixture-backed state and trigger demo behaviour. Website polish and successful server-side onboarding do not compensate for that first-beta safety defect.

## What moved since the previous review

- **No material R2 product movement was observed after the latest implementation work.**
- [4ec4430](https://github.com/Mrsavage92/enquiry/commit/4ec443021391e2069ba149b5f894cf20f51f27cb) improved measured public-site spacing, navigation grouping, and mobile above-the-fold behaviour.
- [2341704](https://github.com/Mrsavage92/enquiry/commit/2341704a3bccfd5f922609dca0954e3fe7a3f931) corrected an invalid login redirect rewrite.
- The latest commits [25ea7a2](https://github.com/Mrsavage92/enquiry/commit/25ea7a2cafab501c39f437da215c5245b2cb4944) and [57c72fb](https://github.com/Mrsavage92/enquiry/commit/57c72fb6a0c86c63d34951567838671d51b3fcaf) established and assigned the Codex-owned critique layer. These are management improvements, not product readiness progress.
- The connected Notion material remains aligned with the repository. No newer conflicting product decision was found in the connected search.

## Codex validation of the active blocker

The documented blocker is visible in the current source:

- `src/routes/onboarding.tsx` creates the authenticated workspace, calls `markOnboardedLocally()`, and navigates to `/enquiries`.
- `src/components/enquiry/workspace.tsx` still reads enquiry state directly from `usePrototype`, including fixture businesses, enquiries, and bookings.
- The same workspace schedules `arriveEnquiry()` when `onboarded` is true and the arrival has not played. The guard excludes framed preview mode, but does not require explicit demo mode.
- Therefore a successful live onboarding can still enter fixture-backed runtime state and can still receive the hard-coded demo arrival.

This confirms the R2A hold is supported by actual code, not only by an old commit message or an unverified implementation report.

## Important decisions

- R2A remains **not signed off**.
- The next implementation action is only the narrow live/demo isolation correction and directly necessary focused tests.
- R2B through R2F remain unauthorised until R2A is independently reviewed and accepted.
- Codex owns progress review, evidence assessment, risk, and phase gating. Implementation agents execute the authorised slice but do not self-certify it.
- Public-site polish and external public-traffic blockers remain separate from the R2 engineering sequence.
- The product remains centred on the Enquiry Decision Object and correct next action, not generic CRM expansion or premature integrations.

## Blockers

1. **R2A live/demo isolation:** fixture state and demo arrival can still leak into the normal live post-onboarding path.
2. **Server-authoritative operator runtime:** the wider runtime cutover remains R2B work and is not complete.
3. **First-beta evidence:** arbitrary non-fixture enquiry processing, correction/outcome telemetry, repeat usage, and paid continuation are not yet demonstrated as a complete first-beta outcome.
4. **Public traffic:** historical preview credential rotation/revocation and final real-browser visual QA remain outstanding.
5. **Verification:** GitHub exposes no CI status checks for the reported test results, so exact commands and baseline evidence are still required.

## Milestone risk

**High risk to first-beta timing; medium risk to the product thesis.**

Timing risk is high because R2A cannot be honestly closed until the isolation defect is corrected and evidenced, and the remaining R2B-R2F slices still carry the transition from prototype state to a truthful beta product. Thesis risk is lower because the product boundary and decision-layer strategy remain coherent. The main danger is confusing visible activity with genuine product readiness.

## Next three priorities

1. Close the exact R2A live/demo isolation defect and add the required focused proof without broadening into R2B.
2. Have Codex review the actual diff, focused tests, full test command, typecheck, and build, then make an explicit R2A sign-off or correction decision.
3. Only after R2A is accepted, activate the next bounded R2B server-authoritative runtime slice. Keep public-traffic work separate.

## Agent handoff

Before changing anything, read `AGENTS.project.md`, `docs/CURRENT_PHASE.md`, and the detailed R2A brief. Implement only the current correction gate. Do not rework accepted server/onboarding foundations, begin R2B hydration, add integrations, redesign the UI, or infer permission from later-phase code already present on `main`.

## Evidence and uncertainty

- **High confidence:** active phase, sequencing, documented blocker, and source-level presence of the live/demo defect.
- **Medium confidence:** complete release readiness, because no live browser verification or CI status evidence was available in this review.
- **Unknown:** uncommitted local work or external agent activity not represented in the repository.
