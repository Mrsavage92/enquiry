# Enquiry - Independent Progress Critique

> Independent, evidence-based management review for Codex, Claude, Cursor, and other agents.
>
> `docs/CURRENT_PHASE.md` remains the execution authority for scope, sequencing, acceptance criteria, and sign-off. This critique does not authorise later work or sign off any phase.

## Review metadata

- Review date: 2026-09-21
- Repository head reviewed: [32ccfcc - finish the public-site critique loop](https://github.com/Mrsavage92/enquiry/commit/32ccfccd9cae2997104b7ced6fae443ee7e58d4e)
- Previous critique commit: [d192390](https://github.com/Mrsavage92/enquiry/commit/d1923906416ae14bd9af27f8625af3563dba7229)
- Change span: 62 commits on `main`, from the prior reviewed head [47a8d29](https://github.com/Mrsavage92/enquiry/commit/47a8d29ba66f19d6280cd2c2ead4b9bc5a360be7) through 2026-09-19
- Review boundary: current `main`; open PR #21 is a documentation handover and is not counted as landed product progress
- Authority and gates: [CURRENT_PHASE.md](./CURRENT_PHASE.md), [PHASE_REGISTRY.md](./PHASE_REGISTRY.md), [BETA_READINESS_GATE.md](./BETA_READINESS_GATE.md), [TEST_REGRESSION_POLICY.md](./TEST_REGRESSION_POLICY.md), [AGENTS.project.md](../AGENTS.project.md)
- Product sources: [Product HQ](https://app.notion.com/p/3c6116e8bef281f9b166fb7a964a7a58), [strategy](https://app.notion.com/p/3c6116e8bef28171aab5ee334e52c852), [decision log](https://app.notion.com/p/3c6116e8bef281c7ba4bc14ba0568bdf), [decision engine](https://app.notion.com/p/3c6116e8bef28140a096e39bfa98d682), [validation](https://app.notion.com/p/3c6116e8bef28191b38cc4eaa0979b0d), [Growth and Launch HQ](https://app.notion.com/p/3c7116e8bef2810cb59ad235086c6b34), and [launch plan](https://app.notion.com/p/3d6116e8bef281268755e622aedbebdf)

## Executive verdict

**Meaningful progress landed in public proof, onboarding safety, and launch hygiene. The core enquiry-to-booking product is not yet proven as a safe first-beta system. First-beta risk remains high, with a mixed trend.**

The strongest product-facing movement is the two-business demo: the same customer message now produces different answers for Ridge and Harbour because their business rules differ, and a changed fact moves each answer for its own reason. That is a credible demonstration of the wedge described in Notion: business-specific reasoning before booking.

It is still a fixture-backed public demonstration. There is no current evidence that the same loop works for an arbitrary live tenant, with real provider interpretation, server-persisted Decision Objects, correction history, and a truthful booked/lost handoff.

## Vision trace

| Vision stage | Current assessment |
| --- | --- |
| Messy inbound enquiry | Demonstrated in fixtures and public demo; arbitrary live input remains unproven. |
| Understood Decision Object | Stronger public explanation and existing source contracts; current-head live persistence is not independently verified. |
| Relevant business checks | Two different sample Business Brains now change the answer; live evaluator selection and provider quality remain unknown. |
| Minimum decision blocker | Visible in sample reasoning and `Why this reply?` affordances; beta evidence is incomplete. |
| Explainable next action | Public demo and retained reply evidence improve explainability; no complete current-head operator proof. |
| Human-authorised action | Product boundaries preserve review/copy/record distinctions; full live journey remains unverified. |
| Booked or lost | No material new evidence this period. |
| Downstream handoff | No material new evidence this period. |

## What materially moved

### 1. The product wedge is clearer and more testable

**Observed fact:** [c33df5b](https://github.com/Mrsavage92/enquiry/commit/c33df5bcf15c8f0162157710d6200819421411f5) added Harbour Painting to the signature demo. Tests pin identical input, different business rules, changed facts, no invented price, and safe fallback for an unknown business id.

**Assessment:** This is real product narrative and prototype progress, not merely visual polish. It directly tests the claim that Enquiry makes business-specific decisions rather than acting as a generic inbox or AI receptionist. It is not yet production or cross-industry validation evidence.

### 2. Onboarding became safer without pretending a draft is saved

**Observed fact:** [0013e88](https://github.com/Mrsavage92/enquiry/commit/0013e88a0c5c769329ecbaa79b5e58530bb64072) persists an onboarding draft in browser session storage, restores it after reload, submits stage one on Enter, and clears the draft only after the server confirms the atomic workspace creation. The review screen still says the data is not saved.

**Assessment:** This is useful first-beta UX and trust progress. It reduces abandonment risk while preserving server authority. It does not prove zero-membership onboarding, reload persistence of the whole live workspace, or tenant isolation at the current head.

### 3. Public-site and early-access readiness improved substantially

**Observed facts:**

- UI1 public-site work now has explicit evidence for responsive layouts, accessibility contracts, honest sample labelling, roadmap feedback, visual references, and reduced-motion source safeguards.
- [a402156](https://github.com/Mrsavage92/enquiry/commit/a40215607fb2f413f58690ff9cc80b9fc3900c56) added support/contact wording, processor and retention disclosures, error alerting hooks, a staged cohort operating model, and a first-20 invitation constraint.
- [32ccfcc](https://github.com/Mrsavage92/enquiry/commit/32ccfccd9cae2997104b7ced6fae443ee7e58d4e) corrected early-access pricing to A$29/month with higher tiers deferred, made the walkthrough readable at phone scale, added business-type chips, and settled the hero motion.
- [8b6b79e](https://github.com/Mrsavage92/enquiry/commit/8b6b79efe02b65348a67d561b8d5b5ceecccb36f) keeps the evidence explanation reachable after a reply is recorded.

**Assessment:** This is credible customer-facing and trust progress. It is mostly presentation, acquisition, and operational readiness, not new decision-engine capability.

### 4. Phase governance is materially more coherent than last review

**Observed fact:** The current phase and registry now describe UI1 as landed on `main`, independently unreviewed, and still awaiting owner acceptance, while CC1 evidence is treated as historical rather than as automatic beta sign-off. The active sequence is UI1 review and exact-head verification, then the next authorised slice and beta gate.

**Assessment:** The earlier direct contradiction between the phase documents has been reduced. The remaining risk is not authority ambiguity so much as the widening public-site surface relative to the still-open beta proof.

## Important decisions

- The owner-authorised UI1 continuation is public/customer-facing work. Its evidence explicitly says it does not sign off the operator beta, authentication, provider readiness, or public traffic.
- The pricing decision is now deliberately narrower and more honest: A$29/month for early access, with A$49 and A$79 retained as deferred hypotheses.
- The demo now makes the cross-industry, business-specific reasoning thesis visible without claiming a live integration or a sent/booked action.
- Onboarding keeps atomic server creation. Browser draft recovery is convenience only and must not become the durable source of truth.
- The Notion product sources remain strategically aligned with the repository: AI interprets, deterministic systems validate important outcomes, the owner authorises consequential actions, and the boundary is first enquiry to booked or lost. The Notion pages are largely unverified and older than the reviewed code, so they are strategy context, not release evidence.

## Blockers and unknowns

1. **The first-beta gate remains open.** Every required section in [BETA_READINESS_GATE.md](./BETA_READINESS_GATE.md) is still unchecked, including two-tenant isolation, live non-demo onboarding, arbitrary non-fixture processing, correction persistence, telemetry, and exact-head verification.
2. **Hosted authentication evidence is mixed.** The earlier launch audit records one successful sign-in reaching `/auth/complete` and onboarding. The newer auth repair documentation says post-repair inbox delivery and a completed authenticated session still require confirmation. Treat production sign-in as not independently closed until the evidence is reconciled.
3. **Operational launch blockers remain owner-side.** The early-access handover still calls for custom SMTP, `ALERT_WEBHOOK_URL`, a production `ANTHROPIC_API_KEY) check, and external Grok credential revocation. The repository cannot prove those dashboard and credential states.
4. **Current-head verification is incomplete.** The reviewed head has a successful Vercel status, but no GitHub Actions workflow run. Historical full-suite, browser, and visual claims are useful evidence but are not a fresh exact-head release ledger.
5. **The core outcome loop has not materially moved.** There is no new evidence for real-provider quality, non-fixture Decision Objects, correction and outcome telemetry, booked/lost completion, or downstream handoff.

## Milestone risk and trend

- **First-beta risk: high.** Improving in public trust, onboarding ergonomics, and demo clarity; flat on live core-product proof.
- **Public launch risk: high.** The website is increasingly ready to attract attention, while auth/email/provider/credential gates are not all independently closed.
- **Product-thesis risk: low to medium.** The two-business demo strengthens the thesis, but it remains fixture evidence.
- **Governance risk: medium, improving.** Phase documents are more coherent, but broad UI continuation can still create a misleading sense of beta readiness.

The main management risk is sequencing: visible public progress is accelerating faster than evidence for the operator loop that must turn an enquiry into a safe, explainable, authorised outcome.

## Next three priorities

1. **Produce one exact-head beta candidate ledger.** Run typecheck, full test discovery, focused product regressions, build, auth, zero-membership onboarding, two-tenant isolation, reload persistence, desktop/phone QA, and reduced-motion checks against one chosen commit. Classify every remaining failure using [TEST_REGRESSION_POLICY.md](./TEST_REGRESSION_POLICY.md).
2. **Close and evidence the operational gates.** Reconcile the hosted sign-in result, custom SMTP, production Anthropic configuration, alert webhook, domain decision, and historical credential revocation. Record dashboard or runtime proof, not implementation claims.
3. **Prove the differentiating live loop before expanding public scope.** Use an arbitrary non-fixture enquiry and at least two tenant-specific Business Brains to show interpretation, relevant evaluator selection, one minimum blocker, explanation, owner correction/approval, recorded response, booked/lost outcome, downstream handoff, and structured telemetry.

## Evidence and confidence

- **High confidence:** current repository source, commit diffs, current phase and registry, beta gate text, current-head Vercel status, and the committed public-site and onboarding evidence.
- **Medium confidence:** implementation reports and browser checks from earlier commits, including the deployed waitlist and sign-in audit. They are specific but not all current-head or independently rerun.
- **Low or unknown:** current hosted environment variables, SMTP reliability, exact-head full-suite result, live provider quality, live tenant isolation, customer activation, payment intent, retention, booked/lost behaviour, and downstream handoff.

## Implementation handoff

Read [CURRENT_PHASE.md](./CURRENT_PHASE.md) first. Treat the public-site work as customer-facing progress, not beta sign-off. Preserve the server-authoritative onboarding boundary, demo/live separation, deterministic commercial rules, provenance, review-first action authority, and the explicit distinction between copied, recorded, and sent responses. Attach the next release evidence to one exact commit. Do not self-sign UI1, CC1, R2E/R2F, the beta gate, or the public traffic gate.
