# CC1 implementation report

Implemented by Claude on 2026-09-07 (Australia/Brisbane). **Not signed off.**
Independent review, not the implementer, decides whether CC1 passes.

## Revision and status

- Implementation branch / PR: `cc1/commercial-correctness`, draft PR #11 against `main`.
- Actual pre-change baseline SHA: `41d9d3371a5fa9a2a29552faea2506f65080dd4d` (`origin/main`).
- Tested application SHA: `e03751780252d08d89d05264fbd48b1adb01057e`, clean tree.
- **Revision 3**, after the browser-journey gate (research doc 38) found a
  live-only defect inside CC1-03/A02: the pencil-edit correction control wrote
  to the client store instead of the server. Fixed in `e037517`, and A02 and
  P03 were then re-exercised in a browser under real auth - see the recheck
  log under `evidence/implementation/<sha>/browser-recheck/`.
- **Revision 2**, after the independent review of PR #11
  (`research/agent-runs/2026-09-04/35-review-pr11-cc1.md`) returned BLOCKING.
  All four blocking findings are fixed, one commit each, each reproduced with a
  failing test first. Six review suggestions were taken. Blocker 2 below is
  reclassified: the review's companion RCA showed my original diagnosis was
  wrong.
- Final report SHA: the commit adding this file (docs only; no source change after the tested SHA).
- Environment: Windows 11, Node v22.16.0, isolated git worktree, in-memory PGLite
  (no `DATABASE_URL` was set at any point, so no external database was reached).
  Browser checks used Chrome via chrome-devtools against a local dev server on
  port 5178. No credentials were added to the repository.
- Overall status: **implemented, partially verified, with three named gates
  open** (real-provider interpretation; the live signed-in browser journey,
  which was not exercised here; multi-connection concurrency).
- Independent sign-off: pending.

## Reproducing the defects first

Every defect family was reproduced on the actual pre-change baseline before any
fix, not assumed from the review:

| Check                                      | Result at `41d9d33`           | Evidence                                                |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------- |
| `npm test -- --test-concurrency=1`         | 0                             | 62 files, **673 tests, 673 pass, 0 fail**               | 590/590 at `41d9d33`; +83 net. No failures either side. |
| `npm run typecheck`                        | exit 0                        | recorded during baseline capture                        |
| `npm run lint`                             | exit 0 (0 errors, 0 warnings) | recorded during baseline capture                        |
| CC1 probe (`probes/price-safety.probe.ts`) | **6 tests, 0 pass, 6 fail**   | `evidence/implementation/<sha>/commands/base-probe.txt` |

All three defect families reproduced: quantity meaning, service/rule ordering,
and unconfirmed-service pricing. The same probe passes 6/6 at the tested SHA.

## Response to the independent review of PR #11

The review returned BLOCKING with four findings, two proven by executing branch
code against a real database. All four are fixed. Each was reproduced with a
failing test before the fix, and each has its own commit.

| Finding                           | What was wrong                                                                                                                                                                                                                                                                                                                                                           | Commit    | Reproduction                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **B-1** (Q05, Q06, C03, P01, P02) | `amountAgrees` compared every `$` figure in the reviewed body against the single structured total. `composeReply` writes "That comes to $580. 4 people at $145 each.", so the unit rate read as a disagreement and **every per-unit quote was refused as `amount_mismatch`** - the rule kind this slice was specified around. Minimum-billed quotes failed the same way. | `6fcc498` | `composed-draft-send.db.test.ts`, which never writes a body: it drives an enquiry from `insertManualEnquiry` through the decision and sends whatever the product composed. Three of its six cases failed before the fix. |
| **B-2** (T05, P05)                | The closed-enquiry guard was `isClosed(...) && !input.staleAttestation` - a **client boolean switched off a server lifecycle check** - and decline did not bump `decision_revision`, so a pre-decline artefact was not stale and took the branch that advances the enquiry. A DECLINED enquiry acquired WAITING_ON_CLIENT / QUOTED / CUSTOMER and a live `sent` quote.   | `cdba7c2` | Three cases in `reviewed-send.db.test.ts`; two failed before the fix.                                                                                                                                                    |
| **B-3** (T02, T05, CC1-06)        | `interpretAndApply` took `for update` and called `applyDecision`, but the live caller passed the **pooled** `Sql`, where each statement is its own implicit transaction. The lock was released at statement end and the critical section did not exist on the deployed path.                                                                                             | `ade329a` | A new `decision-apply.db.test.ts` case injects a failure between the fact writes and the snapshot write and asserts nothing survives.                                                                                    |
| **B-4** (A03)                     | The server correctly refused a quote without a confirmed service fact, but the only control that could create one rendered **exclusively for a model-provenance fact**. A pre-CC1 enquiry showed a ready quote, an enabled button, a server refusal and no way to resolve it.                                                                                            | `82f9b7a` | `service-authority.test.ts` (6 cases) plus the disabled primary action.                                                                                                                                                  |

