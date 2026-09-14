# Enquiry - Implementation Phase Registry

Updated: 2026-09-14 (Australia/Brisbane).

**Execution authority: [CURRENT_PHASE.md](./CURRENT_PHASE.md).** A prepared phase, a commit label or an existing implementation is not a sign-off.

## Current decision

**UI1 - Core experience redesign is the current implementation slice.** The product owner authorised UI1 on 2026-09-10. It landed on `main` at [47a8d29](https://github.com/Mrsavage92/enquiry/commit/47a8d29ba66f19d6280cd2c2ead4b9bc5a360be7), but independent UI1 review and owner visual acceptance remain open. [PR #20](https://github.com/Mrsavage92/enquiry/pull/20) is an open refinement and is not merged.

CC1 landed in the release merge [PR #16](https://github.com/Mrsavage92/enquiry/pull/16) on 2026-09-09. Its commercial safeguards are part of the current baseline, but CC1 landing did not pass the first-beta or public-traffic gates. The older CC1-only status below is historical and no longer defines the active slice.

## Operating rule

1. Read `AGENTS.project.md`, `docs/CURRENT_PHASE.md` and the named package.
2. Inspect the actual branch and establish a pre-change baseline.
3. Implement only the authorised slice, including its ordered internal steps.
4. Run checks, document exact evidence and report remaining blockers.
5. Stop for independent review. Do not self-certify release or start another phase.

## Registry

Earlier completion labels below preserve recorded management decisions; this package did not rerun those historical gates.

| Phase | Status | Purpose / boundary |
|---|---|---|
| 0 | Complete, previously recorded | Product/build guardrails |
| 1 | Complete, previously recorded | Public positioning |
| 2A | Complete, previously recorded | Signature cross-channel demo |
| 2B | Complete, previously recorded | Signature proof in sales journey |
| 3 | Complete, previously recorded | Remove universal pricing assumptions in reviewed scope |
| 4 | Complete, previously recorded | Curated public roadmap |
| 5 | Complete, previously recorded | Early Access and Updates copy |
| 6 | Complete, previously recorded | Roadmap feedback persistence |
| 7A / 7B | Deferred | Broader identity/contact matching and review UX |
| 8 | Complete, historical coherence gate | Not a release test of the present live product |
| 9A | Landed; external visual/runtime gate unresolved here | Preserve existing direction |
| R1A | Complete, previously recorded | Launcher and full test discovery |
| R1B | Code remediation recorded; external rotation unverified here | Operational public-traffic gate remains |
| R1C / R1C1 | Complete, previously recorded | Auth and same-origin return paths |
| R1D | Complete, previously recorded | Demo/local public-link containment |
| R1 Final | Repository/runtime pass previously recorded | External operational/public gates remain separate |
| R2A | Sign-off recorded at `d382f2d` in prior authority | Preserve onboarding and live/demo safeguards |
| R2B | Existing implementation; full phase sign-off not established by CC1 | Persisted tenant reads; preserve and regression-test affected paths |
| R2C | Existing implementation; full phase sign-off not established by CC1 | Brain/trust persistence; no broad expansion |
| R2D | Existing implementation; full phase sign-off not established by CC1 | Enquiry mutations; CC1 fixes only relevant consistency paths |
| R2E | Bounded interpreter source exists; full phase/provider gate not signed off here | Existing interpreter maintenance for CC1 only |
| R2F | Manual review/recording source exists; full phase/telemetry gate not signed off here | CC1 repairs truthful action semantics only |
| CC1 | Landed on `main` via PR #16; independent phase/beta sign-off not recorded | Five commercial defects plus necessary transaction/version safeguards |
| UI1 | Landed on `main` at `47a8d29`; independent review and owner visual acceptance open; PR #20 not merged | Core operator experience redesign |
| 10A | Prepared, not active | PWA installability and branding |
| 10B | Prepared, not active | Installed mobile shell polish |

The live decision path remains narrower than the full cross-industry product contract. This registry does not certify broader evaluator selection merely because historical demo/coherence phases were completed.

## Current sequence

**UI1 owner acceptance and independent review -> exact-head verification -> explicit next product slice -> complete first-beta engineering gate -> subsequent public/mobile phases when authorised.**

Do not mechanically restart or complete R2B-R2F from old instructions. Review existing implementation and remaining acceptance gaps when product management chooses the next slice. No percentage-complete estimate or completion-by-commit-count is implied.

## Detailed references

- Active: [CURRENT_PHASE.md](./CURRENT_PHASE.md), [UI1 working direction](./design/UI1_QUIET_SIGNAL_WORKING_DIRECTION.md), [UI1 visual direction](./design/UI1_VISUAL_DIRECTION_V2.md), and open [PR #20](https://github.com/Mrsavage92/enquiry/pull/20). CC1 evidence remains at [the implementation report](./implementation/CC1_COMMERCIAL_CORRECTNESS/IMPLEMENTATION_REPORT.md) and [commercial review](./reviews/2026-09-07_COMMERCIAL_CORRECTNESS_REVIEW.md).
- Product contract: `AGENTS.project.md`; original programme: `docs/PRODUCT_CHANGE_PLAN.md`.
- R2 parent: `docs/phases/PHASE_R2_PERSISTED_OPERATOR_CUTOVER.md`.
- R2A: `docs/phases/PHASE_R2A_REAL_WORKSPACE_ONBOARDING.md`.
- R2B: `docs/phases/PHASE_R2B_SERVER_AUTHORITATIVE_RUNTIME.md`.
- R2C: `docs/phases/PHASE_R2C_PERSISTED_BRAIN_TRUST.md`.
- R2D: `docs/phases/PHASE_R2D_PERSISTED_ENQUIRY_DECISIONS.md`.
- R2E: `docs/phases/PHASE_R2E_ARBITRARY_ENQUIRY_INTERPRETATION.md`.
- R2F: `docs/phases/PHASE_R2F_REVIEW_FIRST_BETA_LOOP.md`.
- Phase 7: `docs/phases/PHASE_7_SAFE_IDENTITY_CONTINUITY.md`.
- Phase 8: `docs/phases/PHASE_8_FINAL_COHERENCE_QA.md`.
- Phase 9: `docs/phases/PHASE_9_VISUAL_BRAND_POLISH.md`; 9B: `docs/phases/PHASE_9B_PUBLIC_SURFACES_POLISH.md`.
- Phase 10: `docs/phases/PHASE_10_INSTALLABLE_PWA_MOBILE.md`; pre-audit: `docs/PHASE_10_PWA_PRE_AUDIT.md`.
- R1: `docs/phases/PHASE_R1_RELEASE_BLOCKER_STABILISATION.md`, `docs/phases/PHASE_R1_FINAL_STABILISATION_GATE.md`, `docs/phases/R1_FINAL_GATE_RESULT.md`.

These briefs remain historical/design references unless the current authority activates their scope. Their older sequencing text does not override the current UI1 authority. Preserve existing safety requirements; do not use this index to waive a beta/public gate.

## Cross-cutting gates

`docs/TEST_REGRESSION_POLICY.md`, `docs/BETA_READINESS_GATE.md`, `docs/PUBLIC_TRAFFIC_GATE.md`, `docs/AUTH_DEPLOYMENT_CONTRACT.md`, `docs/R2_LIVE_DEMO_SEPARATION_MAP.md`, `docs/R2_ACTION_SEMANTICS_MATRIX.md`, `docs/R2_TYPED_BUSINESS_RULE_CONTRACT.md`, `docs/evals/FIRST_BETA_NON_FIXTURE_EVAL_PACK.md`, `docs/BETA_TELEMETRY_SPEC.md`.

Real auth/tenant isolation, persisted live state, arbitrary enquiry processing, correction/outcome evidence and honest action semantics remain first-beta requirements. Production mailbox/social/payment integrations and a native app remain outside the first-beta prerequisite list.

## Stop and escalation conditions

Report a material product-contract conflict, new security/data-loss risk, incompatible concurrent work or a change requiring a broad architecture/product decision. Do not hide failures, weaken tests or invent authority. Lack of a provider key or browser/test database does not prevent safe in-scope coding, but the unavailable gate stays blocked until actually verified.

Keep the boundary: first enquiry -> correct next decision/action -> booked or lost -> downstream handoff. Do not expand into CRM, generic workflow-building, payments, complex identity graphs or fulfilment to avoid closing the current defects.
