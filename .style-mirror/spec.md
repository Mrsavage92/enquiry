# REFERENCE DESIGN SPEC: linear.app

Captured 2026-09-09 with headless Chromium (Playwright), viewport 1440x900 and 390x844, 4 s settle.
Surfaces: `https://linear.app` (system) and `https://linear.app/changelog` (roadmap/updates pattern).

Extraction artifacts in this folder: `raw-probe.json` (computed styles, 417 root custom properties,
gradients, fonts, icons), `raw-probe2.json` (component internals both viewports), `raw-probe3.json`
(section rhythm, transitions, changelog rule), `raw-probe4.json` / `raw-probe5.json` (vertical
rhythm, mobile section padding), `css-bundles.json` (19 stylesheets), and the reference screenshots.

---

## LAYOUT

    Hero structure      LEFT-ALIGNED, full-bleed. Not centered, not split-pane.
    Above-fold order    nav / headline / lede row / product visual
    Product visual      below text, full width, wider than the text column
    Hero density        sparse - headline, one lede line, nothing else above the visual
    Page wrapper        max-width 1436px, padding-inline 46px  ->  1344px content
    Section inset       further 32px  ->  1280px text column, left edge x=80 at 1440
    At 390              outer padding 16px + inset 8px  ->  left edge x=24
    Nav                 fixed, 72px tall (64px at 390), 1px bottom border rgba(255,255,255,.08),
                        backdrop-filter blur(20px), gradient background, content left edge x=79
    Section rhythm      padding-block 128px at 1440; 40px top / 48px bottom at 390; 10px between
    Prefooter CTA       margin-block 224px at 1440, 96px at 390, gap 40px
    Footer              padding 56px 46px at 1440; 56px 16px 24px at 390

### Changelog / roadmap pattern

    Grid                12 columns of 77.33px, gap 32px, container 1280px
    Date column         cols 1-3 (296px), padding-left 24px, margin-bottom 16px
    Date bar            1px vertical rule, #23252a, margin 9px 0 0 9px, left x=89,
                        spans the whole date group; a 6px #fc7840 dot caps the newest group
    Content column      cols 5-12 (624px), left x=408
    Divider             1px, #18191a, radius 9999px, margin 32px 0 64px, full 1280px
    At 390              stacks: date above title, single column, no vertical rule

---

## COLORS (computed, confirmed against 417 root custom properties)

    Body background     #08090a          --color-bg-primary
    Panel / card        #0f1011          --color-bg-level-1  + rgba(255,255,255,.03) overlay
    Media plate         #090a0b          8px padding around a #101112 panel
    Nav background      linear-gradient(rgba(11,11,11,.8) 0%, rgba(11,11,11,.762) 100%)
    Nav border          rgba(255,255,255,0.08)
    Border              #23252a          --color-border-primary
    Hairline            #18191a          --color-line-tertiary (page dividers)
    Text primary        #f7f8f8          --color-text-primary
    Text secondary      #d0d6e0          --color-text-secondary (long-form prose, card titles)
    Text tertiary       #8a8f98          --color-text-tertiary (lede, nav links, footer links)
    Text quaternary     #62666d          --color-text-quaternary (legal links, mono label)
    CTA button bg       #e5e5e6          --color-button-invert-bg   (inverted, NOT brand colour)
    CTA button text     #08090a
    CTA secondary bg    rgba(255,255,255,0.05)
    Link in prose       #828fff          --color-link-primary
    Brand indigo        #5e6ad2          --color-brand-bg  (accent, not used for CTAs)
    Marker orange       #fc7840          --color-orange, sampled from rendered pixels

Hero backdrop (behind the product visual, 1416x768 at x=12, radius 6px):

    radial-gradient(52.53% 57.5% at 50% 100%, rgba(8,9,10,0) 0%, rgba(8,9,10,.5) 100%),
    linear-gradient(rgb(8,9,10) 10%, rgb(208,214,224) 100%)

plus a `radial-gradient(50% 50%, rgba(255,255,255,.04) 0%, rgba(255,255,255,0) 90%)` 400x400 glow
and a grain PNG overlay (see Omissions).

---

## TYPOGRAPHY

    Computed family     "Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont,
                        "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans",
                        "Helvetica Neue", sans-serif
    Feature settings    "cv01", "ss03"      Variation settings: "opsz" auto
    Monospace           "Berkeley Mono", ui-monospace, "SF Mono", Menlo, monospace
    Weights in use      400 normal / 510 medium / 590 semibold / 680 bold
    Serif               declared as --font-serif-display but used NOWHERE on either surface

