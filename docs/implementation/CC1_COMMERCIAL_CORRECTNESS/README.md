# CC1 - Claude implementation package

## Outcome

Make the existing manual enquiry/quote workflow commercially correct and truthful about actions. Preserve the foundation. Do not rewrite Enquiry.

**Authorised for implementation by the product owner's 2026-09-07 request. Not yet implemented, verified or independently signed off.** Current execution authority: [CURRENT_PHASE.md](../../CURRENT_PHASE.md).

| Reference | Value |
|---|---|
| Reviewed application source | `6eba9a4cee9759cad54d891e8e7515fe438b1c8b` |
| Package preparation base | `fb58a02b1a7675621529e0c3a548b9151b349b79` |
| Review | [Commercial correctness review](../../reviews/2026-09-07_COMMERCIAL_CORRECTNESS_REVIEW.md) |
| Product contract | [AGENTS.project.md](../../../AGENTS.project.md) |
| Acceptance / tests | [ACCEPTANCE.md](./ACCEPTANCE.md) |
| Starter instruction | [CLAUDE_PROMPT.md](./CLAUDE_PROMPT.md) |
| Completion report | [HANDOFF_TEMPLATE.md](./HANDOFF_TEMPLATE.md) |
| Executable diagnostic seeds | [price-safety.probe.ts](./probes/price-safety.probe.ts) |
| Baseline evidence | [BASELINE.md](./evidence/BASELINE.md) and [results](./evidence/baseline-results.json) |

The code review findings are hypotheses to reproduce on the current branch, not permission to manufacture passing tests. The first three defect families have dependency-free reproductions. UI, database-failure and concurrency findings still require runtime/database tests. Do not call them observed production incidents.

## Start and scope

Inspect the current working tree and HEAD. Preserve unrelated work; do not reset, force-push or overwrite another agent's changes. Use an implementation branch, preferably `fix/cc1-commercial-correctness`; use a distinct name if it already contains unrelated work. Record the actual baseline commit before editing. The source baseline above is for reproducing the review, not an instruction to discard later changes.

Read the current project instructions and this package, inspect each affected live path and capture the available baseline checks. Then execute Steps 1-5 below in order within this one authorised slice. There is no additional phase approval between these internal steps. Commit coherent fixes/tests and finish with a review-ready branch/PR and evidence, not an automatic merge or deployment.

Allowed: fixes CC1-01 through CC1-06, their necessary focused UI/state changes, minimal schema migrations or transaction helpers, regression tests and evidence updates. Other review items are context or deferred verification/product work, not an invitation to implement new evaluator families.

Not allowed: broad integrations, a model/provider upgrade, redesign, PWA work, generic rules engine, CRM expansion, unrelated refactoring or automatic legacy financial-data repair. Do not change the product contract to make the current implementation appear compliant.

## Step 1 - Quantity and service selection (CC1-01 / CC1-02)

Source starting points: `src/domain/price-compiler.ts`, `src/domain/business-rule.ts`, `src/domain/decide.ts`, `src/lib/server/enquiry-actions.ts`, `src/components/enquiry/answer-blocker.tsx` and existing tests.

### CC1-01: quantity meaning (review P1-01)

The reviewed parser strips signs, separators and words. With the synthetic AUD 100/person rule, `5-6`, `4 or 5` and `-5` become exact AUD 5,600, AUD 4,500 and AUD 500 respectively.

Replace destructive parsing with explicit supported quantity semantics and server validation. Ranges, alternatives, negative values, empty input, malformed decimals and multiple numeric terms must not silently become a different exact quantity. Define accepted numeric/units/locale forms and handle everything else as an unresolved answer or useful validation error. Do not introduce a general natural-language quantity engine.

Preserve valid integer counts and legitimate fractional units such as hours or area. Do not apply integer-only rules by guessing from arbitrary unit prose. Preserve supported minimum-billing behaviour. A future range-aware outcome is acceptable only if it proves the outcome for the whole range; it is not required in CC1. Keep arithmetic finite and within the supported storage/money bounds.

