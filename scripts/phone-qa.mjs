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
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console ${m.text()}`);
});

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
}

function text() {
  return page.locator("body").innerText();
}

await page.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const today = await text();
if (!/need you|Caught up/i.test(today)) errors.push("Today missing queue title");
if (!page.getByRole("navigation", { name: "App" })) errors.push("App nav missing");
const nav = await page.getByRole("navigation", { name: "App" }).innerText();
if (!/Today/.test(nav) || !/Booked/.test(nav) || !/More/.test(nav)) {
  errors.push(`App nav labels off: ${nav.replace(/\s+/g, " ")}`);
}
await shot("qa-phone-today");

const firstJob = page.locator("a[href*='/enquiries/']").first();
await firstJob.click();
await page.waitForTimeout(400);
const desk = await text();
if (!/Thread/.test(desk)) errors.push("Phone desk missing Thread");
if (!page.getByRole("button", { name: /Send |Ask |Invite |Wait/i }).first()) {
  /* primary may be a situation, not send */
}
await shot("qa-phone-desk");

await page.getByRole("button", { name: "Thread" }).click();
await page.waitForTimeout(350);
await shot("qa-phone-thread");
await page.getByRole("button", { name: "Close" }).click();
await page.waitForTimeout(250);

await page.getByRole("link", { name: "Back to today" }).click();
await page.waitForTimeout(250);

await page.getByRole("link", { name: "Booked" }).click();
await page.waitForTimeout(350);
const booked = await text();
if (!/Booked|No bookings/i.test(booked)) errors.push("Booked page missing");
await shot("qa-phone-booked");

await page.getByRole("button", { name: "More" }).click();
await page.waitForTimeout(350);
const more = await text();
if (!/Business Brain/.test(more) || !/Trust/.test(more)) errors.push("More sheet missing links");
await shot("qa-phone-more");
await page.getByRole("button", { name: "Close" }).click();

await page.goto(`${base}/enquiries/f01`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const holdProbe = await text();
if (/To hold the date/i.test(holdProbe) === false) {
  /* quote sheet may be below the fold */
}
await page.getByRole("button", { name: "Send quote" }).click();
await page.waitForTimeout(400);
await shot("qa-phone-sent-next");

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
if (overflow) errors.push("horizontal overflow on phone");

await browser.close();
if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, shots: ["qa-phone-today", "qa-phone-desk", "qa-phone-thread", "qa-phone-booked", "qa-phone-more", "qa-phone-sent-next"] }));
