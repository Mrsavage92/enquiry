# Business Workspace Refinement

Runtime source: `0777461`, branch `codex/ui1-owner-recovery-2026-09-14`.
Local built preview: http://127.0.0.1:8083/business.

## Outcome

- Retained the lilac navigation and quiet workspace foundation. Business now has two unframed destination groups on wide desktop and a single-column phone/tablet layout.
- Added a tenant-aware business selector, saved-detail previews, visible review flags, and one primary Add a detail action.
- All seven destinations remain. No new production integration, availability, pricing or sending claims were introduced.
- Services now displays the actual catalogue, including status and duration where supplied. Search covers the catalogue and supporting notes, including on phone.
- Removed the unrelated confirmed/learning counters from detail-page headers; business identity stays visible on phone.

## Verification

- Full repository suite: 743 passed, zero failed/cancelled/skipped; 70 test files, 218979ms. This run preceded the final search/capacity review corrections.
- Final focused Business suite: 10 passed. Includes the three tests added for those review corrections; this is not a claim that 753 distinct tests ran.
- Final typecheck, lint, production build and diff check passed.
- Built preview visually inspected at 1440x960, 1024x768, 390x844 and 320x740. Screenshots in this folder are actual rendered app captures.
- DOM width checks: no horizontal overflow at 320px or 1024px. Phone lower destinations and Details you need remain reachable above bottom navigation after scrolling.
- Enter opens Services; search for group shows only Group mobile makeup without a contradictory empty message. A nonmatching query produces an empty result. Search focus has a visible violet outline.
- Enter on Add a detail focuses the existing tell textarea. No change was submitted during this check.
- Business switching to Ridge updates previews; its full crew/empty-house capacity rule remains accessible. Connections still opens its existing route.
- Final built tab console error log: empty.
- Existing global reduced-motion rule retained. Physical mobile keyboard, OS-level reduced-motion emulation and assistive-technology testing were not performed in this slice.

## Independent Review

The read-only QA reviewer found two issues: catalogue search originally ignored the catalogue, and capacity wording equated inactive with unsaved. Both were corrected, covered by tests, and re-reviewed as resolved. The reviewer did not independently run browser checks or the test suite.

## Boundaries

No backend, tenant hydration, commercial decision, send/record, hosted auth, entitlement or deployment behavior changed. No push, production merge or deployment occurred. Previous auth/beta gates and whole-app owner acceptance remain open; this verifies the Business slice, not completion of the entire UI1 programme.
