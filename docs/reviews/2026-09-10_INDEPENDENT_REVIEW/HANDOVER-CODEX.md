# Handover to Codex - Enquiry CC2 work, 2026-09-10

Written by Claude (Fable 5.1) at the end of a session that (1) ran an independent review of production `main` at `9a00749`, (2) produced and validated a plan to get Enquiry to a passed first-beta gate, and (3) started executing that plan until the account's subagent session limit cut five parallel build agents off mid-item. This file is the complete state so Codex can continue without re-deriving anything. Read it top to bottom once; every path, SHA and command is exact.

Companion documents in this same folder on branch `review/independent-review-2026-09-10`:

- `REVIEW.md` - the findings, plus a "Follow-up verification" section that re-graded them against the code with file:line evidence. Read this before touching any slice; it explains why each change exists.
- `PLAN.md` - the ratified plan (owner said "work through all"), including the changes an independent plan review forced. The slice specs below reference PLAN.md sections rather than repeating every line.

## 1. Governance and working rules (unchanged, load-bearing)

- `docs/CURRENT_PHASE.md` is execution authority; the owner (Adam) decides sequencing. He ratified PLAN.md as written, with these defaults for the four open decisions: homepage auto-reply kept but marked "Simulated reply" (B4); the "Building with" copy change is moot (no such copy exists in `src` at this head, the gate doc is stale); byte-identical repeat sends stay blocked (CC1 S-1); sequencing as in PLAN.md.
- Never push to `main`. One branch per slice, cut from `origin/main` (`9a00749`). Merge only after an independent review says MERGE-SAFE. Every merge auto-deploys to production via Vercel; verify production **by content** after each merge (a unique string from the change), and never redeploy over a deploy from another session (a second Claude session has been working this repo in parallel; it also owns the terminal windows Adam is using - see gotchas).
- A control may exist in live mode only if it round-trips the server. Absent satisfies the gates; present-and-lying does not. Demo theatre stays behind `demoMode`.
- No new schema. `business.voice jsonb` already exists (`migrations/0004_product_core.sql:46`).
- Tests first. `npm test -- --test-concurrency=1` (5.5 min, baseline 725/725). Never run the suite without `--test-concurrency=1`: ~50 PGLite WebAssembly heaps start at once and it dies with "could not allocate memory", which looks like failures and is not. Never run two full suites in parallel on this machine for the same reason. Single files: `node --experimental-strip-types --import ./scripts/test-resolve-hook.mjs --test <file>`.
- Before each PR: `npm run typecheck`, `npm run lint`, `npm run build`, full suite.
- Never use the em dash character anywhere (code, UI copy, tests, commit messages, docs). Hyphen only. No code comments unless the WHY is non-obvious. Immutable updates. No `any`.
- Do not start `npm run dev`, Vite, or anything that opens a window on this PC while Adam is using it. A review subagent left a Vite server and two `-NoExit` PowerShell windows open earlier; they were killed. Unit tests, db tests and `npm run build` are the verification tools; the real-auth browser journey runs headless Playwright only.

## 2. Where everything is

