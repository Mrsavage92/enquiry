# Open Enquiry Fidelity

Date: 2026-09-14. Runtime source: `8b6b79e` on `codex/ui1-owner-recovery-2026-09-14`.

## Implemented

- Replaced the large What changed panel with a compact Plan updated disclosure. Collapsed content retains the changed values; full before/after values remain accessible through mouse and keyboard.
- Flattened the right evidence rail. Long verbatim evidence is disclosed rather than rewritten, so the crew rule and its notice/measure conditions remain intact. Short uncertainty stays visible.
- Consolidated desktop Why, edit and listening controls. A three-line preview sits directly beneath them, followed by the existing review action. Full editing and drift notices remain available.
- Recorded information requests now show Waiting on the customer instead of repeating the already-recorded recommendation. This is a read-only presentation predicate, not a decision-engine change. New inbound messages, new actions and blocked recommendations retain their action surface.
- Initial review focus moves to the message, not external-send attestation. Enter at that initial focus does not record anything. Explicit confirmation remains separate from copying.
- The waiting surface retains access to the full reply evidence; customer details remain available through the enquiry's details controls.

## Checks

- Typecheck and lint: exit 0 on final source.
- Production build: exit 0; restarted the local build preview on `http://127.0.0.1:8083`.
- Six focused presentation tests pass: unsent, recorded, new inbound, changed action/follow-up, blocked recommendation and closed/business-owned state.
- `npm test -- --test-concurrency=2`: exit 0 on fixed runtime source `8b6b79e`; 736 passed, 0 failed/cancelled/skipped/todo, 69 files, 237463.8211 ms. Only evidence/documentation changed during this final run.
- Built app visually inspected at 1440x960, 1024x768, 768x1024 and 390x844. No horizontal overflow at the measured tablet width. Short-height editor checked at 390x400; complete ending and Done remain reachable.
- Plan updated disclosure opened with click and closed with Enter. Full crew rule opened and inspected without paraphrasing its authority.
- Review opened on the message. Enter left Nothing sent unchanged; copying and closing also left Nothing sent unchanged.
- Demo-only recording produced Waiting on Maya and removed Review reply. No actual customer message was sent. Full Why evidence remained accessible after recording.
- Calendar-disconnected sample retained its prominent warning, material blockers and absence of a ready Review reply action. No reconnection/bypass performed.

## Evidence

PNG files beside this ledger show the actual local synthetic workspace, not generated mockups. The main desktop capture uses the production build; phone initial state and recorded-state checks also used the development server with the same runtime source. Counts and sample timestamps are not production facts.

The original approved-direction boards remain the design authority. This slice implements the specific original-GPT review in `docs/design/UI1_GPT_REVIEW_2026-09-14.md`; it is not an additional owner approval.

## Independent Screenshot Follow-Up

The original design chat received the new desktop, phone and recorded-desktop screenshots. It judged all three requested visual deltas resolved: compact change context, a receding evidence rail and an appropriately tightened reply surface. It found no further material visual mismatch in these screenshots and noted the improved waiting state.

Its optional refinements were quieter secondary actions and avoiding duplicate Why wording on the recorded desktop view. Those do not reopen the bounded composition. The shared waiting evidence control remains present to preserve access on phone. This peer review is not owner acceptance of the entire app, device QA or release approval.

Source: https://chatgpt.com/c/6aa20b90-c690-83ec-af8b-b549fc7c2865

## Still Open

Physical-device keyboard/safe-area and assistive-technology checks; runtime OS reduced-motion check; Settings terminology; hosted auth/SMTP, provider quality and beta/public release gates. Existing reduced-motion CSS is retained. No main merge, push, deployment or hosted configuration change was performed.
