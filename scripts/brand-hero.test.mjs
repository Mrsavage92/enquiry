import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("brand art stays separate from actual product evidence", () => {
  const hero = read("src/components/site/brand-hero.tsx");
  assert.match(hero, /aria-hidden="true"/);
  assert.match(hero, /signal-ribbon\.webp/);
  assert.match(hero, /fetchPriority="high"/);
  const showcase = read("src/components/site/product-showcase.tsx");
  assert.match(showcase, /Actual app · sample workspace/);
  assert.match(showcase, /\/product\/ui1\//);
  assert.match(showcase, /id="product-preview"/);
  assert.doesNotMatch(showcase, /signal-ribbon/);
  assert.ok(statSync(new URL("../public/brand/signal-ribbon.webp", import.meta.url)).size < 150000);
});

test("hero motion defaults still and supports pause, reduced motion and offscreen suspension", () => {
  const hero = read("src/components/site/brand-hero.tsx");
  assert.match(hero, /\[reducedMotion, setReducedMotion\] = useState\(true\)/);
  assert.match(hero, /!paused && !reducedMotion && visible/);
  assert.match(hero, /Pause background motion/);
  assert.match(hero, /Play background motion/);
  assert.match(hero, /media\.removeEventListener/);
  assert.match(hero, /observer\.disconnect/);
  const css = read("src/brand-hero.css");
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /font-size:[^;]*vw|letter-spacing:\s*-/);
});

test("hero keeps real conversion destinations and product navigation", () => {
  const hero = read("src/components/site/brand-hero.tsx");
  assert.match(hero, /to="\/early-access"/);
  assert.match(hero, /to="\/demo"/);
  assert.match(hero, /href="#product-preview"/);
  assert.match(hero, /<h1 id="home-title">/);
  assert.doesNotMatch(hero, /setInterval|sendReply|fetch\(/);
});
