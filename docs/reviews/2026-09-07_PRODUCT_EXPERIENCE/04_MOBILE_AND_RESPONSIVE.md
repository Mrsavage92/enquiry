# 04 - Mobile as a complete operating surface

Review date: 2026-09-07 (Australia/Brisbane)  
Application source reviewed: `79de089b2fe3f79efec14795eb340cf047bdb67a`  
Status: **REVIEW ONLY. CC1 remains the active implementation slice.**

This is a source-level review unless an executed probe is explicitly identified. It is not a production incident report, browser sign-off, security certification or authority to implement a new phase. Preserve existing work and reproduce findings on the implementation branch before changing it.

## Verdict
The app has purpose-built mobile views, not only compressed desktop styling. However, an important post-quote action is missing from the mobile branch, and action placement is inconsistent. Fix task parity before cosmetic refinement.

## Keep
`PhoneDesk` provides safe-area spacing, a conversation sheet, large back/more controls and a primary-action area. Decline waits for server success before advancing. The shell accounts for the visual viewport when the keyboard opens. These are meaningful foundations, although they were not rerun in a real mobile browser in this review.

## M1 - Ready follow-up has no mobile send trigger
**Priority: P1 for a phone-first beta. Evidence: source-confirmed render branches.**
In `WaitingDesk`, the desktop branch renders the button that opens the follow-up preview when `followUpReady` is true. The phone branch renders waiting text and a More button. Inside More, the 'gone quiet' action disappears when the follow-up is ready, but no ready-follow-up send button replaces it. `PhoneDesk` continues to use this waiting surface for quoted enquiries waiting on the customer.

The ready follow-up can therefore exist in state without the corresponding mobile control in this component path. This is not a measured touch-target complaint; it is missing task functionality.

**Recommendation:** derive a shared action inventory from authoritative state, then render it appropriately on desktop and phone. Keep the correct primary action visible. CC1's copy/confirm distinction must apply here too.

## M2 - Verify the intermediate widths, not only desktop and phone screenshots
**Priority: P2 verification risk, not a claimed rendered defect.**
The JS mobile split uses 860px while the workspace grid changes at Tailwind's 1024px and 1280px breakpoints. The conversation column is hidden below `xl`, while the mobile Thread control belongs to `PhoneDesk`. Verify access to the original customer message at intermediate widths and investigate the single-column grid between 860px and 1023px. Source inspection is not proof of the actual clipping or scroll result.

There are also two different More menus on the phone: the header exposes note/later/decline, while WaitingDesk exposes question/acceptance/loss and quote actions. Consolidate the mental model without hiding a needed action another tap deep.

## Acceptance
Run the complete journey at 375, 390, 768, 859, 860, 1023, 1024, 1279, 1280 and 1440 CSS pixels. Verify original-message access, fact correction, ready follow-up, actual external-send confirmation and outcome recording. Include a long customer name, long draft, on-screen keyboard, failed save, zoom/reflow and a screen-reader pass. Do not describe emulated viewports as real iPhone testing.

Use 44px-class touch targets as a product design preference where suitable. WCAG 2.2 AA target-size minimum is 24 by 24 CSS pixels with specified exceptions, not a universal 44px requirement. See the primary standard in `EVIDENCE.md`.

## Source map
- `src/components/enquiry/phone-desk.tsx`: `inChat`, header menu, waiting surface.
- `src/components/enquiry/waiting-desk.tsx`: `phone`, `followUpReady`, `setConfirmOpen` branches.
- `src/components/enquiry/workspace.tsx`: mobile split and responsive columns.
- `src/components/shell/app-shell.tsx`: keyboard/safe-area handling.
