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

const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setSafeAreaInsetsOverride", {
  insets: { top: 59, bottom: 34, left: 0, right: 0, topMax: 59, bottomMax: 34 },
});

function px(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : v;
}

async function insets() {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const topEl = document.querySelector(".phone-safe-top");
    const nav = document.querySelector(".app-nav");
    const header = document.querySelector(".app-root header");
    const root = document.querySelector(".app-root");
    const h1 = document.querySelector("h1, .text-3xl");
    const r = root?.getBoundingClientRect();
    return {
      tokenTop: cs.getPropertyValue("--app-safe-top").trim(),
      tokenBottom: cs.getPropertyValue("--app-safe-bottom").trim(),
      envTop: cs.getPropertyValue("--app-safe-top").trim(),
      phoneSafeTop: topEl ? getComputedStyle(topEl).paddingTop : null,
      navPadBottom: nav ? getComputedStyle(nav).paddingBottom : null,
      headerPadTop: header ? getComputedStyle(header).paddingTop : null,
      titleTop: h1 ? Math.round(h1.getBoundingClientRect().top) : null,
      navBottom: nav ? Math.round(nav.getBoundingClientRect().bottom) : null,
      navHeight: nav ? Math.round(nav.getBoundingClientRect().height) : null,
      innerHeight: window.innerHeight,
      appHeight: r ? Math.round(r.height) : null,
      appTop: r ? Math.round(r.top) : null,
      cssAppHeight: root ? getComputedStyle(root).height : null,
      keyboard: document.documentElement.dataset.keyboard || "",
      varHeight: document.documentElement.style.getPropertyValue("--app-height"),
      embed: document.documentElement.classList.contains("embed"),
    };
  });
}

await page.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const today = await insets();
await page.screenshot({ path: "/workspace/screenshots/safe-today.png" });

if (px(today.tokenTop) !== 59) errors.push(`token top ${today.tokenTop}`);
if (px(today.tokenBottom) !== 34) errors.push(`token bottom ${today.tokenBottom}`);
if (px(today.phoneSafeTop) !== 59) errors.push(`Today phone-safe-top ${today.phoneSafeTop}`);
if (px(today.navPadBottom) !== 34) errors.push(`nav pad ${today.navPadBottom}`);
if (today.titleTop != null && today.titleTop < 59)
  errors.push(`title under notch ${today.titleTop}`);
if (today.navBottom != null && today.innerHeight - today.navBottom > 2) {
  errors.push(`nav not flush to bottom, gap ${today.innerHeight - today.navBottom}`);
}
if (today.appTop != null && today.appTop > 1) {
  errors.push(`app-root not at top, top ${today.appTop}`);
}
if (today.appHeight != null && today.innerHeight - today.appHeight > 2) {
  errors.push(`app-root shorter than screen by ${today.innerHeight - today.appHeight}`);
}
if (today.keyboard) errors.push(`keyboard flag set on load: ${today.keyboard}`);
if (today.varHeight) errors.push(`--app-height set on load: ${today.varHeight}`);
if (today.navHeight != null && today.navHeight < 70) {
  errors.push(`nav too short to clear home indicator ${today.navHeight}`);
}

await page.goto(`${base}/enquiries/f01`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const job = await insets();
await page.screenshot({ path: "/workspace/screenshots/safe-job.png" });
if (px(job.headerPadTop) !== 59) errors.push(`job header pad ${job.headerPadTop}`);

const sendBox = await page.locator("button", { hasText: "Send quote" }).boundingBox();
if (!sendBox) errors.push("Send quote missing");
else {
  const sendBottom = sendBox.y + sendBox.height;
  const clearance = 844 - sendBottom;
  if (clearance < 34) errors.push(`Send sits in home indicator, clearance ${clearance}`);
}

await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const home = await page.evaluate(() => {
  const nav = document.querySelector(".site-nav");
  return {
    padTop: nav ? getComputedStyle(nav).paddingTop : null,
    wordmarkTop: document.querySelector("header")?.getBoundingClientRect().top ?? null,
  };
});
await page.screenshot({ path: "/workspace/screenshots/safe-home.png" });
if (px(home.padTop) < 90) errors.push(`site-nav pad ${home.padTop}`);

console.log(JSON.stringify({ today, job, home, sendBox, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
