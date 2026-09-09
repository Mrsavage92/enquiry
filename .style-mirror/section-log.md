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

# roadmap

Reference: https://linear.app/changelog, **re-extracted 2026-09-09** for this route -
`.style-mirror/reextract/changelog{,2,3}-{1440,390}.json`. tokens.lock.json already carried the
entry grid, the rail and the title tiers; the re-extraction adds the page header rhythm, the tab
row, the sticky label column, the in-entry list, the media figure, the inline-link treatment and
the end-of-page divider.

Method: `.style-mirror/tools/sections-roadmap.mjs <outdir> <1440|390>` - the same shape as the
lead's `sections.mjs`, with the roadmap's selectors and the re-extracted expected values.
`sections.mjs` itself is shared with three other route builders this pass, so the spec sits beside
it rather than inside it. Geometry: `.style-mirror/tools/geo-roadmap.mjs`.
Contrast: the lead's `contrast.mjs`, unmodified.

Final state: **0 mismatches at 1440 (114 checks), 0 at 390 (108).**

## What the re-extraction settled

| | reference value at 1440 | at 390 |
|---|---|---|
| page h1 | 48 / 510 / -1.056 / lh 48, `#f7f8f8`, optical -2px, top = nav + 77px | **48px unchanged**, optical -1px |
| h1 row | flex, space-between, on the 1280px column | same |
| tab row | 40px tall, 12px under the h1, space-between; tabs flex, gap 16 | breaks out full-bleed and scrolls |
| tab | 16 / 400 / lh 24, `#8a8f98`, `#f7f8f8` when current, no underline, no padding, `transition: color .1s` | same |
| header divider | 1px `#18191a`, radius 9999, margin `32px 0 64px`, full column | same |
| entry | `grid`, 12 cols, column-gap 32, **row-gap 32**, position relative | 4 cols, both children full width |
| rail column | `position: sticky; top: 96px`, 296px at x=80, padding-left 24, margin-bottom 16 | `position: relative; top: 20px`, full width, padding-left 0 |
| rail rule | absolute, `top: 0 / margin-top: 9px / bottom: -9px`, 1px `#23252a`, x=89 | `display: none` |
| entry body | 624px at x=408 | full width |
| first title in a group | 32 / 590 / -0.704 / lh 36 | 24 / 590 / -0.288 / lh 31.92 |
| later titles | 24 / 590, margin-top 56 | same |
| first p after a title | margin-top 12 | same |
| p after p | margin-top 20 | same |
| prose | 17 / 400 / lh 27.2 `#d0d6e0` | 15 / lh 24 |
| `strong` in prose | 17 / **590** / `#f7f8f8` | same |
| list | padding-left 24, `list-style: none` with a `::before` disc counter in `#d0d6e0`; items margin-top 8, first 0 | same |
| media | bare `<figure>`, margin-block 48, image radius 8, **no plate, no border, no shadow** | margin-block 32 |
| inline link in prose | 17 / 400 `#f7f8f8`, `text-decoration: underline` | same |
| entry groups | butt directly, gap 0 - the rule is continuous | same |
| end of page | last entry, one divider (margin `32px 0 16px`), then the footer. No closing block. | same |

## The navigation decision - taken from the extraction, not taste

`/roadmap` carried a sticky era bar. The reference's `sticky_or_fixed` probe returns its per-group
date columns **and nothing else**: its tab row is static, and its orientation while you scroll a
long group is a label column at `position: sticky; top: 96px`. So the sticky bar is replaced rather
than kept, and its two functions are split the way the reference splits them - jump-to-stage into
the tab row under the h1, where-am-I onto the rail label. The IntersectionObserver that drove the
old bar now drives the tab row's current state and still fires `roadmap_stage_view` /
`roadmap_endgame_view` unchanged.

96px is the reference's own value against its own 73px header, i.e. 23px of clearance; our nav is
73px too, so `jump()` offsets by `header height + 23` and lands an entry on the same line.

---

### header - 4 mismatches found, 4 fixed, derivations: 3

1. h1 rendered at 64px. `.mk-h1` is the reference's **home** h1 tier (64px, 38px at 390); the
   changelog's page tier is 48px at both widths. Set inline from the re-extraction, with `.mk-h1`
   still supplying family, colour and the optical margin variable. A shared `.mk-h1-page` is the
   right home for it - filed as a request, not edited into `styles.css` this pass.
