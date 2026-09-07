# CC1 implementation report

Implemented by Claude on 2026-09-07 (Australia/Brisbane). **Not signed off.**
Independent review, not the implementer, decides whether CC1 passes.

## Revision and status

- Implementation branch / PR: `cc1/commercial-correctness` (draft PR against `main`).
- Actual pre-change baseline SHA: `41d9d3371a5fa9a2a29552faea2506f65080dd4d` (`origin/main`).
- Tested application SHA: `2849113ee94434ed3327c863d819bc93899ab0ac`, clean tree.
- Final report SHA: the commit adding this file (docs only; no source change after the tested SHA).
- Environment: Windows 11, Node v22.16.0, isolated git worktree, in-memory PGLite
  (no `DATABASE_URL` was set at any point, so no external database was reached).
  Browser checks used Chrome via chrome-devtools against a local dev server on
  port 5178. No credentials were added to the repository.
- Overall status: **implemented, partially verified, with two named blockers**
  (real-provider interpretation; the full live signed-in browser journey).
- Independent sign-off: pending.

## Reproducing the defects first

Every defect family was reproduced on the actual pre-change baseline before any
fix, not assumed from the review:

| Check                                      | Result at `41d9d33`           | Evidence                                                                |
| ------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------- |
| `npm test -- --test-concurrency=1`         | 590 pass / 0 fail, exit 0     | `evidence/implementation/<sha>/commands/base-test.txt`  |
| `npm run typecheck`                        | exit 0                        | recorded during baseline capture                                        |
| `npm run lint`                             | exit 0 (0 errors, 0 warnings) | recorded during baseline capture                                        |
| CC1 probe (`probes/price-safety.probe.ts`) | **6 tests, 0 pass, 6 fail**   | `evidence/implementation/<sha>/commands/base-probe.txt` |

All three defect families reproduced: quantity meaning, service/rule ordering,
and unconfirmed-service pricing. The same probe passes 6/6 at the tested SHA.

## Decisions and changes

### Quantity grammar (CC1-01)

`src/domain/quantity.ts` defines a closed grammar: one number, optionally
followed by the unit word the owner writes it with (`4`, `4 people`, `2.5
hours`, `40 square metres`), at most nine integer digits and four decimal
places. Everything else returns a named problem with the original text intact:
`range`, `alternatives`, `negative`, `multiple`, `zero`, `malformed`, `empty`,
`too_large`.

Deliberate rulings:

- **Zero is refused**, not priced. A per-unit rule bills for units; zero units
  is a mistake or a decision not to quote, and an AUD 0 quote should not leave
  the building silently.
- **Fractional quantities are preserved.** No integer coercion is applied from
  unit prose - hours and area are legitimately fractional (Q07).
- **Ranges are not evaluated across the range.** The package permits a
  range-aware outcome but does not require it; an unresolved range stays
  unresolved and the owner is asked the one question that settles it.
- **Money is bounded** (`amountMinorFor`): the minor-unit result must be a safe
  integer within `MAX_AMOUNT_MINOR`, so no quantity can produce a non-finite or
  unstorable amount.

Enforced in three places, not one: `parseQuantity` (grammar),
`compilePrice` -> `UNRESOLVED_QUANTITY` (decision), and `answerEnquiryFact` via
`validateFactAnswer` (server write). The server refuses to store a `confirmed`
fact whose value cannot mean a quantity for a rule that would consume it, so
the invariant does not depend on a UI input restriction. Only fields some
Active per-unit rule reads as its quantity are checked - answers to "which
room?" stay free text.

### Service and rule ambiguity (CC1-02)

`matchRule` replaces first-match selection with three explicit outcomes: `one`,
`none`, `ambiguous`. Candidates are ordered by a content fingerprint
(`ruleFingerprint`), never by array position, so reordering the same logical
rules cannot change the commercial answer. Byte-identical duplicates collapse
to one rule - saving the same price twice is not a disagreement about the
price. Two distinct prices for one service is `conflicting_rules`; rules for
different services is `multiple_services`; the owner resolves both, but the
question differs. `selectRule` survives for callers that only ask "is there one
rule?" and returns `undefined` for both "none" and "several", so it can never
decide a price.

The save path was the other half. `saveBusinessRuleInTransaction` supersedes
earlier Active rules for the same service **in the same transaction** as the
insert, taking `for update` on the current Active set first. History is kept:
the previous row becomes `state = 'Superseded'` with `effective_to` set, and
the new row carries the next version number. An identical save is a no-op that
returns the existing id. No schema change was needed - `Superseded` and
`effective_to` already existed.

