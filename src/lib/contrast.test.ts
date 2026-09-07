import assert from "node:assert/strict";
import test from "node:test";

/**
 * Guards the two WCAG AA fixes from the 2026-09-07 visual-tokens slice
 * (research/agent-runs/2026-09-07/44-visual-slice-tokens-and-palette-b.md)
 * and the Palette B trial's own numbers, against a plain re-implementation
 * of the WCAG 2.2 contrast formula - so a later hex edit in src/styles.css
 * that quietly regresses a ratio below its gate fails this test, not just a
 * design review. Hex values are duplicated from styles.css rather than
 * imported: this is a CSS custom-property file, not a JS module, so the
 * only alternative is parsing the CSS. Duplication is the honest option; if
 * these ever drift apart, this test's own numbers stop matching the design
 * comments in styles.css, which is a visible enough seam to catch it.
 */

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG 2.2 contrast ratio, (Llighter + 0.05) / (Ldarker + 0.05). */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL_TEXT = 4.5;
const AA_NON_TEXT = 3.0;

// Current palette (A) - unchanged tokens, sanity-checked against the design
// comments already in styles.css.
const paper = "#f3eee6";
const raised = "#faf7f1";
const paper2 = "#e7dfd3";
const stone = "#716b61";
const lineStrong = "#cfc4b4";

// Part 1 fixes.
const stoneOnPaper2 = "#686259";
const lineControl = "#8e867a";
const warn = "#8f5a00";
const warnOnPaper2 = "#8a5700";

test("baseline: --color-stone still passes on paper and raised, unchanged", () => {
  assert.ok(contrastRatio(stone, paper) >= AA_NORMAL_TEXT);
  assert.ok(contrastRatio(stone, raised) >= AA_NORMAL_TEXT);
});

test("baseline: --color-stone on --color-paper-2 is the documented pre-fix failure", () => {
  const ratio = contrastRatio(stone, paper2);
  assert.ok(ratio < AA_NORMAL_TEXT, `expected the known failure, got ${ratio}`);
});

test("Part 1 fix: --color-stone-on-paper-2 clears 4.5:1 on paper-2", () => {
  assert.ok(contrastRatio(stoneOnPaper2, paper2) >= AA_NORMAL_TEXT);
});

test("baseline: --color-line-strong is the documented pre-fix control-outline failure", () => {
  assert.ok(contrastRatio(lineStrong, paper) < AA_NON_TEXT);
  assert.ok(contrastRatio(lineStrong, raised) < AA_NON_TEXT);
});

test("Part 1 fix: --color-line-control clears 3:1 on both paper and raised", () => {
  assert.ok(contrastRatio(lineControl, paper) >= AA_NON_TEXT);
  assert.ok(contrastRatio(lineControl, raised) >= AA_NON_TEXT);
});

test("baseline: --color-warn passes on paper and raised, unchanged", () => {
  assert.ok(contrastRatio(warn, paper) >= AA_NORMAL_TEXT);
  assert.ok(contrastRatio(warn, raised) >= AA_NORMAL_TEXT);
});

test("baseline: --color-warn on --color-paper-2 is a real failure, found by the computed-style sweep", () => {
  const ratio = contrastRatio(warn, paper2);
  assert.ok(ratio < AA_NORMAL_TEXT, `expected the known failure, got ${ratio}`);
});

test("review follow-up fix: --color-warn-on-paper-2 clears 4.5:1 on paper-2", () => {
  assert.ok(contrastRatio(warnOnPaper2, paper2) >= AA_NORMAL_TEXT);
});

// Palette B ("refined warm") - values transcribed from
// docs/design/2026-09-07_PALETTE_STUDY.html and VISUAL_DIRECTION_REVIEW.md.
const bPaper = "#f5f6f3";
const bRaised = "#ffffff";
const bPaper2 = "#eff2ef";
const bInk = "#18221f";
const bMark = "#245947";
const bStone = "#5e6a63";
const bLineStrong = "#7a8780";
const bMarkFg = "#ffffff";
const bSidebar = "#18231e";
const bSidebarFg = "#f7faf8";

test("Palette B: body text and accent-as-text pass on canvas", () => {
  assert.ok(contrastRatio(bInk, bPaper) >= AA_NORMAL_TEXT);
  assert.ok(contrastRatio(bMark, bPaper) >= AA_NORMAL_TEXT);
});

test("Palette B: muted text passes on canvas, white surface and tint", () => {
  assert.ok(contrastRatio(bStone, bPaper) >= AA_NORMAL_TEXT);
  assert.ok(contrastRatio(bStone, bRaised) >= AA_NORMAL_TEXT);
  assert.ok(contrastRatio(bStone, bPaper2) >= AA_NORMAL_TEXT);
});

test("Palette B: necessary control outline (line-strong) clears 3:1 on paper and raised", () => {
  assert.ok(contrastRatio(bLineStrong, bPaper) >= AA_NON_TEXT);
  assert.ok(contrastRatio(bLineStrong, bRaised) >= AA_NON_TEXT);
});

test("Palette B: action foreground and sidebar foreground pass", () => {
  assert.ok(contrastRatio(bMarkFg, bMark) >= AA_NORMAL_TEXT);
  assert.ok(contrastRatio(bSidebarFg, bSidebar) >= AA_NORMAL_TEXT);
});

test("Part 1 fixes inherited under Palette B still clear their gates (no regression)", () => {
  // --color-stone-on-paper-2, --color-line-control and --color-warn-on-paper-2
  // are NOT part of the study - Palette B does not override them, so they
  // keep their Part-1 hex values while the surfaces around them change under B.
  assert.ok(contrastRatio(stoneOnPaper2, bPaper2) >= AA_NORMAL_TEXT);
  assert.ok(contrastRatio(lineControl, bPaper) >= AA_NON_TEXT);
  assert.ok(contrastRatio(lineControl, bRaised) >= AA_NON_TEXT);
  assert.ok(contrastRatio(warnOnPaper2, bPaper2) >= AA_NORMAL_TEXT);
});
