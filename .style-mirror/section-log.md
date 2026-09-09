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

## /how

Built on `visual/mirror-how`, branched from `visual/mirror-linear` at `c165896`. Method: a standalone
Playwright harness (not `.style-mirror/tools/*`, to avoid touching files shared with the three other
routes being built in parallel) - computed-style assertions against `tokens.lock.json` and a
rendered-pixel contrast sweep using the same background/foreground-extraction algorithm as
`tools/contrast.mjs`. **Final state: 0 mismatches at 1440, 0 at 390, 52/52 computed-style checks
pass at both viewports.**

Re-extraction: before building, `linear.app`'s own below-hero feature sections were re-captured live
at 1440 and 390 (section `padding-block`, `h2` metrics, lede colour) to complement `tokens.lock.json`
rather than replace it. The live site's content has moved on from the 2026-09-09 capture (different
section headings), but every measured value matched the locked tokens exactly - 128px section
padding-block, h2 48px/510/-1.056px/lh 48px stepping to 24px/510/-0.288px/lh 31.92px at 390, text
primary/secondary colours identical - so the existing component vocabulary (`.mk-card`, `.mk-section`,
`.mk-section-head`) was used as-is rather than re-derived.

✓ **page header** - 0 mismatches, 1 derivation

The reference's own page-title tier (`h1_page` in `tokens.lock.json`) is 48px/510/-1.056px/lh 48px at
**both** 1440 and 390 - it does not step down the way `.mk-h1`/`.mk-h2` do (those are the home-hero and
section tiers). No existing class carries that exact non-shrinking behaviour, so the header is built
locally in `how.tsx` with explicit Tailwind arbitrary values, reusing `--mk-h1-optical` (already
defined in the shared layer, already switching -2px -> -1px at the reference's own 640 breakpoint)
rather than duplicating it. Verified by computed-style assertion, not visual match alone: `fontSize`,
`fontWeight`, `lineHeight`, `letterSpacing` and `marginLeft` all equal the `h1_page` scale at both
viewports.

✓ **feature section 1 (the live decision demo)** - 0 mismatches, 0 fixed

Section-head (`mk-label` / `mk-h2` / `mk-lede`) + full-width `MediaFrame` + `.mk-app-surface`, the
same shape as the interactive block on `/` - `CrossChannelDecisionDemo` owns `.mk-app-surface`
internally when `compact`, matching `index.tsx`'s own call site exactly. Verified: h2 48px/510/
-1.056px/lh 48px -> 24px/510/-0.288px/lh 31.92px at 390; media plate `#090a0b` 8px padding radius 12px.

✓ **feature section 2 (the six steps) - new `how-steps.tsx`** - 0 mismatches, 0 fixed

None of the six steps has its own product capture, so per system.md §4 this uses the card/list
vocabulary rather than an invented illustration: a two-column `.mk-card` grid (the same surface as
`/`'s "What Enquiry does instead", already verified there), each card a number label + `.mk-h3` title
+ `.mk-small` body. Collapses to one column below `sm` via the same `grid sm:grid-cols-2` the home
page's card grid uses. Every word of the six steps is unchanged from the pre-mirror page.

✓ **feature section 3 (the pricing case) - new `how-proof-case.tsx`** - 1 mismatch found, 1 fixed

Replaces the shared `ProofCase` component on this route only (that component still carries
`font-serif` and no `.mk-app-surface` wrapping, both against this pass's brief - `ProofCase` itself
is out of this route's edit scope, so a new component was written instead of a shared-file change).
Same shape as feature section 1: section-head + `MediaFrame` + `.mk-app-surface`, since this is also
a recreation of real product output. Copy, the `FACTS` table, the `$625` `CountUp` and the
`HearLetter` playback are byte-identical to the original.

MISMATCH FOUND AND FIXED (contrast sweep): the "Missing · Nothing blocking" value used `text-ok`
(`--color-ok: #27a644`, the marketing dark-surface green), which is not redefined inside
`.mk-app-surface` and measured **2.96:1** on the app's light `#faf7f1` card - a straight port of a bug
already present in the shared `ProofCase` component (same class, same failure, never wrapped in
`.mk-app-surface` to notice it there). Fixed to `text-mark` (`--color-mark: #2f4a3c`), the token
`CrossChannelDecisionDemo` already uses for the identical "positive fact" case
(`cross-channel-decision-demo.tsx:214`) - same green semantic, contrast-correct for a light surface.
Re-measured: **4.5:1+**, sweep now 0 fails.

✓ **CTA block** - 0 mismatches, 0 fixed

Two link-CTAs (`mk-btn mk-btn-primary` / `mk-btn-secondary`, verified h44/pill/`#e5e5e6`) then the
system's `.mk-prefooter` shape with `WaitlistForm compact` - same construct as `index.tsx`'s closing
section. All copy and both destinations (`/early-access`, `/demo`) unchanged.

Nav and footer are untouched shared components (`SiteShell`) - not re-verified per-pixel here since
no route-specific override was added; visually confirmed identical to the `/` capture.

## Contrast sweep - /how

Rendered-pixel, both viewports, every visible text node. **0 fails at 1440 (102 nodes), 0 fails at
390 (98 nodes)** after the `text-mark` fix above. Lowest passing pair: 4.57:1, `#716b61` on `#f3eee6`
("Then Maya texts…" toggle button, inside `CrossChannelDecisionDemo`, unchanged shared component).

## Shared-change request from /how

`ProofCase` (`src/components/site/proof-case.tsx`, not in this route's edit scope) has the same
`text-ok` contrast bug documented above, plus `font-serif` and no `Reveal`-free path. It is currently
unused by any route after this change. Recommend either deleting it or applying the same `text-mark`
fix + `.mk-app-surface` wrap if another route adopts it later.