### Service authority (CC1-03)

The authority is persisted separately from the value, because a nonblank
`service_label` proves nothing about who decided it: `interpretAndApply` writes
that column too.

- A live `service` fact whose status is not `confirmed` makes `compilePrice`
  return `PROVISIONAL` rather than `EXACT`.
- `decideEnquiry` carries the figure as `provisional`; `snapshotFromDecision`
  stores it in `provisionalPrice`, **deliberately not `price`**. Every writer
  that turns a decision into money reads `price`, so an unconfirmed amount
  cannot reach a quote row even if the UI is bypassed.
- The recommendation stays `ESCALATE_HUMAN` with `primaryEnabled: false`.
- `insertManualEnquiry` now records a service the **owner** typed as a
  `confirmed`, `asserted_by = 'user'` fact in the enquiry-creation transaction.
  That is the deliberate authoritative path for manual entry.
- The server approval boundary (`prepareReviewedSendInTransaction`) refuses to
  prepare a `SEND_QUOTE`/`SEND_ESTIMATE` review unless a live confirmed
  `service` fact exists. This is what handles **legacy rows** that carry a
  nonblank label with no authority evidence: they are not silently promoted,
  and they cannot be quoted until confirmed. No historical data was rewritten.
- `ServiceReadAs` shows the provisional figure, explicitly labelled "Not quoted
  yet", so confirming is an informed act.

### Copy is not a send; the reviewed artefact is the authority (CC1-04, CC1-05)

A **reviewed send** (`migrations/0007`, `reviewed_send`) is a server-created
row that freezes what the owner actually reviewed: the text, the structured
amount, the service, the channel, the server-derived recipient, and the
decision revision. Confirming a send records **that**, never a snapshot re-read
at record time and never anything the client supplies.

- `prepareSendReview` creates or returns the artefact. It refuses a closed
  enquiry, a non-sendable action, an unconfirmed service premise on a quote,
  and a body naming money the structured decision does not.
- The old single button "Copy and record as sent" is gone. `SendPreview` now
  has a `Copy the message` step that writes nothing and reports honestly
  whether the clipboard took it (falling back to selecting the text), and a
  separate `I've sent this externally` confirmation that is the only thing in
  the product creating an outbound record.
- `recordSentReply` accepts only `enquiryId`, `reviewedSendId` and an explicit
  `staleAttestation` flag. There is no parameter through which a crafted body,
  amount or recipient can reach the record.
- `recordSentReplyInTransaction` was **deleted**, not deprecated. It had no
  caller left, and keeping a second way to record a send - one that takes the
  body from the client and the amount from a current snapshot - is how the
  unsafe one gets called again.

**Idempotency is content-derived**: one artefact per `(enquiry_id, body_hash)`.
The decision revision is deliberately not part of that key, because recording
a send bumps the revision - a key including it would let the recovery case
(confirm, response lost, refresh, confirm again) create a second artefact at
the new revision and record the same message twice. Two genuinely different
follow-ups differ in their text and get their own rows. An owner who wants to
send byte-identical text a second time must change something, which is a low
price for never recording a send twice.

**Amount consistency is a check, not an extraction.** `amountAgrees` compares
money named in the reviewed text against the structured decision and refuses a
disagreement. Prose never becomes an authoritative price. Tone edits, and text
naming no money at all, pass untouched.

**Stale approvals.** A stale artefact used to start a new send is refused with
the reviewed and current revisions named. An owner attesting they already sent
that older approved message is telling the truth about history: it is recorded
exactly as written, at its own reviewed amount and revision, its quote row
marked `superseded`, the conflict flagged in the audit line, and the newer
decision deliberately not advanced - no responsibility transfer, no
`value_exact_minor` overwrite.

### Transactions and revisions (CC1-06)

`enquiry.decision_revision` is a monotonic counter bumped by every writer of
`decision_snapshot`. `src/lib/repo/decision-apply.ts` is the single shared
path: `lockEnquiry` takes `for update`, `applyDecision` re-reads live facts and
rules, decides, writes the snapshot, state and next revision. All three writers
now use it inside one transaction - `answerEnquiryFact`, `setEnquiryService`
and `interpretAndApply`. Previously the first two wrote the fact
transactionally and recomputed the decision outside it.

