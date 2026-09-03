# BridgeMind-Inspired UI Direction

Created: 2026-09-03
Base commit: 5c1d03b
Reference: https://www.bridgemind.ai/ (live-inspected, not the earlier Cloudflare-blocked pass recorded in `research/32-bridgemind-visual-reference-audit.md` - that audit's own "Verification Still Required" section is what this document closes out)

This document separates what was actually observed on the reference from what Enquiry will do about it. Per the style-mirror skill's Cardinal Rules, values below marked "extracted" came from live `getComputedStyle`/DOM inspection at 1440x900, not estimation.

---

## 1. Observed reference qualities (BridgeMind, extracted)

**Colour (hero, extracted):**
- Body: `background: rgb(13,14,17)`, `color: rgb(255,255,255)`
- H1: transparent fill (`color: rgba(0,0,0,0)`) painted by `linear-gradient(to right bottom, rgb(255,255,255) 28%, rgb(207,220,255) 68%, rgb(255,243,223) 100%)` clipped to text - a gradient-clip headline
- Subline: `rgb(149,151,158)` at 18px/400
- Primary CTA: `background: rgb(255,255,255)`, `color: rgb(5,5,6)`, `border-radius: 9999px` (full pill), `font-weight: 700`, `font-size: 12px`, `letter-spacing: 0.72px`, `text-transform: uppercase`, transition on `transform, translate, scale, rotate` at 0.2s
- Secondary CTA: transparent bg, white text, `border: 1px solid oklab(0.4137 0.001 -0.008 / 0.7)`, same pill/type treatment
- A 641x641px **conic-gradient rotating rainbow blur** (orange -> cream -> blue) sits behind the primary CTA, decorative and animated
- Feature cards (extracted): `background: oklab(0.1998 ... / 0.4)`, `border: 1px solid oklab(0.297 ... / 0.7)`, `border-radius: 12px`, `padding: 24px`
- Section H2 (extracted): 56px/600, `letter-spacing: -2.52px`, `line-height: 53.2px`

**Typography (extracted):** Body font Inter; display font Sora, weight 600, H1 at 84px with `letter-spacing: -2.94px` and `line-height: 84px` (line-height essentially equals font-size - very tight, very confident).

**Structural qualities (from screenshots + DOM):**
- One product concept per section, in sequence, not a dense multi-pane dump on load
- A real product surface (not abstract art) appears early, inside macOS-style window chrome with a glowing 1px border rim
- Eyebrow labels are small, tracked-out, muted, paired with a coloured dot
- Every primary/secondary action pair uses the same pill shape and type treatment - one consistent "this is clickable" language across the whole page

This matches and extends `research/32-bridgemind-visual-reference-audit.md`'s qualitative read (confidence, visible system state, progressive disclosure, meaningful motion) with real measurements.

---

## 2. Enquiry-specific design decisions

Enquiry does not become a dark, gradient-lit AI-tool clone of BridgeMind. It borrows **confidence and energy as qualities**, not BridgeMind's palette, font family, or hero treatment. Rationale below; each decision is defensible against the reference on its own terms.

