# Enquiry - Independent Progress Critique

**Review date:** 2026-11-02 (Australia/Brisbane)  
**Default branch head reviewed:** [`59bfa78`](https://github.com/Mrsavage92/enquiry/commit/59bfa7851fbd8f97c4c49e091628222d3a01c54f) on `main`  
**Comparison baseline:** previous critique commit [`6de6e66`](https://github.com/Mrsavage92/enquiry/commit/6de6e666f8c49fda5e27079adf7b8645c41c6321)  
**Execution authority:** [`docs/CURRENT_PHASE.md`](./CURRENT_PHASE.md), not this critique

## Verdict against the enquiry-to-booking vision

**There is real product movement in the review-to-action part of the journey, but the current candidate is not safe for first beta. Governance and production-schema risk have worsened to critical.**

PR [#81](https://github.com/Mrsavage92/enquiry/pull/81) materially improves the middle of the vision:

> messy inbound enquiry -> understood Decision Object -> relevant checks -> minimum blocker -> explainable next action -> human-authorised action

The merged laser screen reduces interaction cost, keeps Copy distinct from "sent", preserves warnings and refusals, improves greeting and coverage handling, and persists a seven-day copied marker. PR [#87](https://github.com/Mrsavage92/enquiry/pull/87) restores a usable sign-out path. These are genuine product and operational improvements, not only visual or documentation activity.

The candidate still does not prove the complete vision:

> later customer update -> recomputed decision -> booked or lost -> downstream handoff

Current source still routes customer updates, quote acceptance, lost state and external booking confirmation through prototype-store actions. No new server-authoritative outcome-loop evidence, durable beta telemetry, successful real-provider benchmark or completed beta-gate item appeared.

More seriously, PR #81 merged despite `CURRENT_PHASE.md` still naming UI1 as the sole active slice and despite the previous critique's explicit hold for authority, migration sequencing, independent review and device evidence. GitHub records no review or review thread for the PR. The merge also introduced migration `0014_laser_send.sql`, while the repository contains no evidence that it was applied to production before deployment.

## What materially moved since the previous review

| Area | Observed movement | Assessment |
|---|---|---|
| Default branch | Two product commits landed after `6de6e66`: PR #81 at `9d282b9` and PR #87 at `59bfa78`; integrated comparison changes 92 files | Material code movement |
| Laser flow | One-screen phone/desktop review flow, reduced taps, safer greeting and coverage logic, Copy/sent separation, persisted copied state | Real enquiry-to-action progress |
| Account operations | Desktop account menu and mobile Account page now expose sign-out | Real baseline usability fix, not core vision progress |
| PR #81 integration | Rebased onto the prior product head before merge; Vercel is green | Previous stale-branch issue closed |
| Independent review | No GitHub PR review, review thread or Actions run exists for #81 | Required evidence absent |
| Final-head validation | PR body claims 1,388 tests at earlier branch commit `c8f70d7`; no equivalent evidence is attached to final merge `9d282b9` or current head | Implementation claim, not independently reproduced |
| Production schema | `0014_laser_send.sql` adds `reviewed_send.coverage_key` and `copied_at`; current code reads and writes both | Runtime dependency landed; production application unknown |
| Device/accessibility evidence | PR records no iPhone testing, no 200% text walk and other incomplete acceptance checks | Safe-beta proof did not move enough |
| Readiness gates | Beta remains 0/92; public traffic remains 6/23 | No milestone-gate movement |
| Notion sources | Product HQ, strategy, decisions, roadmap, validation and growth sources show no relevant update after September | No new external authority or decision evidence |

## Important decisions

- **[Observed]** Copy is not treated as sent. A copied reply is stored as a temporary marker; the owner must later confirm "Sent it?" before a send is recorded.
- **[Observed]** Coverage confirmation can be folded into the owner-authorised send only when the decision's stored coverage key still matches.
- **[Observed]** Greeting uses a customer name only when the evidence threshold is met; otherwise the reply uses "Hi there".
- **[Observed]** SMS and WhatsApp deep links remain behind a default-off flag.
- **[Observed]** `CURRENT_PHASE.md`, `PHASE_REGISTRY.md` and `AGENTS.project.md` were not updated to authorise the merged slice. UI1 remains the documented execution authority; R2E/R2F remain prepared but not authorised.
- **[Implementation claim]** PR #81 says its browser walks, typecheck, lint, build and 1,388 tests passed on its branch.
- **[Inference]** Merging the implementation did not itself change phase authority or sign off readiness. Repository policy explicitly forbids inferring permission from landed code.

## Blockers

1. **Production migration state is unknown and potentially service-breaking.** Current workspace loading calls `loadCopied`, which selects `reviewed_send.copied_at`; the copy and send paths update `copied_at` and read/write `coverage_key`. If migration 0014 was not applied, authenticated workspace and laser-flow requests can fail at runtime. A green Vercel build does not prove the production database schema.
2. **The merged slice lacks the required independent review.** `CLAUDE.md` requires independent review before merge and re-review after fixes. GitHub shows no review record or review threads for #81.
3. **Execution authority contradicts deployed code.** UI1 remains the sole active slice, while the broad 88-file laser-flow PR is now on `main`. The authority conflict warned about in the previous critique became an actual merge.
4. **Final integrated validation is incomplete.** PR #81's test claim is tied to an earlier branch commit. There is no Actions run for the final merge/current head, no iPhone evidence, no 200% text walk and no full recorded tap-path/device matrix.
5. **The lifecycle remains incomplete.** Customer updates, acceptance, lost outcome and external booking confirmation still use prototype-store paths; downstream handoff is not demonstrated.
6. **Decision-quality and provider evidence remain weak.** Previously recorded count, date, question, money-word, service-area and rule-reading defects have no new closure evidence. The latest checked-in real-provider benchmark remains 2026-09-07 at 1 pass / 15 skipped, with no actual successful provider interpretation.
7. **Telemetry and readiness remain unproven.** The beta telemetry spec has no demonstrated production events, the beta gate is 0/92 and the public-traffic gate is 6/23.

## Milestone risk

| Risk | Level | Trend | Evidence |
|---|---|---|---|
| Production runtime/schema | **Critical** | **New / worsening** | Migration 0014 is required by current reads and writes; application evidence is absent |
| Phase authority and sequencing | **Critical** | **Worsened** | PR #81 merged while UI1 remains the only authorised slice |
| First-beta readiness | **High** | **Slightly improving, still blocked** | Operator action path improved; lifecycle, device, provider, telemetry and gate evidence did not |
| Human-authorised reply safety | **Medium-High** | **Improving** | Copy/sent separation, warning preservation, greeting and coverage safeguards landed |
| Decision correctness | **High** | **Flat** | Known interpretation defects have no new regression closure |
| Validation quality | **High** | **Worsened relative to change size** | Large merge, no recorded independent review or final-head Actions evidence |
| Booked/lost/handoff completion | **High** | **Flat** | Prototype-store outcome paths remain |
| Public/commercial readiness | **High** | **Flat** | 17 public-traffic items and founder/legal decisions remain open |

There is still no evidence-backed milestone date to revise. The merged UX work shortens the owner path, but it does not remove the beta-critical lifecycle, validation or operational blockers.

## Next three priorities

1. **Prove the production schema and live authenticated path immediately.** Confirm migration 0014 is present in production, applying it through the established migration process if absent. Then smoke-test authenticated workspace load, prepare/copy, return after reload, "Sent it?", undo and sign-out against the deployed current head. Record exact evidence; do not treat Vercel success as database proof.
2. **Restore governance and independently review the integrated slice.** Reconcile `CURRENT_PHASE.md` through the authorised product-management process, but do not edit it from this critique. Perform a post-merge independent review of #81 at current head, including the full suite, tenant isolation, attack cases, iPhone/device checks, 200% text and reduced-motion checks. Hold further product merges until critical findings and authority are resolved.
3. **Close the durable outcome loop when explicitly authorised.** Move later inbound updates, recomputation, booked/lost and downstream handoff onto server-authoritative paths, add production telemetry, then rerun the real-provider non-fixture benchmark and readiness gates. Preserve the merged Copy-not-sent and warning/refusal semantics.

## Evidence and confidence

**Observed facts, high confidence:** two integrated commits and their actual diff; PR states, file counts, review records and status checks; current repository source; migration 0014 contents; unchanged authority and phase files; current gate counts; dated benchmark; unchanged Notion source edit history.

**Implementation claims, not independently reproduced:** PR #81's 1,388 passing tests and browser walks; PR #87's local checks; prior handover production checks; any production migration application outside the repository.

**Inferences:** PR #81 is genuine product progress but not safe-beta completion; absence of migration evidence creates a critical runtime risk because current code directly references the new columns; merging without documented authority materially worsens governance risk.

**Unknowns:** actual production migration 0014 state, final-head full-suite result, live authenticated laser-flow behaviour, real-device behaviour, deployed feature flags and environment keys, live-provider quality, beta telemetry delivery and any founder decision not recorded in connected sources.

## Practical handoff for the implementation agent

- Start from current `main` at `59bfa78`; read `AGENTS.project.md` and `CURRENT_PHASE.md` before acting.
- Do not begin another feature. First produce evidence for migration 0014 and the live authenticated laser path.
- Review PR #81 as integrated code, not as an accepted claim. Run checks against current head and record command, commit, result, device and environment.
- Preserve Copy != sent, exact-text/revision prechecks, warning/refusal behavior, safe greeting fallback and coverage-key validation.
- Do not use this critique to alter phase authority, acceptance criteria or sequencing. Escalate the authority mismatch to the owner of `CURRENT_PHASE.md`.
- Do not mark UI1, R2E, R2F, beta readiness or public readiness complete from this review.
