import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
}

async function run(viewport, prefix) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(`${prefix} ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${prefix} console ${m.text()}`);
  });

  await page.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await shot(page, `${prefix}-queue`);

  if (viewport.width >= 900) {
    await page.getByRole("button", { name: "Send quote" }).first().click();
    await page.waitForTimeout(300);
    await shot(page, `${prefix}-f01-sent`);
  } else {
    await page.getByRole("link", { name: /Priya Shah/ }).click();
    await page.waitForTimeout(300);
    await shot(page, `${prefix}-f01`);
  }

  await page.goto(`${base}/enquiries/f03`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const body = await page.locator("body").innerText();
  if (/\$\d{2,}/.test(body) && body.includes("A. Patel") && /Send quote/i.test(body)) {
    errors.push(`${prefix} F03 offered a quote`);
  }
  if (!/Not quotable/i.test(body) && !/Ask clean type/i.test(body)) {
    errors.push(`${prefix} F03 missing blocking question`);
  }
  await shot(page, `${prefix}-f03`);

  await page.goto(`${base}/enquiries/f09`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Correct Service" }).click();
  await page.getByRole("button", { name: "Event coverage" }).click();
  await page.waitForTimeout(300);
  await shot(page, `${prefix}-f09-corrected`);
  const after = await page.locator("body").innerText();
  if (!/Event coverage/i.test(after)) errors.push(`${prefix} F09 did not update service`);
  if (await page.getByRole("button", { name: "Teach Enquiry" }).count()) {
    await page.getByRole("button", { name: "Teach Enquiry" }).click();
  }

  await page.goto(`${base}/enquiries/f10`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await shot(page, `${prefix}-f10`);
  const f10 = await page.locator("body").innerText();
  if (/you're available|week of 7 September is free/i.test(f10) && /Unknown/i.test(f10) === false) {
    errors.push(`${prefix} F10 claimed availability`);
  }

  await page.goto(`${base}/business`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await shot(page, `${prefix}-business`);

  await page.goto(`${base}/trust`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await shot(page, `${prefix}-trust`);

  await page.close();
}

await run({ width: 1280, height: 800 }, "qa-desktop");
await run({ width: 390, height: 844 }, "qa-mobile");
await browser.close();
if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
console.log("QA ok");
