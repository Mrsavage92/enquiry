# Independent review — Enquiry app at origin/main (9a00749)

Reviewed by Claude (Sonnet 5), 2026-09-10, at Adam's request ("independent review of enquiry app"). This satisfies the review step `docs/CURRENT_PHASE.md` names as blocking: *"CC1 implementation -> independent review -> explicit next R2 decision -> first-beta gate."* This document is that independent review. It does not decide the next R2 sequencing — that is explicitly the product owner's call — but it gives a verdict on CC1 sign-off and a full findings list for everything else.

Reviewed in an isolated git worktree of `origin/main` at `9a00749` (production, includes PR #18 roadmap fixes on top of the CC1 release). Read-only: nothing in this review touched the working tree at `C:\Users\Adam\Documents\Claude\enquiry`, which was left on its own uncommitted branch.

## Tool baseline (independently reproduced, not taken on faith)

| Check | Result |
|---|---|
| `npm install` | 414 packages, clean |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean, 0 errors/warnings |
| `npm run build` | succeeds |
| `npm test -- --test-concurrency=1` | **725/725 pass**, 0 fail |
| `npm audit` | 1 HIGH: `js-yaml` (transitive, CVE re: CPU exhaustion via `maxTotalMergeKeys`, fix available) |

Matches the repo's own recorded baseline (725/725 per project history). The `js-yaml` finding is new since the CC1 report (which recorded a clean audit) — likely a transitive bump in a devDependency; run `npm audit fix` and re-check it isn't reachable from a runtime path.

## Method

263 source files, split into 9 batches, each independently reviewed against an 8-pass checklist (security, correctness, performance, design/quality, accessibility, completeness, maintainability, testing) by a separate agent with no visibility into the others' work, plus a targeted verification pass against every specific claim in the prior implementer's own `IMPLEMENTATION_REPORT.md`. Every file was opened by exactly one batch; batch coverage confirmed 263/263. Findings below are deduplicated and cross-checked across batches where more than one batch touched the same code.

## Verdict on CC1 sign-off: NOT READY

The six CC1 acceptance items (quantity meaning, service/rule ambiguity, owner-confirmed service identity, copy-vs-send separation, message/price consistency, transaction safeguards) hold up well **in the specific paths the implementer tested and the repository test suite exercises** — the domain and repo-layer verification below confirms `matchRule`, `parseQuantity`, `service-authority`, `recordSentReply`'s parameter surface, the `reviewed_send` idempotency constraint, and the `decision-apply.ts` transaction/locking are all implemented as claimed and traced correctly through to real-Postgres semantics (not just PGLite artifacts).

But the review found the **identical defect class CC1 exists to close — a client-side state change that looks and feels like a confirmed server action but isn't persisted, and silently reverts — still present, unfixed, in code adjacent to the paths CC1 touched.** This isn't a new, unrelated bug category; it's the same trust violation (an owner believes an action took effect when it didn't) in sibling controls the CC1 slice didn't reach. See P0-3 below. Signing off CC1 as written would certify the narrow paths it tested while leaving the broader invariant it was meant to establish — "the product never lies about what has and hasn't happened" — broken elsewhere in the same UI surface.

There is also a live, public-facing instance of the exact "fabricated event shown as real" failure mode (P0-1/P0-2) reachable today by any anonymous visitor to the marketing homepage.

**Recommendation:** do not sign off CC1 yet. Treat P0-1 through P0-4 as a follow-up slice (call it CC2) before any first-beta/public-traffic gate opens, since P0-1 is reachable by the public right now regardless of beta status.

---

## P0 — blocking

### P0-1: Fabricated "customer replied" + auto-booking is live on the public marketing homepage

`src/routes/index.tsx` embeds `LivePhone` (`src/components/site/live-phone.tsx`), backed by the shared `usePrototype` store. `demoMode` defaults to `true` for every unauthenticated visitor — it is not a separate "this is fake" flag, it's the default state of the public site. 7.2 seconds after a visitor plays the widget, `receiveClientReply` (`src/store/prototype-store.ts:648`, firing logic ~1187-1222) synthesizes an inbound customer message, auto-accepts it, and shows a toast reading "Booked." — rendered in the identical chat UI used for real conversations elsewhere in the product.

This is the exact defect class the product already had to fix twice internally for signed-in tenants (commits `5c8db66`, `b97dd2e` — "Sent" language must only appear when something real happened). It was never closed for the public demo widget, which every visitor to the homepage can trigger today.

