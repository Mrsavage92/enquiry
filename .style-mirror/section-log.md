# Section-by-section mirror log

Reference: https://linear.app and https://linear.app/changelog, extracted 2026-09-09.
Method: `.style-mirror/tools/sections.mjs` reads the built page's computed styles for each section's
key selectors and compares them to the reference values in `tokens.lock.json`, per viewport.
`.style-mirror/tools/geom.mjs` compares rendered box geometry. Reference section crops sit beside the
built ones in `.style-mirror/sections/`. 109 property checks per viewport.

Final state: **0 mismatches at 1440, 0 at 390.**

---

✓ **nav** - 4 mismatches found, 4 fixed, derivations: none

1. `Menu` toggle visible at 1440. `.mk-nav-link` sets `display` and is unlayered, so a Tailwind
   `md:hidden` on the same element lost to it. Added `.mk-below-md` at equal specificity, placed
   after. Reference's own collapse point measured at 768 (links 0px wide at 768, 67px at 860).
2. Header gradient computed as `rgba(11,11,11,0.76)` against the reference's `0.761905`. Pinned to
   the reference's exact oklab computed value, which `rgba()` rounds away.
3. Header content inset 1px too wide - x=80 against the reference's 79. The reference insets its
   header 1px tighter than body content (77 vs 78 at 1440, 23 vs 24 at 390) so the wordmark's
   optical bearing lands on the h1 line. Added `.mk-nav .mk-container` override.
4. `See demo` was hidden below 640. The reference keeps its equivalent "Log in" text link visible
   at every width (62px at 390 and at 1440). Now always visible.

Verified: position fixed, height 73px/65px, `blur(20px)`, `1px solid rgba(255,255,255,0.08)`,
gradient fill, link `#8a8f98` 13px/400 h32 pad-x 12 radius 9999, CTA `#e5e5e6` on `#08090a`
13px/510 h32, wordmark h32 pad-x 8 margin-left -8 radius 6. Geometry: nav inner x=79 w=1282 at
1440 (reference 79/1282), x=23 at 390 (reference 23); wordmark x=71 (reference 71), x=15 at 390
(reference 15).

✓ **hero** - 0 mismatches found, 0 fixed, derivations: the form field and the hero form's presence

Verified: h1 Inter 64px/510/-1.408px/lh 64px `#f7f8f8` with a -2px optical margin at 1440 and
38px/510/-0.836px/lh 41.8px with -1px at 390; lede 15px/400/-0.165px/lh 24px `#8a8f98`; label
12px mono sentence-case `#8a8f98`; content left edge x=80 at 1440 and x=24 at 390; h1 top 266px
against the reference's 272px.

DERIVATION: the reference's hero carries no form. Enquiry's primary action is an email capture, so
one row is added between the lede and the product visual. The field itself has no reference
equivalent and is built from the reference's own surface tokens - `#0f1011` fill,
`1px #23252a`, radius 8px, 15px `#f7f8f8`, placeholder `#8a8f98`, focus ring `#5e69d1`.

DERIVATION: the eyebrow. No uppercase tracked label exists on either reference surface. Metrics
come from its nearest equivalent - a 12px sentence-case monospace label - and the colour is
stepped from `#62666d` (3.63:1, fails) to `#8a8f98`.