Suggestions taken, all in `c305c5a`: **S-5** (lock order inverted between
prepare and confirm - both now lock the enquiry first, closing an ABBA deadlock
on real Postgres), **S-6** (the two SAVEPOINT quote-version retry tests carried
over from the deleted suite), **S-2** (prepare returns the artefact's own frozen
amount rather than the live snapshot's), **S-8** and **S-9** (comments and a
test name describing code that no longer exists), **S-10** (`4 plus`, `5 max`,
`3 minimum`, `at least 4`, `roughly 4` now unresolved rather than silently read
as the bare number).

Suggestions **not** taken, deliberately: **S-1** (byte-identical follow-ups
cannot both be recorded) is the trade-off that makes the recovery guarantee
work and is listed as a residual risk for the product owner to ratify; **S-3**
(the attestation button is auto-focused) is a real point but changing which
control receives focus is a UX decision rather than a correctness one; **S-4**
(a unique partial index on Active rules per service) is a schema change beyond
what the four findings need, and the downstream behaviour is already fail-safe;
**S-7** (an `edited` boolean on the artefact) adds a derived field where the
exact reviewed text is already recoverable through `message.reviewed_send_id`.
Each is left for the reviewer to direct.

### One correction to revision 1 of this report

Revision 1 claimed "All three writers now use it inside one transaction". Two of
three did; the interpreter did not. That is B-3, and the claim was false when
written. It is now true, and enforced by the type system rather than by comment:
`runInTransaction` is a required field, so no call site can omit it.

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