1. **Keep the warm paper system as the base surface; do not flip to near-black.** Enquiry's brand is already built around a paper/notebook/ledger metaphor (`--color-paper`, grain texture, ruled lines, `.ledger`, `.roadmap-rail`) that is load-bearing product identity, not a stylistic accident. `research/01-product-thesis-and-boundaries.md`'s positioning and this task's own boundary ("preserve Enquiry's product identity and operational clarity") both argue against discarding it. BridgeMind's near-black body colour is BridgeMind's identity marker the same way paper is Enquiry's - copying it would be the exact mistake Cardinal Rule 6 (brand content stays) exists to prevent, just applied to background colour instead of logo/copy.
2. **The existing dark sidebar (`--color-sidebar #141210`) becomes the deliberate high-contrast anchor**, used more assertively (icon colour, active-state treatment, subtle depth) rather than introduced as new surface. Enquiry already has a dark surface; it is currently under-used, not absent.
3. **Promote the existing serif display system (`.site-hero`, `.site-display`, IBM Plex Serif 600) onto auth/onboarding H1s.** Today those screens render `text-3xl font-semibold` (30px, sans) - a confidence cliff versus the 84-90px landing hero one click away. This closes the single largest "raw form" gap Phase 1 names, using tokens that already exist and are already Enquiry's own voice. BridgeMind's Sora/Inter pairing is explicitly not adopted; Enquiry's serif/sans pairing already does the "display vs body" job BridgeMind's font pairing does.
4. **Deepen and deploy the single existing accent (`--color-mark`, forest green) more confidently**, rather than adding a second/rainbow accent. BridgeMind uses exactly one accent colour philosophy - a single colour means "action/focus/progress" everywhere - Enquiry already has that in `--color-mark`; the gap is that it currently appears only on primary buttons and the progress dots. Phase 2/3 extend it to focus states, active nav, and state-change motion so it reads as *the* signal colour, not just a button colour.
5. **Borrow "make the real work surface visible early," reinterpreted as Enquiry's own signature moment.** `research/32-bridgemind-visual-reference-audit.md` already named this: "Let one enquiry carry the visual story: Received -> Interpreted -> Needs your decision -> Approved." Phase 4's empty-queue and Phase 1's onboarding-to-first-enquiry moment are where this lives - not a copy of BridgeMind's product-screenshot-in-window-chrome, which has no Enquiry equivalent to show honestly before a real enquiry exists (see Section 4).
6. **Button geometry stays `rounded-md`, not BridgeMind's full pill.** Enquiry's button system already has real motion discipline worth keeping: `active:scale-[0.96]` press feedback, 150ms transitions across background/color/shadow/opacity/scale/border. The confidence gap is not shape, it is that these buttons currently sit on top of a typographically quiet page. Fix the type and empty-state energy around them before touching a control that already works.
7. **One bounded high-contrast section on the landing page, using the existing dark token.** An independent plan critique (Section 11) correctly caught that "landing hero: unchanged" both contradicts Phase 1's explicit instruction to revitalise "landing/start" and, combined with every other decision being reuse-in-place, risks under-delivering on "high contrast... alive." Fix: one section of the landing page (the highest-value candidate is the proof/testimonial section directly below the hero, currently plain paper-on-paper per `01-landing-1440.png`) gets a full-bleed `--color-sidebar` background - Enquiry's own existing near-black token, not a new hue, not BridgeMind's body colour copied wholesale. This gives the page one genuine high-contrast beat, mirrors BridgeMind's structural quality of "a confident dark surface exists on the page" without flipping the whole product dark, and is bounded to a single section so it reads as deliberate rather than a wholesale identity change.
8. **`--color-mark-strong` resolves the "deepen the accent" claim.** The first draft of this document said "deepen and deploy the accent" in Section 2 but then specified "unchanged hue" in the token table - a real contradiction the independent critique caught. Fix: add `--color-mark-strong`, computed via `color-mix(in oklab, var(--color-mark) 82%, black)` - a genuinely darker/more saturated value derived from the same hue (no new colour identity introduced), reserved for a small number of high-confidence moments: the landing hero CTA, the onboarding "Create my workspace" submit, and the new dark-section CTA from decision 7. Every other button keeps `--color-mark` as today.

---