DERIVATION: hero top padding. The reference puts its h1 at y=272 (1440) and y=196 (390). Ours sits
at 206 and 166. The hero carries an eyebrow, a lede row and a waitlist form that the reference's
does not, and the delivery owner requires the product film to be playing on load without a scroll.
SiteVideo starts only at `intersectionRatio >= 0.5`, so the space above the frame was tightened
until the film clears that gate. Measured: at 1440x900 the desk film's box is 1300x731 at y=523
(the reference's own product visual sits at y=527), 377px visible, ratio 0.516, `paused=false`;
at 390x844 the phone film is 260x462 at y=599, 245px visible, ratio 0.529, `paused=false`. Every
other hero value is the reference's. Re-measure with `.style-mirror/tools/hero-film.mjs` after any
change to hero spacing - the margin over the gate is deliberate but not large.

✓ **product visual** - 1 mismatch found, 1 fixed, derivations: 3

Verified: plate `#090a0b`, 8px padding, radius 12px; panel `#101112` with
`1px rgba(255,255,255,0.08)` radius 12px; inner `1px rgba(255,255,255,0.05)` radius 8px with
`rgba(0,0,0,0.2) 0 0 0 2px`. Geometry: plate x=60 w=1320 at 1440, exactly the reference's - wider
than the 1280px text column, as the reference does it.

MISMATCH FIXED: the portrait hero film rendered 358px wide, not the intended cap - `.mk-media`
sets its own `max-width` in the unlayered layer and beat the Tailwind `max-w-*` on the same
element. Moved the cap to a wrapper. Before the fix the film's intersection ratio at 390 was 0.36
and it never started.

DERIVATION: the hero product visual is the desk film at >=640 and the phone film below it. The
reference shows one capture; Enquiry has a landscape and a portrait cut of the same session, and a
16:9 desk capture is unreadable at 390. The phone film is then the second-section media on desktop
only, so neither asset appears twice on a page.

DERIVATION: the interior keeps the app's own light palette (`.mk-app-surface`). The reference's
product visual is its own dark app; Enquiry's product is light, and forcing it dark would ship an
unverified inversion of the real thing. Only the frame is mirrored.

OMISSION: the reference overlays `grain-default.png` on its hero backdrop. That is a raster asset
owned by the reference, so it is omitted rather than approximated with SVG turbulence.

✓ **content sections** (on the phone / try it / the problem / who it's for / what Enquiry does /
at the desk / what it does not require / early access) - 0 mismatches found, 0 fixed,
derivations: none

Verified: `padding-block` 128px at 1440, 48px at 768, 0 at 640 with a 40/48 section-head block -
the reference's own measured ladder; section-head bottom gap 96px / 64px / 48px; h2 Inter
48px/510/-1.056px/lh 48px at 1440 and 24px/510/-0.288px/lh 31.92px at 390; row dividers
`1px solid #23252a`.

Removed here: the `border-t` on every section (the reference carries its rhythm in padding, not
rules), the ruled-paper field, the `.reveal` scroll entrances and the `.hero-in` fade.

✓ **cards** - 0 mismatches found, 0 fixed, derivations: none

Verified: `#0f1011` under a `rgba(255,255,255,0.03)` overlay,
`1px rgba(255,255,255,0.08)`, radius 12px, `rgba(0,0,0,0.2) 0 0 0 1px`; title 20px/590/-0.24px/
lh 26.6px `#d0d6e0`.

✓ **roadmap preview / changelog entry** - 3 mismatches found, 3 fixed, derivations: none

1. Content column at x=517 against the reference's 408. The reference's named grid line read as
   `5 / 13`; measured geometry says the column starts at x=408 and is 624px wide on the 1280px
   12-column grid with a 32px gap, i.e. `4 / 10`. `tokens.lock.json` corrected.
2. The 1px date rule stubbed out under each date, leaving gaps. In the reference the rule is a
   sibling of the date wrapper, not a child, and runs the full height of a date group. Re-parented
   to `.mk-entry` and the entry's bottom spacing moved onto `.mk-entry-body` so the row box (and
   therefore the rule) covers it.
3. `margin-bottom: 16px` had moved onto the date text; the reference carries it on the date
   wrapper. Restored.

Verified: 12 columns, 32px gap, aside `1 / 4` at x=80 w=296 with 24px padding-left, rule 1px
`#23252a` at x=89, marker 6px `#fc7840` (sampled from reference pixels) at x=86, date
14px/-0.182px/lh 21px `#f7f8f8`, title 24px/590/-0.288px/lh 31.92px, body 17px/lh 27.2px
`#d0d6e0` (15px/lh 24px at 390), divider 1px `#18191a` radius 9999px. Stacks to a single column at
640 with the rule and marker hidden, as the reference does.

