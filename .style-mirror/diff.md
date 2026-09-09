# Diff: linear.app reference vs Enquiry marketing (current)

Reference values from `tokens.lock.json` / `spec.md` (extracted 2026-09-09).
Current values measured from the running dev server at 1440x900 and 390x844,
captured in `.style-mirror/shots/before-probe.json`. Nothing below is asserted from reading source.

SKIP is used only for brand content. Layout and typography are HIGH throughout.

## Layout

| Dimension | Reference | Current | Change | Impact |
|---|---|---|---|---|
| Hero structure | left-aligned, full-bleed page wrapper | left-aligned inside a 1024px centred container | widen to the reference wrapper | **HIGH** |
| Above-fold order | nav / headline / lede row / product visual | nav / eyebrow + green rule / headline / lede / waitlist form / "Built for service businesses" | reorder: product visual moves above the fold, directly under the lede | **HIGH** |
| Product visual placement | directly below the headline, full width, **wider than the text column** (1320px plate at x=60 vs 1280px text at x=80) | three separate later sections - phone plate, LivePhone demo, BrowserFrame - none above the fold | promote the interactive demo to the hero position in a reference media frame | **HIGH** |
| Content column at 1440 | 1280px, left edge x=80 | 1024px, left edge x=228 | rebuild the container to 1436/46/32 | **HIGH** |
| Content left edge at 390 | x=24 (16px outer + 8px inset) | x=20 | retune to the reference values | **HIGH** |
| Page wrapper max-width | 1436px | 1024px (`max-w-5xl`) | replace | **HIGH** |
| Section padding-block 1440 | 128px | 80px (hero) / 48-80px (`py-12 sm:py-20`) | replace | **HIGH** |
| Section padding-block 390 | 40px top / 48px bottom | 40px / 48px equivalent via `py-12` = 48px | retune to 40/48 exactly | MED |
| Prefooter CTA rhythm | margin-block 224px (1440) / 96px (390) | none - same `py-12 sm:py-20` as every other section | add the prefooter rhythm | MED |
| Density | sparse | dense | thin the above-fold; keep every section below | MED |
| Section separators | none; rhythm carried by 128px padding | `border-t border-line` on nearly every section | remove borders, carry rhythm with padding | **HIGH** |
| Ruled-paper background | absent | `PaperField` fixed overlay + `.site-field-rules` 48px repeating-linear-gradient + `.notebook` 32px rules | remove from marketing | **HIGH** |

## Colour

| Role | Reference | Current | Change | Impact |
|---|---|---|---|---|
| Body background | `#08090a` | `#f3eee6` | replace | **HIGH** |
| Raised / card surface | `#0f1011` | `#faf7f1` | replace | **HIGH** |
| Nav background | `linear-gradient(rgba(11,11,11,.8), rgba(11,11,11,.762))` + `blur(20px)` | `oklab(.95 .002 .012 / .95)` + `blur(8px)` | replace | **HIGH** |
| Nav border | `rgba(255,255,255,0.08)` | `#e6ddd2` | replace | **HIGH** |
| Border / line | `#23252a` | `#e6ddd2` | replace | **HIGH** |
| Hairline divider | `#18191a` | `#e6ddd2` | replace | **HIGH** |
| Text primary | `#f7f8f8` | `#1a1814` | replace | **HIGH** |
| Text secondary | `#d0d6e0` | `#4f4a42` | replace | **HIGH** |
| Text tertiary | `#8a8f98` | `#716b61` | replace | **HIGH** |
| Primary CTA fill | `#e5e5e6` (inverted near-white) | `oklab(.3138 -.0316 .0109)` = `--color-mark-strong`, dark green | replace - reference CTAs are never brand-coloured | **HIGH** |
| Primary CTA text | `#08090a` | `#f6f2eb` | replace | **HIGH** |
| Secondary CTA | `rgba(255,255,255,0.05)` fill, no border | `#faf7f1` fill + 1px `#4f4a42` border | replace | **HIGH** |
| Accent | `#5e6ad2` indigo (accent only, not CTAs) | `#2f4a3c` green (used for CTAs, eyebrow dots, rules) | remap accent; strip decorative uses | **HIGH** |
| Marker / status | `#fc7840` orange (changelog date marker) | `--color-mark` green dot | replace for the changelog pattern | MED |
| Input surface | derived - no marketing input in the reference | `#faf7f1` fill, `#8e867a` border | derive from reference tokens (see Derivations) | **HIGH** |
| Focus ring | `#5e69d1` | `--color-mark` outline | replace | MED |

