# UI1 Visual Refinement Review

Date: 2026-09-10 (Australia/Brisbane)
Branch: `codex/ui1-visual-refinement`
Baseline: main `47a8d29` / PR #19

## Owner Rejection And Direct Reference Correction

**Current visual acceptance: OPEN.** After the review below, Adam rejected the visual match: "keep going this isnt what you had in the gpt images". The earlier AI review is historical, not owner acceptance. Codex notified the original conversation that its verdict is superseded.

The original four bitmaps are now stored in `docs/design/ui1-references/`, without unrelated ChatGPT chrome. Comparing the actual files exposed differences that the previous review had accepted too loosely: a flat summary strip instead of separate tiles, over-wide unframed rows, a missing week strip, a weak wordmark, and a mobile reply preview competing with its action.

The follow-up correction on the same branch:

- Uses the original composition more closely: pale lilac work background, white summary tiles, lightly outlined individual rows, bolder wordmark and clearer violet active navigation.
- Makes Today a focused preview of the attention queue, with the full list one click away; preserves the at-risk link and real counts. The greeting uses the selected business's actual owner name only when available.
- Adds a working Monday-first week selector using the existing calendar/date helpers. Day selection, previous/next week and return to Today are functional. Booking holds and pending external confirmations stay qualified.
- Restores distinct service/date/status/update columns on desktop Enquiries, with compact phone rows and working search/filter controls.
- Gives Business and Booked the reference's repeated-row treatment, with booking amounts, hold and overlap states retained. Customer markers use initials, never invented customer photos.
- Brings More's destinations forward, with the business switcher and device/sample controls behind disclosure. Removes the old stacked-paper empty-state illustration in favour of a neutral, restrained icon treatment.
- Uses a compact lavender next-step surface on phones. Full reply editing remains in its sheet, while price drift and material blockers stay outside the disclosure. Frozen review, copying and external-send recording are unchanged.

Verification for this correction: 73 targeted calendar/date/labels/review/keyboard/demo-isolation/contrast tests pass; typecheck, lint and production build pass. Browser checks cover 1440x960, 1024x768, 768x1024 and 390x844, plus the full reply editor at 390x400. Search matches/empty results, keyboard tab selection, actual dated sample booking selection and return to Today were exercised. No document horizontal overflow was found at the checked widths. See the `fidelity-*.png` screenshots in `docs/evidence/ui1-review/`.

The earlier full 725-test run below belongs to the previous correction, not a newly repeated full-suite result. Physical phone keyboard/safe-area checks remain unverified. This correction does not claim pixel identity, owner acceptance, or production release approval.

## Original Design Review

At Adam's request, Codex contacted the original design conversation directly in his signed-in ChatGPT browser. No manual relay was required. The reviewer inspected the previous implementation and the four approved handover boards, then reviewed before/after screenshots of the actual local application.

Source conversation: `6aa20b90-c690-83ec-af8b-b549fc7c2865`, "Enquiry Review - Visuals".

The shipped baseline was rejected as a palette change retaining the old composition. The first corrective review accepted the new architecture and requested a finish pass. The final review stated: **"UI1 core visual redesign: ACCEPTED."**

Accepted surfaces: shell, desktop/mobile Today, desktop open enquiry, Business, Booked and Insights. Mobile open enquiry was accepted subject to checking sticky actions and safe areas. This is independent AI design review requested by the owner, not a claim that Adam has approved release.

The final follow-up reviewed the compact-editor evidence plus Enquiries, Connections and Help. It concluded **"Design review: CLOSED / PASS"**, with no release-blocking visual issues in the supplied screenshots. Physical-device keyboard behaviour remains explicitly unverified. The reviewer's mention of nonzero safe areas was not a performed device test; only the retained safe-area CSS and browser viewport geometry were verified.

All four named boards were located and visually inspected in the source conversation, including the design-system attachment. Mockup names, prices, counts, integrations and quotas were not used as product data. Reference captures containing unrelated ChatGPT chrome are excluded from Git.