| Thing | Location |
| --- | --- |
| Repo | `github.com/Mrsavage92/enquiry`, `origin/main` = `9a00749` (production, live at https://enquiry-ashy.vercel.app) |
| Main checkout | `C:\Users\Adam\Documents\Claude\enquiry` - on branch `experiment/ant-design` with UNCOMMITTED changes (package.json, app-shell.tsx, routeTree.gen.ts, __root.tsx, untracked src/lib/antd-theme.ts). Not part of this work. Do not check out anything there; use worktrees. |
| Review worktree | `C:\Users\Adam\AppData\Local\Temp\claude\enquiry-review\main-9a00749` on `review/independent-review-2026-09-10` (main + the three docs). Also holds a gitignored `.grok/app-env.json` with `VITE_SUPABASE_URL` and the legacy anon key, staged for the browser journey. |
| Slice worktrees | `C:\Users\Adam\AppData\Local\Temp\claude\enquiry-cc2\<slice>` for `public-demo-honesty`, `live-controls`, `pricing-hardening`, `hygiene`, `concurrency-evidence`. Each is `npm install`ed and on its `cc2/<slice>` branch. |
| Full-suite results | `C:\Users\Adam\AppData\Local\Temp\claude\enquiry-cc2\full-suite-results.txt` (written by the sequential run described in section 5) |
| Supabase | project `qzzvxfbitixpmfuirvhq`, shared with Orbit Digital (public.contacts must stay at 5 rows). Auth is real Supabase Auth; the app DB role is `enquiry_app` (BYPASSRLS, DML only); migrations are applied out of band as `postgres` and recorded in `_migrations`. |

Temp worktrees survive reboots but live under `%LOCALAPPDATA%\Temp`; if they are gone, recreate with `git worktree add -b <branch> <path> origin/<branch>` from the main checkout (the branches are all pushed).

## 3. State per branch

Nothing has been merged to `main`. Every branch below is pushed to `origin`.

### `review/independent-review-2026-09-10` - docs only

- `d84dfad` REVIEW.md (first pass), `ad8f8d4` follow-up verification + PLAN.md, plus this handover.

### `cc2/public-demo-honesty` - COMPLETE, awaiting full-suite result and independent review

| Commit | Item | What |
| --- | --- | --- |
| `c0319e5` | B1 | `live-phone.tsx` binds only in `demoMode` via `demoPhoneEnquiry()` in `src/domain/live-demo-isolation.ts`; the `?? s.enquiries[0]` fallback is gone; three tests in `live-demo-isolation.test.ts`. |
| `33634f5` | B2 | `Message.simulated?: true` (`src/domain/types.ts`); set on every message `acceptQuote` and `receiveClientReply` fabricate in `prototype-store.ts`; `messageStatusLabel()` in `src/domain/labels.ts` renders "Simulated reply"/"Simulated" in `conversation.tsx` and `case-file.tsx`; two tests in `labels.test.ts`. Note: the agent ran prettier on `types.ts`, so that diff carries ~70 lines of union-type reflow noise around a 2-line change. Harmless; flag it in review as formatting only. |
| `0221011` | B3 | `clearReplyTimer()` called from `hydrateFromServer` and `markOnboardedLocally`; `receiveClientReply` returns unless `mayReceiveDemoReply(s)` (new named policy in `live-demo-isolation.ts`, tested). |

B4: kept the 7.2 s auto-reply (owner default). B5: moot (grep for "uilding with service businesses" in `src` finds nothing at `9a00749`; `docs/PUBLIC_TRAFFIC_GATE.md` section 3 is stale on this point - say so when walking that gate).

Verified: `tsc` clean, `eslint` clean, targeted tests 59/59 (`live-demo-isolation`, `live-handoff`, `labels`). Full suite: see section 5.

Not done, deliberately: no store-level test that the timer is actually cleared on hydrate (the store cannot be instantiated in node tests; `live-handoff.test.ts` mirrors patches by hand, and the fire-time guard is the guarantee). A reviewer may ask for a mirrored assertion in `live-handoff.test.ts` that `hydrateFromServerPatch` is accompanied by `clearReplyTimer()`; that is a 5-minute add.

Ship this branch first and alone: it is the only public-facing change. Production content check after merge: open the homepage, play the demo phone through a send, and confirm the reply bubble label reads "Simulated reply" (the string is only in the client bundle once B2 is live; `grep -c "Simulated reply"` on the built `dist` client chunk works as a pre-merge check).

### `cc2/live-controls` - PARTIAL (A1, A2 done; A3-A6, S1-S3 not started)

| Commit | Item | What |
| --- | --- | --- |
| `f2c7fd9` | A1 | `settings-page.tsx` pause/resume now go through `useLiveTrustMutations` (matches `account-menu.tsx:114-115`, `trust-screen.tsx:145,154`, `system-banners.tsx:48`). |
| `f2c7fd9` | A2 | `writeThroughWithRollback()` in `write-through.ts`; `guardedBusinessWrite()` in `live-mutations.ts` snapshots the business from `usePrototype.getState()` before the optimistic update and calls the new store action `restoreBusiness(business)` when the server write fails; two tests in `write-through.test.ts`. |

Verified: `tsc` clean, `eslint` clean, `write-through.test.ts` + `live-handoff.test.ts` 25/25. Full suite: section 5.

Remaining, in order, exactly per PLAN.md "CC2-A-core" and "CC2-A-endstate" (the specs there are complete; these are the facts I verified that speed them up):

- **A3 append inbound message** (beta gate section 8, confirmed gap). `insertManualEnquiry` at `src/lib/repo/manual-enquiry-core.ts:73-101` shows the message insert shape and how `interpretAndApply(enquiryId, messageId)` is invoked with `runInTransaction: withTransaction` from `createManualEnquiry` in `src/lib/server/enquiry-actions.ts` (~82-175). `lockEnquiry` is in `decision-apply.ts:63-66`. Refuse closed enquiries with the same lifecycle check the reviewed-send path uses. UI: `waiting-desk.tsx:247-257` "They asked a question" becomes a paste textarea in live mode calling a new `useLiveEnquiryMutations().appendMessage`. New db test `append-message.db.test.ts` (copy the setup of `manual-enquiry-core.db.test.ts`).
- **A4 hide non-persisting controls in live mode**: `waiting-desk.tsx:188-199` (`proposeRevision`), `:210-220` (`releaseFollowUp`), `:270-290` (More dialog duplicates); `situation-card.tsx:107-157` (conflict, duplicate, calendar, public-comment groups); `job-sheet.tsx:147,264,299` and `bookings-calendar.tsx:401` (deposit/reschedule/cancel). The store actions behind them are pure client `set()` calls (`prototype-store.ts` imports nothing from `lib/server`).
- **A5 voice write-through**: new server fn `setBusinessVoice` in `src/lib/server/workspace.ts` mirroring `setTrustMode` (`requireBusinessAccess` + zod `VoiceProfile`); add `setVoice` to `useLiveTrustMutations` using `guardedBusinessWrite`; `brain-screen.tsx:498-551` uses it. Record in the beta-gate walk that voice does not affect server-composed drafts (`applyVoiceToDraft` is called only from `prototype-store.ts:886` and the Brain preview at `brain-screen.tsx:568`), so section 3's voice bullet is not-applicable to prepared output.
- **A6 ratchet test** `src/lib/workspace/live-store-usage.test.ts`: scan `src/components/**/*.tsx` for `usePrototype((s) => s.<mutation>)`, freeze the (file, action) pairs in an allow-list with one-line justifications, fail on any addition with the message in PLAN.md.
- **S1 truthful BOOKED/LOST**: there is no server path today that sets either (`close-enquiry-core.ts:32-55` only DECLINED; `insert into booking` has zero matches in `src`; `requireBookingAccess` at `tenancy.server.ts:104` has zero callers). Generalise to `closeEnquiryInTransaction(tx, {..., outcome})`, keep `declineEnquiryInTransaction` as a wrapper, bump `decision_revision`, mark the latest sent `quote_version` accepted on BOOKED, owner-attested audit line only, **never a message row**. Check `migrations/` for the lifecycle check constraint before writing new values. Server fns `recordOffChannelAcceptance` and `markEnquiryLost`. Extend `close-enquiry.db.test.ts` including the concurrent double-call case.
- **S2** `waiting-desk.tsx:224-234`, `:258-269` (accepted off-channel) and `:329` (mark lost) call S1 in live mode; toast "Recorded as booked. Nothing was sent to the customer." / "Marked as lost."
- **S3** bookings screens in live mode list BOOKED enquiries read-only (the `booking` table is never written server-side, so `s.bookings` is always empty for a live tenant).

### `cc2/pricing-hardening` - COMPLETE, awaiting full-suite result and independent review

| Commit | Item | What |
| --- | --- | --- |
| `80bbaf5` | C1 | `ruleFingerprint` serialises its parts with `JSON.stringify` instead of a `\|` join; `business-rule.test.ts` (new) covers the collision pair, normalisation, and `parseBusinessRule` rules. No fingerprint is persisted anywhere (checked `migrations/` and `src/lib/repo/`), so the string change is safe. |
| `80bbaf5` | C2 | `toCompilerFacts` drops `superseded` facts; two tests in `decide.test.ts`. |
| `80bbaf5` | C3 | `quantity.test.ts` (new, every problem class + `amountMinorFor` bounds) and `src/lib/interpret/index.server.test.ts` (new, stub > real > null precedence). |
| `61c9251` | C4 | `unpriceableActivePricing()` in `decide.ts` + test; `pricing-rules.tsx` names text-only Active pricing items instead of claiming nothing is set. |
| same | C5 | `benchmark/r2e/run.ts:212` note corrected (`selectRule` wraps `matchRule`; ambiguity is detected). |

Verified: `tsc` clean, `eslint` clean, domain tests 89/89 before C4 and the decide/business-rule/price-compiler/price-safety files green after. Full suite: section 5. `src/routeTree.gen.ts` shows as modified in this worktree with a 0-line diff (CRLF only); do not commit it.

### `cc2/hygiene` - NOT STARTED (branch exists, identical to main)

E1-E7 per PLAN.md. Facts verified for each: no `notFoundComponent` in `__root.tsx` and no catch-all route; `trust-screen.tsx:189` and `:325` use `?? businesses[0]` with no `!business` guard (line 37 has the pattern to copy); `roadmap-board.tsx:118` calls `void onNeed(id)` and `onNeed` (~500-522) has try/finally with no catch; `protect.server.ts:14-24` reads the first `x-forwarded-for` entry before `x-real-ip` (prefer `x-vercel-forwarded-for`, then `x-real-ip`, then the last `x-forwarded-for` entry); `guard.ts:96-109` never prunes `buckets`; `launch/api.ts` and `feedback.ts` do multi-table writes on the pooled client with select-then-insert (unique constraints: `migrations/0002_launch.sql:6` waitlist.email, `:30` roadmap_interest(feature_id, session_id)); `npm audit` has one HIGH (`js-yaml`, fix available); `src/lib/multiplayer/` has zero callers.

### `cc2/concurrency-evidence` - NOT STARTED (branch exists, identical to main)

CC1 gate B3. The agent got as far as confirming `embedded-postgres@18.4.0-beta.17` installs on win32-x64 (it is still in that worktree's `node_modules`, but `package.json`/lock were reverted so the branch is clean). Approach and the five scenarios (a-e) are in PLAN.md and were given to the agent verbatim; the important mechanics: set `process.env.DATABASE_URL` before the first dynamic import of `src/lib/db.ts` (`dbSource` is computed at module load; the `pg` Pool path is taken whenever the URL is set, `db.ts:19,97`); apply migrations with the existing `scripts/migrate.mjs` logic; make the test opt-in (`ENQUIRY_PG_CONCURRENCY=1`, `npm run test:concurrency`) so default discovery skips it; exercise the real `withTransaction` + repo cores, never hand SQL. No Docker daemon on this machine and starting Docker Desktop opens a window; a Supabase branch costs money and is the owner's call.

### Not started at all

CC2-T (minimal telemetry from `audit_event`), CC2-D (boundary tests), Teach-30, CC2-V (the beta verification walk), both gate walks. All specified in PLAN.md.

## 4. Owner-only blockers (unchanged)

1. `ANTHROPIC_API_KEY` on Vercel and locally - CC1 gate B1. Not present on this machine (`env` has none; no `.env` in the repo). Then `npm run benchmark:r2e` in real mode.
2. A disposable real Postgres for B3 - or accept the embedded-postgres route above, which needs no owner action.
3. Supabase Auth rate limits - Dashboard -> Authentication -> Rate Limits. The app calls Supabase Auth from the browser (`client.ts:133-168`), so nothing in the repo can enforce this.
4. Revoke/rotate the historical Grok preview credential at the broker (`PUBLIC_TRAFFIC_GATE.md` section 1).
5. Reconcile `docs/CURRENT_PHASE.md`: it still says CC1 is not implemented and not signed off; production is live at `9a00749` with CC1 merged.

## 5. Verification ledger

All on this machine, Windows 11, Node 22, in-memory PGLite (no `DATABASE_URL` set at any point).

| Branch | tsc | eslint | targeted tests | full suite (`--test-concurrency=1`) |
| --- | --- | --- | --- | --- |
| `cc2/public-demo-honesty` @ `0221011` | clean | clean | 59/59 | 731/731, 0 fail (13:46) |
| `cc2/live-controls` @ `f2c7fd9` | clean | clean | 25/25 | 727/727, 0 fail (13:52) |
| `cc2/pricing-hardening` @ `61c9251` | clean | clean | 66/66 | 763/763, 0 fail (14:04) |

`npm run build` succeeds on all three branches at the SHAs above (exit 0). The built client bundle on `cc2/public-demo-honesty` contains the "Simulated reply" string once and the other two branches contain it zero times, which is the expected split and the pre-merge content check for B2.

Baseline on `main` `9a00749`, reproduced independently at the start of the review: `tsc` clean, `eslint` clean, `npm run build` ok, 725/725, `npm audit` 1 HIGH (`js-yaml`).

## 6. Real-auth browser journey (for CC2-V and for every changed live control)

- `Playwright 1.62.1` with headless Chromium is installed (`%LOCALAPPDATA%\ms-playwright`). Headless only; no visible browser.
- Env: copy `.grok/app-env.json` from the review worktree into the worktree under test (it is gitignored; `scripts/with-app-env.mjs` merges it into `VITE_*`). Do not set `VITE_AUTH_ENABLED=false`: with the bypass, `workspace-boundary.tsx:110-113` skips `LiveWorkspaceGate`, so `fetchWorkspace()` never runs and the live path is not exercised (this is exactly how the CC1 implementer first fooled itself).
- Local dev has no durable DB: without `DATABASE_URL` the server uses in-memory PGLite per process; restarting the dev server wipes app data; Supabase SQL will never show these rows.
- Disposable user recipe (worked on 2026-09-07 and 2026-09-09): direct insert into `auth.users` setting ALL GoTrue columns (`instance_id`, `aud`, `role`, `encrypted_password` via `crypt()`, `email_confirmed_at`, empty confirmation/recovery/email_change tokens, `raw_app_meta_data`, `is_sso_user false`, `is_anonymous false`), then the password grant over curl, then set localStorage key `sb-qzzvxfbitixpmfuirvhq-auth-token` and navigate to `/onboarding`. Supabase's signup validator rejects `.test` TLDs and magic links are rate-limited; the direct insert bypasses both. Always delete the auth user afterwards; `select count(*) from public.contacts` must stay 5 (Orbit shares the project).
- Evidence goes under `docs/evidence/cc2-<slice>/` with a JOURNEY-LOG.md, following the CC1 layout in `docs/implementation/CC1_COMMERCIAL_CORRECTNESS/evidence/`.

## 7. Recommended next steps, in order

1. Read `full-suite-results.txt`; fill section 5. If any branch is red, fix on that branch before anything else.
2. `npm run build` on `cc2/public-demo-honesty`; open a PR; independent review (a fresh reviewer, not the implementer - `pr-review-expert`-style: blast radius, the `simulated` field through persistence, the `types.ts` formatting noise); merge; verify production by content as described above.
3. Same for `cc2/pricing-hardening` (self-contained, no UI risk beyond the pricing-screen copy).
4. Finish `cc2/live-controls` A3-A6 and S1-S3 per section 3; PR; review; merge. This is the slice CC1 sign-off depends on.
5. `cc2/concurrency-evidence` (B3) and, once the owner supplies the key, the real-mode benchmark (B1).
6. CC2-T, then the CC2-V verification walk at the integrated head, then independent sign-off of CC1 + CC2, then the owner declares the beta gate.
7. `cc2/hygiene`, CC2-D, Teach-30, public-traffic gate walk.

## 8. Gotchas found this session

- Five parallel Sonnet subagents hit the account's 5-hour session limit at once and were terminated mid-item; their uncommitted work was salvaged by hand. If you fan out, fewer agents with fuller briefs, and commit after every item (the briefs said so; only one agent had committed).
- The AskUserQuestion tool errored on a PreToolUse hook (`pretool-router.ps1`, no stderr) - do not rely on it in this harness; state the default you are taking and proceed.
- The Vercel CLI on this machine is logged into the wrong team; verify deploys by fetching the site, not `vercel ls`.
- CRLF warnings on every `git add` are normal here.
- Some agents ran prettier on files they touched; the eslint config does not enforce prettier, so baseline files are not prettier-formatted and a `prettier --write` produces large noise diffs. Keep diffs tight; do not format whole files.