Provider calls stay outside transactions: `interpretAndApply` awaits the
interpreter first, then takes the lock and re-reads. `isClosed` drops a late
result on a declined, lost or booked enquiry with an honest audit line rather
than reopening or re-quoting it.

### Delivery owner's demo ruling (CC1-04 / C06)

- The Cmd/Ctrl+Enter shortcut no longer records a send in any mode.
  `mayRecordSendViaShortcut` returned `true` for demo while its own comment
  said a real send goes through the approval preview - so in demo it did
  exactly what the sentence forbade. Sending in demo still works through the
  Send button and its preview.
- The "does not send from here" disclosure is no longer suppressed in demo
  mode (`intelligence.tsx`), and demo confirmations read "I've sent this
  externally (demo)" with an explicit demonstration-only note.
- The fabricated inbound reply and auto-booking (`prototype-store.ts:648-653`)
  is not implemented - see remaining risks.

## Findings and acceptance

| Work item  | Review ID          | Implementation paths                                                                                                                                                                                                                                                   | Tests / acceptance IDs                                                                      | Observed result                                                                                                                                                                                                                                                                           | Evidence path                                         | Remaining limitation                                                                                    |
| ---------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| CC1-01     | P1-01              | `domain/quantity.ts`, `domain/price-compiler.ts`, `domain/decide.ts` (`validateFactAnswer`), `lib/server/enquiry-actions.ts`                                                                                                                                           | Q01-Q07, `domain/price-safety.test.ts` (23)                                                 | Implemented and verified. The three review probes that produced AUD 5,600 / 4,500 / 500 now return `UNRESOLVED_QUANTITY`. Q05-Q07 confirm ordinary counts, minimums and fractional units still price.                                                                                     | `commands/npm-test.txt`                               | Range-aware pricing across a whole range not implemented (not required by CC1).                         |
| CC1-02     | P1-02              | `domain/price-compiler.ts` (`matchRule`), `domain/business-rule.ts` (`ruleFingerprint`), `lib/repo/business-rule-core.ts`, `lib/server/enquiry-actions.ts`                                                                                                             | S01-S04 in `price-safety.test.ts`; S03/S05 in `lib/repo/business-rule.db.test.ts` (5)       | Implemented and verified. Order-independence asserted by comparing both orderings; supersession proven against the database with history retained.                                                                                                                                        | `commands/npm-test.txt`                               | Concurrent competing saves rely on `for update`, unproven on multi-connection Postgres.                 |
| CC1-03     | P1-03              | `domain/price-compiler.ts` (`PROVISIONAL`), `domain/decide.ts`, `domain/decision-snapshot.ts`, `domain/types.ts`, `lib/repo/manual-enquiry-core.ts`, `lib/repo/reviewed-send-core.ts`, `components/enquiry/service-read-as.tsx`                                        | A01-A04, `lib/repo/service-authority.db.test.ts` (5) plus A01/A02 in `price-safety.test.ts` | Implemented and verified at domain and repository level. A03's legacy case is enforced at the server approval boundary and proven in `reviewed-send.db.test.ts`.                                                                                                                          | `commands/npm-test.txt`                               | Not exercised through the live browser.                                                                 |
| CC1-04     | P1-04              | `migrations/0007`, `lib/repo/reviewed-send-core.ts`, `lib/repo/sent-reply-core.ts`, `lib/server/enquiry-actions.ts`, `lib/workspace/live-mutations.ts`, `components/enquiry/send-preview.tsx`, `intelligence.tsx`, `waiting-desk.tsx`, `domain/live-demo-isolation.ts` | C01-C06, `lib/repo/reviewed-send.db.test.ts` (34)                                           | Implemented and verified at repository level; partially verified in the browser. Copy/confirm separation and truthful copy feedback observed on desktop 1440 and phone 390.                                                                                                               | `commands/npm-test.txt`, `browser/desktop-1440-send-preview.png`, `browser/phone-390-send-preview.png`              | Browser observation used the demo path for the shared component; the live signed-in journey is blocked. |
| CC1-05     | P1-05              | as CC1-04, plus `amountAgrees` and the stale-attestation path                                                                                                                                                                                                          | P01-P05 in `reviewed-send.db.test.ts`                                                       | Implemented and verified at repository level. An amount mismatch is refused with nothing written; a stale review is refused; a historical attestation records without advancing the newer decision.                                                                                       | `commands/npm-test.txt`                               | Not exercised through the live browser.                                                                 |
| CC1-06     | P2-01              | `lib/repo/decision-apply.ts`, `manual-enquiry-core.ts`, `enquiry-actions.ts`, `migrations/0007`                                                                                                                                                                        | T01-T05, `lib/repo/decision-apply.db.test.ts` (6) and `reviewed-send.db.test.ts`            | Implemented and verified against PGLite. Injected failures roll back; retries work; late results neither overwrite an owner nor reopen a closed enquiry.                                                                                                                                  | `commands/npm-test.txt`                               | True multi-connection concurrency not proven - `for update` is a no-op on single-connection PGLite.     |
| Boundaries | Preserved controls | unchanged auth/tenancy; ownership checks in `reviewed-send-core.ts` / `sent-reply-core.ts`                                                                                                                                                                             | I01-I03                                                                                     | Partially verified. I01 proven at repository level (cross-enquiry and cross-tenant confirmations refused, no writes). I02 observed live: a freshly created workspace showed zero enquiries and no fixture leakage. I03 covered by existing r2e null/failure/injection cases, all passing. | `commands/npm-test.txt`, `commands/benchmark-r2e.txt` | I01 not exercised at the HTTP endpoint layer with two real signed-in tenants.                           |