## What Changed

- Shipped Inter; tightened the lilac shell; moved the violet accent after the Enquiry wordmark; standardised headings, surfaces and status chips.
- Rebuilt Today around compact supported counts, attention rows and a calendar rail. Mobile gets its own header and tabs. At-risk work remains visible and links to its actual filter.
- Made the customer conversation primary. The prepared reply sits inline; the supporting rail and details drawer retain evidence, quotes, facts and decision safeguards.
- Preserved complete editing and the existing frozen review, copy and external-send attestation flow. Copying does not record delivery.
- Reworked Business into seven human-facing destinations, retaining underlying knowledge, pricing, voice, review and correction controls deeper in the screen. Primary navigation returns to the hub.
- Refined the complete searchable enquiry list and restored live manual enquiry creation using the existing persistence path, never a fixture-business fallback.
- Added Upcoming/Past views to Booked while preserving day/week/month calendar, conflict/hold states and job details. Empty Upcoming can link to existing past bookings.
- Kept Insights to repository-backed totals and source counts. Counts are not presented as an invented conversion funnel or revenue analytics.
- Simplified account, usage, referral and support states without claiming unavailable plans, rewards or support channels. Calendar connection simulation and sample reset controls remain demo-only.
- Added arrow/Home/End keyboard navigation to segmented controls and accessible labels to reply/note editors.

No decision engine, server authority, commercial arithmetic, tenant membership, data schema or real sending integration was rewritten.

## Verification

- Existing full test suite: **725 passed, 0 failed**, run serially to avoid parallel in-memory database pressure.
- New tests read the actual shipped CSS colour tokens: **2 passed**, covering text, navigation, semantic status and input boundary contrast.
- Typecheck, lint and production build pass.
- Browser checks: desktop 1440x1000; tablet 1024x768 and 768x1024; phone 390x844 and short 390x600/390x400 layouts. No document horizontal overflow on checked routes.
- Inter was confirmed loaded through the browser font API. A fresh browser tab reported no runtime errors before development hot-reloads.
- Checked full draft editing, end-of-message access, review recipient/body/amount, evidence drawer/sheet, search within selected filters, arrow-key tabs, Business hub return, empty bookings, and mobile risk links.
- At 390x400 the full reply ending can be scrolled into view inside the editor while Done remains within the viewport. At 1024x768 the conversation and Review reply remain visible, with evidence available on demand.
- Reduced-motion CSS disables animation and transition duration globally. This was inspected in source, not claimed as an OS/device emulation test.

## Evidence

Actual sample-workspace browser captures are in `docs/evidence/ui1-review/`:

- `before-*`: rejected shipped baseline.
- `after-*`: initial structural correction submitted for review.
- `final-today-*`, `final-enquiry-*`, `final-business-desktop.png`: reviewed core composition.
- `final-edit-compact-phone.png`: complete reply ending and Done at 390x400.
- `final-enquiry-tablet.png`: tablet conversation with reachable review action.
- `final-evidence-desktop.png`, `final-why-phone.png`, `final-review-desktop.png`: retained evidence and truthful review workflow.
- `final-booked-*`, `final-insights-desktop.png`, `final-enquiries-desktop.png`: additional operational views.

Some review-round screenshots predate small follow-up corrections described in the design chat: the mobile risk link, removal of the nested draft tile, "Current totals" chart title and the Booked empty-state link. They are labelled review evidence, not proof of a deployed build.

## Remaining Release Limits

- No physical iPhone/Android keyboard or nonzero safe-area device was available. Browser viewport tests are not a substitute for claiming those device tests passed.
- Visual captures use the explicitly marked local sample workspace, not authenticated production customer data. Live manual creation and server sending safeguards are covered by existing tests; no production customer record was created or sent during QA.
- Usage entitlements, referral rewards, support contacts and production integrations remain unavailable where authoritative data does not define them. Visual polish does not make those capabilities live.
- No merge to main or production deployment is authorised by this review record. Beta/public-traffic gates remain separate.
