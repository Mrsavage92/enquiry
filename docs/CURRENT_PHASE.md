# Enquiry - Current Implementation Phase

Updated: 2026-09-07 (Australia/Brisbane).

## Active slice: CC1 - Commercial correctness and truthful action recording

**Status: AUTHORISED FOR IMPLEMENTATION. Not implemented or signed off by this package.**

Product-owner instruction on 2026-09-07: add the commercial-correctness review to GitHub as a package for Claude to implement. This authorises the bounded CC1 correction below, not a rewrite, general R2 completion, deployment or external beta release.

Start here: [CC1 implementation package](./implementation/CC1_COMMERCIAL_CORRECTNESS/README.md).

Read `AGENTS.project.md`, this file, the package and its linked review before editing. The package contains the implementation order, source map, acceptance cases, executable diagnostic probes and required handoff.

## Exactly what Claude should implement

- CC1-01 / review P1-01: preserve quantity meaning; never turn ranges, alternatives or negatives into a different exact quantity.
- CC1-02 / P1-02: resolve service/rule ambiguity explicitly, never by rule-array order.
- CC1-03 / P1-03: enforce owner confirmation of model-proposed commercial service identity.
- CC1-04 / P1-04: separate copying a draft from confirming an actual external send.
- CC1-05 / P1-05: keep reviewed message, structured price and recorded quote consistent; protect stale approvals.
- CC1-06 / P2-01: transaction/revision safeguards directly necessary to keep related facts, decisions and sent records consistent.

Follow the package sequence within this one authorised slice. Do not stop for a new phase approval between its implementation steps. Run the specified checks, record the evidence and stop for independent review at the end. An unavailable verification environment must be reported as a blocker, not silently treated as a pass.

## Current status and historical reconciliation

- The previous authority recorded R2A sign-off at `d382f2d`. Preserve that recorded decision; do not reopen the old live/demo transition fix merely because an archived instruction calls it active.
- A real manual first-beta loop was reported browser-verified on 2026-09-03. Its detailed external dossier has not been independently rerun by this package, and that historical result does not clear the commercial defects found subsequently.
- Approval-preview and interpreter/null-fallback source now exists. The former statement that interpretation had not started is obsolete. Existence is not full R2E sign-off or proof of real-provider quality.
- Full R2B-R2F completion and the complete first-beta gate are not certified here. Existing work must be preserved and evaluated, not assumed absent or complete from a phase label.
- The prior current-phase file is preserved byte-for-byte in [history](./history/2026-09-07_CURRENT_PHASE_PRE_CC1.md). Its contradictory R2A-only and prior active-slice instructions are historical, not current execution authority.

The [registry](./PHASE_REGISTRY.md) reflects this bounded sequencing update. `AGENTS.project.md` remains the product contract. This file is the current execution authority; the CC1 package supplies the detailed brief.

## Preserve

Keep server-side auth/membership checks, tenant isolation, explicit demo separation, raw-message persistence before best-effort interpretation, deterministic commercial validation, proposed-fact provenance, AUD-only supported money semantics and human action authority. The original review remains an immutable historical assessment of its stated commit.

## Not authorised by CC1

No production mailbox/social/SMS/payment/calendar/booking integration programme; no visual redesign or PWA phase; no new broad evaluator family, generic rules engine or CRM; no model upgrade; no unrelated refactor; no automatic legacy financial-data rewrite. Necessary focused migrations, UI corrections, transaction helpers and tests for CC1 are permitted. Do not modify production data, rotate credentials, auto-merge or deploy merely because this package is authorised.

## Completion and release gates

Use the package's [acceptance matrix](./implementation/CC1_COMMERCIAL_CORRECTNESS/ACCEPTANCE.md), [handoff template](./implementation/CC1_COMMERCIAL_CORRECTNESS/HANDOFF_TEMPLATE.md) and `docs/TEST_REGRESSION_POLICY.md`.

The implementer reports implemented/verified/blocked status separately. Independent review, not the implementer, signs off CC1 and decides subsequent R2 sequencing. `docs/BETA_READINESS_GATE.md` and `docs/PUBLIC_TRAFFIC_GATE.md` remain open unless separately evidenced and approved. Historical credential rotation, auth/deployment and visual/public-claim checks are not cleared by this document.

Current sequence: **CC1 implementation -> independent review -> explicit next R2 decision -> first-beta gate.** Later visual/PWA phases remain deferred to their own authority.