Confirmation means the owner confirms the original meaning, not whatever remains after characters are deleted. Both server submission and downstream decision code must enforce the invariant; a UI-only input restriction is insufficient.

### CC1-02: service/rule ambiguity (review P1-02)

`selectRule` currently picks the first exact or partial match. Requests matching several services, or conflicting Active rules for one service, must no longer obtain a definite price from array/query order.

Use an explicit match result: one authoritative service/rule, no match, or an ambiguity/conflict requiring a specific choice. Stable service identity or deliberate aliases may help, but never add a new guessed alias silently. List the plausible choices and let the owner resolve the smallest relevant question. Reordering the same logical rules must not change the commercial outcome.

Cover rule updates as well as selection: the existing save path must not silently leave two competing Active prices and pick an old one. Choose either explicit supersession/versioning or explicit conflict blocking; do not discard pricing history. An identical duplicate must not change the result. Do not broaden this into a business-rule management redesign.

## Step 2 - Authoritative service confirmation (CC1-03)

Source: `src/lib/repo/manual-enquiry-core.ts`, `src/lib/server/enquiry-actions.ts`, `src/domain/decide.ts`, `src/domain/decision-snapshot.ts`, `src/components/enquiry/service-read-as.tsx` and the compiler.

A model-populated `service_label` with a `check_this` service fact must not be indistinguishable from an owner-confirmed service. This affects fixed-price services even when no quantity is needed.

Persist the authority/provenance distinction and enforce it at the server-side commercial decision/approval boundary. A provisional numeric calculation may be shown as provisional, but it cannot claim a confirmed commercial premise. Manual owner service selection must have a deliberate authoritative path too; a nonblank legacy string alone is not proof that a human confirmed it.

Keep the interaction small: confirmation may be a separate service control or an explicit combined service-and-quote approval, provided the confirmation is persisted and validated before a commercially authorised action. No hidden confirmation triggered by viewing, copying or merely receiving model output. Null/failure interpretation remains usable, and later model responses must not overwrite an owner's decision.

The diagnostic seed tests the reviewed low-level compiler. If the corrected architecture intentionally keeps a pure arithmetic compiler that can return a provisional price, replace that seed with a stronger live-boundary regression proving that the unconfirmed service cannot become an authorised quote. Explain the change of test boundary. Do not delete the invariant or make a red test green by renaming it.

## Step 3 - Consistent decisions and immutable reviewed content (CC1-06 + foundation of CC1-05)

Source: `answerEnquiryFact`, `setEnquiryService`, `interpretAndApply`, `recordSentReplyInTransaction`, database transaction helpers and relevant migrations/repository tests.

Use a consistent per-enquiry locking/revision strategy so a fact/service update, its derived snapshot/state and required audit record succeed together or not at all. All writers of the affected snapshot, including interpreter application, must participate; protecting only one endpoint is insufficient.

Keep provider calls outside database transactions. After the provider returns, acquire the appropriate guard and re-read current facts, service authority and applicable rules before applying proposals and deriving a snapshot. Never overwrite a concurrent owner-confirmed fact with a delayed model result. Prevent overlapping edits from leaving duplicate authoritative active facts or a stale snapshot. Respect lifecycle state: an old preview must not silently revive or reclassify a declined/closed enquiry.

Bind reviewed text, structured price, service/rule identity, decision revision and chosen recipient/channel semantics to a server-validated reviewed artefact or an equally strong consistency mechanism. A mutable client `edited` flag or current snapshot read at record time is not that mechanism. Transaction/idempotency fixes directly necessary for this path are in scope.

Migrations must be minimal, tested against representative existing data and non-destructive. Report inconsistent legacy records; do not invent or bulk rewrite what was historically sent. Define handling for legacy unversioned/unconfirmed rows without silently promoting them.

## Step 4 - Truthful copy, external send confirmation and quote consistency (CC1-04 / CC1-05)