| Work item  | Review ID          | Implementation paths                                                                                                                                                                                                                                                   | Tests / acceptance IDs                                                                                                                                                      | Observed result                                                                                                                                                                                                                                                                                                                                                        | Evidence path                                                                                          | Remaining limitation                                                                                           |
| ---------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| CC1-01     | P1-01              | `domain/quantity.ts`, `domain/price-compiler.ts`, `domain/decide.ts` (`validateFactAnswer`), `lib/server/enquiry-actions.ts`                                                                                                                                           | Q01-Q07, `domain/price-safety.test.ts` (23)                                                                                                                                 | Implemented and verified. The three review probes that produced AUD 5,600 / 4,500 / 500 now return `UNRESOLVED_QUANTITY`. Q05-Q07 confirm ordinary counts, minimums and fractional units still price.                                                                                                                                                                  | `commands/npm-test.txt`                                                                                | Range-aware pricing across a whole range not implemented (not required by CC1).                                |
| CC1-02     | P1-02              | `domain/price-compiler.ts` (`matchRule`), `domain/business-rule.ts` (`ruleFingerprint`), `lib/repo/business-rule-core.ts`, `lib/server/enquiry-actions.ts`                                                                                                             | S01-S04 in `price-safety.test.ts`; S03/S05 in `lib/repo/business-rule.db.test.ts` (5)                                                                                       | Implemented and verified. Order-independence asserted by comparing both orderings; supersession proven against the database with history retained.                                                                                                                                                                                                                     | `commands/npm-test.txt`                                                                                | Concurrent competing saves rely on `for update`, unproven on multi-connection Postgres.                        |
| CC1-03     | P1-03              | as revision 1, plus `domain/service-authority.ts`, `domain/fact-correction.ts`, `components/enquiry/intelligence.tsx`, `situation-card.tsx`                                                                                                                            | A01-A04, `lib/repo/service-authority.db.test.ts` (5), `domain/service-authority.test.ts` (6), `domain/fact-correction.test.ts` (4), A02 in `composed-draft-send.db.test.ts` | Implemented and **verified live**. A03 has the confirmation path it lacked (B-4). **A02 is now genuinely satisfied**: the correction control reached only the client store, so a correction reverted on reload; it now goes through the server and was observed persisting across a reload in a real signed-in browser.                                                | `browser-recheck/A02-corrected-6-after-reload.png`                                                     | Demo-mode correction path not exercised in a browser.                                                          |
| CC1-04     | P1-04              | `migrations/0007`, `lib/repo/reviewed-send-core.ts`, `lib/repo/sent-reply-core.ts`, `lib/server/enquiry-actions.ts`, `lib/workspace/live-mutations.ts`, `components/enquiry/send-preview.tsx`, `intelligence.tsx`, `waiting-desk.tsx`, `domain/live-demo-isolation.ts` | C01-C06, `lib/repo/reviewed-send.db.test.ts` (39)                                                                                                                           | Implemented and verified at repository level; the component was observed rendering on desktop 1440 and phone 390. **C03 is now genuinely reachable for a per-unit quote (B-1)**.                                                                                                                                                                                       | `commands/npm-test.txt`, `browser/desktop-1440-send-preview.png`, `browser/phone-390-send-preview.png` | Browser observation used the demo path, which never calls the server; the live journey was not exercised (B2). |
| CC1-05     | P1-05              | as CC1-04, plus `impliedAmountsMinor`, `amountAgrees` and the stale-attestation path                                                                                                                                                                                   | P01-P05 in `reviewed-send.db.test.ts` and `composed-draft-send.db.test.ts`                                                                                                  | Implemented and verified at repository level, and **P03 now verified live**: a preview frozen at $870 was refused after a second tab corrected the quantity to 5, with nothing recorded and the enquiry not advanced. The consistency rule accepts what the structured price implies (B-1), which the same browser pass confirmed on the product's own composed draft. | `browser-recheck/P03-stale-preview-refused.png`                                                        | -                                                                                                              |
| CC1-06     | P2-01              | as revision 1, plus `lib/repo/pglite-tx.ts` and a required `runInTransaction`                                                                                                                                                                                          | T01-T05, `lib/repo/decision-apply.db.test.ts` (7) and `reviewed-send.db.test.ts`                                                                                            | Implemented and verified against PGLite. **All three writers genuinely run in one transaction now (B-3)**, enforced by the type system rather than by comment. Injected failures roll back, including in the interpreter's write-back; the SAVEPOINT retry branches are tested again (S-6); both send functions lock in one order (S-5).                               | `commands/npm-test.txt`                                                                                | True multi-connection concurrency still not proven - `for update` is a no-op on single-connection PGLite.      |
| Boundaries | Preserved controls | unchanged auth/tenancy; ownership checks in `reviewed-send-core.ts` / `sent-reply-core.ts`                                                                                                                                                                             | I01-I03                                                                                                                                                                     | Partially verified. I01 proven at repository level, and **P05's crafted-flag bypass is closed (B-2)**: no client value can now switch off a server lifecycle guard. I02 observed live. I03 covered by existing r2e null/failure/injection cases, all passing.                                                                                                          | `commands/npm-test.txt`, `commands/benchmark-r2e.txt`                                                  | I01 not exercised at the HTTP endpoint layer with two real signed-in tenants.                                  |

## Command ledger

All commands run at `e03751780252d08d89d05264fbd48b1adb01057e`, clean tree, no
`DATABASE_URL` set.