2. Both ledes ran the full 1280px column. `.mk-lede` sets `max-width: none` in the unlayered
   marketing layer, so a Tailwind `max-w-xl` on the same element loses to it. Capped inline.
3. 16px between the two lede paragraphs; the reference's paragraph rhythm is 20px.
4. `padding-top` was the old `pt-10 sm:pt-20`. The reference puts its h1 77px under a 73px header.

DERIVATION: the eyebrow. The reference's changelog header is h1 + tab row, with no eyebrow.
"Roadmap - Built in public" is copy that must be kept, so it takes the system's own `.mk-label`
above the h1 - the same shape home uses.

DERIVATION: the lede and the second paragraph. The changelog header has no lede either. They use
`.mk-lede` at the system's hero recipe, which is the reference home's own lede tier.

DERIVATION: the status legend. The reference has no legend. It is laid out under the CTAs, before
the tab row, so the vocabulary is defined before the stream that speaks it: mark at the 12px mono
label tier, label at the 14px rail tier, hint at the 13px tier - all three reference tiers.

Verified: h1 48/510/-1.056/lh 48 with -2px optical at 1440 and -1px at 390; label 12px mono
sentence-case `#8a8f98`; lede 15/400/-0.165/lh 24 `#8a8f98`; content left edge x=80 at 1440 and
x=24 at 390; primary CTA `#e5e5e6` on `#08090a`, h44, pad-x 20, radius 9999, 16px/510; secondary
`rgba(255,255,255,0.05)`.

### era nav + divider - 1 mismatch found, 1 fixed, derivations: 1

1. Below 640 the row clipped at the 24px content inset instead of the viewport, so "Trust" and
   "Endgame" were unreachable with no scroll affordance - the contrast sweep caught it as a 1:1
   pair, because the tab was not painted at all. The reference breaks its tab row out to the full
   viewport width to scroll (`.tabs` measures x=0 w=390 while its row sits at x=24). Reproduced
   with `-mx-6 / px-6` at the same 640 boundary `.mk-entry` uses.

DERIVATION: the right-hand slot. The reference's tab row puts a search field and a bell there.
Enquiry has no site search, so the slot carries the "Last updated / phase / access" line at the
reference's 13px tier - the same role, the page's own utility.

