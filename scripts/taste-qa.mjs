import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

function parseRgb(s) {
  const m = String(s).match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
const PAPER = [243, 238, 230];
const MARK = [47, 74, 60];
const INK = [26, 24, 20];

async function colors(page) {
  return page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const html = getComputedStyle(document.documentElement);
    const btn = document.querySelector("button, a.inline-flex, [class*='bg-mark']");
    const primary =
      [...document.querySelectorAll("button, a")].find((el) =>
        /Join|Send quote|Save this/i.test(el.textContent || ""),
      ) ?? btn;
    const tile = document.querySelector("[aria-hidden] svg")?.parentElement;
    return {
      bodyBg: body.backgroundColor,
      htmlBg: html.backgroundColor,
      bodyFg: body.color,
      primaryBg: primary ? getComputedStyle(primary).backgroundColor : null,
      primaryFg: primary ? getComputedStyle(primary).color : null,
      primaryText: primary ? (primary.textContent || "").trim().slice(0, 40) : null,
      tileBg: tile ? getComputedStyle(tile).backgroundColor : null,
    };
  });
}

function assertWarm(label, rgbStr, target, max = 28) {
  const rgb = parseRgb(rgbStr);
  if (!rgb) {
    errors.push(`${label}: unparseable ${rgbStr}`);
    return;
  }
  const d = dist(rgb, target);
  if (d > max) errors.push(`${label}: ${rgbStr} dist ${d.toFixed(1)} from ${target.join(",")}`);
}

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
}

const phone = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
phone.on("pageerror", (e) => errors.push(`phone ${e.message}`));

await phone.goto(`${base}/`, { waitUntil: "networkidle" });
await phone.waitForTimeout(400);
const homeC = await colors(phone);
console.log("home-phone", JSON.stringify(homeC));
assertWarm("home paper", homeC.bodyBg, PAPER);
assertWarm("home join", homeC.primaryBg, MARK, 18);
assertWarm("home tile", homeC.tileBg, MARK, 18);
await shot(phone, "taste-home-phone");

await phone.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await phone.waitForTimeout(400);
await shot(phone, "taste-today");

await phone.goto(`${base}/enquiries/f01`, { waitUntil: "networkidle" });
await phone.waitForTimeout(500);
const jobC = await colors(phone);
console.log("job", JSON.stringify(jobC));
assertWarm("job paper", jobC.bodyBg, PAPER);
assertWarm("job send", jobC.primaryBg, MARK, 18);
const send = phone.getByRole("button", { name: /Send quote/i });
if (!(await send.count())) errors.push("Send quote missing on f01");
await shot(phone, "taste-job");

if (await send.count()) {
  await send.click();
  await phone.waitForTimeout(600);
  await shot(phone, "taste-job-sent");
}

await phone.goto(`${base}/how`, { waitUntil: "networkidle" });
await phone.waitForTimeout(300);
await shot(phone, "taste-how");

await phone.goto(`${base}/roadmap`, { waitUntil: "networkidle" });
await phone.waitForTimeout(400);
await shot(phone, "taste-roadmap");

await phone.goto(`${base}/early-access`, { waitUntil: "networkidle" });
await phone.waitForTimeout(300);
const earlyC = await colors(phone);
console.log("early", JSON.stringify(earlyC));
assertWarm("early join", earlyC.primaryBg, MARK, 18);
await shot(phone, "taste-early");

const desk = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
desk.on("pageerror", (e) => errors.push(`desk ${e.message}`));
await desk.goto(`${base}/`, { waitUntil: "networkidle" });
await desk.waitForTimeout(500);
const deskC = await colors(desk);
console.log("home-desk", JSON.stringify(deskC));
assertWarm("desk paper", deskC.bodyBg, PAPER);
assertWarm("desk join", deskC.primaryBg, MARK, 18);
await shot(desk, "taste-home-desk");

await desk.goto(`${base}/enquiries/f01`, { waitUntil: "networkidle" });
await desk.waitForTimeout(500);
const deskJobC = await colors(desk);
console.log("desk-job", JSON.stringify(deskJobC));
assertWarm("desk send", deskJobC.primaryBg, MARK, 18);
await shot(desk, "taste-job-desk");

await browser.close();
console.log(JSON.stringify({ ok: errors.length === 0, errors }, null, 2));
if (errors.length) process.exit(1);
