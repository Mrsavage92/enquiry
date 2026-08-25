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

await page.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

async function box() {
  return page.evaluate(() => {
    const root = document.querySelector(".app-root");
    const nav = document.querySelector(".app-nav");
    const r = root?.getBoundingClientRect();
    const n = nav?.getBoundingClientRect();
    const cs = root ? getComputedStyle(root) : null;
    return {
      innerHeight: window.innerHeight,
      vvHeight: window.visualViewport?.height ?? null,
      vvOffset: window.visualViewport?.offsetTop ?? null,
      appTop: r ? Math.round(r.top) : null,
      appBottom: r ? Math.round(r.bottom) : null,
      appHeight: r ? Math.round(r.height) : null,
      navBottom: n ? Math.round(n.bottom) : null,
      navHeight: n ? Math.round(n.height) : null,
      cssHeight: cs?.height,
      cssTop: cs?.top,
      cssPos: cs?.position,
      varH: getComputedStyle(document.documentElement).getPropertyValue("--app-height").trim(),
      varT: getComputedStyle(document.documentElement).getPropertyValue("--app-offset-top").trim(),
      gapBottom: r ? Math.round(window.innerHeight - r.bottom) : null,
      gapTop: r ? Math.round(r.top) : null,
    };
  });
}

const today = await box();
await page.screenshot({ path: "/workspace/screenshots/app-vp-today.png" });
if (today.cssPos !== "fixed") errors.push(`app-root position ${today.cssPos}`);
if (Math.abs(today.gapBottom) > 2) errors.push(`bottom gap ${today.gapBottom}`);
if (Math.abs(today.gapTop) > 2) errors.push(`top gap ${today.gapTop}`);
if (today.navBottom != null && Math.abs(today.navBottom - today.innerHeight) > 2) {
  errors.push(`nav not at bottom ${today.navBottom} vs ${today.innerHeight}`);
}

await page.goto(`${base}/enquiries/f01`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const job = await box();
await page.screenshot({ path: "/workspace/screenshots/app-vp-job.png" });
if (Math.abs(job.gapBottom) > 2) errors.push(`job bottom gap ${job.gapBottom}`);
if (Math.abs(job.gapTop) > 2) errors.push(`job top gap ${job.gapTop}`);

await page.evaluate(() => {
  document.documentElement.classList.add("embed");
  document.documentElement.style.setProperty("--app-offset-top", "72px");
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight - 72}px`);
});
await page.waitForTimeout(100);
const shifted = await box();
await page.screenshot({ path: "/workspace/screenshots/app-vp-shifted.png" });
if (shifted.appTop < 60) errors.push(`shifted app did not pin to offset, top ${shifted.appTop}`);
if (shifted.gapBottom < -2) errors.push(`shifted overflow ${shifted.gapBottom}`);

console.log(JSON.stringify({ today, job, shifted, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