## Typography

| Dimension | Reference | Current | Change | Impact |
|---|---|---|---|---|
| Heading family | Inter (sans) | IBM Plex **Serif** | replace - reference has no serif on either surface | **HIGH** |
| Body family | Inter | IBM Plex Sans | replace | **HIGH** |
| Mono family | `ui-monospace, "SF Mono", Menlo, monospace` (Berkeley Mono removed) | IBM Plex Mono | replace | MED |
| Heading weights | 510 (display) / 590 (entry, card) | 600 | replace | **HIGH** |
| h1 size / tracking / leading | 64px / -1.408px / 64px (1.00) | 89.6px / -3.0464px / 94.976px (1.06) | replace | **HIGH** |
| h1 at 390 | 38px / -0.836px / 41.8px | (clamp 2.5rem = 40px) | replace | **HIGH** |
| h2 section | 48px / 510 / -1.056px / lh 48px | 44px and 33.6px / 600 serif / -1.408px, -1.008px | replace, one scale | **HIGH** |
| h3 card title | 20px / 590 / -0.24px / lh 26.6px / `#d0d6e0` | 20px / 600 serif / -0.5px / lh 28px / `#1a1814` | replace | **HIGH** |
| Lede | 15px / 400 / -0.165px / lh 24px / `#8a8f98` | 17px / 400 / normal / lh 28.05px / `#4f4a42` | replace | **HIGH** |
| Long-form prose | 17px / lh 27.2px / `#d0d6e0` | 14px / lh 21px / `#4f4a42` | replace | **HIGH** |
| Nav link | 13px / 400 / `#8a8f98` | 14px / 400-500 / `#4f4a42`, `#1a1814` | replace | **HIGH** |
| Footer link | 13px / 400 / `#8a8f98` | 14px / 400 / `#4f4a42` | replace | **HIGH** |
| Eyebrow / label | none in reference; nearest is a 12px **sentence-case monospace** label | 11px **uppercase**, 0.88px tracking, 600, with a 4px green dot `::before` | replace with the derived mono label, drop the dot | **HIGH** |
| Optical heading offset | `margin-left: -2px` (1440) / `-1px` (390) | none | add | LOW |
| Font features | `"cv01","ss03"`, `"opsz" auto` | none | add | LOW |

## Components