| Exact command                                           | Exit code | Result                                                                                                                                             | Baseline comparison                                     |
| ------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `npm test -- --test-concurrency=1`                      | 0         | 62 files, **673 tests, 673 pass, 0 fail**                                                                                                          | 590/590 at `41d9d33`; +83 net. No failures either side. |
| `npm run typecheck`                                     | 0         | clean                                                                                                                                              | clean at baseline                                       |
| `npm run lint`                                          | 0         | 0 errors, 0 warnings                                                                                                                               | clean at baseline                                       |
| `npm run check:auth -- --dev-url http://127.0.0.1:5178` | 0         | "dev and build agree: sign-in on"                                                                                                                  | n/a                                                     |
| `npm run benchmark:r2e`                                 | 0         | null 16/16, fake 16/16, **real 1 pass / 15 skipped**                                                                                               | same shape as the checked-in historical report          |
| `npm run build` (no `DATABASE_URL`)                     | 0         | built; `db:migrate` skipped, "DATABASE_URL not set"                                                                                                | not run at baseline                                     |
| `npm run build:dev`                                     | 0         | built                                                                                                                                              | not run at baseline                                     |
| CC1 probe (`probes/price-safety.probe.ts`)              | 0         | 6 pass / 0 fail                                                                                                                                    | **0 pass / 6 fail** at `41d9d33`                        |
| Browser journey (real Supabase auth, PGLite)            | n/a       | 12 of 13 steps passed at `58b5679`; the 13th found the A02 defect fixed in `e037517`. A02, P03 and the B-1 confirmation re-exercised at `e037517`. | n/a                                                     |

Test count by revision: 590 at the baseline, 641 at revision 1, 666 at revision
2, **673 now** - plus 4 for the correction-routing rule and 3 for the A02/P03
repository cases.

`npm test`, `npm run typecheck`, `npm run lint` and `npm run build:dev` were run
before each commit in revisions 2 and 3, not only at the end.

`npm run build` is safe by construction: `scripts/migrate.mjs` exits early when
`DATABASE_URL` is unset, and the log records it doing so. No database outside
the in-process PGLite instance was contacted at any point in this work.

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

### B2 - The live signed-in browser journey: EXERCISED, and it found a defect

**Status changed twice. Both changes matter.**

Revision 1 reported the live journey as blocked by a "pre-existing live-path
product defect", on the strength of four files not appearing in this branch's
diff. That was wrong: the mechanism is in a fifth,
`src/components/shell/workspace-boundary.tsx:111`, which returns `children`
directly when `authEnabled` is false, so `LiveWorkspaceGate` - the only caller
of `fetchWorkspace()` and `hydrateFromServer()` - never mounts. It was an
artefact of the `VITE_AUTH_ENABLED=false` bypass I chose, not a product defect.
Analysis: `research/agent-runs/2026-09-04/37-rca-cc1-blocker2-empty-store.md`.

The journey was then executed under real Supabase auth with local PGLite
(`research/agent-runs/2026-09-04/38-*`, evidence at
`evidence/implementation/58b5679.../browser-journey/`). It passed 12 of 13
acceptance steps and found a live-only defect the entire test suite could not
see: the "Correct guests" / "Correct service" pencil control called
`correctFact` on the client Zustand store, showed a success toast, fired no
network request, persisted nothing and reverted on reload. That is CC1-03/A02
failing, and it left P03 unexercisable. Fixed in `e037517`.

A02 and P03 were then re-exercised in a browser under real auth
(`evidence/implementation/e037517.../browser-recheck/`):

- **A02**: correcting `guests` from 4 to 6 fires exactly two server requests -
  `answerEnquiryFact` then `fetchWorkspace` - recomputes to "6 people at $145
  each.", and **survives a page reload**. Before the fix it fired zero.
- **B-1, live for the first time**: the send preview opened on the product's own
  composed draft, "That comes to $870. 6 people at $145 each.", and the server
  accepted it. This is the exact two-figure body that returned
  `amount_mismatch` before the B-1 fix, and no earlier browser pass could reach
  it.