Source: `src/components/enquiry/send-preview.tsx`, `intelligence.tsx`, `waiting-desk.tsx`, `src/lib/workspace/live-mutations.ts`, `src/lib/server/enquiry-actions.ts`, `src/lib/repo/sent-reply-core.ts`, send-preview domain helpers and tests.

### CC1-04: copied is not sent (review P1-04)

Make these separate events:

| Event | Required effect |
|---|---|
| Prepare/review | No outbound sent record or customer-waiting transition |
| Copy succeeds | Truthful copied feedback; no sent timestamp, sent quote or transfer of responsibility |
| Clipboard denied/unavailable | Truthful failure/manual-copy option; no sent state |
| Owner explicitly confirms an actual external send | Persist exactly that send once; advance state only when valid |
| Close, cancel or abandon | Do not claim the customer received anything |

Use a clear confirmation such as `I've sent this externally`, after the copy/manual-send step. The UI must say Enquiry did not deliver the message. Do not infer delivery from a copy or from permission to send. Owner attestation is the evidence level; do not label it provider-confirmed delivery.

Use an idempotency key stable for the same logical confirmation across retries, refresh/reopening and response-loss recovery. A transient new UUID on each dialog open is not sufficient recovery by itself. Different genuinely sent follow-ups must still be recordable as distinct sends. Make both the main composer and waiting/follow-up path use the same semantics.

### CC1-05: one commercial truth (review P1-05)

Do not persist submitted text saying AUD 500 beside a sent quote record saying AUD 580. Warnings and an `edited` flag alone do not solve the mismatch.

Commercial edits must use an explicit structured reprice/override-and-review flow, or be prevented until reconciled. Ordinary tone edits should remain possible. Prefer a small deliberate commercial-edit boundary over regex/NLP extraction that silently turns prose into authoritative money. Enforce consistency on the server, not just by disabling a button.

Freeze what was actually reviewed/copied. A stale preview used to initiate a new commercial action must refresh/review before proceeding. Important distinction: if the owner has ALREADY sent an older approved quote externally, do not erase that fact or falsely record the new current price. Preserve the actual historical sent body and its reviewed price/revision, mark any conflict with newer state and avoid silently advancing the newer enquiry decision. A truthful owner-attested historical record is different from authorising a stale new send.

Retries, a failed post-write workspace refresh and concurrently confirmed sends must not duplicate message/quote rows or pair one message with another decision's amount. Add database proof, not just assertions about button labels.

## Step 5 - Verify and hand off

Follow [ACCEPTANCE.md](./ACCEPTANCE.md). Integrate regression tests into the normal `src`/`scripts` test tree; the package's explicit probes are not the finished release suite. Test real functions and database effects, not only copied logic, mocks or source-text patterns.

Required command record: targeted tests, `npm test`, `npm run typecheck`, `npm run check:auth`, `npm run lint`, `npm run benchmark:r2e`, and production `npm run build` when safely configured. The build runs database migrations: first inspect the actual scripts and use a disposable/non-production database. Never point a review build at production merely to obtain a green result.

Capture fresh desktop/phone browser evidence for the real signed-in non-fixture workflow and both recording paths, including reload and failures. Demo screenshots do not prove live persistence. Real-provider benchmark work remains separately gated; null/fake/failure coverage must not be described as real-model quality. Use only an already-authorised test provider setup for any bounded live calls; do not add credentials to the repo.

Compare every claimed pre-existing failure against the actual pre-change baseline under [the regression policy](../../TEST_REGRESSION_POLICY.md). The old 12-failure count in historical phase notes is not an automatic waiver.

Complete [HANDOFF_TEMPLATE.md](./HANDOFF_TEMPLATE.md) as a new `IMPLEMENTATION_REPORT.md` in this package and place evidence under `evidence/implementation/<tested-sha>/`. Bind results to the code revision actually exercised. Leave historical baseline evidence unchanged. No source change means no new pass claim. Stop for independent review; do not mark CC1, R2 or beta release signed off.