*File:line:* `src/store/prototype-store.ts:648,1187-1222`; embedded via `src/components/site/live-phone.tsx` and `src/routes/index.tsx:125-128`.
*Fix shape:* either remove the auto-fire entirely (require an explicit "simulate a reply" click) or add an unmissable "(this is a simulation)" marker directly on the fabricated message bubble, not just in a figure caption elsewhere on the page.

### P0-2: Real tenant data can leak into the same public widget

Independently found while verifying P0-1: `LivePhone` reads `s.enquiries.find((e) => e.id === id) ?? s.enquiries[0]` with no `demoMode` or tenant check of its own. If a signed-in tenant with real enquiries loaded (`demoMode: false`) client-side-navigates back to `/` without a full page reload, the "Interactive demo" widget falls back to `enquiries[0]` — the tenant's own real first enquiry, including customer name, quote and conversation — instead of the fixture. Currently only reachable via an SPA back-navigation, but the widget itself has no defense against it.

*File:line:* `src/components/site/live-phone.tsx` (enquiry lookup), consumed from `src/routes/index.tsx`.
*Fix shape:* gate the lookup on `s.demoMode === true`, never fall back to a live tenant's real data regardless of navigation path.

### P0-3: The "client store pretends to be a confirmed server action" bug is unfixed in sibling controls

CC1's IMPLEMENTATION_REPORT documents fixing exactly this pattern for one control (the fact-correction pencil-edit in `intelligence.tsx`, defect A02). This review confirms that specific fix holds — but found the same pattern, unfixed, in at least four other live (non-demo-gated) controls in the same component tree:

- **Pause/Resume outbound** — `src/components/settings/settings-page.tsx:49-53` calls `usePrototype((s) => s.pause)`/`s.resume` directly, bypassing `useLiveTrustMutations().pauseBusiness/resumeBusiness` (the hook that actually writes to the server). For a live tenant, clicking "Pause outbound" never persists — `hydrateFromServer` silently reverts it on the next refresh. **This is the product's core safety control for stopping outbound sends, and it doesn't work.**
- **"Tell Enquiry" business-rule / pricing changes** — `src/components/business/brain-screen.tsx:197-234,342-415`, `src/components/enquiry/teach-dialog.tsx:45-56`. An owner types a price correction, sees "Business Brain updated," and nothing is written server-side. Reverts on next reload while Enquiry keeps quoting the old price.
- **Price-conflict resolution** — `src/components/enquiry/situation-card.tsx:114`, backed by `resolvePrice` (`prototype-store.ts:986-1019`), which is hardcoded to one fixture business id and two literal fixture rule ids. For every real business, clicking a conflict-resolution choice updates only the local draft and never resolves the underlying conflict server-side — directly the "stale approval" invariant CC1-05 was meant to close.
- **"They accepted off-channel"** — `src/components/enquiry/waiting-desk.tsx:228`, via `acceptQuote` (`prototype-store.ts:1102-1176`). Fabricates a verbatim inbound customer message and writes it into the permanent case file as if genuinely exchanged, flips the enquiry to BOOKED, manufactures a booking row — with no server write and no demo gate. Reverts on refresh, so an owner can believe a job is booked and off their plate, then have it silently reappear as open.

Lower-severity siblings with the same wiring gap (P1, not P0, since they don't touch price/send/booking state): `job-sheet.tsx`/`bookings-calendar.tsx` (deposit/reschedule/cancel), and in `situation-card.tsx`/`waiting-desk.tsx`: `resolveDuplicate`, `reconnect`, `continueWithoutAvailability`, `inviteToDm`, `markLost`, `proposeRevision`, `releaseFollowUp`, `recordClientQuestion`.

*Fix shape:* the correct pattern already exists three lines away in most of these files (`chooseAlternative` in situation-card.tsx, the pencil-edit fix in intelligence.tsx) — route each of these through a real server call + `refresh()`, the same way CC1 fixed A02.

### P0-4: `ruleFingerprint` can collide on two genuinely different pricing rules

`src/domain/business-rule.ts:155-169` builds a rule's identity by joining fields with an unescaped `|` delimiter. Two `per_unit` rules with different `unit`/`quantityField` values can produce an identical fingerprint if either field contains a literal `|` (plausible: the function's own docstring says these fields "may have been proposed by a model" from customer text). A collision means the repo layer treats two rules that price different things as "the same rule already confirmed," silently skipping the owner re-confirmation this exact mechanism exists to force. Zero test coverage on `ruleFingerprint` anywhere in the repo — the collision would have been caught by one property-style test.

