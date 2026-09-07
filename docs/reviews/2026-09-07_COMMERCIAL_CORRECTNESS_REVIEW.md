# Enquiry - Commercial correctness review

Review date: 2026-09-07 (Australia/Brisbane)

Reviewed application source: `6eba9a4cee9759cad54d891e8e7515fe438b1c8b` on `main`.

This is a documentation-only independent review. It does not change application code, supersede `docs/CURRENT_PHASE.md`, authorise another implementation phase, or claim a release sign-off. It supplements the weekly `docs/INDEPENDENT_PROGRESS_CRITIQUE.md` with source-level findings and independently executed pricing probes.

## Verdict

There is a genuine server-backed manual enquiry/quote workflow here, not just a visual prototype. However, I would not sign off real commercial beta use of the reviewed build yet. The most immediate problems are incorrect commercial interpretation and inaccurate recording of what has happened, rather than missing mailbox integrations or unfinished styling.

Keep the existing authentication, tenancy checks, raw-message persistence, proposed-fact model, deterministic pricing and human-review direction. Harden the commercial path before broadening it. This review is not a recommendation for a rewrite.

## Evidence and limitations

The current GitHub source, project contract, current-phase document, weekly critique, benchmark report and relevant client/server/domain paths were read through the connected repository.

A full checkout could not be obtained in this execution environment because its GitHub hostname resolution failed. To avoid substituting a rewritten approximation for the application, three dependency-free source files were reconstructed from the connector's complete file contents and checked against their Git blob hashes. All three matched byte-for-byte:

| File | Verified Git blob SHA |
|---|---|
| `src/domain/business-rule.ts` | `8f679c96506f3de655c69533f4893abe7dc15a55` |
| `src/domain/price-compiler.ts` | `57d3a950fc4a4c507d09a9f6d9fa30cc555a77ca` |
| `src/domain/price-compiler.test.ts` | `0a4f90fad1f4acaaa4f2234b3a3b0eb8e9abcd58` |

Using Node v22.16.0:

- The unchanged repository pricing test file was executed: **14 passed, 0 failed**.
- Six additional safety probes against those unchanged modules were executed: **0 passed, 6 failed**. These expose three defect families, not six unrelated root causes.
- The additional test source is included in the appendix. The original test output, failing-probe output and hash manifest were also retained in the review's conversation attachment.

This was **not** a run of the full repository test command, typecheck, lint, build, browser suite, live database tests, provider-backed interpretation or two-tenant security tests. UI/server findings below are explicitly identified as source traces, not claimed production incidents.

## Release-blocking findings

### P1-01 - Quantity parsing changes the meaning of a confirmed answer

**Evidence: reproduced on unchanged pricing source, with the live input path traced.**

`quantityFrom` in `src/domain/price-compiler.ts:60-68` removes everything except digits and decimal points before parsing. Confirmation of the text does not make that transformation safe.

Using a synthetic rule of AUD 100 per person:

| Confirmed answer | Quantity used | Exact amount returned |
|---|---:|---:|
| `5-6` | 56 | AUD 5,600 |
| `4 or 5` | 45 | AUD 4,500 |
| `-5` | 5 | AUD 500 |

The live `AnswerBlocker` accepts a text answer. `answerEnquiryFact` checks that the value is non-empty and saves it as `confirmed`; it does not validate it as a single quantity before the pricing compiler reads it. This is therefore reachable through ordinary operator input, not only an artificial direct call.

**Required correction:** validate the semantic value for the rule's quantity type. Reject or preserve ranges, alternatives, negative values and compound expressions instead of deleting their meaning. Apply integer constraints only to countable units where appropriate; fractional hours or area may be legitimate. An unresolved range should remain unresolved unless a deterministic rule can safely produce an outcome from the whole range.

**Acceptance:** all three examples above cannot become exact positive quantities; valid quantities still price correctly; the operator sees the unresolved meaning and a useful next step.

### P1-02 - Ambiguous service selection silently chooses a price

**Evidence: reproduced on unchanged pricing source.**

`selectRule` in `src/domain/price-compiler.ts:79-85` selects the first exact match or the first partial match. It has no multi-match result.

