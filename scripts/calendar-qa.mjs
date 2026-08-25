import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

async function run(name, options, fn) {
  const page = await browser.newPage(options);
  page.on("pageerror", (e) => errors.push(`${name} pageerror ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${name} console ${m.text()}`);
  });
  try {
    await fn(page);
  } catch (e) {
    errors.push(`${name} ${e instanceof Error ? e.message : String(e)}`);
  }
  await page.close();
}

function shot(page, file) {
  return page.screenshot({ path: `/workspace/screenshots/${file}.png`, fullPage: false });
}

await run(
  "phone",
  { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  async (page) => {
    await page.goto(`${base}/bookings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const text = await page.locator("body").innerText();
    if (!/Booked/.test(text)) errors.push("phone missing Booked title");
    if (!/West End Community Hall/.test(text)) errors.push("phone missing today's hall job");
    if (!/Day/.test(text) || !/Week/.test(text) || !/Month/.test(text)) errors.push("phone missing view switcher");
    await shot(page, "cal-phone-day");

    await page.getByRole("button", { name: /West End Community Hall/ }).click();
    await page.waitForTimeout(400);
    const sheet = await page.locator("body").innerText();
    if (!/Move time/.test(sheet)) errors.push("phone job sheet missing Move time");
    if (!/7:30am/.test(sheet) && !/7:30/.test(sheet)) errors.push("phone job sheet missing start time");
    await shot(page, "cal-phone-job");
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(250);

    await page.getByRole("tab", { name: "Week" }).click();
    await page.waitForTimeout(350);
    const week = await page.locator("body").innerText();
    if (!/Claire Hart|Sofia Almeida|Parkside/.test(week)) errors.push("phone week missing later jobs");
    await shot(page, "cal-phone-week");

    await page.getByRole("tab", { name: "Month" }).click();
    await page.waitForTimeout(350);
    const month = await page.locator("body").innerText();
    if (!/August/.test(month) && !/September/.test(month)) errors.push("phone month missing month label");
    await shot(page, "cal-phone-month");

    await page.getByRole("tab", { name: "Day" }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: /Sat 29/i }).click();
    await page.waitForTimeout(300);
    const sat = await page.locator("body").innerText();
    if (!/Sofia Almeida/.test(sat)) errors.push("phone Saturday missing Sofia");
    await shot(page, "cal-phone-sat");
  },
);

await run(
  "desk",
  { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  async (page) => {
    await page.goto(`${base}/bookings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const text = await page.locator("body").innerText();
    if (!/Bookings|Booked/.test(text)) errors.push("desk missing title");
    if (!/West End Community Hall/.test(text)) errors.push("desk missing hall job");
    await shot(page, "cal-desk-day");

    await page.getByRole("tab", { name: "Week" }).click();
    await page.waitForTimeout(400);
    await shot(page, "cal-desk-week");

    await page.getByRole("tab", { name: "Month" }).click();
    await page.waitForTimeout(400);
    await shot(page, "cal-desk-month");

    await page.goto(`${base}/bookings?on=2026-08-27&job=b4`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const job = await page.locator("body").innerText();
    if (!/Claire Hart/.test(job)) errors.push("desk deep link missing Claire");
    if (!/Record the hold/.test(job)) errors.push("desk hold CTA missing");
    await shot(page, "cal-desk-hold");
  },
);

await browser.close();
if (errors.length) {
  console.error("FAIL");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log("calendar qa ok");
