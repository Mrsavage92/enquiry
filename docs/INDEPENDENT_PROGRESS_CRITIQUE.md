# Enquiry - Independent Progress Critique

> Independent, evidence-based management review of the Enquiry repository. Updated weekly for Codex, Claude, Cursor, and other agents.
>
> `docs/CURRENT_PHASE.md` remains the execution authority for scope, sequencing, acceptance criteria, and sign-off. This critique does not authorise later work or sign off any phase.

## Review metadata

- Review date: 2026-09-14
- Repository head reviewed: [47a8d29 - merge UI1 Quiet Signal redesign](https://github.com/Mrsavage92/enquiry/commit/47a8d29ba66f19d6280cd2c2ead4b9bc5a360be7)
- Previous critique commit: [6eba9a4](https://github.com/Mrsavage92/enquiry/commit/6eba9a4cee9759cad54d891e8e7515fe438b1c8b)
- Change span: 92 commits on `main`, from 2026-09-07 to 2026-09-10
- Review boundary: current `main`; open [PR #20](https://github.com/Mrsavage92/enquiry/pull/20) is management context, not counted as landed progress
- Execution authority: [CURRENT_PHASE.md](./CURRENT_PHASE.md)
- Supporting sources: [phase registry](./PHASE_REGISTRY.md), [UI1 direction](./design/UI1_QUIET_SIGNAL_WORKING_DIRECTION.md), [UI1 visual direction v2](./design/UI1_VISUAL_DIRECTION_V2.md), [CC1 package](./implementation/CC1_COMMERCIAL_CORRECTNESS/README.md), [CC1 implementation report](./implementation/CC1_COMMERCIAL_CORRECTNESS/IMPLEMENTATION_REPORT.md), [test policy](./TEST_REGRESSION_POLICY.md), [beta gate](./BETA_READINESS_GATE.md), [public traffic gate](./PUBLIC_TRAFFIC_GATE.md), [auth contract](./AUTH_DEPLOYMENT_CONTRACT.md), and [beta telemetry spec](./BETA_TELEMETRY_SPEC.md)
- Product sources: [Notion Product HQ](https://app.notion.com/p/3c6116e8bef281f9b166fb7a964a7a58), [strategy](https://app.notion.com/p/3c6116e8bef28171aab5ee334e52c852), [decision log](https://app.notion.com/p/3c6116e8bef281c7ba4bc14ba0568bdf), [decision engine](https://app.notion.com/p/3c6116e8bef28140a096e39bfa98d682), [validation](https://app.notion.com/p/3c6116e8bef28191b38cc4eaa0979b0d), [Growth and Launch HQ](https://app.notion.com/p/3c7116e8bef2810cb59ad235086c6b34), and [launch plan](https://app.notion.com/p/3d6116e8bef281268755e622aedbebdf)

## Executive verdict

**The product moved materially toward a safer human-authorised enquiry-to-booking loop, but first-beta readiness remains high risk and the current governance state is unreliable.**

CC1 is real product progress. Current source now preserves quantity meaning, refuses ambiguous/conflicting rules, prevents an unconfirmed model service from becoming an authorised quote, freezes reviewed content, separates copying from external-send attestation, blocks stale approvals, and keeps fact/service interpretation writes inside a revisioned transaction. This directly strengthens:

> understood Decision Object -> relevant business check -> minimum blocker -> explainable next action -> human-authorised action

The rest of the vision is still not demonstrated as a complete beta system. Real-provider interpretation, broader evaluator selection, two-tenant endpoint isolation, real PostgreSQL contention, correction/outcome telemetry, and a proven booked-or-lost downstream handoff remain absent or unverified. UI1 makes the product calmer and more task-led, but it is primarily presentation and interaction-architecture progress, not new decision-engine capability.

## What materially moved

### 1. Commercial correctness and truthful action recording improved

**Observed fact:** [PR #11](https://github.com/Mrsavage92/enquiry/pull/11) and the integrated release [PR #16](https://github.com/Mrsavage92/enquiry/pull/16) landed CC1 on `main`. Source inspection confirms the important safeguards remain present at the reviewed head:

- `parseQuantity` refuses ranges, alternatives, negatives, malformed values, zero, and unsafe magnitudes instead of silently coercing them.
- `matchRule` returns one, none, or ambiguity/conflict and no longer prices by array order.
- Unconfirmed service identity produces `PROVISIONAL`, not `EXACT`.
- `prepareReviewedSendInTransaction` requires a confirmed service for commercial sends, checks message amounts against structured outcomes, derives the recipient server-side, and freezes the reviewed artefact.
- Copying writes nothing. Only explicit owner attestation records a send.
- Decision revisions and enquiry locks prevent old previews or late interpretation from silently overwriting current or closed state.

**Implementation claim with tracked evidence:** CC1 reports 673/673 tests, typecheck, lint, auth check, builds, PGLite transaction tests, and a real-auth browser journey. The journey found a live-only correction defect, which was fixed and rechecked for persistence and stale-preview refusal. This is credible, specific evidence, but it was not independently rerun in this review.

**Inference:** This is the week's strongest movement toward safe first beta. It removes several paths where Enquiry could state or record a commercial outcome that the owner had not actually confirmed.

### 2. A deployable release path was established, with a manual migration obligation

**Observed fact:** [PR #17](https://github.com/Mrsavage92/enquiry/pull/17) removed database migration execution from the Vercel build after production's restricted app role failed DDL. Migration 0007 was reported applied out of band as the table owner, with DML grants and RLS enabled on `reviewed_send`. The current package build no longer runs `db:migrate`.

**Implementation claim:** [PR #16](https://github.com/Mrsavage92/enquiry/pull/16) reports 725/725 tests and a 14/14 real-auth disposable-user journey before release. Notion records the product as live from 2026-09-09.

**Risk:** Deployability improved, but schema readiness now depends on a manual pre-deploy procedure. The CC1 implementation report still says the build runs migrations, so evidence documents are stale relative to the current build contract.

### 3. Demo, public, and display honesty improved

**Observed fact:** The branch now labels sample data, routes public visitors to an explicit demo, distinguishes sign-in from early access, removes a fabricated sent message on demo decline, corrects timestamp/integration labels, and adds public traffic/security hardening.

**Inference:** These are trust and launch-quality improvements. They reduce false product claims but do not close the operator beta gate.

### 4. UI1 materially changed the operator experience

**Observed fact:** [PR #19](https://github.com/Mrsavage92/enquiry/pull/19) replaced the prior shell and navigation, added Today and secondary account/support destinations, reframed Booked/Business/Insights, and moved the visual system to the authorised lilac/violet Editorial Utility direction.

**Implementation claim:** Typecheck, lint, build, and desktop/phone smoke passed. The full suite reportedly hit PGLite/WASM memory pressure; only representative database failures were rerun in isolation.

**Unknown:** Owner visual acceptance is still open. [PR #20](https://github.com/Mrsavage92/enquiry/pull/20) says the original match was rejected, carries a substantial refinement, and has not been merged. Its latest correction reports 73 targeted tests, while its earlier 725-test result was not rerun at the latest branch head.

**Assessment:** UI1 is meaningful usability progress, but not evidence that arbitrary enquiries are understood better or that beta businesses can complete the full live loop more safely.

### 5. No material movement on the remaining differentiation proof

There is no new successful real-provider benchmark. The checked-in R2E report still records null 16/16, fake 16/16, and real 1 pass / 15 skipped, where the only real-mode pass is an injected provider failure that makes no provider call.

There is also no material evidence this week for:

- dynamic evaluator breadth beyond the narrow current decision path;
- two real signed-in tenants denied at the HTTP boundary;
- genuine multi-connection PostgreSQL contention;
- first-beta correction, override, outcome, activation, or retention telemetry;
- booked/lost lifecycle completion and downstream handoff across non-fixture enquiries;
- customer validation, willingness to pay, paid conversion, or repeat use.

## Important decisions

- **Observed:** The product owner explicitly allowed [PR #16](https://github.com/Mrsavage92/enquiry/pull/16) to merge without prior independent CC1 sign-off. That is a release decision, not retrospective proof that CC1 or the beta gate passed.
- **Observed:** `CURRENT_PHASE.md` activates UI1 and makes the draft design documents authoritative through that file. It preserves deterministic commercial authority, demo/live separation, and human approval.
- **Observed:** Reviewed sends use content-derived idempotency. Byte-identical repeat messages on one enquiry cannot currently be recorded as distinct sends. The implementation report correctly leaves this as an owner-ratification decision.
- **Observed:** Production migrations are now out of band and must be applied by the table-owner role before a dependent deploy.
- **Inference:** "Quiet Signal" is directionally aligned with the vision when it hides internal mechanics but keeps blockers, uncertainty, evidence, and action authority reachable.

## Blockers and urgent contradictions

1. **Execution authority is stale and contradictory.** `CURRENT_PHASE.md` says UI1 is authorised but "not deployed, merged to production or signed off" and forbids merging to `main` without explicit approval. UI1 is already merged to `main` at the reviewed head and has a successful Vercel status. `PHASE_REGISTRY.md` still says CC1 is the only active slice and not yet implemented. Agents cannot reliably determine current authority, release state, or the next permitted action.
2. **The live sign-in path is operationally blocked.** The 2026-09-09 Notion launch plan records that a real sign-in link redirected to localhost because Supabase URL configuration remained open. Custom SMTP, the Anthropic production key, and the domain decision were also open. The project board still records an environment-variable blocker.
3. **First-beta verification remains incomplete.** The beta checklist remains entirely open. Two-tenant HTTP isolation, real PostgreSQL contention, exact-head full regression, reload persistence across all meaningful mutations, and beta telemetry are not proven.
4. **Real model quality is unknown.** The null fallback is safe, but without successful provider cases Enquiry has not shown that arbitrary messy enquiries become useful Decision Objects.
5. **Release evidence is not tied to the current head.** The last full 725-test claim predates the UI1 merge. Current head exposes only Vercel success. PR #19 explicitly reports a broad-suite memory failure, not a clean exact-head suite.

## Milestone risk and trend

- **First-beta risk: high, improving on commercial safety but flat on end-to-end proof.**
- **Governance/release risk: high, worsening.**
- **Product-thesis risk: low to medium, stable.**
- **Public-traffic risk: high while the site is live but the traffic gate and sign-in configuration remain open.**

The trend is mixed. CC1 substantially reduced the chance of false prices, false sends, stale approvals, and inconsistent decisions. However, 92 commits created more presentation and launch movement than new validation of the core differentiation. Shipping UI1 before reconciling authority, exact-head tests, sign-in, provider evidence, and beta gates increases the chance that visible polish is mistaken for beta readiness.

## Next three priorities

1. **Restore one truthful control plane.** Reconcile `CURRENT_PHASE.md`, `PHASE_REGISTRY.md`, deployed-main status, CC1 review status, and PR #20. Record what is active, what landed, what remains unsigned, and whether PR #20 is accepted or rejected. Do not infer permission to merge it from UI1's existence.
2. **Prove the exact beta candidate, not an earlier branch.** At the chosen head, run the full regression/typecheck/lint/build ledger, real-auth zero-membership onboarding, two-tenant endpoint denial, meaningful reload persistence, and controlled multi-connection PostgreSQL checks. Verify the manual migration procedure, Supabase redirect allow-list, and transactional SMTP before inviting a business.
3. **Return focus to the differentiating loop.** Run the real provider across the non-fixture benchmark, then exercise several business brains through interpretation, relevant evaluator selection, one minimum blocker, explanation, owner correction/approval, booked or lost outcome, downstream handoff, and structured beta telemetry. Do not substitute another visual phase or broader integration programme.

## Evidence and confidence

- **High confidence observed facts:** current `main` source, phase documents, merged/open PR state, current Vercel commit status, beta/public gate text, source-level CC1 safeguards, and Notion-recorded operational blockers.
- **Medium confidence implementation claims:** 673/673 and 725/725 test reports, browser journeys, production migration application, and UI smoke evidence. They are detailed and committed but were not rerun by this review.
- **Inference:** CC1 is meaningful safe-product progress; UI1 is meaningful usability progress but does not materially close interpretation or beta-evidence gaps.
- **Unknown:** current production content at the latest head, successful production sign-in after the recorded localhost failure, production SMTP, real-provider quality, exact-head full-suite status, first-customer behaviour, paid conversion, and retention.

## Implementation handoff

Read `docs/CURRENT_PHASE.md` first, but treat its release-state statements and the registry's CC1 status as contradictory evidence requiring owner reconciliation before any merge, deploy, or new phase. For UI1, review current `main` and PR #20 separately and preserve every CC1 server boundary. For beta work, attach evidence to one exact commit and label source observation, test evidence, browser evidence, production verification, and unknowns separately. Do not self-sign UI1, CC1, R2E/R2F, the beta gate, or the public traffic gate.
