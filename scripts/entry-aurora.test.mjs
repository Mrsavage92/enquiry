import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("src/auth.css");
const component = read("src/components/ui/aurora-background.tsx");

test("entry aurora is decorative and cannot intercept form interaction", () => {
  assert.match(component, /aria-hidden="true"/);
  assert.doesNotMatch(component, /<(main|button|a|input)\b/);
  assert.match(css, /\.entry-aurora\s*\{[^}]*pointer-events: none/);
  assert.match(css, /\.auth-page\s*\{[^}]*isolation: isolate/);
});

test("entry aurora flows continuously with pause and reduced-motion safeguards", () => {
  assert.match(css, /animation: entry-aurora-flow 24s ease-in-out infinite alternate/);
  assert.match(css, /animation: entry-aurora-counterflow 32s ease-in-out -12s infinite alternate/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.entry-aurora-ribbons,\s*\.entry-aurora-ribbons::after\s*\{\s*animation: none/,
  );
  assert.match(
    css,
    /@media \(forced-colors: active\)[\s\S]*?\.auth-motion-toggle\s*\{\s*display: none/,
  );
  assert.match(
    css,
    /\[data-aurora-paused="true"\][^{]*::after\s*\{\s*animation-play-state: paused/,
  );
  const layout = read("src/components/auth/auth-layout.tsx");
  assert.match(layout, /aria-label=\{motionLabel\}/);
  assert.match(layout, /setMotionPaused\(\(paused\) => !paused\)/);
  assert.doesNotMatch(component, /framer-motion|useEffect|requestAnimationFrame/);
});

test("entry aurora belongs to the shared auth layout, without replacing forms", () => {
  const layout = read("src/components/auth/auth-layout.tsx");
  assert.equal((layout.match(/<AuroraBackground \/>/g) ?? []).length, 1);
  assert.equal((layout.match(/<main\b/g) ?? []).length, 1);
  assert.match(
    layout,
    /className=\{`auth-content\$\{wide \? " auth-content-wide" : ""\}`\}>\{children\}/,
  );
  assert.match(layout, /wide = false/);
  assert.match(read("src/routes/early-access.tsx"), /<AuthLayout>/);
});