With synthetic rules for Bridal makeup at AUD 190 and Event makeup at AUD 170, the request `makeup` receives one definite price. Reversing the rule array changes the answer from AUD 190 to AUD 170. The logical rule set is the same; only its order changed.

This is not a safe resolution of ambiguity. The benchmark's final notes already acknowledge the related gap for two simultaneously Active rules for the same service. Its passing conflicting-rule case tests a rule already marked `Needs review`, not automatic detection of two competing Active rules.

**Required correction:** represent service selection and active-rule conflicts explicitly. Prefer confirmed service identities and deliberate aliases. Multiple plausible matches should request the smallest clarification or an owner choice, not use array order as commercial policy. Define rule replacement/versioning so an old Active rule does not win by accident.

**Acceptance:** ambiguous matches cannot produce a definite quote; reordering equivalent rules cannot change the commercial decision; competing Active rules are surfaced rather than silently selected.

### P1-03 - An unconfirmed model service can already unlock an exact fixed price

**Evidence: reproduced at the compiler boundary and traced through interpretation/decision code.**

`interpretAndApply` in `src/lib/repo/manual-enquiry-core.ts` may populate a blank `service_label` from a model candidate that matches an Active pricing rule. It deliberately records the corresponding service fact as `check_this`.

The fixed-price branch of `compilePrice` then returns `EXACT` without inspecting that service fact's confirmation status. `decideEnquiry` maps `EXACT` to `SEND_QUOTE`, and `snapshotFromDecision` enables the primary action. Passing an explicit `service` fact with status `check_this` into the compiler still produces an exact price in the added test.

There is still a human send-preview step. This finding is **not** a claim that the model sends autonomously. The gap is that the service is simultaneously presented as needing confirmation and used as the basis of a ready exact quote.

**Required correction:** distinguish provisional pricing from a commercially confirmed decision, or make service confirmation an explicit, server-validated part of the approval action. Do not require extra ceremonial clicks if one well-designed approval can confirm the service and quote together, but make the authority transition real and testable.

**Acceptance:** an unconfirmed or conflicting service cannot be treated as an already-confirmed commercial premise; the chosen confirmation path is enforced server-side.

### P1-04 - Copying a reply records it as sent before the owner sends it

**Evidence: source trace across the active client and server paths; not browser-executed here.**

`SendPreview` offers `Copy and record as sent`. In `Intelligence.commitSend`, the live path attempts to copy the draft, catches clipboard failures, then calls `recordSent` regardless. Its success toast tells the owner to send the text from their own inbox after recording it.

`recordSentReplyInTransaction` immediately writes an outbound message with `sent_at`, moves responsibility to `CUSTOMER`, sets `WAITING_ON_CLIENT`, and, for a quote, creates a quote version marked `sent` and changes the commercial state to `QUOTED`.

Consequently, copying without sending, abandoning the external send, or even failing to copy can move the enquiry into a state that says the business has already replied. The clipboard-success message is also not truthful when copying failed.

**Required correction:** separate preparation/copying from confirmed external sending. A copy action must not create an outbound sent record. Provide an explicit owner confirmation after external sending and make that confirmation idempotent. Keep responsibility with the business until then. Report clipboard success and failure accurately.

**Acceptance:** copy-only, denied clipboard, closing the preview and abandoning the external send leave sent state unchanged; explicit confirmation creates one durable outbound record and only then advances the enquiry.

### P1-05 - Edited message prices and the recorded sent quote can disagree

**Evidence: source trace; the illustrative amount change below was not executed against a live database.**

The composer permits editing the draft. Price-drift and sheet/letter checks display warnings, but the inspected send-button conditions do not block the action on those warnings.

The server records the submitted body while taking the structured quote amount from the stored decision snapshot. For example, changing a prepared AUD 580 quote to AUD 500 in the message can leave the recorded outbound text saying AUD 500 and the structured sent quote saying AUD 580. Recording an `edited` flag does not reconcile the two commercial meanings.

There is also no decision-version token in the inspected recording input tying the operator's preview to the exact snapshot used by the server.

**Required correction:** route commercial changes through a deliberate structured reprice/override flow or refuse to record an inconsistent quote. Bind approval/recording to the reviewed decision version, with a clear refresh/review path when it is stale. Do not silently extract a new authoritative price from arbitrary prose.