✓ **footer** - 2 mismatches found, 2 fixed, derivations: 2

1. Links hugged the right edge. The reference's footer is a left-aligned grid: measured as
   `grid-template-columns: 224px x6` over the 1344px content with `gap: 0` and `padding: 0 32px`
   on every cell, which is what puts its first column's content on the x=80 line.
2. The footer used the 32px-inset container; the reference's footer uses the 46px page padding and
   applies the 32px inset per cell instead.

Verified: `#08090a`, `border-top 1px #23252a`, `padding-block 56px`, links 13px/400/-0.13px/
lh 19.5px `#8a8f98` on 28px rows with a 2px gap (30px pitch, the reference's). Geometry: brand
cell x=48 with content at x=80, link cells on the reference's 224px pitch.

DERIVATION: the reference's brand cell holds only its mark and spans one column. Enquiry's holds
the wordmark plus a two-line description, so it spans two.

DERIVATION: the reference's link columns carry headings ("Product", "Company"). Those are copy
this pass may not invent, so the columns ship unlabelled and every existing link keeps its wording
and destination.

---

## Responsive re-run at 390

Every section above was re-checked at 390x844 after the 1440 pass. 109/109 match. The responsive
ladder itself (640 / 1024 / 1280 breakpoints and their per-step type sizes, header heights,
outer/inset padding and section padding) was measured by sweeping the reference across 15 viewport
widths - `.style-mirror/sweep.json` - not inferred.

## Contrast sweep

Rendered-pixel, both viewports, every visible text node on `/`. See the report for the numbers.

## Known, out of scope

`/roadmap` carries two failing pairs (1.19:1 and 1.25:1) where a `·` separator is painted with
`text-line-strong`, a hairline *border* token used as a text colour. It fails in the light palette
too (1.49:1), so it predates this work, and `/roadmap` belongs to another agent in this sequence.
Recommended fix there: `text-stone`.

---

# updates

Reference: https://linear.app/changelog. Method: a route-scoped extension of the harness
(`.style-mirror/tools/_wk-sections.mjs`, `_wk-geom.mjs`, not committed as shared tools since
`sections.mjs`/`geom.mjs` hardcode `BASE + "/"` and this builder's dev port is 5273, not 5261 -
see "Shared-change requests" at the end of this log) plus the existing route-parametrised
`contrast.mjs` unchanged. 32/32 computed-style checks match at both viewports, 0 contrast fails.

**Re-extraction.** `.style-mirror/system.md` flags no shared class for a page-title tier distinct
from the home hero (`.mk-h1`, 64px→38px) or a section heading (`.mk-h2`, 48px→24px) - both wrong
for a short page name that must stay a constant size. Measured the reference's own `/changelog`
"Now" h1 live (Playwright, both viewports): **48px / 510 / -1.056px / lh 48px, unchanged at 390**,
optical margin -2px at 1440 / -1px at 390, color `#f7f8f8`, top padding 77px under the nav at
*both* viewports (unlike the home hero's responsive 64/96 split). This is exactly
`tokens.lock.json`'s already-recorded `typography.scale_*.h1_page` - confirmed against the live
page rather than assumed, and consumed here for the first time. No shared class exists for it, so
it is built as arbitrary utilities directly on the route's own `<h1>` (not `.mk-h1`/`.mk-h2`,
neither of which holds a size across breakpoints): `text-[48px] font-[510] leading-[48px]
tracking-[-1.056px] text-ink -ml-[2px] max-[640px]:-ml-[1px]`. Also measured live: the reference's
own tab row (All / Changelog / Product launches / ...) sits between the title and the divider,
title-top to tabs-top = 68px, matching `spacing.changelog_page_title_to_tabs` exactly. This route
has no categories to filter, so the tabs are not reproduced - the existing "In public" eyebrow
(copy this pass may not remove) sits in that slot instead, and the header uses `pt-[77px] pb-16`
to land the title at the same measured offset the reference uses for a header **with no eyebrow**;
adding one pushes the divider/entries down proportionally to the eyebrow's own height. Recorded
as a derivation, not fixed further, because the alternative is inventing new copy.

**Changelog entries.** Reused `.style-mirror/system.md` §4's pattern verbatim - one `.mk-entry`
per post (all 5 keep their own date, including the three consecutive "26 Aug 2026" entries; the
task requires every entry and date kept, and the rule/marker are per-entry, not per-date-group, so
stacking still reads as one continuous line, exactly as home's roadmap preview already proves).
Newest entry (`i===0`) gets the marker dot and `data-featured="true"`. Live re-extraction of the
reference's own newest changelog post confirms the featured tier is real, not assumed: title
"Priority inbox" computes to exactly 32px there (`h2_entry_featured` in tokens.lock.json).

Verified (32/32, both viewports): h1 48px/510/-1.056px/lh48/`#f7f8f8`, optical margin -2/-1px;
label 12px mono `#8a8f98`; lede 15px `#8a8f98`; divider 1px `#18191a` radius 9999; entry date 14px
`#f7f8f8`; featured title 32px/590/-0.704px/lh36 (24px/590/-0.288px/lh31.92 at 390, per the
existing breakpoint rule); non-featured title 24px/590; entry body prose 17px/lh27.2 `#d0d6e0`
(15px/lh24 at 390); entry rule/marker colours; inline links `#828fff`; closing h2 48px/510/`#f7f8f8`.

Geometry (`_wk-geom.mjs`, matches the reference exactly): h1 left x=78 (1440) / x=23 (390) -
identical to the live-measured reference h1 position, not merely the container edge; entry aside
x=80 w=296 (1440), content column x=408 w=624 (1440) - both exact matches to
`layout.changelog_grid`; first entry title bottom = y484 at 1440x900 and y553 at 390x844, both
comfortably inside the fold as required.

MISMATCH FOUND AND FIXED (pre-harness, self-caught during composition): none required - all 32
checks passed on the first harness run at both viewports.

DERIVATION: the closing "Join early access" section reuses `.mk-prefooter` (home's own closing-CTA
pattern - h2, lede, form, 224px margin-block) rather than inventing a smaller variant. On a page
this short the resulting gap reads generous, but the alternative is a bespoke spacing value with
no reference behind it; `.mk-prefooter` is the reference's own measured closing-CTA rhythm and the
same class home's bottom CTA uses, so the composition stays inside the vocabulary.

# early-access

Reference: the system's own composing pattern (`.style-mirror/system.md` §5), not a fresh
reference extraction - this route's task explicitly calls for "the system's page header," and its
headline is a sentence ("Be one of the first businesses to use Enquiry."), not a short page name,
so it takes the home hero tier (`.mk-h1`, 64px→38px) rather than `/updates`' page-title tier - the
same split the system's own guide draws between a hero composition and a listing page. 26/26
computed-style checks match at both viewports, 0 contrast fails.

**Bug found and fixed: unlayered class beats a Tailwind colour utility (twice).** The offer
sentence and each "What joining means" item title were built as `.mk-small` (unlayered, `color:
var(--mk-fg-2)`) plus a Tailwind colour utility (`text-ink`, matching the home page's own identical
`text-[var(--mk-fg)]` pattern on this exact sentence) intending to step the colour up to the
brighter `--mk-fg` tier. `system.md` §1 states plainly that unlayered rules beat the Tailwind
utilities layer regardless of source order or which utility is used - the computed-style harness
caught it directly (`offer sentence / color: expected rgb(247, 248, 248) got rgb(208, 214, 224)`),
proving both instances rendered as the untouched `fg-2` colour. **This means home's own copy of
this sentence is very likely the same silent no-op** - out of this pass's ownership to fix, flagged
under "Shared-change requests" below. Fixed here with an inline `style={{ color: "var(--mk-fg)" }}`,
which wins over both the utilities layer and unlayered stylesheet rules; re-ran the harness after
the fix and both instances now measure `rgb(247, 248, 248)` exactly.

DEAD CODE FOUND AND REMOVED (no computed-value change, so not reported as a fix): the second
content section was written as `.mk-section pt-0`, intending to zero the section's own top padding
for a tighter gap under the hero. `.mk-section` is also unlayered (`padding-block: 128px`), so
`pt-0` never applied - the section rendered at the full 128px top padding regardless of the class.
Per the invisible-change rule, a class that does not change the computed value is not a real
edit, so it was deleted rather than left as misleading intent; the section now correctly reads as
using the reference's own standard section rhythm (matches home's own inter-section spacing, not a
bespoke tightened value).

Verified (26/26, both viewports): h1 64px/510/-1.408px/lh64 at 1440, 38px/510/-0.836px/lh41.8 at
390, `#f7f8f8`; label 12px `#8a8f98`; lede 15px `#8a8f98`; offer sentence 14px `#f7f8f8` (post-fix);
form field `#0f1011` fill, 1px `#23252a` border, radius 8, `#f7f8f8` text; primary CTA `#e5e5e6` on
`#08090a`, radius 9999; "What joining means" h2 48px/510/`#f7f8f8`; `.mk-rows` divider 1px `#23252a`;
card `#0f1011`, 1px rgba(255,255,255,.08), radius 12.

Geometry: h1 left x=78 (1440) / x=23 (390), matching the same reference-derived hero-h1 position
home's own hero uses; form field top y=504 at 1440x900 (comfortably inside the fold - "no empty
fold" requirement met with the offer sentence and form both visible without scrolling); card near
the bottom of the page at y=1415, the last content block before the footer.

DERIVATION: the waitlist form sits directly under the offer sentence with no card wrap - it is not
a signed-in app component (`system.md` §5.3's `.mk-app-surface` rule does not apply to it), so it
already inherits the mirror palette through the app-named token remap, the same way home's hero
form does.

---

## Contrast sweep (both routes, both viewports, rendered-pixel)

0 real failures across 160 graded text nodes (updates: 47 @1440, 43 @390; early-access: 37 @1440,
33 @390). Lowest pair: 5.51:1, `.mk-label` "Why not open it to everyone?" on early-access (both
viewports) - a 12px mono label against `#08090a`, comfortably above the 4.5:1 threshold.

## Shared-change requests (not made - outside this pass's ownership)

1. **`src/routes/index.tsx` line ~315-318** almost certainly ships the same unlayered-vs-utility
   no-op this log documents above: `<p className="mk-small mt-4 max-w-xl text-[var(--mk-fg)]">`
   for the "Join before public release..." sentence renders as `--mk-fg-2` (`#d0d6e0`), not the
   intended `--mk-fg` (`#f7f8f8`), because `.mk-small` is unlayered. Not fixed here (home is out
   of this pass's ownership) - worth a one-line fix (inline `style` or drop `.mk-small` in favour
   of bespoke utilities) whenever home is next touched.
2. **`.style-mirror/tools/sections.mjs` and `geom.mjs`** hardcode `BASE = "http://127.0.0.1:5261"`
   and `page.goto(BASE + "/", ...)` - fine for the home-page harness they were built for, but every
   other route builder on a different assigned port (this pass used 5273) cannot run them as-is
   without either editing a shared file or duplicating them. Worth a `--route` / `--port` CLI flag
   so future route passes can reuse the canonical tool instead of writing a parallel one (this pass
   wrote route-scoped equivalents against port 5273, ran them, then deleted them rather than
   commit new files outside this pass's ownership boundary - the console output is preserved in
   this log and in the deliverable report instead of as JSON in the repo).