9. **Layout/density (added after independent critique flagged this as missing).** style-mirror's Cardinal Rule 2 - "layout is not optional" - was not given an Enquiry-side answer in the first draft. BridgeMind's structural quality is "one concept per section, sparse density, progressive reveal down the page." Enquiry's landing page already does this (screenshot evidence: eyebrow -> headline -> subline -> single CTA -> proof, one idea per scroll segment - see `01-landing-1440.png`). No layout restructure is needed there; the gap is entirely inside the app shell, where Business Brain and Trust (Section 4 baseline evidence) present many small facts at flat, equal visual weight in one dense pass. Phase 4 applies the same "one concept, progressive reveal" principle there: group related facts under clearer visual hierarchy rather than a flat list, without adding new navigation or hiding information the operator needs.
10. **Eyebrow/dot label pattern.** BridgeMind pairs small tracked-out eyebrow labels with a coloured dot. Enquiry already has an eyebrow pattern (`.eyebrow` class: uppercase, tracked, `--color-stone`, confirmed in `styles.css` and visible in every baseline screenshot - "THE APP", "BUSINESS BRAIN", "TRUST CENTRE"). Adopt the coloured-dot pairing as a small, cheap addition (a 4-6px `--color-mark` dot before the eyebrow text) - it reinforces the single-accent system (decision 4) at negligible risk and directly closes a gap the independent critique found had no decision either way.

## 3. Hypotheses (to validate through the build and Phase 5 QA, not assumed true)

- Promoting serif-display H1s onto auth/onboarding will read as "confident" rather than "mismatched with a plain form below it" - Phase 5 real-browser check required, not just a screenshot diff.
- Extending `--color-mark` into focus rings and active-nav states will not collide with the existing `:focus-visible` outline treatment (`outline: 2px solid var(--color-mark)`) - needs a real keyboard-navigation pass.
- A single, restrained state-change animation on the empty-queue ("received -> waiting" micro-motion) will read as "alive" without reading as fake activity in a workspace that is honestly empty - this is a real tension (Section 5 of R2_FOUNDATION_REVIEW: "do not fabricate activity") and must be resolved by animating structure/waiting-state, never by animating fabricated content.

---

## 4. Decisions not to make (explicit rejections, with evidence)

| BridgeMind pattern (extracted) | Verdict | Why |
|---|---|---|
| Gradient-clip headline text (`background-clip: text`) | **Reject** | Explicitly forbidden by style-mirror's Cardinal Rules and this task's own Phase 2 ban list ("no gradient-clip text" is not named verbatim but "novelty effects" and the forbidden-additions registry both cover it). Confirmed present via `color: rgba(0,0,0,0)` + gradient background on the H1 - not a guess. |
| 641px conic-gradient rotating rainbow blur behind CTA | **Reject** | Direct, hard-evidenced match to Phase 2's explicit ban: "no decorative gradient blobs, fake AI orbs, noisy backgrounds or novelty effects." |
| Near-black body background / full dark-mode flip | **Reject** | Would erase the paper/notebook product identity this task requires preserving (Section 2.1). |
| Sora + Inter font pairing | **Reject** | Enquiry's IBM Plex Serif/Sans pairing already performs the same display/body role and is established brand voice; swapping fonts is not required to gain confidence, only to gain BridgeMind's specific look, which is not the goal. |
| Full-pill (`rounded-full`) buttons everywhere | **Reject** | Enquiry's `rounded-md` + scale-press system is already a working, purposeful motion language; changing shape adds nothing Phase 2/3 need and would touch every button in the app for no evidenced gain. |
| Product screenshot in glowing macOS-chrome window on the hero | **Reject** | Enquiry has no "always-true" product screenshot to show honestly pre-signup without either faking data (banned) or showing another tenant's real data (banned). The signature-moment principle is kept (Section 2.5); the literal execution is not. |
| Multi-mode/agent-roster shell language | **Reject** | Already rejected in `research/32-bridgemind-visual-reference-audit.md`; reconfirmed here. Enquiry is not a multi-mode product. |

---

## 5. Colour tokens

No hue changes. Contrast and confidence increase through deployment, not new colours, plus one narrow, justified addition:

| Token | Current | Direction |
|---|---|---|
| `--color-ink` / `--color-paper` | `#1a1814` / `#f3eee6` | Unchanged - already high-contrast (verify exact ratio in Phase 2 against new type sizes). |
| `--color-mark` | `#2f4a3c` | Unchanged hue. Extend usage: focus rings on interactive cards, active nav-item background in the sidebar, state-change motion accent. |
| `--color-sidebar` | `#141210` | Unchanged. Use more deliberately as the "confident dark anchor" - icon/active-state contrast increases here, not a new dark surface elsewhere. |
| `--color-warn` / `--color-danger` / `--color-ok` | existing | Unchanged. Already AA-passing per the styles.css comment history (stone was already corrected once for this reason - do not regress it). |
| New: `--shadow-mark-focus` | none | A soft single-hue (mark-tinted) focus-ring shadow, e.g. `0 0 0 3px color-mix(in oklab, var(--color-mark) 24%, transparent)`. **Scope, corrected after independent critique**: `:focus-visible` states only - never a decorative/ambient effect, never applied to the "signature moment" or any element that isn't actually focused. The original draft scoped this into decorative territory ("purposeful glow at the focal CTA"), which is the same emotional beat as BridgeMind's rejected conic-blur under an accessibility label. Must be checked against WCAG 2.2 SC 2.4.11 (Focus Appearance) for minimum contrast/perimeter, not just text-contrast ratios. |
| New: `--color-mark-strong` | none | `color-mix(in oklab, var(--color-mark) 82%, black)` - a genuinely darker/more saturated value derived from the same hue, not a new colour. Reserved for a small set of high-confidence moments named in Section 2, decision 8. This is the actual "deepen the accent" move; `--color-mark` itself is unchanged everywhere else. |

Every colour/contrast change ships with a measured before/after ratio against its real rendered background before being reported done, per the standing contrast-gate rule - no exceptions for this task. **Added after independent critique**: `--color-mark` on `--color-sidebar` is a new pairing (active-nav fill) even though neither hex changes - background-on-background computes to roughly 1.9:1, a tight pairing before any foreground text/icon sits on top. This pairing, plus mark-on-mark-strong and any foreground colour placed on the new dark landing section (decision 7), are explicitly in the Phase 2 measurement list - "hex unchanged" does not mean "no re-check needed" when the context is new.

---

## 6. Typography

| Context | Current | Direction |
|---|---|---|
| Landing hero | `.site-hero`: IBM Plex Serif 600, `clamp(2.5rem, 7.2vw, 5.6rem)`, `letter-spacing: -0.034em` | Unchanged - already confident and already close in scale to BridgeMind's 84px hero. |
| Auth/onboarding H1 | `text-3xl font-semibold tracking-tight` (30px, sans) | **Change**: adopt `.site-display` (IBM Plex Serif 600, `clamp(1.7rem, 3.2vw, 2.55rem)`, `letter-spacing: -0.03em`) or a purpose-built onboarding-scale variant between `.site-display` and `.site-hero` if `.site-display` reads too small once tested live. Exact size decided against a real screenshot in Phase 1, not guessed here. **Fallback (added after independent critique)**: this is a named hypothesis (Section 3), not a certainty - if the Phase 5 screenshot shows a bigger serif word sitting awkwardly on an otherwise-untouched form, the fallback is not reverting to 30px sans, it is bringing the field/label treatment below it up to match (spacing, label weight) rather than shrinking the heading back down. Do not ship a heading change in isolation from the form it sits above. |
| Body copy on auth/onboarding | `text-sm text-ink-2` | Unchanged size; only the heading above it changes weight class. |
| Section headers inside the app (Business, Trust, Enquiries) | plain `text-3xl`/`text-2xl` utility classes, sans | Evaluate in Phase 4 whether a smaller serif treatment (not full `.site-display` scale - this is dense operational UI, not a landing moment) adds confidence without hurting scannability. Bias toward "no change" here per Phase 4's own instruction to keep the operator experience practical, not decorative. |

BridgeMind's Sora/Inter is not imported. No new font files.

