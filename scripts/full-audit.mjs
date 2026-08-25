import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:8080";
const out = "/workspace/screenshots/audit";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const notes = [];

async function makePage({ width, height, mobile }) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  page.on("pageerror", (e) => errors.push(`${width} ${e.message}`));
  if (mobile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 59, bottom: 34, left: 0, right: 0, topMax: 59, bottomMax: 34 },
    });
  }
  return page;
}

async function measure(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".app-root");
    const nav = document.querySelector(".app-nav");
    const site = document.querySelector("header.site-nav");
    const rr = root?.getBoundingClientRect();
    const nr = nav?.getBoundingClientRect();
    const issues = [];
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
      issues.push(`h-overflow ${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth}`);
    }
    if (root && rr) {
      if (Math.round(rr.top) > 1) issues.push(`app-root top ${Math.round(rr.top)}`);
      if (Math.round(window.innerHeight - rr.bottom) > 2) {
        issues.push(`app-root bottom gap ${Math.round(window.innerHeight - rr.bottom)}`);
      }
    }
    if (nav && nr) {
      if (Math.round(window.innerHeight - nr.bottom) > 2) {
        issues.push(`nav bottom gap ${Math.round(window.innerHeight - nr.bottom)}`);
      }
    }
    const overflowing = [];
    document.querySelectorAll("h1, h2, p, button, a, td, th, li").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      if (r.right > window.innerWidth + 2) overflowing.push(el.tagName + ":" + (el.textContent || "").slice(0, 24));
    });
    if (overflowing.length) issues.push(`clip-right ${overflowing.slice(0, 4).join(" | ")}`);
    const tiny = [];
    document.querySelectorAll("button, a, [role='button']").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.width === 0) return;
      if (r.height < 36 && r.width < 36) tiny.push((el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 20));
    });
    return {
      path: location.pathname,
      title: document.title,
      inner: [window.innerWidth, window.innerHeight],
      appH: rr ? Math.round(rr.height) : null,
      navBottom: nr ? Math.round(nr.bottom) : null,
      sitePad: site ? getComputedStyle(site).paddingTop : null,
      h1: document.querySelector("h1")?.textContent?.trim().slice(0, 60) || null,
      issues,
      tiny: tiny.slice(0, 6),
    };
  });
}

const phonePages = [
  ["home", "/"],
  ["how", "/how"],
  ["roadmap", "/roadmap"],
  ["updates", "/updates"],
  ["early", "/early-access"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
  ["onboarding", "/onboarding"],
  ["enquiries", "/enquiries"],
  ["enquiry-f01", "/enquiries/f01"],
  ["bookings", "/bookings"],
  ["insights", "/insights"],
  ["business", "/business"],
  ["trust", "/trust"],
  ["trust-access", "/trust/access"],
  ["trust-audit", "/trust/audit"],
  ["trust-auto", "/trust/automation"],
  ["settings", "/settings"],
  ["lab", "/lab"],
  ["quote-f01", "/q/f01"],
  ["book-b3", "/book/b3"],
];

const phone = await makePage({ width: 390, height: 844, mobile: true });
const report = [];

for (const [name, path] of phonePages) {
  await phone.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 20000 });
  await phone.waitForTimeout(350);
  const m = await measure(phone);
  await phone.screenshot({ path: `${out}/p-${name}.png`, animations: "disabled" });
  report.push({ name, ...m });
  if (m.issues.length) notes.push(`PHONE ${name}: ${m.issues.join("; ")}`);
}

// Bookings views
await phone.goto(`${base}/bookings`, { waitUntil: "networkidle" });
await phone.waitForTimeout(300);
for (const label of ["Week", "Month"]) {
  const tab = phone.getByRole("tab", { name: label }).or(phone.getByRole("button", { name: label }));
  if (await tab.count()) {
    await tab.first().click();
    await phone.waitForTimeout(250);
    await phone.screenshot({ path: `${out}/p-bookings-${label.toLowerCase()}.png`, animations: "disabled" });
  }
}

// More sheet
await phone.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await phone.waitForTimeout(250);
const more = phone.getByRole("button", { name: "More" });
if (await more.count()) {
  await more.first().click();
  await phone.waitForTimeout(300);
  await phone.screenshot({ path: `${out}/p-more.png`, animations: "disabled" });
  await phone.keyboard.press("Escape");
}

// Job sheet on bookings
await phone.goto(`${base}/bookings?job=b4`, { waitUntil: "networkidle" });
await phone.waitForTimeout(400);
await phone.screenshot({ path: `${out}/p-job-sheet.png`, animations: "disabled" });

await phone.close();

const desk = await makePage({ width: 1280, height: 800, mobile: false });
const deskPages = [
  ["home", "/"],
  ["how", "/how"],
  ["roadmap", "/roadmap"],
  ["enquiries", "/enquiries"],
  ["enquiry-f01", "/enquiries/f01"],
  ["bookings", "/bookings"],
  ["insights", "/insights"],
  ["business", "/business"],
  ["trust", "/trust"],
  ["settings", "/settings"],
];
for (const [name, path] of deskPages) {
  await desk.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 20000 });
  await desk.waitForTimeout(350);
  const m = await measure(desk);
  await desk.screenshot({ path: `${out}/d-${name}.png`, animations: "disabled" });
  report.push({ name: `desk-${name}`, ...m });
  if (m.issues.length) notes.push(`DESK ${name}: ${m.issues.join("; ")}`);
}
await desk.close();

console.log(JSON.stringify({ notes, errors, report }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
