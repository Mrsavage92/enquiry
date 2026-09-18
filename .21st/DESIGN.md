<!-- Generated from .21st/design.json. Edit that file, then regenerate this one. `21st init --refresh` re-detects from source and DROPS hand-recorded decisions, so do not use it here. -->
# Project Design Context

## Project

- Name: enquiry-marketing-site
- Product type: b2b-saas-prelaunch
- Stack: react, tailwind-v4, vite, tanstack-start
- Color mode: light
- Density: comfortable

## Sources

- Tokens: src/styles.css#@theme, src/public-site.css, src/site-story.css
- Components: src/components/ui, src/components/site
- Assets: public/brand, public/product
- Instructions: AGENTS.md, docs/CURRENT_PHASE.md, docs/PUBLIC_CLAIM_TRUTH_MATRIX.md

## Components

- Installed: badge, button, dialog, segmented, sheet, wordmark, scroll-fade, empty-state, waitlist-form, enquiry-story, product-walkthrough
- Preferred primitives: radix-ui, lucide-react, native-details
- Patterns:
  - section = kicker + h2 + lede
  - icon chip 46px radius 8 in violet/rose/green tints
  - native <details> accordion
  - hairline drawn-grid grammar: cells bordered with extended hairlines and corner crosshair marks (adopted 2026-09-18)

## Tokens

### Colours

- `paper`: `#fafafc`
- `paper-2`: `#f0eef4`
- `raised`: `#ffffff`
- `reply`: `#f3efff`
- `ink`: `#1c1b1f`
- `ink-2`: `#4f4b55`
- `stone`: `#68656d`
- `line`: `#eceaf0`
- `line-strong`: `#cbc5d3`
- `mark`: `#6848d6`
- `mark-hover`: `#583ac0`
- `public-violet`: `#654ac2`
- `kicker`: `#69519d`
- `workflow-band`: `#f8f8fa`
- `invite-band`: `#f1edf7`
- `icon-violet-bg`: `#f0eafa`
- `icon-rose-bg`: `#faedf1`
- `icon-rose-fg`: `#9b5069`
- `icon-green-bg`: `#eaf4ef`
- `icon-green-fg`: `#347859`

### Typography

- sans: Inter Variable, Inter, system-ui
- h2: 38px / 600 / 1.22
- h3: 20px / 600 / 1.45
- body: 16px / 1.75
- lede: 18px / 1.7
- kicker: 15px / 550

### Spacing, radius, shadows, motion

- section: 88px block
- grid-gap: 40-48px
- icon: 8px
- button: 6px
- card: 8px
- border: 0 0 0 1px #1c1b1f12, 0 1px 2px #1c1b1f0a
- border-hover: 0 0 0 1px #1c1b1f1f, 0 4px 12px #1c1b1f0d
- quick: 150ms
- fast: 250ms
- ease: cubic-bezier(0.22,1,0.36,1)
- reducedMotion: respected

## Constraints

### Must

- keep src/components/site/brand-hero.tsx untouched
- every text element >= 4.5:1 (3:1 large) against its rendered background
- keep secondary text at #68656d or darker; it already sits at 4.95:1 on lavender
- respect prefers-reduced-motion
- no new runtime dependency without a stated reason
- copy stays truthful: no fabricated logos, testimonials, counts or integrations
- do not add new instances of the product name in copy; the name is under review

### Avoid

- dark mode variants
- gradient text
- glassmorphism
- dark glows
- uniform equal-width padded card grids
- hero-metric layouts
- pointer-follow spotlights and other decorative motion
- navy + gold
- Geist

## Decisions

- **2026-09-14** - UI1 identity: white working surfaces, soft lilac shell, violet accent, sculptural ribbon hero. Owned by Codex.
  Source: docs/CURRENT_PHASE.md
- **2026-09-18** - Home body de-templated with a drawn hairline-grid grammar rather than padded cards. Benefits: 21st hirael feature-08 (id 26797) cell geometry, crosshair corner marks, spotlight dropped. Workflow: story progress track becomes a left vertical dashed rail from 21st ln-dev7 how-it-works-02 (id 26902), scoped to the compact story only. FAQ: 21st hirael faq-05 (id 26656) bordered two-column frame plus the contact card idea from ln-dev7 faqs-02 (id 26910), accordion stays native <details>. CTA band: reuse the project's own WaitlistForm compact inline; 21st results only validated the direction.
  Source: independent /critique 2026-09-17 (Nielsen 29/40: body template-shaped, center-aligned)
- **2026-09-18** - Site-wide 21st pass beyond the home body. /how: sticky scroll walkthrough of the three real captures, structure from 21st hyperiux sticky-content-wrapper (id 26064) rebuilt on position: sticky + IntersectionObserver because its GSAP ScrollTrigger would be a new runtime dependency; below 860px each step carries its capture inline. /updates: changelog timeline from 21st shadcnblocks changelog-1 (id 2203), sticky kind-pill + date column, capture under the copy at reading width. /early-access: founding offer as one bordered card from 21st ln-dev7 single-plan pricing card (id 26907), no trust badges and no strike-through price because the standard price is unconfirmed. Home captures and the walkthrough stage sit in the project's own BrowserFrame (device-frame.tsx) with a new light tone; 21st designali browser (id 5942) was retrieved and rejected as a duplicate. Footer deliberately untouched.
  Source: user: the home-only pass was not enough (2026-09-18)

## Evidence

- tokens (src/styles.css @theme block)
- section rhythm and section colours (src/public-site.css lines 258-430)
- @radix-ui/react-accordion already a dependency; native details kept anyway (package.json)
- 21st tier paid, aiGenerationEnabled false (mcp__21st__get_usage 2026-09-18)
