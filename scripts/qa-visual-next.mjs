import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
desktop.on("pageerror", (e) => errors.push(`desktop ${e.message}`));
desktop.on("console", (m) => {
  if (m.type() === "error") errors.push(`desktop console ${m.text()}`);
});

await desktop.goto(`${base}/`, { waitUntil: "networkidle" });
await desktop.waitForTimeout(400);
await shot(desktop, "qa-welcome");

await desktop.goto(`${base}/enquiries/f01`, { waitUntil: "networkidle" });
await desktop.waitForTimeout(500);
if (await desktop.getByRole("button", { name: "Got it" }).count()) {
  await desktop.getByRole("button", { name: "Got it" }).click();
  await desktop.waitForTimeout(200);
}
await shot(desktop, "qa-value-exact");

await desktop.goto(`${base}/enquiries/f02`, { waitUntil: "networkidle" });
await desktop.waitForTimeout(400);
await shot(desktop, "qa-value-estimate");

await desktop.goto(`${base}/enquiries/f15`, { waitUntil: "networkidle" });
await desktop.waitForTimeout(400);
await shot(desktop, "qa-value-not-ready");

await desktop.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await desktop.waitForTimeout(400);
await shot(desktop, "qa-desktop-queue");
await desktop.close();

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
mobile.on("pageerror", (e) => errors.push(`mobile ${e.message}`));
mobile.on("console", (m) => {
  if (m.type() === "error") errors.push(`mobile console ${m.text()}`);
});
await mobile.goto(`${base}/`, { waitUntil: "networkidle" });
await mobile.waitForTimeout(400);
await shot(mobile, "qa-welcome-mobile");

await mobile.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await mobile.waitForTimeout(400);
await shot(mobile, "qa-mobile-queue");

await mobile.getByRole("link", { name: /Priya Shah/ }).click();
await mobile.waitForTimeout(400);
if (await mobile.getByRole("button", { name: "Got it" }).count()) {
  await mobile.getByRole("button", { name: "Got it" }).click();
  await mobile.waitForTimeout(200);
}
await shot(mobile, "qa-mobile-f01");
await mobile.getByRole("tab", { name: "Conversation" }).click();
await mobile.waitForTimeout(300);
await shot(mobile, "qa-mobile-workspace");
await mobile.close();

await browser.close();
if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
console.log("visual next qa ok");