| Dimension | Reference | Current | Change | Impact |
|---|---|---|---|---|
| Nav position / height | fixed, 72px (64px at 390) | sticky, 69px | replace | **HIGH** |
| Nav link shape | h32, pad-x 12px, radius 9999px | h44, pad 8px 12px, radius 6px | replace | **HIGH** |
| Primary button | h44, pad-x 20px, 16px/510, radius 9999px | h48, pad-x 24px, 14px/500, radius 6px | replace | **HIGH** |
| Small button | h32, pad-x 12px, 13px/510, radius 9999px | h44, pad-x 12px, 14px/500, radius 6px | replace | **HIGH** |
| Button transition | `.16s cubic-bezier(.25,.46,.45,.94)` on border/bg/colour | `.15s ease-out` on bg/colour/shadow/opacity/**scale**, plus `active:scale-[0.96]` | replace; drop the scale | MED |
| Card | `#0f1011` + `rgba(255,255,255,.03)` overlay, 1px `rgba(255,255,255,.08)`, radius 12px | bordered list rows, no card surface | add the card vocabulary | **HIGH** |
| Media frame | `#090a0b` plate, 8px pad, radius 12px, holding `#101112` panel with 1px `rgba(255,255,255,.08)` radius 12px | `PhoneFrame` radius 41.6px + 2 rings + 80px shadow; `BrowserFrame` radius 8px with fake traffic-light dots | replace both with the reference frame | **HIGH** |
| Footer structure | column headings 13px/510 + link columns, padding 56px 46px | one wordmark block + a flat wrap of links, py-40px | rebuild to columns | **HIGH** |
| Changelog entry | 12-col grid, date col 1-3 with a 1px `#23252a` vertical rule and a 6px `#fc7840` cap, content col 5-12 at 624px | `.roadmap-*` spine, dots, `.notebook` ruled surface | replace (roadmap route is another agent's; vocabulary provided) | **HIGH** |
| Divider | 1px `#18191a`, radius 9999px, margin 32px 0 64px | `border-t border-line` `#e6ddd2` | replace | MED |

## Icons and motion

| Dimension | Reference | Current | Change | Impact |
|---|---|---|---|---|
| Icon family | custom **fill** SVG, `0 0 16 16` viewBox, `stroke: none` | 4 SVGs render on `/`: 2 fill-based at `0 0 16 16` with `stroke: none` (already a match) and 2 Lucide stroke icons at `0 0 24 24`, `stroke-width: 2` (`chevron-left`, `ellipsis-vertical`) | the 2 Lucide icons come from `src/components/enquiry/phone-desk` rendered inside the interactive demo - **out of scope** (signed-in app). The marketing chrome itself ships no icon set; stroke sets stay banned for the four remaining routes | SKIP (out of scope) |
| Scroll-triggered reveals | none - no GSAP / Lenis / Framer Motion / IntersectionObserver reveal | `.reveal` opacity 0 + translateY(16px) on nearly every block; `.hero-in` fade-in-up 0.7s | remove from marketing | **HIGH** |
| Hover scale | none | `active:scale-[0.96]` on every button | remove | MED |
| Easing | `cubic-bezier(0.25, 0.46, 0.45, 0.94)`, 0.1s / 0.16s | `cubic-bezier(0.22,1,0.36,1)` / `(0.23,1,0.32,1)`, 150-700ms | replace | MED |
| Smooth scroll | `auto` | `auto` | none | SKIP |
| Grain texture | present on the hero backdrop (raster PNG owned by the reference) | absent | **OMITTED** - see Derivations | LOW |

## SKIP - brand content, preserved verbatim

| Item | Note |
|---|---|
| Wordmark | `Wordmark` component unchanged |
| Product name | "Enquiry" everywhere |
| All body and heading copy | every string preserved verbatim, including the curly apostrophes |
| CTA wording | "Join early access", "Request early access", "See demo", "Full roadmap" |
| Nav and footer link labels and destinations | unchanged |
| Waitlist form fields, submit path, tracking calls | unchanged |
| Interactive demo behaviour | `LivePhone` / `CrossChannelDecisionDemo` logic unchanged, frame restyled |
| Demo interior palette | The demo renders real signed-in app components (`components/enquiry/*`). The app's light palette is re-asserted inside the media frame so the demo keeps showing the real product; only the frame around it is mirrored. The reference's own product visual is its dark app, so this is a deliberate, recorded departure rather than a miss. |

## Derivations (reference has no equivalent; derived from reference tokens)

1. **Marketing input.** Neither reference surface has a marketing form field. Derived from the
   reference's own surface tokens: `#0f1011` fill (`--color-bg-level-1`), 1px `#23252a`
   (`--color-border-primary`), radius 8px (`--radius-8`), 15px text at `#f7f8f8`, placeholder
   `#8a8f98`, focus ring `#5e69d1` (`--focus-ring-color`).
2. **Eyebrow / section label.** No uppercase tracked label exists in the reference. Metrics taken
   from its nearest equivalent - the 12px sentence-case monospace label - and the colour stepped
   from `#62666d` to `#8a8f98` because `#62666d` on `#08090a` does not reach 4.5:1 at 12px.
3. **Font family name.** `"Inter Variable"` -> `"Inter"` (Google Fonts serves the identical
   variable typeface under that family name). Fallback stack kept verbatim.
4. **Monospace.** Berkeley Mono is commercial; the reference's own declared fallback is used.
5. **Grain texture: OMITTED, not approximated.** A raster asset owned by the reference.
