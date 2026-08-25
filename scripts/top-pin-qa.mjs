import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

async function metrics() {
  return page.evaluate(() => {
    const header = document.querySelector(".site-nav");
    const brand = header?.querySelector("a");
    const h1 = document.querySelector("h1");
    const hr = header?.getBoundingClientRect();
    const br = brand?.getBoundingClientRect();
    const r1 = h1?.getBoundingClientRect();
    const pad = header ? getComputedStyle(header).paddingTop : "";
    return {
      scrollY: Math.round(window.scrollY),
      padTop: pad,
      headerTop: hr ? Math.round(hr.top) : null,
      brandTop: br ? Math.round(br.top) : null,
      h1Top: r1 ? Math.round(r1.top) : null,
      h1Text: (h1?.textContent ?? "").trim(),
      embed: document.documentElement.classList.contains("embed"),
    };
  });
}

const top0 = await metrics();
await page.screenshot({ path: "/workspace/screenshots/top-pin-embed.png" });
if (top0.scrollY > 2) errors.push(`load scrollY ${top0.scrollY}`);
const padPx = Number.parseFloat(top0.padTop);
if (!(padPx >= 90)) errors.push(`phone header padding ${top0.padTop}, expected >= 90px`);
if (top0.brandTop != null && top0.brandTop < 90) {
  errors.push(`wordmark too high under preview chrome: ${top0.brandTop}`);
}
if (!/Stop managing/.test(top0.h1Text)) errors.push("headline missing");

await page.evaluate(() => window.scrollTo(0, 48));
await page.waitForTimeout(200);
const nudged = await metrics();
await page.evaluate(() => window.scrollTo(0, 420));
await page.waitForTimeout(400);
const deep = await metrics();
if (deep.scrollY < 300) errors.push(`real scroll was yanked back, scrollY ${deep.scrollY}`);
await page.screenshot({ path: "/workspace/screenshots/top-pin-scrolled.png" });

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
const back = await metrics();
if (back.scrollY > 2) errors.push(`return to top failed ${back.scrollY}`);
if (!/Stop managing/.test(back.h1Text)) errors.push("headline missing after return");
await page.screenshot({ path: "/workspace/screenshots/top-pin-back.png" });

console.log(JSON.stringify({ top0, nudged, deep, back, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