## Command ledger

All commands run at `2849113ee94434ed3327c863d819bc93899ab0ac`, clean tree, no
`DATABASE_URL` set.

| Exact command                                                                                                                                                 | Exit code | Result                                               | Evidence path                                                  | Baseline comparison                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `node --experimental-strip-types --import ./scripts/test-resolve-hook.mjs --test docs/implementation/CC1_COMMERCIAL_CORRECTNESS/probes/price-safety.probe.ts` | 0         | 6 tests, 6 pass, 0 fail                              | `commands/npm-test.txt` (integrated as `price-safety.test.ts`) | 0 pass / 6 fail at `41d9d33` (`commands/base-probe.txt`)                                          |
| `npm test -- --test-concurrency=1`                                                                                                                            | 0         | 59 files, **641 tests, 641 pass, 0 fail**            | `commands/npm-test.txt`                                        | 590/590 at `41d9d33`; +51 net. No failures either side.                                                           |
| `npm run typecheck`                                                                                                                                           | 0         | clean                                                | `commands/typecheck.txt`                                       | clean at baseline                                                                                                 |
| `npm run lint`                                                                                                                                                | 0         | 0 errors, 0 warnings                                 | `commands/lint.txt`                                            | clean at baseline                                                                                                 |
| `npm run check:auth -- --dev-url http://127.0.0.1:5178`                                                                                                       | 0         | "dev and build agree: sign-in on"                    | `commands/check-auth.txt`                                      | At baseline this returned exit 2 (indeterminate) only because no dev server was running; with a server it agrees. |
| `npm run benchmark:r2e`                                                                                                                                       | 0         | null 16/16, fake 16/16, **real 1 pass / 15 skipped** | `commands/benchmark-r2e.txt`                                   | Same shape as the checked-in historical report.                                                                   |
| `npm run build` (no `DATABASE_URL`)                                                                                                                           | 0         | built; `db:migrate` skipped, "DATABASE_URL not set"  | `commands/npm-build.txt`                                       | not run at baseline                                                                                               |
| `npm run build:dev`                                                                                                                                           | 0         | built                                                | `commands/npm-build-dev.txt`                                   | not run at baseline                                                                                               |
| Browser journey (Chrome, dev server 5178, `VITE_AUTH_ENABLED=false`)                                                                                          | n/a       | **partial** - see blockers                           | `browser/desktop-1440-send-preview.png`, `browser/phone-390-send-preview.png`                                                | fixture-load behaviour reproduced identically at `41d9d33` on port 5179                                           |

`npm run build` was safe by construction: `scripts/migrate.mjs` exits early
when `DATABASE_URL` is unset, and the log records it doing so. No database
outside the in-process PGLite instance was contacted at any point in this work.

**Note on one aborted run.** An earlier attempt at the final `npm test` exited
1 with no summary while two Vite dev servers and Chrome were running; a second
Vite server had already crashed with a V8 heap failure. After stopping both
servers the identical command returned 641/641 pass, exit 0. This was host
memory exhaustion, not a test failure - no assertion failed in either run.

## Blockers

These are stated as blockers, not passes. Nothing below was worked around by
weakening a test or describing a skipped check as verified.

