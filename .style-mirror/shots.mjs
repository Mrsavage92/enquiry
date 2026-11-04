// Section screenshots for the Things UI pass. Run against `npm run preview -- --port 4360`
// on a freshly started server (the local database is in-memory and starts empty).
// usage: node .style-mirror/shots.mjs <label>
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4360";
const OUT = "C:/Users/Adam/Documents/Enquiry/wip-2026-10-12/things-ui-shots";
const label = process.argv[2] ?? "before";

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
];

const report = [];
const browser = await chromium.launch();

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
}

async function snap(page, vp, name) {
  await settle(page);
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    const main = document.querySelector("#main");
    return {
      doc: d.scrollWidth - d.clientWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  await page.screenshot({ path: `${OUT}/${name}-${vp.name}-${label}.png` });
  report.push({ name, vp: vp.name, url: page.url().replace(BASE, ""), overflow });
}

async function shoot(page, vp, name, path) {
  await page.goto(`${BASE}${path}`);
  await snap(page, vp, name);
}

async function enquiryHref(page) {
  await page.goto(`${BASE}/enquiries`);
  await settle(page);
  const hrefs = await page.$$eval("a[href*='/enquiries/']", (as) =>
    as.map((a) => a.getAttribute("href")).filter((h) => /\/enquiries\/[^/?#]+/.test(h ?? "")),
  );
  return hrefs[0];
}

async function withPage(vp, fn) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  try {
    await fn(page);
  } finally {
    await ctx.close();
  }
}

async function fillOnboarding(page) {
  await page.goto(`${BASE}/onboarding`);
  await settle(page);
  await page.getByLabel("Business name").fill("Ridge Painting");
  await page.getByLabel("Your first name, for sign-offs").fill("Sam");
  await page.getByLabel("What you do").fill("house painting");
  await page.getByLabel("Where you work from").fill("Newcastle, NSW");
}

// 1. First run, before any business exists: empty states and onboarding.
for (const vp of VIEWPORTS) {
  await withPage(vp, async (page) => {
    await shoot(page, vp, "empty-today", "/today");
    await shoot(page, vp, "empty-enquiries", "/enquiries");
    await fillOnboarding(page);
    await snap(page, vp, "onboarding");
    await page.getByRole("button", { name: "Continue" }).click();
    await snap(page, vp, "onboarding-review");
  });
}

// 2. Create the workspace once, then a practice enquiry.
await withPage(VIEWPORTS[1], async (page) => {
  await fillOnboarding(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await settle(page);
  await page.getByRole("button", { name: /Create my workspace/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/onboarding"), { timeout: 30000 });
  await page.goto(`${BASE}/today`);
  await settle(page);
  await page.getByRole("button", { name: /Try a practice enquiry/ }).click();
  await page.waitForURL(/\/enquiries\/[^/]+/, { timeout: 30000 });
});

// 3. The working screens.
for (const vp of VIEWPORTS) {
  await withPage(vp, async (page) => {
    const enquiry = await enquiryHref(page);
    await shoot(page, vp, "today", "/today");
    await shoot(page, vp, "enquiries", "/enquiries");
    if (enquiry) await shoot(page, vp, "laser", enquiry);
    await shoot(page, vp, "business", "/business");
    await shoot(page, vp, "settings", "/settings");
  });
}

await browser.close();
for (const r of report) console.log(r.name, r.vp, r.url, JSON.stringify(r.overflow));
