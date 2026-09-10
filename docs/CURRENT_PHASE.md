# Enquiry - Current Implementation Phase

Updated: 2026-09-10 (Australia/Brisbane).

## Active slice: UI1 - Core experience redesign

**Status: UI1 CORE VISUAL REFINEMENT ACCEPTED BY THE ORIGINAL DESIGN REVIEW CHAT. Release approval remains separate.**

PR #19 was merged and deployed, then rejected by the product owner and original design reviewer as an incomplete visual redesign. The corrective implementation is on `codex/ui1-visual-refinement`, based on main commit `47a8d29`. It has not been merged or deployed to production.

The original ChatGPT design conversation reviewed actual before/after screenshots directly on 2026-09-10. Its final verdict was "UI1 core visual redesign: ACCEPTED", subject to checking the mobile reply tray. Browser viewport checks subsequently verified the reply action and complete editable text at reduced heights. Physical iOS/Android keyboard and safe-area testing is still a release QA limitation, not a claimed result.

After reviewing the compact-editor and supporting-screen evidence, the original design chat closed its review: **"Design review: CLOSED / PASS."** No further design round was requested. Physical-device keyboard testing remains an outstanding release-QA item.

See `docs/design/UI1_VISUAL_REFINEMENT_REVIEW.md` for scope, evidence, verification and limitations. This visual acceptance does not close beta readiness, production traffic, integration or correctness gates.

Product-owner instruction on 2026-09-10: implement the UI1 core-experience redesign end-to-end on the dedicated `design/ui1-quiet-signal` branch. This is an authorised presentation and interaction-architecture reset, not a cosmetic spacing pass.

Start here:

- `AGENTS.project.md`
- `docs/design/UI1_VISUAL_DIRECTION_V2.md`
- `docs/design/UI1_QUIET_SIGNAL_WORKING_DIRECTION.md`

The referenced design docs began as research drafts. This file now makes their UI1 direction implementation authority for the operator app, with the corrections in the user handover taking precedence where they are more specific.

## Exactly what Codex should implement

Implement UI1 in bounded slices:

1. foundations, tokens, wordmark, shell and navigation;
2. Today and the responsive mobile shell;
3. complete Enquiries list and open-enquiry desktop/mobile;
4. Booked;
5. Business;
6. Insights;
7. More/account, plan/usage placeholder, referral/help/settings/account surfaces and states;
8. polish, accessibility, reduced motion, representative viewport verification and tests.

The target information architecture is:

- desktop primary: Today, Enquiries, Booked, Business, Insights;
- secondary/account: plan and usage, Refer a friend, Help & support, Settings, Account;
- mobile bottom navigation: Today, Enquiries, Booked, Business, More.

The target visual direction is Editorial Utility: clean white working surfaces, soft lilac/lavender shell, restrained violet identity, modern sans typography, generous spacing, polished rounded components, subtle borders/shadows and selective semantic green/amber/red.

## Preserve

Keep server-side auth/membership checks, tenant isolation, explicit demo separation, raw-message persistence before best-effort interpretation, deterministic commercial validation, proposed-fact provenance, AUD-only supported money semantics, human action authority, and all CC1 truthful-action safeguards.

UI1 may move, rename, group or progressively disclose presentation surfaces. UI1 must not weaken the product contract: do not fabricate sends, bookings, payments, integrations, availability, quotas, pricing, analytics or referral rewards.

Material uncertainty, blockers, unsupported decisions, price conflicts, availability uncertainty and unsafe actions must remain visible when they affect the next action. Hide technical detail by default but keep Why this?/details/evidence reachable.

## Not authorised by UI1

No production mailbox/social/SMS/payment/calendar/booking integration programme; no new broad evaluator family, generic rules engine or CRM; no model upgrade; no unrelated backend refactor; no automatic legacy financial-data rewrite; no production data mutation; no credential rotation; no production deploy; no merge to `main` without explicit approval.

## Completion and release gates

Run existing tests/typecheck and add or update UI tests where appropriate. Verify representative phone/tablet/desktop widths, keyboard/focus, reduced motion, long content, empty/error/loading states and accessibility.

The result must look materially different from the existing Enquiry UI. A result that can be described as "the old Enquiry with cleaner spacing" fails.

Independent review, not the implementer, signs off UI1 and decides subsequent R2 sequencing. `docs/BETA_READINESS_GATE.md` and `docs/PUBLIC_TRAFFIC_GATE.md` remain open unless separately evidenced and approved.
