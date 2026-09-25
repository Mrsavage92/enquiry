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
  assert.match(home, /OFFER_FAQ\.cost/);
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

test("the founding offer is stated in one place and nowhere else", () => {
  const offer = source("src/lib/site/offer.ts");
  assert.match(offer, /FOUNDING_PRICE = "A\$15"/);
  assert.match(offer, /STANDARD_PRICE = "A\$29"/);
  for (const file of [
    "src/routes/index.tsx",
    "src/routes/early-access.tsx",
    "src/routes/terms.tsx",
    "src/routes/onboarding.tsx",
    "src/components/site/brand-hero.tsx",
    "src/components/site/early-access-invite.tsx",
    "src/lib/email/waitlist-welcome.ts",
  ]) {
    const text = source(file);
    assert.doesNotMatch(
      text,
      /30% off|first 20|12 months|A\$\d|20-minute/,
      `${file} restates the offer`,
    );
  }
});

test("demo toggles mirror the URL through the router without resetting scroll", () => {
  // TanStack history patches history.replaceState into a router load, and that
  // load scrolled the page to the top on every toggle tap (critique round 3).
  for (const file of [
    "src/components/site/product-showcase.tsx",
    "src/components/site/cross-channel-decision-demo.tsx",
  ]) {
    const text = source(file);
    assert.doesNotMatch(
      text,
      /window\.history\.(replaceState|pushState)\(/,
      `${file} bypasses the router`,
    );
    assert.match(text, /replace: true,\s*resetScroll: false/, `${file} keeps the scroll position`);
  }
  const demo = source("src/components/site/cross-channel-decision-demo.tsx");
  // Critique round 4: scrollIntoView pushed the toggles off the top; the
  // capped delta keeps the controls and the verdict on screen together.
  assert.match(demo, /decisionScrollDelta\(/);
  assert.doesNotMatch(demo, /scrollIntoView/);
  assert.match(demo, /aria-label="Message"/);
});

test("the founding price number and its per-day line stay in step", () => {
  const offer = source("src/lib/site/offer.ts");
  const label = offer.match(/FOUNDING_PRICE = "A\$(\d+)"/)?.[1];
  const amount = offer.match(/FOUNDING_PRICE_AMOUNT = (\d+);/)?.[1];
  assert.equal(label, amount);
  assert.equal(Math.round((Number(amount) / 30) * 100), 50, "A$15 over 30 days is 50c");
  assert.match(offer, /perDay: `About \$\{perDayLabel\(FOUNDING_PRICE_AMOUNT\)\} a day\.`/);
  assert.doesNotMatch(offer, /Your price never goes up/);
  const page = source("src/routes/early-access.tsx");
  assert.match(page, /OFFER\.perDay/);
  assert.doesNotMatch(page, /OFFER\.after/);
});

test("an empty email gets its own prompt before the shape check", () => {
  const form = source("src/components/site/waitlist-form.tsx");
  const empty = form.indexOf("Enter your email to join.");
  const shape = form.indexOf("That does not look like an email address.");
  assert.ok(empty > 0 && empty < shape);
});

test("phone captures ship a real 2x file and every phone image offers it", () => {
  const jpegSize = (bytes) => {
    for (let i = 2; i < bytes.length;) {
      const marker = bytes.readUInt16BE(i);
      if (marker >= 0xffc0 && marker <= 0xffc2)
        return [bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)];
      i += 2 + bytes.readUInt16BE(i + 2);
    }
    return null;
  };
  for (const view of ["today", "enquiry", "business"]) {
    const path = new URL(`../public/product/ui1/${view}-mobile@2x.jpg`, import.meta.url);
    assert.deepEqual(jpegSize(readFileSync(path)), [780, 1200], `${view} 2x size`);
    assert.ok(statSync(path).size < 150_000, `${view}-mobile@2x exceeds its image budget`);
  }
  assert.match(source("src/lib/site/captures.ts"), /-mobile@2x\.jpg 2x/);
  for (const file of [
    "src/components/site/product-walkthrough.tsx",
    "src/components/site/product-showcase.tsx",
    "src/routes/index.tsx",
  ])
    assert.match(source(file), /mobileCaptureSrcSet\(/, `${file} serves the 2x capture`);
});
