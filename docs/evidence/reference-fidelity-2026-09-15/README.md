# Reference fidelity correction - 15 September 2026

Branch: `codex/ui1-reference-fidelity`, base `e8b421d` (PR #30).

## Why this correction exists

The owner explicitly said the implementation did not deliver what the images designed.
The previous GPT review and passing tests did not close that gap. This slice compares
rendered pages directly with existing boards rather than commissioning another aesthetic.

## Reference-to-implementation decisions

| Page | Reference | Correction |
| --- | --- | --- |
| How, shared homepage story | `../../design/sitewide-2026-09-15/gpt-refinement-board.png`, top left | Compact heading with four principles, horizontal four-stage sequence, three side-by-side native message/action surfaces. Replaces the long vertical essay. |
| Demo | Same board, top right | Conversation and business facts on the left; lilac next action, reasons and cautions on the right. Two working scene controls retained. |
| Updates | Same board, bottom left | Compact dated rows with real product illustrations. Replaces oversized featured article plus text-only journal. Existing post dates and claims retained. |
| Business | `../../design/ui1-references/enquiry_desktop_handover_board.png`, Business home; `../../design/sitewide-2026-09-15/workspace-exploration.png` | One compact seven-destination directory, not two sprawling groups. Real previews, business selection and review warnings remain. |
| Insights | Refinement board, bottom right | Four compact icon/value cards and paired independent count charts. Real scoped counts only, no fabricated monthly selector, trends or conversion funnel. |

Reference images are not flattened into the interface. The controls, messages, facts and
charts are native, responsive UI. The generated board's sample Send button is replaced by
a real Explore sample link. Maya's authoritative changed scope, deadline and crew condition
remain intact. No action is represented as sent or booked. Journal images are actual
existing product captures and explicitly labelled as current sample views, not historic
customer evidence. Their thumbnails are not new fictional product mockups.

## Verification

- 772 tests pass, zero failures/skips. The 13 sitewide UI contracts were rerun after the final component edits.
- Typecheck, lint and production build pass; final responsive CSS build checked again before release.
- Direct desktop comparison at 1440x960, plus 1280x720 inspections. Screenshots in `after/`.
- Phone: 390x844. Tablet: 768x1024. All five corrected pages also checked at 320x740 with no document overflow; Insights cards have no clipped content. Release verification is recorded on the PR.
- How disclosure opens the real crew rule. Demo mouse and keyboard scene changes update the facts and next action. Keyboard Space opens Why; focus is visibly outlined.
- Business Pricing still exposes the two conflicting source prices and requires review. No source price was accepted or changed during testing.
- Mobile Business retains all seven destinations. Real product images load on Updates.
- Reduced-motion behavior remains governed by the existing public-site and app safeguards; no new animation added. OS preference emulation is not claimed.

## Limits and acceptance

This is a bounded correction of the clearly mismatched compositions, not a fresh claim that
every route is pixel-identical to every image. Decorative board furniture, invented customer
data, fake integrations and unsupported actions are intentionally not copied. Real tenant
empty/error/loading states and production personal-email authentication were not newly
exercised in this visual correction. Existing beta, SMTP, support/contact and external launch
gates remain open unless independently resolved. Owner visual acceptance remains open.

The owner's existing production publishing instruction applies after verification. Release
commit, PR, deployment result and live route checks are recorded on the delivery PR.
