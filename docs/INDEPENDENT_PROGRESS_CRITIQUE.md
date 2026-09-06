# Enquiry - Independent Progress Critique

> Independent, evidence-based management review of the Enquiry repository. Updated weekly for Codex, Claude, Cursor, and other agents.
>
> `docs/CURRENT_PHASE.md` remains the execution authority for scope, sequencing, acceptance criteria, and sign-off. This critique does not authorise later work.

## Review metadata

- Review date: 2026-09-07
- Repository head reviewed: [e5d28ea - record Slice E2 width and overflow-probe measurements](https://github.com/Mrsavage92/enquiry/commit/e5d28ea30d01dbae52ae5140cb331d1ed0919951)
- Previous critique head: [57c72fb](https://github.com/Mrsavage92/enquiry/commit/57c72fb6a0c86c63d34951567838671d51b3fcaf)
- Change span: 83 commits, mainly 2026-09-03 to 2026-09-04
- Current branch: `main`
- Current phase authority: [docs/CURRENT_PHASE.md](./CURRENT_PHASE.md)
- Supporting sources: [phase registry](./PHASE_REGISTRY.md), [R2A brief](./phases/PHASE_R2A_REAL_WORKSPACE_ONBOARDING.md), [R2E brief](./phases/PHASE_R2E_ARBITRARY_ENQUIRY_INTERPRETATION.md), [test policy](./TEST_REGRESSION_POLICY.md), [beta gate](./BETA_READINESS_GATE.md), [R2 live/demo map](./R2_LIVE_DEMO_SEPARATION_MAP.md)
- Product sources: [Notion Enquiry Product HQ](https://app.notion.com/p/3c6116e8bef281f9b166fb7a964a7a58), [strategy](https://app.notion.com/p/3c6116e8bef28171aab5ee334e52c852), [decision log](https://app.notion.com/p/3c6116e8bef281c7ba4bc14ba0568bdf), [decision engine](https://app.notion.com/p/3c6116e8bef28140a096e39bfa98d682), [validation](https://app.notion.com/p/3c6116e8bef28191b38cc4eaa0979b0d), and [Growth & Launch HQ](https://app.notion.com/p/3c7116e8bef2810cb59ad235086c6b34)

## Executive verdict

**The product thesis remains strongly aligned. First-beta readiness is improving, but is not yet independently proven.**

The repository still points at the correct outcome: messy inbound enquiry -> understood Enquiry Decision Object -> relevant business checks -> minimum decision blocker -> explainable next action -> human-authorised action -> booked or lost -> downstream handoff.

The work now represents real product progress, not only presentation work. R2A live/demo contamination was addressed, a real onboarding and manual enquiry loop was browser-verified, approval preview was added to customer-facing sends, and a server-side interpretation path now exists. However, the branch contains conflicting phase authority, real-provider interpretation remains unverified, and the full beta gate is not closed.

## What materially moved since the previous review

### 1. R2A live/demo isolation was corrected

Observed in current source and commits:

- [b2b59a6](https://github.com/Mrsavage92/enquiry/commit/b2b59a65d6425a8a1ea9422b3538aea4553f8890), [f5b808e](https://github.com/Mrsavage92/enquiry/commit/f5b808e4f01cb640583273aa2125e5a351e3a3ec), [3d8f2ae](https://github.com/Mrsavage92/enquiry/commit/3d8f2ae148ecfd66383f37915a5d2858f262f585), and [a538457](https://github.com/Mrsavage92/enquiry/commit/a538457889d5af2fbc99ac643056d09887dd1888) close fixture, transient, offline, and fake-arrival leakage.
- Current `workspace.tsx` gates the scripted arrival through `mayPlayDemoArrival`, requiring explicit demo mode.
- Current isolation tests cover live handoff state, fixture content, demo arrival, transient state, and failure-to-complete onboarding.

This is genuine first-beta safety progress. It removes the previously observed defect where a newly onboarded live tenant could receive fixture customers or the scripted arrival.

### 2. The real onboarding and manual first-beta loop has evidence

The repository records an independent real-browser verification on 2026-09-03 in [28dc37c](https://github.com/Mrsavage92/enquiry/commit/28dc37cc3f373ca6b0632ef7329e5e5ec5d05385):

- real Supabase Auth;
- real onboarding;
- confirmed pricing rule;
- manually typed enquiry;
- one blocking fact;
- exact quote;
- recorded manual/copy action;
- reload persistence;
- honest no-price refusal.

This is a meaningful product slice, but the evidence dossier is external and not tracked in the repository. Treat it as implementation evidence with medium confidence until the current branch has a reproducible tracked verification trail.

### 3. Approval-preview and action semantics improved

Commits [a2e2760](https://github.com/Mrsavage92/enquiry/commit/a2e276069170a8e6d2a33a8f288baf62267001b3), [74fbf98](https://github.com/Mrsavage92/enquiry/commit/74fbf9815f1f3d68e2ed69492bda6406c8e55303), and [c92744a](https://github.com/Mrsavage92/enquiry/commit/c92744ab062e57ab4b5a204c0dbaad90c8510929) make customer-facing sends review-first, add structural quote records, and retain server-side idempotency/recipient derivation. This aligns with the locked principle that AI interprets while deterministic systems transact and humans retain action authority.

### 4. Interpretation architecture now exists, but evidence is partial

Commit [f7c2973](https://github.com/Mrsavage92/enquiry/commit/f7c2973e95d3f07f21f46bf19cf3f2dafa732ebc) adds:

- a server-only interpreter interface;
- Anthropic adapter plus null fallback;
- strict structured output validation;
- inferred/check-this facts with provenance;
- deterministic re-evaluation after interpretation;
- prompt-injection tests;
- failure-safe persistence of the raw enquiry;
- owner confirmation/correction for inferred service and facts.

The [R2E benchmark](./benchmarks/r2e-2026-09-03.md) reports 16/16 pass for null and fake transport modes across interpretation, business correctness, trust/safety, and draft grounding. Real-provider coverage is only 1 pass and 15 skipped because no `ANTHROPIC_API_KEY` was present. That proves the deterministic/null safety path, not real model quality.

### 5. Visual and accessibility work was substantial but secondary

The remaining commits include real fixes to mobile product framing, touch targets, panel sizing, confidence visibility, animation behaviour, and overflow. This improves usability and trust presentation. It should not be counted as equivalent to arbitrary-enquiry, persistence, telemetry, or beta-validation progress.

## Important decisions

- Product positioning remains cross-industry and defined by enquiry shape, not weddings or another single niche.
- The Enquiry Decision Object and correct next action remain the differentiation target, not generic CRM features, a chatbot, or a workflow builder.
- Manual/private paste remains a valid first-beta ingestion path. Production mailbox, social, SMS, payment, and booking integrations are not prerequisites.
- Model output remains proposed and unconfirmed. Confirmed Business Brain rules and deterministic evaluators control consequential outcomes.
- The repository records external R2A sign-off at [d382f2d](https://github.com/Mrsavage92/enquiry/commit/d382f2d), and [ccbf770](https://github.com/Mrsavage92/enquiry/commit/ccbf770c3379b69d42d425eed4112146db98ddef) records the active slice as approval preview plus interpretation with null fallback.

## Blockers and contradictions

1. **Execution authority is internally inconsistent.** `CURRENT_PHASE.md` begins by recording R2A sign-off and a new active slice, but later still states `R2A - Real workspace bootstrap + persisted onboarding`, says R2A is not signed off, and repeats the old live/demo blocker. The R2E brief also still says it is not authorised until `CURRENT_PHASE.md` activates it. This must be reconciled before another agent can safely infer scope.
2. **Real-provider interpretation is not proven.** The code exists, but the benchmark skips 15 of 16 real-provider cases. No claim about production interpretation quality is currently justified.
3. **The complete first-beta gate remains open.** The repository still needs independently evidenced server-authoritative state across the whole signed-in product, arbitrary non-fixture processing, correction/outcome telemetry, two-tenant isolation, and a reproducible review-first loop.
4. **Operational auth/deployment evidence is incomplete.** The auth deployment contract says the production origin value is staged but not deployed, Supabase redirect settings are not externally verified, and built-in SMTP remains testing-only.
5. **No repository CI proof is available.** The current head exposes a successful Vercel status only. It does not expose test, typecheck, or regression status.

## Milestone risk and trend

**First-beta timing risk: high, improving. Product-thesis risk: low to medium, stable.**

Risk improved because the previous R2A fixture-leak blocker has a source-level correction, the live loop has browser evidence, and interpretation now has a bounded architecture. Risk remains high because the sequence is contradictory, real model coverage is absent, and the remaining beta gate spans persistence, arbitrary enquiries, review telemetry, and operational deployment evidence.

The main management risk is now confusing a large volume of polished commits and synthetic/null benchmark passes with demonstrated external first-beta readiness.

## Next three priorities

1. Reconcile `CURRENT_PHASE.md`, `PHASE_REGISTRY.md`, the R2E brief, and the critique so one explicit authority states whether R2A is signed off and exactly what interpretation work is authorised.
2. Independently verify the active interpretation slice with a configured provider, null/failure fallback, adversarial input, deterministic evaluator enforcement, and exact test/typecheck/build results. Keep model quality claims separate from synthetic benchmark claims.
3. Close the first-beta evidence gaps in sequence: reproducible persisted live workspace proof, two-tenant isolation, non-fixture enquiry review, correction/outcome telemetry, and deployment/auth/SMTP readiness. Do not add broader integrations or visual phases to compensate.

## Evidence and confidence

- **High confidence:** current branch, commit history, actual source guards, benchmark contents, phase-document contradiction, and Notion product principles.
- **Medium confidence:** real-browser live-loop claims, because the verification is described in a committed evidence note but the detailed dossier is external and not tracked.
- **Low or unknown:** real Anthropic interpretation quality, current customer validation, paid conversion, retention, production auth deployment state, and full test status. No CI evidence was available for the reviewed head.

## Implementation handoff

Read `docs/CURRENT_PHASE.md` first, but stop and resolve its contradictory R2A/R2E instructions before extending the implementation. Preserve the cross-industry Decision Object boundary, explicit demo/live separation, null fallback, deterministic authority, human approval, and no-fake-integration rules. Any next implementation slice must report exact evidence and must not self-certify phase completion.
