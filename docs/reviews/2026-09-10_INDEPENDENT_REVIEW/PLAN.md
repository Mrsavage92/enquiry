# Plan to finish Enquiry - from the 2026-09-10 review to a passed first-beta gate

Companion to `REVIEW.md` in this folder. Drafted by Claude on 2026-09-10, then stress-tested by an independent plan review; the changes that review forced are recorded under "Validation" at the end. This plan proposes; the product owner ratifies sequencing, per `docs/CURRENT_PHASE.md` ("explicit next R2 decision" is the owner's).

## What "finished" means

Three gates, each with written evidence. The first two are decoupled from the third on purpose: the **beta** gate is what puts a real business on the product; the **public-traffic** gate only unlocks marketing traffic and should not hold beta hostage.

1. **CC1 + CC2 signed off** by an independent reviewer - the review's must-fix clusters closed, every changed control exercised in a real-auth browser journey at the integrated head, and CC1's two open gates (B1 real-provider run, B3 multi-connection Postgres) evidenced.
2. **`docs/BETA_READINESS_GATE.md` passed** - every required checkbox in sections 1-11 backed by implementation and QA evidence.
3. **`docs/PUBLIC_TRAFFIC_GATE.md` passed** - credential revocation, visual runtime QA, public-claim truth, waitlist smoke test.

Not in scope: mailbox/social/SMS/payment/calendar integrations, PWA, model upgrades, visual redesign (all named as not-required or deferred by the gates themselves).

## The critical path is owner-blocked, not code-blocked

CC1 sign-off needs gates B1 and B3 from `IMPLEMENTATION_REPORT.md` (lines 284, 342-351), and both need something only the owner can supply. They should start **today**, in parallel with all code below:

| Item | Why | Owner effort | Then Claude |
| --- | --- | --- | --- |
| Set `ANTHROPIC_API_KEY` (optionally `ENQUIRY_INTERPRETER_MODEL`) on Vercel and in a local `.env` for the benchmark | B1: `npm run benchmark:r2e` real mode is 1 pass / 15 skipped until then | 5 min | run the benchmark in real mode, record 16 cases (20 min) |
| Provide a disposable real Postgres: a Supabase branch via the linked CLI, or approve local Docker Postgres | B3: PGLite is single-connection, so `for update` contention can never be exercised | 10 min | write the two-connection contention test for `decision-apply` and `reviewed-send` (45 min) |

Everything else is parallel to those two.

## Operating rules for every slice

- One branch per slice (`cc2/<name>`), cut from `main`. Never push to `main`. Merge only after independent review.
- Tests first for every behaviour change; `npm test -- --test-concurrency=1` green (725 -> more), `npm run typecheck`, `npm run lint`, `npm run build` before each PR.
- Every changed live control gets a real-auth browser check (Playwright, disposable `auth.users` row, in-memory PGLite) before the PR is marked ready. The CC1 lesson: two defects were invisible to the suite and to demo screenshots.
- **A control may exist in live mode only if it round-trips the server.** "Absent" satisfies the gates; "present and lying" does not. Demo theatre stays behind `demoMode`.
- No new schema. `business.voice jsonb` already exists (`migrations/0004_product_core.sql:46`, mapped at `rows.ts:332`); nothing in this plan needs a migration.
- Estimates are Claude wall-clock for the work, not calendar time; review turnaround is separate.

## Beta-minimum sequence (what must ship before the first external business, ~7-9 h)

This is the smallest truthful path to gate 2. Everything in the next section can follow it.

### CC2-A-core - rewire what exists, hide what lies

Branch `cc2/live-controls-core`. ~2.5-3 h.

| # | Change | Where | Est. |
| --- | --- | --- | --- |
| A1 | Settings pause/resume via `useLiveTrustMutations` (the three other pause controls already do) | `settings-page.tsx:12-13,49-53` | 10 min + test |
| A2 | Rollback on failed write-through for pause/resume/policy/trust-mode: snapshot the business before the local update, restore it when `writeThrough` returns false | `live-mutations.ts:46-97`, new `live-mutations.test.ts` | 30 min |
| A3 | **Append a later customer message to an existing enquiry** (beta gate section 8, currently unmet: `insertManualEnquiry` at `manual-enquiry-core.ts:73-101` only writes a message with a *new* enquiry, and none of the 15 live server fns appends). New server fn `appendInboundMessage(enquiryId, body, channel)` -> insert `message` -> existing `interpretAndApply(enquiryId, messageId)` inside `withTransaction`; db test; wire "They asked a question" to it in live mode with a paste field | `lib/server/enquiry-actions.ts`, new `lib/repo/append-message-core.ts`, `waiting-desk.tsx:247-257` | 60 min |
| A4 | Hide every remaining non-persisting control in live mode, keep in demo: `proposeRevision`, `releaseFollowUp` (a derived state, never a manual write), situation-card duplicate/calendar/public-comment/conflict buttons, bookings deposit/reschedule/cancel | `waiting-desk.tsx:188-220,270-290`, `situation-card.tsx:107-157`, `job-sheet.tsx:147,264,299`, `bookings-calendar.tsx:401` | 40 min |
| A5 | Voice write-through to the existing `business.voice` column (20 min). Record honestly that voice does not affect server-composed drafts today (`applyVoiceToDraft` is called only from the client store at `prototype-store.ts:886` and the Brain preview at `brain-screen.tsx:568`), so beta section 3's "where they actually affect prepared output" reads as not-applicable until voice reaches `compose-reply` server-side | `brain-screen.tsx:498-551`, `lib/server/workspace.ts` | 20 min |
| A6 | Allow-list test: a static check that every `usePrototype((s) => s.<mutation>)` reachable from a live-rendered component is either a write-through or gated on `demoMode` | new test | 30 min |

### CC2-A-endstate - truthful BOOKED and LOST, no booking subsystem

Branch `cc2/truthful-end-states`. ~2 h. Depends on nothing in A-core; can run in a parallel worktree.

There is **no server path today that sets lifecycle `BOOKED` or `LOST`** (`close-enquiry-core.ts` only produces `DECLINED`; `insert into booking` / `update booking` have zero matches in `src/`; `requireBookingAccess` at `tenancy.server.ts:104` has zero callers). Beta section 8 needs "a truthful booked/lost/handoff end state" - it does not need a bookings table write. So:

| # | Change | Where | Est. |
| --- | --- | --- | --- |
| S1 | Extend `close-enquiry-core` with outcomes `BOOKED` (owner attests the customer accepted outside Enquiry) and `LOST`, same conditional-update guard shape as decline, `decision_revision` bump, quote `accepted`/`superseded` status update, **owner-attested audit line only** - never a fabricated customer message | `close-enquiry-core.ts:32-55`, `enquiry-actions.ts` | 60 min + db tests |
| S2 | "They accepted off-channel" and "Mark lost" call S1 in live mode; demo path unchanged | `waiting-desk.tsx:224-234,258-269,329` | 15 min |
| S3 | Bookings screen in live mode reads end-state from the enquiry (BOOKED enquiries listed, no editable booking rows); the store's `acceptQuote` booking fabrication stays demo-only | `bookings-calendar.tsx`, `job-sheet.tsx` | 30 min |

### CC2-B - Public demo honesty and isolation

Branch `cc2/public-demo-honesty`. ~1 h. Ships first and alone: it is the only public-facing change and the smallest.

| # | Change | Where | Est. |
| --- | --- | --- | --- |
| B1 | `LivePhone` renders only when `demoMode`; remove the `?? s.enquiries[0]` fallback; live mode shows the static `Still` | `live-phone.tsx:18` | 15 min + test |
| B2 | Fabricated inbound messages carry `simulated: true`; `conversation.tsx` and `case-file.tsx` label them "Simulated reply" instead of "Received" | `prototype-store.ts:1109-1126,1200-1211`, `conversation.tsx:106,127`, `domain/types.ts` | 30 min |
| B3 | `hydrateFromServer` and `markOnboardedLocally` clear `replyTimer`; `receiveClientReply` returns unless `demoMode` at fire time | `prototype-store.ts:316,390,1187` | 10 min + `live-handoff.test.ts` case |
| B4 | Owner decision: keep the 7.2 s auto-reply with the marker, or require a "Simulate their reply" click. Default: keep + marker | `prototype-store.ts:648` | 0-10 min |

### CC2-T - Minimal beta telemetry (beta gate section 10)

Branch `cc2/beta-telemetry-min`. ~45 min. Derive the section-10 signals (accepted unchanged / edited / rejected / fact correction / rule correction / booked-lost / repeat session) from the existing `audit_event` rows plus `reviewed_send.edited`-equivalent (body hash vs prepared body), exposed as one server-side query and a small `/insights` panel. No new analytics system, no raw customer bodies leave the database. The full `docs/BETA_TELEMETRY_SPEC.md` is deferred until a real cohort exists.

### CC2-V - Verification walk for beta (beta gate section 11)

~3-4 h once the owner's Postgres exists, at the integrated head:

- two-tenant isolation test at the endpoint layer (D1 below, pulled forward);
- zero-membership onboarding from a fresh `auth.users` row;
- one arbitrary non-fixture enquiry through the review-first loop including A3 append and S1 end-state;
- reload persistence after every mutation above;
- desktop + phone + reduced-motion QA of the operator path;
- section 5's twelve boxes (no demo duration / travel / 09:00 fallbacks on live data) checked one by one against `decide.ts`, `calendar.ts`, `working-hours.ts` with a written line per box.

Evidence goes under `docs/evidence/beta-gate/` with one file per gate section. Then independent sign-off of CC1 + CC2, and the owner declares the beta gate.

## After beta (hardening and public traffic, ~6-8 h)

### CC2-C - Pricing engine hardening

Branch `cc2/pricing-hardening`. ~1.5 h.

- C1 `ruleFingerprint` -> `JSON.stringify` of the parts; property test (`business-rule.ts:155-169`). 15 min.
- C2 `toCompilerFacts` drops `superseded` facts; test with a superseded fact first (`decide.ts:72-78`). 10 min.
- C3 Direct unit tests for `quantity.ts` bounds and `interpret/index.server.ts` precedence. 40 min.
- C4 Pricing-rules empty state names the text-only items instead of "cannot price anything yet" (`pricing-rules.tsx:91`). 20 min.
- C5 Fix the stale note at `benchmark/r2e/run.ts:212`. 2 min.

### CC2-D - Boundary tests

Branch `cc2/boundary-tests`. ~1.5 h. D1 (tenancy two-tenant tests, 45 min) is pulled into CC2-V. D2 tests the exported core functions with a fake authenticated context rather than building a `createServerFn` harness (45 min). D3 `rows.test.ts` mapping (20 min).

### CC2-E - Hygiene and the public-traffic gate

Branch `cc2/hygiene`. ~1.5-2 h. E1 404 route (10 min), E2 trust-screen guards (5 min), E3 roadmap `onNeed` catch (5 min), E4 `clientIp` prefers `x-vercel-forwarded-for` then `x-real-ip` then the last `x-forwarded-for` entry and the bucket map is bounded (20 min + test), E5 launch writes inside `withTransaction` with upserts (30 min), E6 `npm audit fix` and delete `src/lib/multiplayer/` (10 min), E7 a11y tablist/`<dl>`/lazy images (20 min). E4 and E5 belong to the public-traffic gate, not beta.

### Public-traffic gate walk

~1.5-2 h: visual runtime QA desktop + phone + reduced motion, waitlist and qualification smoke test on the deployed URL, claim matrix against `docs/PUBLIC_CLAIM_TRUTH_MATRIX.md`, copy change "Building with" -> "Built for" once the owner rules on it.

### Teach Enquiry (beta gate section 7) - the 30-minute version

`teach` is never assigned a value in live code, so nothing lies today. Section 7 is met by routing a teachable correction to the existing owner-confirmed `saveBusinessRule` (`enquiry-actions.ts:24`): "Teach Enquiry" in live mode opens the pricing form pre-filled from the correction. 30 min. The learning-proposal engine is deferred until a real cohort asks for it.

## Owner-only items

| Item | Why | Effort |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` on Vercel + local | B1, critical path | 5 min |
| Disposable real Postgres | B3, critical path | 10 min |
| Check Supabase Auth rate limits (Dashboard -> Authentication -> Rate Limits) | Review P1; sign-in calls Supabase from the browser, so this is the only enforcement point | 10 min |
| Revoke/rotate the historical Grok preview credential at the broker | `PUBLIC_TRAFFIC_GATE.md` section 1 | 15 min |
| Decide B4 (auto-reply keep+marker vs click) | Product | 1 min |
| Decide "Building with" -> "Built for" | Truth boundary before traffic | 1 min |
| Decide byte-identical repeat sends (CC1 S-1) | Product | 1 min |
| Reconcile `docs/CURRENT_PHASE.md` (still says CC1 unsigned and not implemented; production is live at 9a00749) | Execution authority is stale | 10 min |

## Sequencing

```
Today        owner: API key + Postgres started (critical path)
             Claude: CC2-B (1 h) -> PR -> review -> merge -> verify production by content
                     CC2-A-core (2.5-3 h)  and  CC2-A-endstate (2 h)  in parallel worktrees -> PRs
Next session CC2-T (45 min) -> PR
             B1 benchmark + B3 contention test once inputs exist (~1 h)
             CC2-V verification walk at the integrated head (3-4 h) -> evidence docs
             -> independent sign-off CC1 + CC2 -> owner declares BETA gate
After        CC2-C, CC2-D, CC2-E, Teach-30, public-traffic walk (~6-8 h)
             -> owner declares PUBLIC_TRAFFIC gate
```

Merge order: B, then A-core and A-endstate (either order), then T. Every merge auto-deploys; verify production by a unique content string after each, and never redeploy over a gated deploy from another session.

Totals: beta-minimum ~7-9 h of Claude work plus the 3-4 h verification walk; after-beta ~6-8 h. Roughly 16-20 h across three sessions, plus owner effort of about an hour and two independent review passes.

## Risks and what would change the plan

- **A3 `interpretAndApply` re-entry**: appending a message to an enquiry with an existing decision must re-run the decision without erasing history (beta section 6). `interpretAndApply` already takes `(enquiryId, messageId)` and locks the enquiry; if it assumes a fresh enquiry anywhere, A3 grows by ~30 min.
- **S1 quote status semantics**: marking a `quote_version` accepted on BOOKED must not collide with CC1's `superseded` handling for stale attestations; the db test covers both orders.
- **Section 5's twelve boxes** are the most likely place the verification walk finds new work; budget is 3-4 h for that reason.
- **The public homepage is live**, so CC2-B ships alone and first, with a content check on the deployed URL.

## Validation

Reviewed by an independent plan-validation pass (strategic-cto-mentor, Opus) before presentation. Its verdict: adopt with changes. What it found and what changed:

1. **A3/A6 rested on a false premise.** The draft assumed a server-side booking write path; there is none (`requireBookingAccess` has zero callers, no `insert into booking` anywhere, no server path sets BOOKED or LOST). Replaced with CC2-A-endstate: truthful lifecycle end-states with an owner-attested audit line and no booking subsystem. Bookings mutations are hidden in live mode (section 4 says "where used").
2. **Migration 0008 was unnecessary.** `business.voice jsonb` already exists. Cancelled; voice becomes a 20-min write-through, and section 3's voice bullet is recorded as not-applicable to prepared output until voice reaches server-side compose.
3. **Append-later-info was mis-filed as an open question.** It is a confirmed section-8 gap; moved into A-core, and "They asked a question" becomes its live affordance rather than being hidden.
4. **The critical path is owner-blocked.** B1/B3 moved to the top and started today.
5. **Gate-walk estimates were more than 2x low.** Verification walk re-estimated at 3-4 h; total 16-20 h, not 11-13.
6. **Beta and public-traffic gates decoupled**, with a beta-minimum sequence first; A6, A7-as-migration, the `createServerFn` harness, C3-C5 and E5-E7 moved to after beta as gold-plating relative to the gates as written.
7. **Teach Enquiry** reduced to the 30-minute routing version; telemetry reduced to the audit-event-derived minimum.
