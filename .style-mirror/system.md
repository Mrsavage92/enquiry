# Marketing system - hand-off for the route builders

The shared marketing system mirrors **linear.app** (and **linear.app/changelog** for the entry
pattern). Home is built on it. `/how`, `/roadmap`, `/updates` and `/early-access` are next.

Read this, then `tokens.lock.json` (the extracted reference values), `.style-mirror/spec.md`
(human-readable) and `.style-mirror/diff.md` (what changed and why). Everything below is a measured
reference value unless it says DERIVATION.

---

## 1. How the layer is scoped

`SiteShell` sets `data-site="marketing"` on `<html>` on mount and removes it on unmount, and swaps
the `theme-color` meta to `#08090a` for the same lifetime. Every rule lives behind
`html[data-site="marketing"]` at the end of `src/styles.css`. The `@theme` block at the top of that
file is the signed-in app's and is untouched.

**Verified**: `/` and `/how` are `#08090a` + Inter + theme-color `#08090a`; `/login` is `#f3eee6` +
IBM Plex + `#faf7f1`, on both a client-side navigation and a hard load.

The layer redefines the app-named colour tokens as well as its own `--mk-*` set, so **every
existing Tailwind utility in the marketing tree already resolves to the mirror palette**:
`bg-paper`, `bg-raised`, `bg-paper-2`, `text-ink`, `text-ink-2`, `text-stone`, `border-line`,
`bg-mark`, `text-mark-fg`, `shadow-border`, `font-serif`, `font-mono`, `text-ok/warn/danger`.
You do not have to rewrite a route to get the palette. You do have to rewrite it to get the
**layout and type**, which is the part that makes it look mirrored.

Rules are deliberately **unlayered**, so they beat Tailwind's `utilities` layer. Two consequences:
- If you set `display` in a vocabulary class, a Tailwind `md:hidden` on the same element loses.
  Use a companion class at equal specificity placed after (see `.mk-below-md`).
- Do not add a bare element selector like `a { color: ... }` to this layer. One did exist and it
  silently beat every `text-*` utility on links, painting `/how`'s CTA at 1.18:1.

## 2. Tokens