*File:line:* `src/domain/business-rule.ts:155-169`.
*Fix shape:* delimit with a character that can't appear in the source fields, or hash each field independently before joining.

---

## P1 — fix before the next release

- **No server-side rate limiting on auth.** `src/lib/auth/resend.ts:17-36`, `src/lib/auth/client.ts:133-168` — only a client-side UI cooldown timer (trivially bypassed). Real throttling depends entirely on Supabase's own per-address project config, outside this repo's control.
- **Optimistic UI updates with no rollback on server failure.** `src/lib/workspace/live-mutations.ts:46-97` — `pauseBusiness`, `resumeBusiness`, `setActionPolicy`, `setTrustMode` all update local state before the server call and never revert on failure, contradicting the file's own doc comment ("leaving an operator believing they had paused outbound sending when the server never recorded it is the kind of silent failure this product cannot afford") and the pattern already fixed for `decline` in the same file.
- **Zero direct test coverage on the tenant-isolation layer.** `src/lib/repo/tenancy.server.ts` (by its own docstring, "the only thing standing between one tenant and another's data," since RLS is bypassed by design), `src/lib/server/enquiry-actions.ts` (the actual server-fn validators and tenancy wiring), and `src/lib/repo/rows.ts` all have no dedicated test file — every existing test exercises the layer underneath them directly, bypassing these files entirely. Logic was traced and found correct in this review, but a regression here is a cross-tenant leak and nothing in the suite would catch it.
- **First-match fact selection in the pricing compiler.** `src/domain/price-compiler.ts:191-215` (`serviceIsUnconfirmed`, `quantityFrom`) select a fact via plain `Array.find()` with no ordering/dedup discipline — the same "array order decides the commercial outcome" defect class `matchRule` was rewritten to eliminate for *rules*, reintroduced for *facts*. No test constructs a fact array with duplicate/conflicting entries for one field to catch this.
- **Untested commercial-logic files:** `src/domain/quantity.ts` (traced by hand and confirmed correct, but only indirectly exercised via `price-compiler.test.ts`), `quote-sheets.ts`, `reeval.ts`, `status-tone.ts`, `voice-apply.ts`, `src/lib/interpret/index.server.ts` (the interpreter-selection dispatcher — a precedence regression here would ship silently).
- **Pricing-rules empty state IS reachable on real data**, upgraded from the CC1 report's "not a commercial-correctness defect, fixture-only" verdict: `src/lib/repo/db.ts` (benchmark's mirror of production SQL) excludes any `knowledge_item` whose Active rule lacks a populated `rule_payload`, and this is a real, reachable state for any real business, not just the fixture. An owner sees an "Active" rule but the engine silently reports "cannot price anything yet."
- **No 404 route exists anywhere** in the app (`src/routes/**` has no catch-all/`$.tsx`, `__root.tsx` registers no `notFoundComponent`).
- **Public rate-limiter is fully bypassable.** `src/lib/launch/protect.server.ts:14-20` trusts the first `X-Forwarded-For` entry with no trusted-proxy verification — an attacker can rotate the header per request to defeat the waitlist/roadmap rate limits entirely.
- **Multi-table writes not transactional.** `src/lib/launch/api.ts` and `feedback.ts` perform 2+ sequential inserts/updates across tables via the plain pooled client, never `withTransaction`, despite `db.ts`'s own doc saying that's required wherever one logical change spans several tables. Contained to marketing/waitlist data, not commercial data.
- **`trust-screen.tsx` crashes for a live tenant with zero businesses**, in two places (`TrustAccess` line ~192, `TrustAutomation` line ~326) — the `!business` guard that protects the sibling `TrustOverview` function three lines above was not replicated.
- **Unhandled promise rejection on the public roadmap page** — `src/components/site/roadmap-board.tsx:118,500-522`, `onNeed` has no `.catch`; a failed vote silently no-ops with the visitor believing it was recorded.

## P2/P3 — condensed (fix opportunistically)