- **P03, exercised for the first time**: with that preview frozen at $870, a
  second browser tab corrected the quantity to 5. Confirming the frozen preview
  was refused - "This enquiry has changed since that message was prepared" -
  and the control became "I already sent that older message". After a reload the
  enquiry was still "Needs you", with no outbound message and no quote row.

**What remains open on this gate.** The recheck covered A02, P03 and the B-1
confirmation only. The other eleven journey steps were not re-run - nothing in
`e037517` touches them - and the demo-mode correction path was not exercised in
a browser. A reviewer wanting a single clean end-to-end pass at the final head
should ask for one; I have not performed it and do not claim it.

The lesson the reviewer drew from B-1 held: the live journey is where the
defects that matter surfaced, twice.

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

1. **B1, B2, B3 above.** Each is an open gate, not a passed one. B2 in
   particular should be sequenced before sign-off: B-1 was a defect that only
   the live journey could catch, and neither the suite nor the demo screenshots
   saw it.
2. **Fabricated demo reply and auto-booking - not implemented, as ruled.** The
   demo store fabricates an inbound customer reply roughly 7.2 s after a send
   and marks the job Booked (`src/store/prototype-store.ts:648-653`), and this
   also fires inside the production homepage embed. Ruled outside CC1. Recorded
   here for separate authorisation. It interacts with this slice: the demo can
   still reach a "Booked" state no owner attested.
3. **Stale pricing empty state.** `src/components/business/pricing-rules.tsx:91`
   renders "Enquiry cannot price anything yet" whenever `activeRules(business)`
   is empty. Confirmed in the browser against the fixture business Glow & Co,
   which displays Active pricing knowledge items on the same screen. Root cause
   is fixture knowledge items carrying no `rulePayload`; the live hydration path
   does map it (`lib/repo/rows.ts:265`). Not a commercial correctness defect and
   not fixed. The adjacent save feedback on that screen was corrected, because
   CC1-02 changed what a save means.
4. **`decideEnquiry` remains narrower than the product contract** (review
   P2-02). Unchanged by CC1 and still true.
5. **Byte-identical repeat sends (review S-1).** The content-derived idempotency
   key means an owner cannot record two byte-identical messages on one enquiry
   as two sends. This is the trade-off that makes the recovery guarantee work,
   and it is deliberate - but it is a behaviour the product owner should ratify
   rather than discover. The reviewer suggested a `prepared_day` component or an
   explicit "record this as a new send" affordance; neither was taken, because
   both are product decisions.
6. **`amountAgrees` recognises `$`-prefixed amounts only.** A body writing "580
   dollars" is not compared against the structured amount. It reuses the
   repository's existing `dollarAmounts` helper rather than introducing a second
   money parser. Comma-grouped numbers ("5,000") are rejected by the quantity
   grammar as malformed, which fails safe; both are deliberate rulings rather
   than oversights.
7. **Zero quantity is refused.** If a business genuinely quotes a zero-unit
   line, this blocks rather than pricing it at nil. Deliberate, stated here so
   it can be overruled knowingly.
8. **Review suggestions S-3, S-4, S-7 not taken.** The attestation button is
   still auto-focused on dialog open (S-3); there is no unique partial index
   forcing one Active rule per service (S-4, downstream is already fail-safe);
   the audit line no longer carries a derived `edited` boolean (S-7, the exact
   reviewed text is recoverable through `message.reviewed_send_id`). Each is a
   judgement call left for the reviewer to direct rather than made unilaterally.

## Reviewer handoff

Branch `cc1/commercial-correctness`, thirteen commits on top of
`41d9d3371a5fa9a2a29552faea2506f65080dd4d` - six from revision 1 and five
answering the independent review. Every CC1 item is implemented, all four
blocking review findings are fixed with a failing test reproduced first in each
case, and the repository is green: 673/673 tests, typecheck, lint, `check:auth`,
both builds, and the benchmark.