| Role | 1440 | 390 |
|---|---|---|
| h1 home | 64px / 510 / -1.408px / lh 64px | 38px / 510 / -0.836px / lh 41.8px |
| h1 page (changelog) | 48px / 510 / -1.056px / lh 48px | 48px, unchanged |
| h2 section | 48px / 510 / -1.056px / lh 48px | 24px / 510 / -0.288px / lh 31.92px |
| h2 entry featured | 32px / 590 / -0.704px / lh 36px | 24px / 590 |
| h2 entry | 24px / 590 / -0.288px / lh 31.92px | same |
| h3 card title | 20px / 590 / -0.24px / lh 26.6px / #d0d6e0 | - |
| lede | 15px / 400 / -0.165px / lh 24px / #8a8f98 | same |
| long-form prose | 17px / 400 / lh 27.2px / #d0d6e0 | 15px / lh 24px |
| small | 14px / 400 / -0.182px / lh 21px | same |
| mini / nav / footer | 13px / 400 / -0.13px / lh 19.5px | same |
| micro mono label | 12px / 400 / lh 16.8px | same |

Headings carry an optical `margin-left: -2px` at 1440 (-1px at 390) so the glyph edge, not the
box edge, lands on the content line.

---

## COMPONENTS

    Primary CTA         #e5e5e6 bg / #08090a text / 16px 510 / h44 / pad-x 20px / radius 9999px
                        border 1px solid #e5e5e6
                        transition border+background-color+color .16s cubic-bezier(.25,.46,.45,.94)
    Secondary CTA       rgba(255,255,255,.05) bg / #f7f8f8 / same metrics / no border
    Small invert        same as primary at 13px 510 / h32 / pad-x 12px
    Nav link            #8a8f98 / 13px 400 / h32 / pad-x 12px / radius 9999px
                        transition color+background .1s cubic-bezier(.25,.46,.45,.94)
    Wordmark link       h32 / pad-x 8px / margin-left -8px / radius 6px
    Card                #0f1011 + rgba(255,255,255,.03) overlay / 1px rgba(255,255,255,.08)
                        radius 12px / shadow rgba(0,0,0,.2) 0 0 0 1px
    Media frame         #090a0b plate, 8px padding, radius 12px, holding a #101112 panel with
                        1px rgba(255,255,255,.08) and radius 12px. Inner surface radius 8px with
                        1px rgba(255,255,255,.05) and shadow rgba(0,0,0,.2) 0 0 0 2px.
                        Plate is 1320px wide at x=60 - wider than the 1280px text column.
    Changelog media     plain img, radius 8px, 624px wide, no frame
    Footer              #08090a, border-top 1px #23252a, column heading 13px 510 #f7f8f8 mb 24px,
                        links 13px 400 #8a8f98, legal links #62666d

---

## MOTION

No GSAP, no Lenis, no Framer Motion, no Rive. `scroll-behavior: auto`. View Transitions API is
available but no scroll-triggered entrance animation runs on either surface. The only motion is
colour and background hover transitions:

    links / nav       .1s  cubic-bezier(0.25, 0.46, 0.45, 0.94)
    buttons           .16s cubic-bezier(0.25, 0.46, 0.45, 0.94)

---

## ICONS

Custom fill-based SVG on a `0 0 16 16` viewBox, rendered at 13-16px, `fill` painted, `stroke: none`.
Stroke icon sets (Lucide, Heroicons outline) are a mismatch.

---

## DERIVATIONS AND OMISSIONS

1. **Font family name.** Reference computes to `"Inter Variable"` (Linear's self-hosted Inter v4
   variable). Google Fonts serves the identical typeface as family `"Inter"` with the wght 100-900
   and opsz 14-32 axes, so 400/510/590 are all reachable. Family name substituted; the fallback
   stack is kept verbatim. Same typeface, different family string.
2. **Monospace.** `"Berkeley Mono"` is commercially licensed. The reference's own declared fallback
   `ui-monospace, "SF Mono", Menlo, monospace` is used with the paid face removed.
3. **Grain texture (OMITTED, not approximated).** The reference overlays
   `grain-default.png` on the hero backdrop block. That is a raster asset owned by the reference.
   It is omitted rather than reproduced with SVG turbulence, which would be an approximation.
4. **Section label / eyebrow.** The reference has no uppercase tracked eyebrow. Its nearest
   equivalent is a 12px sentence-case monospace label at `--color-text-quaternary` (#62666d).
   #62666d on #08090a measures below 4.5:1, so Enquiry's eyebrow uses the same 12px mono metrics
   at `--color-text-tertiary` (#8a8f98). Metrics from the reference, colour stepped up one token
   for the contrast gate.

## FORBIDDEN ADDITIONS (computed from what the reference does NOT do)

gradient_mesh, border_glow, glassmorphism_on_cards, grid_lines, gradient_text, lucide_icons,
stroke_icons, framer_motion_entrances, scroll_triggered_reveals, hover_scale_transforms,
serif_headings, ruled_paper_background, uppercase_letterspaced_eyebrows, custom_cursor,
rounded_corners_larger_than_12px_on_cards, centered_hero, shadcn_default_button_radius,
logo_cloud_stats_testimonials_pricing_faq_boilerplate_sections, coloured_cta_buttons.