Verified: nav 40px tall, space-between; tabs flex with a 16px gap; idle tab 16/400/lh 24
`#8a8f98` with no underline, no background, no padding; current tab `#f7f8f8` at the same weight
(the reference's current tab is 400, not bold); divider 1px `#18191a`, radius 9999, margin
`32px 0 64px`.

### rail + first entry - 3 mismatches found, 3 fixed, derivations: 2

1. The rule broke by 9px between groups. `.mk-entry-rule` stops at its group's bottom while its top
   is inset 9px; the reference overshoots by exactly that 9px (`bottom: -9px`) so the rule is
   continuous down the whole stream. Set inline so the class still handles the `<=640` hide.
2. At 390 the two rail lines stacked and collided with the title by 5px. `.mk-entry` is
   `display: block` below 640, so the grid's 32px row-gap disappears there. Status and number now
   share one rail line, as the reference's does, and the row-gap is added back as padding. The
   rail's rendered bottom now sits **28px** above the title box - the reference measures 28px.
3. Breakpoints were Tailwind's `sm`, which starts at 640, while `.mk-entry` collapses at
   `max-width: 640px`. Rewritten as `max-[640px]` / `min-[641px]` so the two never disagree.

DERIVATION: the rail's second line. The reference's rail carries one line - a date. The roadmap's
rail carries the status (the reference's 14px `#f7f8f8` date tier) and, because the stage number is
copy that must be kept and the tab row no longer shows it, the number under it at the 13px tier.
Below 640 they sit side by side so the rail stays one line, as the reference's is.

DERIVATION: the marker dot. The reference caps its **newest** group with a 6px `#fc7840` dot. The
roadmap has no newest; it caps the stage marked `current`, which is the same "you are here" role.

Verified: 12 columns, column-gap 32; aside x=80 w=296 with 24px padding-left, `sticky` / `top: 96px`
at 1440 and `relative` / `top: 20px` at 390; rule 1px `#23252a` at x=89 with `bottom: -9px`, hidden
at 390; marker 6px `#fc7840`; rail label 14/400/-0.182/lh 21 `#f7f8f8`; body x=408 w=624 with
48px padding-bottom; featured title 32/590/-0.704/lh 36 (24/590/-0.288/lh 31.92 at 390).

### a mid entry with media - 0 mismatches found, 0 fixed, derivations: 1

DERIVATION: the stage visual in the media slot. The reference's in-entry media is a bare `<figure>`
at the full column width holding a screenshot at radius 8 - no plate, no bezel, no shadow, no
background. The stage visual is live DOM rather than a raster that carries its own surface. It
keeps the bare figure and its 48px/32px margin-block: it is built from the system's own card +
hairline vocabulary, which already reads on the page ground. A panel was tried first and rejected -
the reference does not frame anything inside an entry, and `#0f1011` cards on a `#101112` panel
collapse to a 1-value difference.

Also removed here: `font-serif` on the endgame flow (the reference has no serif on either surface;
the marketing layer already remapped it to Inter, so this was intent, not a rendered change).

Verified: lead paragraph 17/**590**/lh 27.2 `#f7f8f8` at margin-top 12; prose 17/400/lh 27.2
`#d0d6e0` at margin-top 20 (15/lh 24 at 390); list padding-left 24, `list-style: disc`, items
margin-top 8; figure margin-block 48 at 1440 and 32 at 390 with no background and no border.

### closing entries + the end of the page - 0 mismatches found, 0 fixed, derivations: 1

"What we're not building", "Shipped" and "Roadmaps change" were three bordered sections, one on a
tinted surface. The reference has no closing block at all: its last entry is followed by one
divider at margin `32px 0 16px` and then the footer. So they stay in the entry stream as three more
entries and the divider closes it, exactly there.

DERIVATION: the third block's rail label. "Restraint" and "Evidence" were already the first two
sections' own eyebrows. "Roadmaps change." had none, and inventing one would be new copy, so the
rail runs on unlabelled through it.

Verified: closing divider 1px `#18191a`, radius 9999, margin `32px 0 16px`.

### CTA - 0 mismatches found, 0 fixed, derivations: 1

DERIVATION: there is no CTA on the reference's changelog - the page ends at the footer. Enquiry's
closing ask uses the system's own `.mk-prefooter` (margin-block 224px / 96px) and the shared
`WaitlistForm`, which is what home does, so the two pages close the same way.

Verified: prefooter margin-block 224px at 1440 and 96px at 390; h2 48/510/-1.056/lh 48
(24/510/-0.288/lh 31.92 at 390); waitlist field `#0f1011` with `1px #23252a`, radius 8, 15px.

---

## Contrast sweep

Rendered-pixel, the lead's unmodified `contrast.mjs`, every visible text node on `/roadmap`.

| | nodes | graded | fails | lowest real pair |
|---|---|---|---|---|
| 1440 | 215 | 215 | **0** | 4.88:1 - `p.w-full.text-xs` "." |
| 390 | 211 | 210 | 1 (detector artefact, below) | 5.83:1 - `p.mt-0.5.text-xs` "Starts the enquiry" on `#0f1011` |

**The two pairs system.md section 8 flagged are fixed.** They were the separators in the
"Last updated / phase / access" line, painted with `text-line-strong` - a hairline *border* token
used as a text colour - at 1.19:1 and 1.25:1. They are now `--mk-fg-2` (`#d0d6e0`), not the line's
own `--mk-fg-3`, because a 13px separator glyph loses most of its area to antialiasing and never
reaches its specified colour. Both now measure 6.13:1 in the sweep, alongside the rest of the line.

**The one remaining 390 failure is a detector artefact, not a real pair.** `p.w-full.text-xs` "."
is the trailing period of "We'll only email about Enquiry access. Privacy." in the shared
`WaitlistForm`. Proof, in order:

1. Its parent `<p>` is `text-stone` -> `#8a8f98`. Its own sibling text node on the same line
   ("We'll only email about Enquiry access.") measures **6.13:1** in the same sweep.
2. The reported box is 3x15px. Read back from the render, it holds 44 background pixels and **one**
   non-background pixel. Widening the sample to 8x19 around the same glyph gives `#658a81` on
   `#08090a` = **5.22:1** - the period's real subpixel-antialiased pixels sit just outside the 3px
   Range rect the sweep clips to.
3. The identical node, same component, same x, measures **4.88:1 and passes on `/` at 390** and
   4.88:1 at 1440 here. Only the sub-pixel y placement differs.

The equivalent node inside this route's own files was fixed by making the sentence a single text
node (`Last written <date>.`), which is the right fix for `WaitlistForm` too - filed as a request.
