import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the public shell preserves access and attribution without the rejected paper surface", () => {
  const shell = source("src/components/site/site-shell.tsx");
  for (const destination of [
    "/how",
    "/demo",
    "/roadmap",
    "/updates",
    "/early-access",
    "/login",
    "/privacy",
    "/terms",
  ]) {
    assert.ok(shell.includes(`"${destination}"`), destination);
  }
  assert.match(shell, /captureAttribution\(\)/);
  assert.match(shell, /event_name: "page_view"/);
  assert.match(shell, /event_name: "hero_cta_click"/);
  assert.match(shell, /Skip to content/);
  assert.match(shell, /aria-expanded=\{open\}/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /menuButton\.current\?\.focus\(\)/);
  assert.doesNotMatch(shell, /PaperField|notebook|backdrop-blur/);
});

test("every product view has a real, bounded desktop and mobile JPEG", () => {
  for (const view of ["today", "enquiry", "business"]) {
    for (const size of ["desktop", "mobile"]) {
      const path = new URL(`../public/product/ui1/${view}-${size}.jpg`, import.meta.url);
      const image = readFileSync(path);
      assert.equal(image.readUInt16BE(0), 0xffd8, "JPEG start marker");
      assert.equal(image.readUInt16BE(image.length - 2), 0xffd9, "JPEG end marker");
      assert.ok(statSync(path).size < 150_000, `${view}-${size} exceeds its image budget`);
    }
  }
  const showcase = source("src/components/site/product-showcase.tsx");
  assert.match(showcase, /aria-pressed=\{selected === index\}/);
  assert.match(showcase, /hidden=\{selected !== index\}/);
  assert.match(showcase, /Actual app/);
  assert.match(showcase, /sample workspace/);
  assert.match(showcase, /media="\(max-width: 600px\)"/);
});

test("public presentation has stable media, reduced motion and no animated aurora", () => {
  const css = source("src/public-site.css");
  assert.match(css, /aspect-ratio: 3 \/ 2/);
  assert.match(css, /aspect-ratio: 390 \/ 600/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /aurora|repeating-linear-gradient|letter-spacing:\s*-/);
});

test("marketing retains review-first and sample boundaries", () => {
  const home = source("src/routes/index.tsx");
  assert.match(home, /Copying a reply is not sending it/);
  assert.match(home, /30% off your first 12 months/);
  assert.match(home, /not into a paid subscription/);
  assert.match(home, /<details/);
  assert.doesNotMatch(home, /send-phone\.mp4|poster-desk|LivePhone|PhoneFrame/);
  const privacy = source("src/routes/privacy.tsx");
  assert.match(privacy, /stored?[^]*on the server|stores[^]*on the server/);
  assert.doesNotMatch(privacy, /anything you type there stay on this/);
});

test("share metadata and browser assets use the approved temporary UI1 identity", () => {
  const metadata = JSON.parse(source("src/lib/og/site.json"));
  assert.match(metadata.imageAlt, /safely promise/);
  assert.ok(source("src/lib/site/head.ts").includes(metadata.imageAlt));
  assert.equal(metadata.color, "654ac2");
  assert.doesNotMatch(source("public/favicon.svg"), /2f4a3c|f6f2eb/);
  for (const [name, size] of [
    ["apple-touch-icon.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
  ]) {
    const bytes = readFileSync(new URL(`../public/${name}`, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
  assert.doesNotMatch(source("src/routes/__root.tsx"), /fonts.googleapis.com/);
});
