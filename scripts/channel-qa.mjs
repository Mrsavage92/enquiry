import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
}

function listen(page, prefix) {
  page.on("pageerror", (e) => errors.push(`${prefix} ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${prefix} console ${m.text()}`);
  });
}

function has(text, re) {
  return re.test(text);
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
listen(page, "desktop");

await page.addInitScript(() => {
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
});

await page.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const queue = await page.locator("body").innerText();
for (const needle of ["Tash Morello", "A. Patel", "Jordan Hale", "Samira Ott", "jess.k", "Instagram", "Text", "Website form", "Facebook", "Public comment"]) {
  if (!queue.includes(needle)) errors.push(`queue missing ${needle}`);
}
await shot(page, "qa-channel-queue");

await page.goto(`${base}/enquiries/f02`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const f02 = await page.locator("body").innerText();
if (!has(f02, /submitted on the website/i)) errors.push("F02 missing form ledger");
if (!has(f02, /indoor or outdoor/i)) errors.push("F02 missing indoor/outdoor question");
if (!has(f02, /website form/i)) errors.push("F02 missing website form label");
if (!has(f02, /jordan@lumengoods/i)) errors.push("F02 missing email identity");
await shot(page, "qa-channel-f02-form");

await page.goto(`${base}/enquiries/f03`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const f03 = await page.locator("body").innerText();
if (!has(f03, /texts/i)) errors.push("F03 missing Texts thread");
if (!has(f03, /0412 773 091/)) errors.push("F03 missing phone");
if (!has(f03, /ask clean type/i)) errors.push("F03 missing ask");
if (has(f03, /send quote/i)) errors.push("F03 offered a quote");
await shot(page, "qa-channel-f03-sms");

await page.goto(`${base}/enquiries/f18`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const f18 = await page.locator("body").innerText();
if (!has(f18, /instagram/i)) errors.push("F18 missing Instagram thread");
if (!has(f18, /@tash\.moves/i)) errors.push("F18 missing handle");
if (!has(f18, /\$210/)) errors.push("F18 missing $210");
if (!has(f18, /send quote on instagram/i)) errors.push("F18 missing IG send");
if (!has(f18, /formal makeup/i)) errors.push("F18 missing line items");
await shot(page, "qa-channel-f18-ig");
const send = page.getByRole("button", { name: /send quote on instagram/i });
if (await send.count()) {
  await send.click();
  await page.waitForTimeout(500);
  const after = await page.locator("body").innerText();
  if (!has(after, /the quote is with them on instagram/i) && !has(after, /waiting on client/i)) {
    errors.push("F18 send did not move to waiting");
  }
  await shot(page, "qa-channel-f18-sent");
} else {
  errors.push("F18 send button missing");
}

await page.goto(`${base}/enquiries/f19`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const f19 = await page.locator("body").innerText();
if (!has(f19, /facebook/i)) errors.push("F19 missing Facebook thread");
if (!has(f19, /ask how long on facebook/i)) errors.push("F19 missing ask");
if (!has(f19, /collingwood/i)) errors.push("F19 missing venue");
await shot(page, "qa-channel-f19-fb");

await page.goto(`${base}/enquiries/f20`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const f20 = await page.locator("body").innerText();
if (!has(f20, /public comment, not an enquiry/i)) errors.push("F20 missing public-comment situation");
if (!has(f20, /invite them to message/i)) errors.push("F20 missing invite");
if (has(f20, /send quote/i)) errors.push("F20 offered a public quote");
await shot(page, "qa-channel-f20-comment");
await page.getByRole("button", { name: /invite them to message/i }).click();
await page.waitForTimeout(500);
const invited = await page.locator("body").innerText();
if (!has(invited, /waiting for a message/i) && !has(invited, /waiting on client/i)) {
  errors.push("F20 invite did not wait for a DM");
}
if (!has(invited, /public reply/i) && !has(invited, /don.t price in comments/i)) {
  errors.push("F20 invite reply missing");
}
await shot(page, "qa-channel-f20-invited");

await page.goto(`${base}/settings`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const settings = await page.locator("body").innerText();
if (!has(settings, /how work arrives/i)) errors.push("Settings missing How work arrives");
if (!has(settings, /instagram/i)) errors.push("Settings missing Instagram");
if (!has(settings, /text/i)) errors.push("Settings missing Text");
await shot(page, "qa-channel-settings");

await page.goto(`${base}/trust/access`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const access = await page.locator("body").innerText();
if (!has(access, /public comments are not quotes/i)) errors.push("Access missing social copy");
if (!has(access, /connect text/i) && !has(access, /connect facebook/i)) {
  errors.push("Access missing connect for disconnected channel");
}
await shot(page, "qa-channel-access");

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
listen(mobile, "mobile");
await mobile.addInitScript(() => {
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
});
await mobile.goto(`${base}/enquiries/f18`, { waitUntil: "networkidle" });
await mobile.waitForTimeout(400);
await shot(mobile, "qa-channel-f18-mobile");
await mobile.goto(`${base}/enquiries/f03`, { waitUntil: "networkidle" });
await mobile.waitForTimeout(400);
await shot(mobile, "qa-channel-f03-mobile");
await mobile.goto(`${base}/enquiries/f20`, { waitUntil: "networkidle" });
await mobile.waitForTimeout(400);
await shot(mobile, "qa-channel-f20-mobile");
await mobile.close();

await browser.close();
if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
console.log("channel qa ok");