### B1 - Real-provider interpretation is not evidenced

`ANTHROPIC_API_KEY` is not set in this environment. `npm run benchmark:r2e`
ran all three modes: null 16/16 and fake 16/16 genuinely exercise the
deterministic pipeline, but real mode is **1 pass / 15 skipped**, and the one
"pass" is the provider-failure case whose transport never calls the network.
That is not real-provider evidence and is not claimed as any. No credentials
were added to the repository. Acceptance rows depending on real-model quality
remain unverified.

### B2 - The full live signed-in browser journey could not be completed

**What was verified in a browser** (Chrome, dev server on 5178,
`VITE_AUTH_ENABLED=false`, the documented local-only override; the middleware
still resolves a real user id and `requireEnquiryAccess` / `requireBusinessAccess`
still run):

- The rebuilt approval preview renders with **Copy the message** and **I've
  sent this externally** as separate controls, at 1440x900 and at 390x844.
- Clicking copy reports "Copied to your clipboard. **Nothing has been sent or
  recorded yet.**" and records nothing.
- The copies-not-sends disclosure now appears in demo mode ("Enquiry does not
  send from here - you send it, then record it").
- I02: creating a fresh live workspace through `/onboarding` produced a queue
  with zero enquiries and no fixture business, enquiry or arrival leakage.
- No console errors or warnings on any page visited.

**What blocked the rest.** After onboarding, the client store held
`demoMode: false` but **zero businesses**, so the live intake control
(`AddEnquiry`, which requires a resolved `activeBusiness`) never rendered, and
a page reload put the app back on the fixture workspace. The live signed-in
loop - paste an enquiry, confirm a blocking fact, review, copy, reload, confirm
the external send, reload again - therefore could not be driven end to end.

**This is pre-existing and unrelated to CC1**, established two ways rather than
assumed:

1. **Observed at baseline.** A second dev server at `41d9d33` on port 5179,
   with cleared storage, loaded the same fixture workspace (19 fixture
   enquiries) on a fresh page load. Identical signature.
2. **No changed file participates.** The provisioning and hydration path -
   `lib/repo/provision-core.ts`, `provision.server.ts`,
   `lib/repo/workspace.server.ts`, `lib/server/workspace.ts`,
   `store/prototype-store.ts`, `routes/onboarding.tsx` - contains **none** of
   the files in this branch's diff.

Per `AGENTS.project.md` section 12, this is recorded rather than fixed: it sits
outside CC1's six authorised items and is not an immediate security or
data-loss incident on the exercised path. It does, however, conflict with
`AGENTS.project.md` section 13 ("Refreshing the browser must not revert a real
business to session-storage or fixture state") and should be placed into a
phase by product management. Acceptance rows C01-C06, P01-P05 and A01-A04 are
therefore **verified at the repository/database level and blocked at the
browser level**.

### B3 - True multi-connection concurrency is not proven

Per the package's own evidence levels, controlled multi-connection PostgreSQL
tests are required before claiming concurrent-write races are resolved. Only
in-memory PGLite was available, and it runs a single connection, so `for
update` never actually blocks there. What **was** proven: injected-failure
rollback, retry after failure, sequential double-confirm, and two overlapping
`Promise.all` confirmations resolving to exactly one recorded send. What was
**not** proven: two genuinely concurrent transactions on separate connections
contending for the same enquiry lock. This gate is **blocked**.

## Migration and data notes

`migrations/0007_reviewed_sends_and_revisions.sql` is the only schema change:

- `enquiry.decision_revision bigint not null default 0` - additive.
- `reviewed_send` - a new table.
- `message.reviewed_send_id`, `quote_version.reviewed_send_id` - nullable
  additive foreign keys.
- One unique index, `reviewed_send (enquiry_id, body_hash)`.

Every statement is `if not exists` / `add column if not exists`, so the file is
idempotent. **No data is rewritten, deleted or backfilled.**

Tested against representative existing data in
`src/lib/repo/migration-0007.db.test.ts` (6 tests): a database is built to
migration 0006, filled with an enquiry carrying a decision snapshot, an
already-sent outbound message and a sent quote version, and only then upgraded.
The tests assert that no row is lost, that message and quote content is
byte-for-byte unchanged, that every existing enquiry gets `decision_revision =
0` (not a fabricated count), that **no `reviewed_send` row is invented for a
message sent before reviewed sends existed**, and that re-running the migration
does not reset live values.

**Legacy handling, stated explicitly.** Enquiries created before this slice
carry `decision_revision = 0` and no service fact. They are not promoted: a
quote review for such a row is refused with `service_unconfirmed` until the
owner confirms the service through the existing control. Historically sent
messages keep a null `reviewed_send_id` rather than a fabricated artefact. No
automatic historical repair was performed, and none is authorised.

**Deployment note.** `npm run build` runs `db:migrate`. On a deployment with
`DATABASE_URL` set, 0007 will apply. It is additive and idempotent, but it has
been exercised only against PGLite; a reviewer may want it applied to a
disposable Postgres copy of production before any deploy.

## Evidence and residual risks

Evidence lives under
`docs/implementation/CC1_COMMERCIAL_CORRECTNESS/evidence/implementation/2849113ee94434ed3327c863d819bc93899ab0ac/`.
The historical baseline under `evidence/BASELINE.md` was left unchanged.

Evidence levels are kept separate and are not blended:

- **Domain tests** (`price-safety.test.ts`) prove parsing and decision logic only.
- **PGLite repository tests** (`reviewed-send`, `service-authority`,
  `business-rule`, `decision-apply`, `migration-0007`) prove exercised SQL and
  transaction behaviour on one connection - not every production schedule.
- **Browser observation** proves the exercised demo/live surfaces named in B2,
  not the whole live loop.
- **No provider call was made.** Null, fake and injected-failure coverage keeps
  those labels throughout.

### Residual risks

1. **B1, B2, B3 above.** Each is an open gate, not a passed one.
2. **Fabricated demo reply and auto-booking - not implemented, as ruled.** The
   demo store fabricates an inbound customer reply roughly 7.2 s after a send
   and marks the job Booked (`src/store/prototype-store.ts:648-653`), and this
   also fires inside the production homepage embed. The delivery owner ruled
   this outside CC1. It is recorded here for separate authorisation. Note it
   interacts with this slice: the demo can still reach a "Booked" state that no
   owner attested.
3. **Stale pricing empty state.** `src/components/business/pricing-rules.tsx:91`
   renders "Enquiry cannot price anything yet" whenever `activeRules(business)`
   is empty. Confirmed in the browser against the fixture business Glow & Co,
   which displays Active pricing knowledge items on the same screen while the
   panel claims nothing can be priced. Root cause is fixture knowledge items
   carrying no `rulePayload`, so `activeRules` returns none; the live hydration
   path does map `rulePayload` (`lib/repo/rows.ts:265`). Not a commercial
   correctness defect and not fixed. The adjacent save feedback on that screen
   **was** corrected, because CC1-02 changed what a save means.
4. **`decideEnquiry` remains narrower than the product contract** (review
   P2-02). Unchanged by CC1 and still true.
5. **Byte-identical repeat sends.** The content-derived idempotency key means
   an owner cannot record two byte-identical messages at the same enquiry as
   two sends. This is deliberate (see CC1-04 above) but is a behaviour a
   reviewer should agree with rather than discover.
6. **`amountAgrees` recognises `$`-prefixed amounts only.** A reviewed body
   writing "580 dollars" would not be compared against the structured amount.
   It reuses the repository's existing `dollarAmounts` helper rather than
   introducing a second money parser; widening it is a product decision.
7. **Zero quantity is refused.** If a business genuinely quotes a zero-unit
   line, this now blocks rather than pricing it at nil. Deliberate, and stated
   here so it can be overruled knowingly.

## Reviewer handoff

Branch `cc1/commercial-correctness`, five commits on top of
`41d9d3371a5fa9a2a29552faea2506f65080dd4d`. Every CC1 item is implemented, each
defect family was reproduced on the real baseline before being fixed, the
regressions live in the default discovered suite (`npm test` finds them without
extra arguments), and the repository is green: 641/641 tests, typecheck, lint,
`check:auth`, both builds, and the benchmark.

**This slice is ready for independent review. It is not signed off, not
released, and not deployed.** Three gates are explicitly open: real-provider
interpretation (B1), the full live signed-in browser journey (B2), and
multi-connection concurrency (B3). `docs/BETA_READINESS_GATE.md` and
`docs/PUBLIC_TRAFFIC_GATE.md` remain unresolved and untouched. The roadmap was
not advanced and `docs/CURRENT_PHASE.md` was not edited - the next R2 decision
belongs to the reviewer.