**Acceptance:** price edits cannot create a silently contradictory sent quote; ordinary tone edits remain possible; stale approvals cannot be paired with a different current amount without review.

## Additional correctness and management risks

### P2-01 - Fact changes and their derived decisions are not one atomic operation

`answerEnquiryFact` and `setEnquiryService` transactionally write the fact/service change, then read inputs, compute a decision and update the snapshot outside that transaction. A failure after the first commit can leave new facts with an old decision. Concurrent updates can also finish their snapshot writes out of order.

This is a source-level failure/race risk, not a reproduced concurrency test. Put the relevant mutation and decision update under a consistent transactional/revision model and test injected failures and overlapping edits before claiming this is fixed.

### P2-02 - The live decision model is narrower than the product contract

`decideEnquiry` currently calls the price compiler and chooses between quote, request information and human escalation. `snapshotFromDecision` starts from empty evaluators and explanations and retains the default Low confidence rather than deriving a richer assessment.

The project contract instead calls for relevant evaluator selection across pricing, service fit, availability, capacity, travel and qualification, with pricing absent when irrelevant. A narrow first-beta slice is reasonable, but it should be described as a narrower live capability, not proof that the full cross-industry decision layer works.

Adding a calendar or mailbox integration is not the immediate remedy. First make the existing commercial slice correct, then prove one non-pricing enquiry path through the same decision model.

### P2-03 - The execution authority contradicts itself

`docs/CURRENT_PHASE.md` starts by recording R2A sign-off and a new approval-preview/interpretation slice. It later says R2A is not signed off, repeats the old isolation blocker and instructs agents to execute only the old correction. The top also says interpretation has not started, while the adapter and interpretation application code now exist.

Consolidate one current status and move historical instructions into clearly labelled history. Preserve the distinction between implemented, tested, independently reviewed and approved. This report itself does not resolve or override that authority.

### P2-04 - Current release evidence does not prove the full application

The checked-in R2E benchmark reports 16 null and 16 fake case runs. Its real-mode results are 1 pass and 15 skipped, but the one passing case uses an injected failure and makes no provider call. That report therefore contains no successful live-provider interpretation evidence.

The GitHub Actions runs endpoint returned zero workflow runs. The reviewed head's combined status showed Vercel success only. That is deployment evidence, not evidence that the full regression/typecheck suite passed.

The existing live-loop verification is described in repo documentation, but its detailed dossier is referenced at a local Windows research path outside the repository. It should be made reproducible and shareable without depending on that one machine. This review did not independently re-run it.

## What should be preserved

The inspected server boundaries verify user identity and re-derive membership before accessing business/enquiry data. Workspace loading is scoped to that user's businesses. Raw manual enquiry and inbound message creation are transactionally paired. Interpretation is best effort after raw persistence, so an unavailable model does not have to lose the original enquiry. Proposed facts carry status and provenance. Pricing uses confirmed Active business-rule payloads and minor-unit output rather than accepting a model-produced total. Human previews and idempotency infrastructure already exist.

These are useful foundations. They do not eliminate the specific boundary defects above. In particular, application-level tenancy checks should still receive real two-tenant endpoint tests: the code documents that its table-owner database connection bypasses row-level security. No cross-tenant exploit was demonstrated in this review.

## Recommended implementation sequence

1. Reconcile the phase authority and explicitly authorise a bounded commercial-correctness slice. Preserve the existing product contract and manual-first ingestion boundary.
2. Correct P1-01 through P1-05, adding focused regression coverage and the transactional/version protections directly needed by those changes. Do not combine this with a redesign or broad integration programme.
3. Run the full repository regression policy, typecheck and build in an appropriately configured non-production environment. The build script invokes database migrations, so do not point an improvised test run at live data. Verify the manual loop in a real browser, including reload, clipboard denial, changed quantity, ambiguous service, provisional service, edited amount, stale approval, provider failure and two-tenant denial. Publish exact results tied to the reviewed commit before release sign-off.

No percentage-complete estimate is assigned. The immediate question is whether the existing narrow path tells the truth and preserves the correct commercial decision, not how many phases or commits exist.

## Reproduction appendix

The commands below were executed against byte-matched isolated copies of the unchanged source files, not a full repository checkout:

```sh
node --experimental-strip-types --test src/domain/price-compiler.test.ts
# Observed: 14 pass, 0 fail.

node --experimental-strip-types --test price-safety-regressions.test.ts
# Observed on the reviewed source: 0 pass, 6 fail. These failures are intentional safety assertions.
```

Place this review probe at the repository root when integrating it into a proper regression change. It was not added to the application's test tree by this documentation-only review:

```ts
/** Independent review probes, not tests shipped by the repository. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { compilePrice } from './src/domain/price-compiler.ts';
import type { BusinessRule, FixedPriceRule } from './src/domain/business-rule.ts';
const perPerson: BusinessRule = { kind: 'per_unit', service: 'Group makeup', amount: 100, currency: 'AUD', unit: 'person', quantityField: 'guests' };
for (const value of ['5-6', '4 or 5', '-5']) {
  test(`SAFETY: confirmed text ${JSON.stringify(value)} must not become an exact positive quantity`, () => {
    const out = compilePrice([perPerson], 'Group makeup', [{field:'guests', value, status:'confirmed'}]);
    assert.notEqual(out.kind, 'EXACT', JSON.stringify(out));
  });
}
const bridal: FixedPriceRule = { kind:'fixed_price', service:'Bridal makeup', amount:190, currency:'AUD' };
const event: FixedPriceRule = { kind:'fixed_price', service:'Event makeup', amount:170, currency:'AUD' };
test('SAFETY: ambiguous service must not select a definite price', () => {
  assert.notEqual(compilePrice([bridal,event], 'makeup', []).kind, 'EXACT');
});
test('SAFETY: ambiguous service price must not depend on rule array order', () => {
  const a=compilePrice([bridal,event], 'makeup', []);
  const b=compilePrice([event,bridal], 'makeup', []);
  assert.deepEqual(a,b);
});
test('SAFETY: an explicitly unconfirmed model service fact must not unlock exact pricing', () => {
  const out=compilePrice([bridal], 'Bridal makeup', [{field:'service',value:'Bridal makeup',status:'check_this'}]);
  assert.notEqual(out.kind,'EXACT',JSON.stringify(out));
});
```

## Source map

All paths below refer to the immutable reviewed commit `6eba9a4cee9759cad54d891e8e7515fe438b1c8b`, not a claim about later changes:

- `src/domain/price-compiler.ts`: `quantityFrom`, `selectRule`, `compilePrice`.
- `src/domain/business-rule.ts`: accepted fixed/per-unit rule shapes and payload validation.
- `src/domain/price-compiler.test.ts`: the 14 original pricing tests executed here.
- `src/domain/decide.ts`: `activeRules`, `decideEnquiry`.
- `src/domain/decision-snapshot.ts`: `emptyDecisionSnapshot`, `snapshotFromDecision`, `stateFromDecision`.
- `src/lib/repo/manual-enquiry-core.ts`: `insertManualEnquiry`, `interpretAndApply`.
- `src/lib/server/enquiry-actions.ts`: `answerEnquiryFact`, `setEnquiryService`, `recordSentReply`, `saveBusinessRule`.
- `src/lib/repo/sent-reply-core.ts`: `recordSentReplyInTransaction`.
- `src/components/enquiry/intelligence.tsx`: `commitSend`, draft editing, drift warnings, send-button conditions.
- `src/components/enquiry/send-preview.tsx`: the copy-and-record confirmation.
- `src/components/enquiry/answer-blocker.tsx`: text entry and owner fact confirmation.
- `src/domain/situation.ts` and `src/domain/channel.ts`: inspected situation/outbound gating.
- `src/lib/workspace/live-mutations.ts`: server action calls and workspace refresh.
- `src/lib/repo/workspace.server.ts` and `src/lib/repo/tenancy.server.ts`: workspace scoping and membership checks.
- `src/lib/interpret/anthropic-interpreter.server.ts`: adapter validation and failure classification.
- `docs/benchmarks/r2e-2026-09-03.md`: reported null/fake/real coverage and acknowledged Active-rule conflict gap.
- `AGENTS.project.md`, `docs/CURRENT_PHASE.md`, `docs/INDEPENDENT_PROGRESS_CRITIQUE.md`, `package.json`: product contract, sequencing, prior evidence and available checks.