**This slice is ready for a second independent review. It is not signed off, not
released, and not deployed.** Three gates were named open at revision 2: real-provider
interpretation (B1), the live signed-in browser journey (B2), and multi-connection
concurrency (B3). B2 has since been exercised under real auth - see "Browser journey
(real auth, local PGLite)" below, added after this report's original revision 2. It
closes B2 as "exercised, mostly passing, with one significant live-only defect found
and one acceptance step (P03) blocked by that defect's precondition." B1 and B3 remain
open exactly as described above.
`docs/BETA_READINESS_GATE.md` and `docs/PUBLIC_TRAFFIC_GATE.md` remain
unresolved and untouched. The roadmap was not advanced and
`docs/CURRENT_PHASE.md` was not edited - the next R2 decision belongs to the
reviewer.

## Browser journey (real auth, local PGLite)

Executed 2026-09-07, against this same commit (`58b5679b2b58b8190a445c931ab2456715c1535a`),
in a fresh worktree with real Supabase Auth (`VITE_AUTH_ENABLED` not set) and no
`DATABASE_URL` (in-memory PGLite, resets on dev-server restart). This is the exact gate
named in the independent review's re-review section: "exercise B2 before signing, not
after." Full step-by-step evidence, the exact commands/requests used, and one
significant finding are in
`evidence/implementation/58b5679b2b58b8190a445c931ab2456715c1535a/browser-journey/JOURNEY-LOG.md`.
Summary:

- **12 of 13 journey steps PASS live**, including the exact defect class B-1 was
  about: Q01 (a `5-6` range answer is refused, not silently priced), Q05 (an ordinary
  4-person quote reads exactly $580), C01-C06 (copy-is-not-send, clipboard denial,
  confirm, retry/idempotency, follow-up as a distinct message, desktop and phone),
  P01 (a $500-vs-$580 body/amount mismatch is hard-blocked, not warning-only), P02
  (a tone-only edit is not blocked), and T05/B-2 (a stale confirm against a declined
  enquiry is refused/redirected to a truthful attestation, never revives the
  enquiry).
- **One step, P03 (stale preview via a concurrent quantity change), could not be
  genuinely exercised** - not because the stale-preview guard is broken, but because
  a different, newly-discovered live defect makes the precondition unreachable
  through the UI (see below).
- **New finding, not previously known:** the "Correct guests" / "Correct service"
  pencil-edit control on an already-confirmed fact (`intelligence.tsx` ~line 1190,
  `correctFact` from the `usePrototype` Zustand store) writes only to client-side
  demo/prototype state, never to the server. It shows a full success toast, an
  updated fact panel, and a synthetic audit-trail line, none of which survive a page
  reload - and even before reload, the recommendation/draft did not recompute against
  the new value. Every other fact-answering path this journey touched
  (`answer-blocker.tsx`, real `answerEnquiryFact`) persisted correctly. This is
  exactly the class of gap B2 exists to catch: invisible to the repository suite
  (which calls `answerEnquiryFact` directly, not through this specific UI control) and
  invisible to demo-mode screenshots (where client-only state is the correct,
  intended behaviour). Directly touches CC1-03/A02 ("recompute correctly; survives
  reload").

**Both open items above are now closed, and re-exercised in a browser at
`e037517`** (`evidence/implementation/e03751780252d08d89d05264fbd48b1adb01057e/browser-recheck/RECHECK-LOG.md`):

- The correction control routes through `answerEnquiryFact` / `setEnquiryService`
  in live mode. Correcting `guests` 4 to 6 fires exactly two server requests,
  recomputes to "6 people at $145 each.", and survives a reload. Before the fix
  it fired zero.
- P03 was then exercisable and was exercised: a preview frozen at $870 was
  refused after a second browser tab corrected the quantity to 5, the control
  became "I already sent that older message", and after a reload the enquiry was
  still "Needs you" with no message and no quote row.
- The same pass gave the first live confirmation of the B-1 fix: the server
  accepted the product's own composed draft, "That comes to $870. 6 people at
  $145 each."

The recheck covered those three things only. The other eleven journey steps were
not re-run at `e037517` - nothing in that commit touches them - and no single
clean end-to-end pass has been performed at the final head.

Not signed off by this work - browser observation only, per the package's own
evidence-levels rule.
