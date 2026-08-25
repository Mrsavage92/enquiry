import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage });
}

const phone = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
phone.on("pageerror", (e) => errors.push(`phone ${e.message}`));

await phone.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await phone.evaluate(() => sessionStorage.clear());
await phone.reload({ waitUntil: "networkidle" });
await phone.waitForTimeout(400);
await shot(phone, "score-phone-today");

const job = phone.locator("a[href*='/enquiries/']").first();
await job.click();
await phone.waitForTimeout(500);
const jobText = await phone.locator("body").innerText();
if (/\$18[78]/.test(jobText) && /hold/i.test(jobText)) {
  errors.push(`phone job still has $187/$188 hold: ${jobText.match(/\$18\d/g)}`);
}
await shot(phone, "score-phone-job");

await phone.goto(`${base}/roadmap`, { waitUntil: "networkidle" });
await phone.waitForTimeout(500);
const roadPhone = await phone.locator("body").innerText();
if (!/Where this is going/i.test(roadPhone)) errors.push("roadmap hero missing on phone");
if (!/Five businesses first/i.test(roadPhone)) errors.push("rollout missing on phone");
if (!/I need this|You need this/i.test(roadPhone)) errors.push("need-this missing on phone");
await shot(phone, "score-roadmap-phone");
await shot(phone, "score-roadmap-phone-full", true);

await phone.goto(`${base}/onboarding`, { waitUntil: "networkidle" });
await phone.waitForTimeout(400);
const onb = await phone.locator("body").innerText();
if (/Glow & Co/.test(onb)) errors.push("onboarding still prefilled Glow");
if (!/Your business|Your studio/i.test(onb)) errors.push("onboarding not yours");
await shot(phone, "score-onboarding-phone");

const desk = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
desk.on("pageerror", (e) => errors.push(`desk ${e.message}`));
await desk.goto(`${base}/roadmap`, { waitUntil: "networkidle" });
await desk.waitForTimeout(500);
const roadDesk = await desk.locator("body").innerText();
if (!/Where this is going/.test(roadDesk)) errors.push("roadmap hero missing desktop");
if (!/Already/.test(roadDesk)) errors.push("Already era missing");
await shot(desk, "score-roadmap-desk");
await desk.evaluate(() => document.getElementById("already")?.scrollIntoView());
await desk.waitForTimeout(300);
await shot(desk, "score-roadmap-already");

await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("score-qa ok");
