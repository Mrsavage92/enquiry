# Slice E2 - width and overflow-probe measurements

Recorded 2026-09-04. Review `26-review-slice-e2.md` (research library, not in this repo) flagged
that the re-run overflow-probe measurements for this slice existed only in research doc
`25-slice-e2-panel-cap.md`, not in version control alongside the screenshots they explain. This
file closes that gap by committing the numeric tables next to the evidence they support.

## Methodology

All numbers below are live browser measurements against the real `f01` fixture (Priya Shah, Group
mobile makeup), taken with `chrome-devtools` MCP tooling (`getBoundingClientRect`,
`getComputedStyle`, `document.documentElement.scrollWidth`) on a running dev server - not read from
CSS source, not estimated. Commits: `af9049e` (decision-panel cap + correspondence cap raise, task
1-2), `8c32070` (hover title on the truncated confirm button, task 3), `7ecafbf` (screenshots and
the overflow-probe re-run, task 4).

## Task 1 - decision panel width cap, before -> after

Grid template changed from `xl:grid-cols-[18.5rem_minmax(20rem,30rem)_minmax(24.5rem,1fr)]` to
`xl:grid-cols-[18.5rem_minmax(20rem,36rem)_minmax(24.5rem,40rem)]` (`workspace.tsx:186`). Columns
in order: Queue (fixed 296px), Conversation/correspondence, Intelligence/decision panel.

| viewport | container width | before: queue / corr / decision (px) | after: queue / corr / decision (px) | overflow? |
|---|---|---|---|---|
| 1280 | 1030 | 296 / 342 / 392 | 296 / 331 / 403 | no - `scrollWidth` 1270 < 1280 |
| 1440 | 1190 | 296 / 480 / 414 | 296 / 411 / 483 | no - `scrollWidth` 1430 < 1440 |
| 1920 | 1670 | 296 / 480 / 894 | 296 / 576 / 640 | no - `scrollWidth` 1910 < 1920 |
| 2560 | 2310 | 296 / 480 / 1534 | 296 / 576 / 640 | no - `scrollWidth` 2550 < 2560 |

At 1920 and 2560 the decision panel was growing unbounded before this fix (894px and 1534px);
after, it is hard-capped at 640px at both widths. Correspondence's own cap was raised from 480px to
576px in the same commit, matching `conversation.tsx`'s pre-existing `max-w-xl` (576px) content cap
so the track cap stops clipping 96px of already-design-intended reading width. Residual dead gutter
on the right edge: 0px at 1280/1440, ~158px at 1920, ~798px at 2560 - a disclosed, reasoned
trade-off (see `af9049e` commit body), not an oversight; two alternatives (whole-grid centering, a
5-track spacer with explicit per-child placement) were considered and rejected as disproportionate
regression risk for a non-blocking, edge-width polish item.

## Task 4 - overflow probe re-run at 1024 and 1150

Same methodology as the original Slice E bug proof (`4e05616`): a synthetic non-wrapping node
injected into the real Intelligence grid column, at the real `f01` enquiry, against the already-
shipped `lg:` template fix (`workspace.tsx`'s `minmax(0,1fr)`, untouched by this slice). Run at two
injection points - as a direct sibling of Intelligence's root (shallow, inside the workspace-level
grid-item wrapper) and inside Intelligence's own `overflow-y-auto` root (deep).

### 1024px

| probe location | grid track before | grid track after injection | doc `scrollWidth` | page blowout? |
|---|---|---|---|---|
| shallow (sibling of Intelligence root) | 296px 478px | 296px 478px (unchanged) | 1014 (unchanged) | no |
| deep (inside Intelligence's `overflow-y-auto` root) | 296px 478px | 296px 478px (unchanged) | 1014 (unchanged) | no |

### 1150px

| probe location | grid track before | grid track after injection | doc `scrollWidth` | page blowout? |
|---|---|---|---|---|
| shallow (sibling of Intelligence root) | 296px 604px | 296px 604px (unchanged) | 1140 (unchanged) | no |
| deep (inside Intelligence's `overflow-y-auto` root) | 296px 604px | 296px 604px (unchanged) | 1140 (unchanged) | no |

The grid track never grows at either width, and `document.documentElement.scrollWidth` never
exceeds its pre-injection value - no page-level blowout at either injection point. Where the excess
content actually lands changes how it is contained, not whether: a shallow injection is silently
clipped by the outer workspace grid's own `overflow-hidden`, with no scrollbar; a deep injection
(inside Intelligence's own scrollable subtree) produces a real, visible internal horizontal
scrollbar, confirming the fallback mechanism the Slice E review predicted. Both outcomes are safe.
Screenshots: `probe-1024-wrapper-level.png` (shallow, clipped), `probe-1024-deep-scrollbar.png`
(deep, scrollbar visible), `probe-1150-both-injections.png` (both injection points at 1150px).
