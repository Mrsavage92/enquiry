# 01 - Operator journey: enquiry to booked or lost

Review date: 2026-09-07 (Australia/Brisbane)  
Application source reviewed: `79de089b2fe3f79efec14795eb340cf047bdb67a`  
Status: **REVIEW ONLY. CC1 remains the active implementation slice.**

This is a source-level review unless an executed probe is explicitly identified. It is not a production incident report, browser sign-off, security certification or authority to implement a new phase. Preserve existing work and reproduce findings on the implementation branch before changing it.

## Verdict
The manually entered enquiry and quote preparation path has real server-backed work. The journey after a quote is recorded still mixes that work with prototype state changes. Completing CC1 will not by itself make the whole enquiry-to-outcome journey durable.

## Keep
Keep raw-message preservation, deterministic price calculation, server-confirmed service/blocker answers, explicit owner review and the principle that silence is not a rejection. The standalone decline flow already waits for server success; use that pattern rather than rebuilding it.

## J1 - Acceptance, lost and customer-question paths are not equivalent to the live quote path
**Priority: P1 for real customer use. Evidence: traced UI callbacks and store implementations.**
`WaitingDesk` calls `acceptQuote`, `markLost`, `recordClientQuestion` and `recordDeposit` directly from the prototype store. Unlike its live reply-recording callback, these paths do not call a server mutation. The store persists tenant content only in demo mode, and live server hydration replaces the cache.

The off-channel acceptance action also constructs an inbound acceptance message and an outbound booking message that the owner did not supply. The mobile action called 'They asked a question' passes no body, so the store inserts a predefined date-change question and prepares a date-change reply. These are not merely missing saves: they can create a misleading conversation on screen.

The booking action can show 'Booked. Handed off' without evidence of a downstream handoff. An owner-reported external acceptance, a confirmed booking, a deposit received and a completed external handoff need separate meanings.

**Recommendation:** add bounded server-backed owner-reported outcome actions. Store the actual event, actor, source, timestamp and relevant quote version. Ask for the real new customer text, or record a note that a question was reported without fabricating a message. Do not add payments or booking-provider integrations simply to make the first-beta record truthful.

## J2 - There are two different ways to correct a fact
**Priority: P1. Evidence: source trace.**
`AnswerBlocker` uses `useFirstBetaActions().answerFact`, and service confirmation has a server action. The generic pencil/edit path in `Intelligence.CorrectDialog` instead calls local `correctFact`, which uses the prototype re-evaluator. A correction can therefore have different persistence and decision behaviour depending on which control the owner used.

**Recommendation:** one authenticated correction operation and deterministic re-evaluation path for all live fact-editing controls. Keep a separate demo adapter. Preserve prior fact versions and never silently promote a customer fact into business policy.

## Acceptance
Use a fresh non-fixture enquiry. Record a quote, add a real subsequent question, correct its facts, revise it and record external acceptance or loss. Reload and open a second session after every operation. The saved conversation must contain only actual supplied messages or clearly labelled owner reports. A failed write must not close the enquiry or report success. Booking status must not assert a payment or handoff that has not occurred. Generic fact editing and blocker confirmation must converge on the same server truth.

Existing CC1 defects around copying, amounts and stale approvals are dependencies, not additional findings to count twice. Runtime, database and concurrency verification remains outstanding.

## Source map
- `src/components/enquiry/waiting-desk.tsx`: `WaitingDesk`, off-channel acceptance, question and lost controls.
- `src/store/prototype-store.ts`: `acceptQuote`, `markLost`, `recordClientQuestion`, `recordDeposit`, `partialize`.
- `src/components/enquiry/intelligence.tsx`: `CorrectDialog`.
- `src/components/enquiry/answer-blocker.tsx`; `src/lib/workspace/live-mutations.ts`.
- `docs/implementation/CC1_COMMERCIAL_CORRECTNESS/README.md`.