- `js-yaml` high-severity transitive audit finding (fix available, run `npm audit fix`).
- `src/lib/multiplayer/{index,p2p}.ts` — confirmed dead code, zero callers anywhere (571 lines).
- `src/domain/reeval.ts` and `src/domain/brain-apply.ts` — fixture-id-branching logic (hardcoded `"f09"`, `"glow"`, etc.) sitting undifferentiated inside `src/domain/` next to real pricing logic; confirmed demo-only callers but no naming/location signal that it's not production code.
- CSRF check on public launch endpoints (`protect.server.ts:26-39`) passes silently when both `sec-fetch-site` and `Origin` are absent (non-browser clients).
- `src/lib/workspace/business-rule-core.ts` locks all of a business's Active rules rather than just the affected service's — correct, just coarser than necessary.
- `job-sheet.tsx`/`bookings-calendar.tsx`, `situation-card.tsx`, `waiting-desk.tsx` P1 siblings listed under P0-3.
- Several components over the 200-line guideline (`prototype-store.ts` at 1785 lines is the most significant — it's the single state-transition module for nearly every commercial action and would benefit from splitting per action domain).
- Accessibility: incomplete ARIA tablist pattern (`trust/route.tsx`), invalid `<dl>` child structure (`insights.tsx`), missing `loading="lazy"` on below-the-fold marketing images.
- Full fixture dataset (`businesses.ts` 679 lines + `enquiries.ts` 2230 lines + `channels.ts` 375 lines) ships to every anonymous homepage visitor via the shared store import.
- Stale comment in `src/benchmark/r2e/run.ts:212` describing pre-rewrite `selectRule` behavior as a live gap — the current implementation (`price-compiler.ts:185-188`) is a thin wrapper around `matchRule` and cannot first-match; update or remove the comment so a future reader doesn't mistake it for a real defect (as this review initially did, before checking the code).

---

## CC1 claim verification — summary

Every specific claim in `IMPLEMENTATION_REPORT.md` reachable by this review's batches was checked against the actual code (not the report's prose), independently, by tracing the real call chain through to what a real concurrent Postgres connection would do — not just what single-connection PGLite happens to mask.

| Claim | Verdict |
|---|---|
| `parseQuantity` closed grammar (ranges/alternatives/negatives/zero/malformed rejected) | **CONFIRMED** — traced by hand against every input shape |
| `matchRule` order-independent, explicit one/none/ambiguous | **CONFIRMED** for rule selection |
| Fact selection inside `compilePrice` also order-independent | **CONTRADICTED** — first-match `Array.find()`, no safeguard (P1 above) |
| `ruleFingerprint` gives safe, collision-free rule identity | **CONTRADICTED** — delimiter collision (P0-4 above) |
| `service-authority.ts` blocks unconfirmed service from sending | **CONFIRMED** |
| `price` vs `provisionalPrice` never conflated by any writer | **CONFIRMED** in every writer checked |
| `recordSentReply` parameter surface can't be crafted by a client | **CONFIRMED**; `recordSentReplyInTransaction` genuinely deleted |
| `reviewed_send` idempotency via real unique constraint, not app-level-only | **CONFIRMED** — real unique index, atomic upsert |
| `decision-apply.ts` transaction/locking (B-3 fix) | **CONFIRMED** — traced `withTransaction` itself; holds on real concurrent Postgres, not a PGLite artifact |
| Closed-enquiry/decline guard has no client-suppliable bypass, bumps `decision_revision` | **CONFIRMED** |
| `business-rule-core.ts` supersedes atomically under lock | **CONFIRMED** |
| I01 tenant isolation in server actions/repo | **CONFIRMED** — every checked handler derives ids from session, never client input |
| Zero quantity refused, not priced at $0 | **CONFIRMED** |
| Fabricated demo inbound-reply gated to `demoMode`, can't reach a live tenant | **CONFIRMED** for signed-in tenants; **but reachable by anonymous public visitors** (P0-1) |
| `pricing-rules.tsx:91` stale empty state is fixture-only, not a real defect | **CONTRADICTED/upgraded** — reachable on real data (see P1 above) |
| "Correct guests"/"Correct service" pencil-edit now routes through server (A02 fix) | **CONFIRMED** |
| Copy vs. "I've sent this externally" are genuinely distinct, no shortcut can record a send | **CONFIRMED** |

## What this review did not, and could not, do

- No real signed-in browser journey was run (the CC1 report's own B2 gate) — this was a static/traced code review, not a live exercise. The findings above were reached by reading and tracing the actual source, including the exact transaction/connection objects passed at each call site, not by re-running the implementer's own journey.
- Real-provider AI interpretation quality (B1, `ANTHROPIC_API_KEY` still unset) remains unverified, as before.
- True multi-connection Postgres concurrency (B3) was not executed against a live database; this review traced the locking/transaction code path and confirms it *should* be correct against real concurrent connections (unlike the pre-fix code, which was provably wrong even in principle), but "should be correct by inspection" is not the same evidence tier as an actual concurrent-connection test.
