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
await page.waitForTimeout(500);

async function metrics() {
  return page.evaluate(() => {
    const header = document.querySelector(".site-nav");
    const h1 = document.querySelector("h1");
    const videos = [...document.querySelectorAll("video")];
    const hr = header?.getBoundingClientRect();
    const r1 = h1?.getBoundingClientRect();
    const headerPos = header ? getComputedStyle(header).position : null;
    return {
      scrollY: Math.round(window.scrollY),
      maxScroll: Math.round(document.documentElement.scrollHeight - window.innerHeight),
      headerPos,
      headerTop: hr ? Math.round(hr.top) : null,
      headerBottom: hr ? Math.round(hr.bottom) : null,
      h1Top: r1 ? Math.round(r1.top) : null,
      h1Bottom: r1 ? Math.round(r1.bottom) : null,
      h1Text: (h1?.textContent ?? "").trim(),
      overlap: hr && r1 ? Math.round(hr.bottom - r1.top) : null,
      videoCount: videos.length,
      videosPlaying: videos.filter((v) => !v.paused).length,
      livePhoneInDom: Boolean(document.body.innerText.includes("Start again")),
      canScrollUp: window.scrollY > 0,
    };
  });
}

const top0 = await metrics();
await page.screenshot({ path: "/workspace/screenshots/scroll-top.png" });
if (top0.scrollY !== 0) errors.push(`start scrollY ${top0.scrollY}`);
if (!/Stop managing/.test(top0.h1Text) || !/enquir/i.test(top0.h1Text)) {
  errors.push(`h1 incomplete at top: ${top0.h1Text}`);
}
if (top0.headerPos === "sticky" || top0.headerPos === "fixed") {
  errors.push(`phone header should not stick, got ${top0.headerPos}`);
}
if (top0.h1Top != null && top0.headerBottom != null && top0.h1Top < top0.headerBottom - 2) {
  errors.push(`h1 under header at top by ${top0.headerBottom - top0.h1Top}px`);
}
if (top0.videoCount > 1) errors.push(`phone loaded ${top0.videoCount} videos`);
if (top0.livePhoneInDom) errors.push("LivePhone mounted on phone homepage");

await page.mouse.wheel(0, 220);
await page.waitForTimeout(300);
const mid = await metrics();
await page.screenshot({ path: "/workspace/screenshots/scroll-mid.png" });
if (
  mid.headerPos === "sticky" &&
  mid.overlap != null &&
  mid.overlap > 8 &&
  mid.h1Top < (mid.headerBottom ?? 0)
) {
  errors.push(`sticky header covering h1 after scroll by ${mid.overlap}px`);
}

await page.mouse.wheel(0, 900);
await page.waitForTimeout(250);
await page.mouse.wheel(0, -2000);
await page.waitForTimeout(350);
const back = await metrics();
await page.screenshot({ path: "/workspace/screenshots/scroll-back.png" });
if (back.scrollY > 8) errors.push(`could not return to top, scrollY ${back.scrollY}`);
if (back.h1Top != null && back.headerBottom != null && back.h1Top < back.headerBottom - 2) {
  errors.push(`h1 under header after return by ${back.headerBottom - back.h1Top}px`);
}
if (!/Stop managing/.test(back.h1Text)) errors.push("Stop managing missing after return");

await page.evaluate(() => window.scrollTo(0, 0));
const top2 = await metrics();
if (top2.scrollY > 2) errors.push(`scrollTo(0) failed, ${top2.scrollY}`);

console.log(JSON.stringify({ top0, mid, back, top2, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
