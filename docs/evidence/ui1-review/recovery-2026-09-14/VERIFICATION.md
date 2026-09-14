# UI1 Recovery Verification

Date: 2026-09-14. Owner acceptance remains OPEN. This is a bounded recovery and open-enquiry slice, not UI1 completion or launch approval.

## Source And Branch

- Repository: Mrsavage92/enquiry, local `enquiry-ui1` worktree.
- Branch: `codex/ui1-owner-recovery-2026-09-14`.
- Final implementation source head: `2541180`.
- Baseline recovery: `8c350c7`; main governance merge: `73158f7`; painting/context implementation: `de3e663`; overlap fix: `335bbfc`; demo-dialog close fix: `2541180`.
- Evidence-only commits following this head do not alter runtime source. No push, main merge, deployment, hosted configuration or database mutation was performed in this recovery.
- Original four approved-direction boards were opened from `docs/design/ui1-references/`. They are visual references, not factual production data.
- PR #21 was reviewed as a documentation handover, not an implementation PR. Claude's marketing branch `visual/mirror-integrate` at `d205d9f` remains parked and unmerged here.

## Automated Checks

- `npm run typecheck`: exit 0 on `2541180`.
- `npm run lint`: exit 0 on `2541180`.
- `npm run build`: exit 0 on `2541180`, Vercel/Nitro production output. A Windows native-dependency platform notice is not proof of Linux deployment readiness.
- `npm test -- --test-concurrency=2`: exit 0 on fixed source head `2541180`; 730 passed, 0 failed/cancelled/skipped/todo, 68 files, 205262.8831 ms. Only documentation/evidence changed during this run.
- Earlier serial run: 730 passed, 0 failed/skipped, 68 files. The one-line demo-dialog fix landed during that run, so it is not labelled an exact-head result.
- The three new painting fixture tests check synthetic/no-send/no-booking/no-price state, the existing active crew rule and explicit changed facts. These tests are not proof of a production crew evaluator.

## Browser Checks Actually Performed

Local development: `http://127.0.0.1:8082`. Local production-build preview: `http://127.0.0.1:8083`. Both explicitly show sample workspace mode. Neither is the public deployment.

- Painting: 1440x960, 1024x768, 768x1024 and 390x844 rendered and visually inspected. The original 1024 sticky-footer overlap was fixed and its evidence replaced. No document horizontal overflow at the checked tablet width.
- Full reply editor: 390x400, complete ending reachable by ordinary scrolling, Done visible. A reversible wording edit persisted after closing/reopening, then the original text was restored. The browser's synthetic Ctrl+End moved the caret but did not scroll the textarea; this is not recorded as a keyboard-scroll pass.
- Latest customer message foregrounded; earlier message disclosure exposes the original five-weekday request. Why/evidence exposes the real sample crew rule and unconfirmed contractor availability, site measure and price.
- Copying the prepared painting reply did not change Nothing sent. Demo external-send attestation created a recorded reply and Waiting state without a booking. Its dialog now closes after the transition. No actual message left the browser.
- Enquiries: name search, no-results state, filter selection, arrow-key tab switching. The queue correctly shows a waiting count after demo recording.
- Today: desktop daily summary and phone navigation inspected. Counts vary between captures because a demo reply was recorded and the existing sample-arrival timer ran; they are not production metrics.
- Booked: truthful empty upcoming state and existing past-booking rows inspected. Old sample dates were not silently changed to look current.
- Business: all seven destinations and flat desktop rows inspected; not a fresh deep test of every editing workflow.
- Insights: existing enquiry/channel/quoted/booked totals only. No new analytics claims.
- More: full phone page, secondary navigation, Plan & usage, Refer a friend, Help & support, Settings and Account opened. Missing plan/referral/support capabilities are shown as unavailable, not fabricated.
- Availability-blocked sample `f10`: unavailable calendar warning and blockers visible; no Review reply control. No reconnection or bypass was executed.
- Production build: painting desktop and short-height reply editor rendered. The preview server was restarted after rebuilding to avoid mixed stale server/client assets. Its final error-log check was empty.
- Reduced-motion CSS rule inspected; actual OS reduced-motion emulation was not available and is not claimed as a runtime pass.

## Captures

All PNGs beside this file are local sample data. They are review evidence, not owner approval.

- `painting-built-desktop.png`: final production-built 1440x960 example.
- `painting-desktop.png`, `painting-desktop-reply.png`: initial and scrolled desktop working surface.
- `painting-1024x768.png`, `painting-768x1024.png`, `painting-phone.png`: responsive context and action surface after the overlap fix.
- `painting-editor-390x400.png`: final build, reply ending and Done control.
- `painting-recorded-demo.png`: demo recorded history, after the dialog-close fix.
- `blocked-phone.png`: unavailable-calendar sample.
- `today-desktop.png`, `today-phone.png`, `enquiries-empty-desktop.png`, `booked-desktop.png`, `business-desktop.png`, `insights-desktop.png`, `more-phone.png`: representative surrounding screens.

## Open Review Findings And Gates

1. Settings retains legacy capability wording and internal terminology. Reconcile sample/live wording and the actual effect of Pause outbound before full visual acceptance.
2. After recording, the open enquiry can retain the previous proposed next step even though the queue correctly switches to Waiting. A focused post-action presentation pass is still needed.
3. External-send attestation initially receives focus in the existing review dialog. Review keyboard-safety implications separately from the preserved recording transaction guarantees.
4. Physical iPhone/Android keyboards, nonzero safe areas, assistive technology, OS reduced motion and exhaustive cross-screen loading/error/disconnection states remain unverified.
5. Supabase Site URL/allowlist and SMTP are reported blockers, not independently inspected hosted settings. No auth configuration was changed. Public sign-in, provider quality, two-tenant HTTP evidence and beta/public gates remain open under current main governance.

Next slice: resolve post-recording presentation and Settings terminology, then complete the missing accessibility/device/state matrix against the approved boards. Keep marketing parked until the app direction is accepted; replacement marketing footage must show the new application rather than the rejected paper interface.