---

## 7. Radii, borders, shadows

Unchanged tokens (`--radius-md`/`--radius-lg` via Tailwind defaults, `--shadow-border`, `--shadow-border-hover`, `--shadow-float`, `--shadow-plate`). These already form a restrained, purposeful elevation system (confirmed via `button.tsx`: `rounded-md`, `shadow-border`/`shadow-border-hover` on the secondary variant). The one addition is `--shadow-mark-focus` (Section 5), scoped to focus/progress states only, not general card styling.

---

## 8. Motion timings and easing

Existing tokens are sound and are kept as the system: `--ease-smooth-out: cubic-bezier(0.22,1,0.36,1)`, `--ease-out: cubic-bezier(0.23,1,0.32,1)`, `--motion-quick: 150ms`, `--motion-fast: 250ms`, plus the already-defined `rise-in`, `dialog-in/out`, `sheet-in/out`, `menu-in`, `pulse-quiet` keyframes and the button system's `active:scale-[0.96]` press feedback.

Phase 3 additions (all within the existing 150-300ms micro / <=400ms complex bounds from the brief, all transform/opacity, all `prefers-reduced-motion`-safe by extending the existing reduced-motion media block rather than replacing it):

- Auth state changes (loading -> success/error): reuse `rise-in` for the error banner (already present on `onboarding.tsx`'s error state; extend the same treatment to `login.tsx`/`signup.tsx`/`auth.complete.tsx`, which currently pop error text in with no transition).
- Onboarding stage transition: already animated (`key={stage}` + `rise-in` at 280ms, confirmed in current `onboarding.tsx`). Keep as-is; it already satisfies "directional stage transitions."
- Timezone progressive disclosure: currently an instant swap (`editingTimezone` boolean toggles two whole blocks with no transition). Add a `rise-in`-class fade for the reveal only - not a layout-shifting height animation.
- Empty-queue arrival state: **corrected after independent critique.** The original draft proposed an ambient `pulse-quiet` on the inbox icon to signal "waiting." Rejected: a rhythmic pulse communicates "the system is watching/expecting something" - a form of implied activity not bound to any real backend state, which is exactly what the "no fabricated activity" product rule (R2B doc, Section 8) exists to prevent. Replacement: motion here is a single, non-repeating entrance (`rise-in`, already defined) triggered once by the real event of the panel mounting - never a looping/idle animation. Confidence in this state comes from typography and copy weight (Section 6), not from motion implying the workspace is doing something.
- Enquiry selection / decision surfaces: reuse `.arrive-row`/`.arrive-strip` patterns already defined and already used for demo arrivals; apply the same rise-in language to real selection-state changes for visual consistency between demo and live.

No GSAP, no Framer Motion additions, no scroll-triggered reveal library - the existing CSS-keyframe system already covers everything Phase 3 asks for.

---

## 9. Responsive rules

No structural breakpoint changes. Existing rules stay: `@media (max-width: 860px)` app-shell/mobile handling, `.app-root` fixed-viewport behaviour on phone, safe-area insets throughout. Phase 1/4 work happens inside this system, not around it. Every new/changed control is checked against the existing 44px minimum (`.field`'s `min-height: 2.75rem` pattern, `size-md`/`lg` button heights) - this task already found and fixed one violation this session (onboarding's "Change" timezone button) and treats that as the standing bar, not a one-off.

---

## 10. Accessibility and reduced-motion rules

- Every new motion addition is added to (not replacing) the existing `@media (prefers-reduced-motion: reduce)` block in `styles.css`, which already zeroes animation/transition duration globally and special-cases `.reveal`, `.hero-in`, `.roadmap-spine-fill`, `.site-field-*`, `.roadmap-dot.is-now`. New keyframed elements from Phase 3 (timezone reveal, empty-queue pulse) get their own explicit reduced-motion override alongside these, not an assumption that the global rule covers them.
- `:focus-visible` stays `outline: 2px solid var(--color-mark)` at minimum; the new `--shadow-mark-focus` token is additive (used on non-outline-bearing surfaces like cards), never a replacement for the outline on standard controls.
- Every colour/opacity change touching text gets a measured contrast check against its real rendered background (WCAG AA: 4.5:1 normal text, 3:1 large text) before being reported done - the standing contrast-gate rule applies with no exception for this task, and `--color-stone`'s prior AA failure/fix (documented in `styles.css`'s own comment) is the cautionary precedent.

