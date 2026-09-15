# Enquiry - Current Implementation Phase

Updated: 2026-09-15 (Australia/Brisbane).

## Active slice: UI1 - Core experience redesign

**Status: IMPLEMENTATION LANDED ON `main`; NOT INDEPENDENTLY SIGNED OFF.**

Product-owner instruction on 2026-09-10: implement the UI1 core-experience redesign end-to-end on the dedicated `design/ui1-quiet-signal` branch. This is an authorised presentation and interaction-architecture reset, not a cosmetic spacing pass.

## Current release state

### Sitewide visual review (15 September 2026)

Owner-authorised continuation: apply the original GPT review, creative image exploration,
critique and native implementation process across the whole website and app. Isolated on
`codex/ui1-sitewide-visual-review`, based on `9ebff84` (PR #29). Five visual boards inform
four related page families. Strong existing Today, enquiry, Business and roadmap structures
are retained after review; public storytelling, entry/onboarding, utility pages, Insights,
permissions and recovery states receive targeted redesigns.

The owner's standing instruction covers website production delivery after verification.
It does not authorise new provider integrations, production database/auth configuration,
or a claim of beta readiness. Existing engine, tenant, sending and commercial safeguards
remain authoritative. See `docs/design/sitewide-2026-09-15/README.md` and
`docs/evidence/sitewide-2026-09-15/README.md` for decisions, review coverage and limits.

### Customer roadmap slice (15 September 2026)

Owner-authorised outcome: ask the original GPT design chat to review the public roadmap,
generate and critique a visual reference, then implement and publish the customer/investor-facing
roadmap. Work is isolated on `codex/ui1-customer-roadmap`, based on `b44bb24` (PR #28).
The scope is roadmap copy, presentation, existing feedback controls and verification. Native
iPhone/Android apps and other future outcomes are published as direction, not implemented by
this slice. No auth, commercial engine, tenant isolation or external integration changes.

The owner explicitly authorises this roadmap's production release after verification.
This does not close beta, email-delivery or public-traffic readiness gates. See
`docs/design/roadmap-2026-09-15/README.md` and `docs/evidence/roadmap-2026-09-15/README.md`.

### UI1 public-site release candidate (14 September 2026)

The owner has authorised finishing the public website for early access. Active work is isolated on
`codex/ui1-early-access-release`: accepted entry-page aurora, branded auth-email source, current-product
imagery and a light public-site rebuild. Claude's `visual/mirror-integrate` is not included.
See `docs/evidence/early-access-release-2026-09-14/README.md` for scope, verification and remaining
external launch gates. This work does not independently sign off UI1, public traffic or operator beta.

UI1 was merged to `main` in [47a8d29](https://github.com/Mrsavage92/enquiry/commit/47a8d29ba66f19d6280cd2c2ead4b9bc5a360be7) after the owner authorised implementation. Vercel reports a successful status for that commit, but production content and the complete exact-head verification ledger remain independently unverified here. [PR #20](https://github.com/Mrsavage92/enquiry/pull/20) is an open visual refinement with owner acceptance still open. Treat UI1 as landed work awaiting independent review, not as a phase sign-off or beta release.

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

No production mailbox/social/SMS/payment/calendar/booking integration programme; no new broad evaluator family, generic rules engine or CRM; no model upgrade; no unrelated backend refactor; no automatic legacy financial-data rewrite; no production data mutation; no credential rotation; no further production deploy or merge to `main` without explicit approval.

## Completion and release gates

Run existing tests/typecheck and add or update UI tests where appropriate. Verify representative phone/tablet/desktop widths, keyboard/focus, reduced motion, long content, empty/error/loading states and accessibility.

The result must look materially different from the existing Enquiry UI. A result that can be described as "the old Enquiry with cleaner spacing" fails.

Independent review, not the implementer, signs off UI1 and decides subsequent R2 sequencing. `docs/BETA_READINESS_GATE.md` and `docs/PUBLIC_TRAFFIC_GATE.md` remain open unless separately evidenced and approved.
