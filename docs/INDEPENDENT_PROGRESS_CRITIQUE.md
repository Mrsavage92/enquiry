# Enquiry - Independent Progress Critique

> This file is an independent, evidence-based management review of the Enquiry repository. It is updated daily. It is useful context for Claude, Codex, and other agents, but it is not implementation authority.
>
> `docs/CURRENT_PHASE.md` remains the authority for the active slice, sequencing, acceptance criteria, and sign-off.
>
> **Ownership:** Codex owns the independent progress, evidence, risk, and phase-review layer. Claude, Cursor, or another implementation agent may execute an authorised slice, but must not self-certify completion or advance sequencing.

## Review metadata

- Review date: 2026-09-01
- Repository: [Mrsavage92/enquiry](https://github.com/Mrsavage92/enquiry)
- Latest commit observed in the recent repository review: [4ec4430 - reclaim the dead space above the fold](https://github.com/Mrsavage92/enquiry/commit/4ec443021391e2069ba149b5f894cf20f51f27cb)
- Primary sources:
  - [Current phase](./CURRENT_PHASE.md)
  - [Phase registry](./PHASE_REGISTRY.md)
  - [R2A active brief](./phases/PHASE_R2A_REAL_WORKSPACE_ONBOARDING.md)
  - [R2 foundation review](./R2_FOUNDATION_REVIEW.md)
  - [Test and regression policy](./TEST_REGRESSION_POLICY.md)
  - Connected Notion Enquiry Product HQ and decision material

## Executive verdict

**Vision alignment: directionally strong; first-beta readiness: not yet demonstrated.**

The repository still reflects the intended product: a cross-industry enquiry decision layer that turns messy inbound messages into an understood, explainable, business-specific next action, ending in a booked or lost enquiry. The product boundary remains clear: this is not a generic CRM, shared inbox, workflow builder, AI receptionist, or all-in-one operations suite.

The material risk is execution truth, not product direction. R2A remains active and explicitly unsigned off because the normal live post-onboarding path can still expose fixture businesses, enquiries, and bookings and can still trigger demo arrival behaviour. Until that is corrected and independently evidenced, the product cannot honestly be treated as a safe first-beta operator workspace.

## What moved

- The R2A correction materially improved real workspace creation, onboarding persistence, tenancy handling, currency truth, fake-integration copy, and focused database coverage in [3d0207a](https://github.com/Mrsavage92/enquiry/commit/3d0207a502d48e78169bed12f35e4aaf77798418).
- Management review correctly retained one unresolved live/demo isolation defect rather than signing off R2A on the strength of the implementation report alone.
- Public-site work continued, including the above-the-fold spacing and navigation correction in [4ec4430](https://github.com/Mrsavage92/enquiry/commit/4ec443021391e2069ba149b5f894cf20f51f27cb) and the login redirect correction in [2341704](https://github.com/Mrsavage92/enquiry/commit/2341704a3bccfd5f922609dca0954e3fe7a3f931).
- The phase registry and regression policy now clearly separate landed foundation from reviewed phase completion and require exact evidence for claimed baseline failures.

## Important decisions

- R2A is **not signed off**.
- The next authorised implementation slice remains the narrow live/demo isolation correction. R2B through R2F are not authorised until the active gate is reviewed.
- The server and onboarding direction from the R2A correction is accepted and should not be unnecessarily reworked.
- R2 engineering may continue independently of the external public-traffic blockers, but those blockers must not be mixed into the R2A correction.
- The product must remain centred on the Enquiry Decision Object and the correct next action, not on accumulating CRM features or integrations.

## Blockers

1. **R2A live/demo isolation:** successful live onboarding can still land the signed-in operator on fixture-backed local state, and the hard-coded demo arrival can still run outside explicit demo mode. See [CURRENT_PHASE.md](./CURRENT_PHASE.md).
2. **Server-authoritative operator runtime:** the wider live workspace cutover remains R2B work and is not yet complete.
3. **Public traffic:** historical preview credential rotation/revocation and final real-browser visual QA remain outstanding before deliberate public traffic.
4. **Verification evidence:** the repository has no CI status checks for the reported R2A test results, so claimed test outcomes still require the exact command and baseline evidence required by the regression policy.

## Milestone risk

**High risk to first-beta timing, medium risk to the product thesis.**

This is high risk to timing because the current release path cannot progress honestly beyond R2A until live/demo isolation is corrected and evidenced, while R2B through R2F still contain the core transition from prototype state to a truthful first-beta product. It is medium risk to the thesis because the product boundary and decision-layer strategy remain coherent; the main threat is allowing implementation momentum or visual progress to be mistaken for beta readiness.

## Next three priorities

1. Close the exact R2A live/demo isolation defect and add the required focused proof without broadening into R2B.
2. Independently verify the changed diff, focused tests, full test command, typecheck, and build; then make an explicit R2A sign-off or correction decision.
3. Only after R2A sign-off, activate the next bounded R2B server-authoritative runtime slice. Keep public-traffic credential and browser-QA work tracked separately.

## Evidence and uncertainty

- **High confidence:** current phase, sequencing, acceptance boundary, and documented blockers, because they are stated in the repository management sources.
- **Medium confidence:** implementation status between the latest observed commits and this review, because GitHub exposed no CI status checks and no live browser verification was performed in this review.
- **Unknown:** whether any uncommitted local work or external agent activity exists outside the repository.

## Agent handoff

Use this file to understand the independent management view and challenge assumptions. Before changing anything, read `AGENTS.project.md`, `docs/CURRENT_PHASE.md`, and the detailed active phase brief. Do not treat this file's priorities as permission to implement a later phase, change product authority, or sign off a gate.