Colour (`--mk-*`, all from the reference's root custom properties):

| Token | Value | Role |
|---|---|---|
| `--mk-bg` | `#08090a` | page |
| `--mk-bg-1` | `#0f1011` | panel, card, form field |
| `--mk-bg-2` | `#141516` | recessed |
| `--mk-plate` | `#090a0b` | media plate |
| `--mk-panel` | `#101112` | media panel |
| `--mk-border` | `#23252a` | borders, row dividers, the entry rule |
| `--mk-border-translucent` | `rgba(255,255,255,0.08)` | card and nav hairline |
| `--mk-border-faint` | `rgba(255,255,255,0.05)` | media inner edge |
| `--mk-hairline` | `#18191a` | page divider |
| `--mk-fg` | `#f7f8f8` | primary text |
| `--mk-fg-2` | `#d0d6e0` | long-form prose, card titles |
| `--mk-fg-3` | `#8a8f98` | lede, nav links, footer links, labels |
| `--mk-fg-4` | `#62666d` | **fails 4.5:1 on `--mk-bg` - do not use for text** |
| `--mk-invert-bg` / `--mk-invert-fg` | `#e5e5e6` / `#08090a` | primary CTA |
| `--mk-translucent` / `-strong` | `rgba(255,255,255,0.05)` / `0.1` | secondary CTA, hover |
| `--mk-accent` | `#5e6ad2` | accent only - **never a CTA fill**, the reference's CTAs are inverted |
| `--mk-link` | `#828fff` | inline link in prose |
| `--mk-marker` | `#fc7840` | changelog marker dot |
| `--mk-focus` | `#5e69d1` | focus ring |

Status tokens are remapped to the reference's dark-surface set: `--color-ok #27a644`,
`--color-warn #f0bf00`, `--color-danger #eb5757`. DERIVATION: the pill backgrounds are those hues
mixed into `--mk-bg-1`, the shape the reference uses for `--color-accent-tint`.

Type: `--mk-font` is Inter (DERIVATION: the reference computes to `"Inter Variable"`, its
self-hosted name for the identical Inter v4 variable font; Google Fonts serves it as `"Inter"` and
the fallback stack is verbatim). Loaded in `__root.tsx` - a remote `@import` in `styles.css` is
stripped by the Tailwind/Vite pipeline. `--mk-font-mono` is the reference's own declared fallback
with the commercial Berkeley Mono removed. Weights: 400 / **510** (display) / **590** (entry and
card titles). `font-feature-settings: "cv01","ss03"` and `font-variation-settings: "opsz" auto`
are on `body`. **There is no serif anywhere on either reference surface. Do not reintroduce one.**

Radius: 4 / 6 / 8 (media, fields) / 12 (cards, plates) / 9999 (buttons, nav links).
Easing: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` at 0.1s for links, 0.16s for buttons. That is the
only motion the reference has.

## 3. Geometry and spacing rhythm

Two nested layers, exactly as the reference builds it:

- `.mk-page` - `max-width: calc(1344px + 2 * outer)`, `padding-inline: outer`
- `.mk-container` - the same, plus the section inset: `padding-inline: outer + inset`

Measured responsive ladder (swept across 15 widths, `.style-mirror/sweep.json`):

| viewport | outer | inset | nav | section padding-block | section-head gap | h1 | h2 |
|---|---|---|---|---|---|---|---|
| > 1280 | 46px | 32px | 72px | 128px | 96px | 64 / -1.408 / 64 | 48 / -1.056 / 48 |
| 1025-1280 | 10px | 32px | 72px | 128px | 96px | 64 | 48 |
| 641-1024 | 28px | 8px | 72px | 128px (48/96 at ≤768) | 64px | 56 / -1.232 / 61.6 | 40 / -0.88 / 44 |
| ≤ 640 | 16px | 8px | 64px | 40px top / 48px bottom | 48px | 38 / -0.836 / 41.8 | 24 / -0.288 / 31.92 |

At 1440 that resolves to a 1280px text column with its left edge at x=80. At 390, x=24.

Two deliberate exceptions, both the reference's:
- The **nav** is inset 1px tighter (`.mk-nav .mk-container`), so the wordmark's optical bearing
  lands on the h1 line.
- The **media plate** is *wider* than the text column - 1320px at x=60 against 1280 at x=80.
  Put it in `.mk-page`, not `.mk-container`.

Headings carry an optical `margin-left` of -2px (-1px at 390). `.mk-h1` and `.mk-h2` do it for you.

`.mk-prefooter` gives the closing CTA the reference's 224px / 96px margin-block.

## 4. Component vocabulary

Compose a route from these. Do not invent new surface treatments.

| Class | What it is |
|---|---|
| `.mk-page` / `.mk-container` | the two container layers above |
| `.mk-section` | `padding-block: var(--mk-section-y)` |
| `.mk-section-head` | the block holding label + h2 + lede; adds the section-head gap below |
| `.mk-h1` / `.mk-h2` / `.mk-h3` | display, section heading, card/entry heading (590) |
| `.mk-lede` | 15px `#8a8f98` - the line under a heading |
| `.mk-prose` | 17px / lh 27.2 `#d0d6e0` - long-form body (15px / 24 at 390) |
| `.mk-small` / `.mk-mini` | 14px `#d0d6e0` / 13px `#8a8f98` |
| `.mk-label` | the eyebrow: 12px mono, sentence case, `#8a8f98` (DERIVATION, see below) |
| `.mk-inline-link` | `#828fff`, white on hover |
| `.mk-btn` + `.mk-btn-primary` / `.mk-btn-secondary` / `.mk-btn-sm` | h44 (h32 for `-sm`) pill |
| `.mk-card` | `#0f1011` + 3% white overlay, hairline, radius 12 |
| `.mk-rows` | a `ul`/`ol` whose children get `border-top`, last child `border-bottom` |
| `.mk-divider` | 1px `#18191a`, radius 9999 |
| `.mk-media` > `.mk-media-panel` > `.mk-media-inner` | the product-capture frame |
| `.mk-media-plain` | changelog-style media: no frame, radius 8 |
| `.mk-app-surface` | re-asserts the app's light palette (see §5) |
| `.mk-nav` / `.mk-nav-inner` / `.mk-nav-link` / `.mk-wordmark` / `.mk-main` | the shell |
| `.mk-footer` / `.mk-footer-inner` / `.mk-footer-grid` / `.mk-footer-brand` / `.mk-footer-heading` / `.mk-footer-link` | the footer |
| `.mk-entry` / `-aside` / `-rule` / `-marker` / `-date` / `-body` / `-title` | the changelog pattern |
| `.mk-tab` | the changelog filter row |
| `.mk-below-md` | display helper for elements that also carry a vocabulary class |

**The changelog-entry pattern - use this for `/roadmap` and `/updates`.** It is the reference's
`/changelog`, measured. Markup:

```tsx
<div className="mk-entry">
  <span className="mk-entry-rule" aria-hidden />
  {isNewest ? <span className="mk-entry-marker" aria-hidden /> : null}
  <div className="mk-entry-aside">
    <p className="mk-entry-date">{dateOrStatus}</p>
  </div>
  <div className="mk-entry-body">
    <h3 className="mk-entry-title" data-featured={featured ? "true" : undefined}>{title}</h3>
    {media ? <img className="mk-media-plain mt-12" ... /> : null}
    <p className="mk-prose mt-5">{body}</p>
  </div>
</div>
```

The rule and marker are **siblings of the aside, children of `.mk-entry`** - that is what makes the
rule run continuously down a group instead of stubbing out under each date. The entry's bottom
spacing lives on `.mk-entry-body` for the same reason. `data-featured` gives the 32px title tier.
Everything collapses to one column at 640 with the rule and marker hidden, as the reference does.

`/roadmap` should replace the `.roadmap-*` spine, dots and `.notebook` ruled surface with this. The
existing `.roadmap-*` rules are still in `styles.css`; delete them when nothing references them.

## 5. Composing a route so it matches home

```tsx
<SiteShell>
  <section className="mk-container pt-[120px] pb-14 sm:pt-[152px]">   {/* hero */}
    <p className="mk-label">Eyebrow</p>
    <h1 className="mk-h1 mt-6 max-w-[18ch]">Headline</h1>
    <p className="mk-lede mt-8 max-w-xl">One line.</p>
  </section>

  <section className="mk-section">
    <div className="mk-container">
      <div className="mk-section-head">
        <p className="mk-label">Label</p>
        <h2 className="mk-h2 mt-4 max-w-[20ch]">Section heading</h2>
        <p className="mk-lede mt-5 max-w-xl">Supporting line.</p>
      </div>
      {/* content */}
    </div>
  </section>

  <section className="mk-prefooter">                                  {/* closing CTA */}
    <div className="mk-container"> ... </div>
  </section>
</SiteShell>
```

Rules that keep a route consistent with home:

1. **No section borders.** The reference carries rhythm in padding. `border-t border-line` on every
   section is what the old site did.
2. **No `Reveal` / `HeroIn`.** The reference has no scroll-triggered entrances. The layer already
   neutralises them defensively so a stray one cannot leave content invisible, but do not add more.
3. **Any block that renders signed-in app components** (`components/enquiry/*`, `PhoneDesk`,
   `LivePhone`, the decision demo's panels) **must sit inside `.mk-app-surface`**, which re-asserts
   the app's light palette. The marketing layer remaps the app's colour tokens at the root, so
   without it you ship an inverted, contrast-unverified version of the product.
   `CrossChannelDecisionDemo` and `LivePhone` already own this internally; anything new does not.
4. **Product captures go in `MediaFrame`** (`components/site/device-frame.tsx`). The old
   `PhoneFrame` / `BrowserFrame` are gone - the reference frames portrait and landscape identically
   and draws no device bezel or fake browser chrome.
5. **Primary CTAs are the inverted near-white pill.** Never `--mk-accent`, never a brand-coloured
   fill. The nav CTA and the hero CTA are the same fill at different sizes, which is what the
   reference does; the old "nav CTA must be a step under the page's action" rule does not survive
   the mirror.
6. **Do not use `--mk-fg-4` (`#62666d`) for text.** 3.63:1 on `--mk-bg`.
7. Check `forbidden_additions` in `tokens.lock.json` before adding anything decorative. It is
   computed from what the reference does **not** do: no gradient mesh, border glow, glassmorphism
   on cards, grid lines, gradient text, Lucide or any stroke icon set, entrance animations, hover
   scale, serif headings, ruled paper, uppercase tracked eyebrows, custom cursor, centered hero,
   or coloured CTA buttons. The reference's icons are **fill**-based custom SVG on a `0 0 16 16`
   viewBox with `stroke: none`.

## 6. Dark / light decision

Marketing routes are dark (`#08090a`), the signed-in app stays light, and `/login` is out of scope
and stays light. The only light surfaces on a marketing route are `.mk-app-surface` blocks showing
the real product.

## 7. Verification you are expected to repeat

The harness ships in `.style-mirror/tools/` (run from the worktree root so `playwright`
resolves):

- `node .style-mirror/tools/sections.mjs <outdir> <1440|390>` - computed-style diff against
  `tokens.lock.json`, plus per-section screenshots. Add your route's selectors to the spec.
- `node .style-mirror/tools/contrast.mjs <outdir> <vp> <base> <route>` - rendered-pixel contrast
  sweep of every visible text node. It walks ancestors for opacity/clipping so screen-reader and
  honeypot text is not graded, and takes the glyph colour as the pixel furthest from the measured
  background rather than an antialiasing average.
- `node .style-mirror/tools/geom.mjs` - rendered box geometry against the reference's numbers.

Gates: `npx tsc --noEmit`, `npm run lint`, `npm test -- --test-concurrency=1` (serial is mandatory
on this machine; 725 tests), `npm run build`.

## 8. Known, not fixed here

`/roadmap` has two failing contrast pairs (1.19:1, 1.25:1): a `·` separator painted with
`text-line-strong`, a hairline **border** token used as a text colour. It failed in the light
palette too (1.49:1), so it predates this work. Fix it to `text-stone` when you rebuild that route.

Small glyphs are worth watching generally: a `·` at 12-14px never reaches its specified colour
after rasterisation, so a nominally-passing token can measure below 4.5:1. The decision demo's
separator needed `text-ink-2` for this reason.
