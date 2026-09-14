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

test("entry aurora settles within five seconds and respects reduced motion", () => {
  assert.match(css, /animation: entry-aurora-arrive 4\.5s ease-out both/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.entry-aurora-ribbons\s*\{\s*animation: none/,
  );
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*?\.entry-aurora\s*\{\s*display: none/);
  assert.doesNotMatch(component, /framer-motion|useEffect|requestAnimationFrame/);
});

test("entry aurora belongs to the shared auth layout, without replacing forms", () => {
  const layout = read("src/components/auth/auth-layout.tsx");
  assert.equal((layout.match(/<AuroraBackground \/>/g) ?? []).length, 1);
  assert.equal((layout.match(/<main\b/g) ?? []).length, 1);
  assert.match(layout, /className="auth-content">\{children\}/);
  assert.match(read("src/routes/early-access.tsx"), /<AuthLayout>/);
});
