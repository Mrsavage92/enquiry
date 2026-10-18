# Enquiry - Independent Progress Critique

**Review date:** 2026-10-19 (Australia/Brisbane)  
**Product head reviewed:** [`02cf586`](https://github.com/Mrsavage92/enquiry/commit/02cf58674e130e3ff68aecba3b788b96863d3b6e) on `main`  
**Previous critique commit:** [`2d30621`](https://github.com/Mrsavage92/enquiry/commit/2d30621731e5efe32aa4d81f68e9c447886282ab)  
**Execution authority:** [`docs/CURRENT_PHASE.md`](./CURRENT_PHASE.md), not this critique

## Verdict against the enquiry-to-booking vision

**Material product progress, but not a safe first-beta candidate. Risk is improving overall, with an urgent sequencing problem.**

The merged trust pass advances the middle of the vision in a meaningful way:

> messy inbound enquiry -> understood Decision Object -> relevant checks -> minimum blocker -> explainable next action -> human-authorised action

Date extraction, closed-day handling, ledger completeness, removal of app-authored availability promises, owner-edit warnings and the reviewed-send gate all reduce the chance of an unsafe commercial reply. The current head also has a successful Vercel status, so last week's dependency deployment blocker is no longer active.

The end of the vision remains incomplete:

> later customer update -> recomputed decision -> booked or lost -> downstream handoff

Current source still routes `acceptQuote`, `markLost`, `receiveClientReply` and `confirmExternalBooking` through the prototype store. Those are not durable server-authoritative lifecycle evidence. The real-provider benchmark still contains no successful Anthropic interpretation run, beta telemetry remains a prepared specification rather than observed evidence, and all 92 first-beta gate items remain unchecked.

The largest management risk is now authority drift. `CURRENT_PHASE.md` and `PHASE_REGISTRY.md` still define UI1 as the only active slice, while substantial R2E/R2F-adjacent decision, interpretation and send behaviour has merged. The new Claude handover correctly says the critique does not authorise work, but it cannot cure that contradiction.

## What materially moved since the previous review

| Movement | Classification | Independent assessment |
|---|---|---|
| PR #80 trust pass merged as `02cf586` | **Observed product movement** | Real progress in decision correctness and human-authorised send safety: broader date detection, closed-day checks, ledger coverage, safer promises, owner-edit warnings and exact acknowledgement of send risk. |
| TanStack Start upgraded in PR #85 | **Observed operational movement** | The CVE-based Vercel block was removed. GitHub reports Vercel success for the exact reviewed head. |
| Public price, unsubscribe, privacy and terms work merged in PR #83 | **Observed public-trust movement** | Reduces misleading offer and compliance risk. It does not prove operator beta readiness. |
| Engine-backed trade examples and share card merged in PR #84 | **Observed visual/marketing movement** | More honest product proof than fabricated examples, but mostly public-site progress rather than completion of the enquiry lifecycle. |
| Claude handover, live-check script and research briefs merged in PR #86 | **Observed documentation movement** | Improves agent orientation. The claimed 12/12 live check is implementation evidence, not independently reproduced in this review. |
| PR #81 remains open | **Not counted as progress** | It is a large interaction rewrite based on stale history and is not validated against current `main`. Its test and tap-count claims do not apply to the released candidate. |
| Connected Notion sources | **No material movement** | Product HQ, strategy, decisions, architecture, validation, growth and launch pages remain unverified and were last edited between 2026-08-24 and 2026-09-11. They provide intent, not current execution truth. |

Five commits landed after the prior critique. This is not merely visual or documentation activity: PR #80 and PR #85 materially improve the candidate. However, none closes the durable booked/lost/handoff path or establishes a beta gate result.

## Important decisions and their status

- **[Observed] Human authority remains explicit.** Prepared money can pass unchanged; owner-added or changed money is warned and must be acknowledged; hard contradictions are refused.
- **[Observed] Public offer truth is centralised.** The repository now states A$15/month for founding members and A$29 after public launch, with payments not yet open.
- **[Observed] Founder-only commercial decisions remain open.** GST/ABN, a founding-price subscription cut-off and paid-subscription terms still require the founder.
- **[Observed] `CLAUDE.md` points agents to `AGENTS.project.md` and the handover.** It rejects only the unrelated sandbox instructions in `AGENTS.md`; it does not replace `CURRENT_PHASE.md`.
- **[Unknown] No current authority decision explains why R2E/R2F-adjacent work is allowed while UI1 remains active.** Existing merged code does not retroactively authorise more of the same.

## Blockers

1. **Execution authority is stale and internally inconsistent.** UI1 remains the active slice even though the merged work materially changes interpretation, business checks and send semantics. This creates high risk that agents use landed code, research briefs or the handover as de facto authority.
2. **The lifecycle is not server-authoritative end to end.** Customer updates, quote acceptance, booked/lost and external booking confirmation still depend on prototype-store actions, so state can fail to persist across devices or sessions.
3. **Decision quality is not proven with the real provider.** The latest checked-in benchmark is dated 2026-09-07: null and fake modes pass, while real mode is 1 pass / 15 skipped and the one pass intentionally makes no provider call.
4. **Known interpretation gaps remain.** The implementation handover records count loss, missed date forms/closed periods, dropped customer questions, money-in-words bypasses, no service-area check and business-rule misreads. Date sweep is focused on initial arrival rather than the full later-update loop.
5. **Release evidence is incomplete.** The exact head has Vercel success but no associated GitHub Actions run. The handover claims 1374/1374 tests and a 12/12 live check; this review did not independently execute either.
6. **Readiness gates remain open.** First beta is 0/92 checked. Public traffic is 6/23 checked, including unresolved external credential revocation, device QA, claim truth and deployed waitlist checks.
7. **Notion cannot resolve current conflicts.** The connected product and growth sources are stale and unverified relative to October repository work.

## Milestone risk

| Risk | Level | Trend | Evidence |
|---|---|---|---|
| First-beta readiness | **High** | **Improving** | Trust/send correctness and deployability improved; durable lifecycle, telemetry, real-provider and gate evidence remain absent. |
| Phase authority and sequencing | **Critical** | **Worsening** | More non-UI behaviour merged while UI1 remains the sole authorised slice; PR #81 is a large pending rewrite. |
| Decision and customer trust | **High** | **Improving** | PR #80 closes several severe defects, but the 77-enquiry probe still identifies material count, date, question, service-area and rule-parsing failures. |
| Deployment and operations | **Medium** | **Improving** | Exact-head Vercel status is successful after the dependency upgrade; broad CI and production-behaviour evidence are still limited. |
| Validation and learning | **High** | **Flat** | No successful real-provider benchmark, no first-beta telemetry evidence and no checked beta-gate items. |
| Public/commercial readiness | **High** | **Improving** | Price/compliance copy is clearer; 17 public-traffic checks and founder/legal decisions remain open. |

## Next three priorities

1. **Reconcile authority before another broad merge.** Product management should update `CURRENT_PHASE.md` and the registry to name the actual authorised slice and boundaries. Until then, do not infer authority from PR #80, the Claude handover or the PR #81 research briefs.
2. **Close the truth-critical engine gaps on current `main`.** Convert the 77-enquiry findings into focused regressions for counts, date variants/closed periods, customer questions, money in words, service area and negated/conditional business rules. Include later customer updates, not only initial intake.
3. **Complete and prove the durable loop when explicitly authorised.** Persist later inbound updates, recomputed Decision Objects, review outcomes, booked/lost and handoff evidence server-side; then run the real-provider non-fixture benchmark, two-tenant isolation, reload persistence, phone/desktop QA, full current-head tests and production smoke before changing any readiness checkbox.

## Evidence and confidence

**High confidence observed facts:** current `main`, five-commit diff since the previous critique, actual changed files, required authority/gate documents, current source search, PR states, exact-head Vercel status and zero GitHub Actions workflow runs.

**Implementation claims, not independently reproduced:** 1374/1374 tests for PR #80, 12/12 production content checks, production application of migration `0013`, the 77-enquiry probe findings and isolated reruns used to classify PGlite failures as memory pressure.

**Inferences:** PR #80 is real product progress because it changes decision and send behaviour, not only presentation. PR #84 is predominantly marketing progress. The candidate is safer than last week but still unsuitable for external businesses processing real enquiries.

**Unknowns:** production migration state beyond the handover, deployed environment keys, real sign-up persistence, external revocation of the historical preview credential, real-device behaviour, live-provider quality and final founder/legal decisions.

## Practical handoff for the implementation agent

- Start from `main` at `02cf586`; re-read `AGENTS.project.md` and `CURRENT_PHASE.md` before changing behaviour.
- Treat PR #81 as unvalidated. Do not merge it merely because its research says decisions are locked; it requires explicit authority, rebase onto current `main`, independent review, migration sequencing and device evidence.
- Preserve PR #80's warning/refusal semantics while adding regressions from the known probe gaps.
- Do not describe focused or isolated test success as a green current-head release suite. Record exact commands, failures, baseline comparison and live evidence.
- Stop after the authorised slice. This critique identifies sequence and evidence needs; it does not sign off UI1, activate R2E/R2F or pass either readiness gate.