---

## Baseline evidence

Real-browser screenshots captured before any change, at `docs/evidence/baseline/`:
- Landing: 1440, 1024, 768, 375
- Signup: 1440 (stale-session error state), 375 (clean unauthenticated form)
- Login: 1440, 375
- Onboarding: live stage-1 at 1440 (`05-onboarding-live-1440.png`); stage-1/2 at 1440 and 375 already captured and current as of this commit at `docs/evidence/r2a/06-09*.png` (R2A Slice 5 verification, same code state)
- Empty live queue (real onboarded tenant, real Supabase auth, zero enquiries): 1440, 375
- Business Brain (real tenant, honestly empty - 0 services/confirmed/learning): 1440
- Trust Centre (real tenant, honestly empty - 0 action classes, "none yet"): 1440, 375
- BridgeMind reference: `.evolution/style-mirror/reference.png` (hero, 1440), `reference-section2.png` (feature cards + second section)

Method note: Brain/Trust/empty-queue baselines used a disposable Supabase test user created and destroyed via direct SQL for this session (id `2781d0aa-...`, cleaned up and verified against Orbit Digital's unrelated `contacts` table row count, unchanged at 5). This is the same shared Supabase project as Orbit Digital; no other project data was touched.

---

## 11. Independent critique (run before any implementation)

A general-purpose agent, given no prior context beyond this file and the surrounding product constraints, was dispatched to critique this plan cold - specifically checking for AI-slop risk, internal contradictions, Nielsen-heuristic and accessibility gaps, and whether the plan actually satisfies the founder's brief or is too conservative.

Findings (3 P0, 4 P1, 2 P2) and the resulting fixes, applied directly into the sections above:

- **P0** - `--shadow-mark-focus` was scoped to include a "signature moment" use, re-admitting the exact decorative-glow pattern Section 4 rejects. Fixed: scoped to `:focus-visible` only (Section 5).
- **P0** - the empty-queue "waiting pulse" implied ongoing activity with no real state behind it, in tension with the "no fabricated activity" product rule. Fixed: replaced with a single non-repeating mount animation (Section 8).
- **P0** - the plan's rejections were individually well-argued but collectively risked under-delivering on "high contrast... alive." Fixed: added a bounded dark-section landing treatment and a real `--color-mark-strong` token (Section 2, decisions 7-8), rather than deferring the question to the founder mid-build.
- **P1** - "deepen the accent" (Section 2) contradicted "unchanged hue" (Section 5's original table). Fixed by decision 8 above.
- **P1** - new mark-on-sidebar and mark-on-mark-strong pairings needed explicit contrast re-checks even though neither hex changes. Added to Section 5.
- **P1** - the serif-H1-on-auth-forms hypothesis had no fallback plan if Phase 5 rejected it. Added to Section 6.
- **P1** - layout/density (style-mirror Cardinal Rule 2) had no Enquiry-side decision. Added as decision 9.
- **P2** - eyebrow/coloured-dot pattern had no accept/reject decision. Added as decision 10.
- **P2** - confirmed the landing hero itself needed a real decision, not silent omission - resolved by decision 7's bounded dark section rather than a hero rewrite (the hero's headline/CTA/copy stay; the section beneath it is where "high contrast" lands).

Full agent transcript available in this session; not reproduced here. This document reflects the fixed plan, not the pre-critique draft.
