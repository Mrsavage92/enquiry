import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:5274";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const readState = async (label) => {
  const s = await page.evaluate(() => ({
    dataSite: document.documentElement.getAttribute("data-site"),
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
  }));
  console.log(label, JSON.stringify(s));
  return s;
};

console.log("--- SPA transition: /demo -> click 'Already invited? Sign in' -> /login ---");
await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await readState("on /demo (hard load)");

await page.click('a:has-text("Already invited? Sign in")');
await page.waitForURL(/\/login/);
await page.waitForTimeout(800);
await readState("on /login (after SPA nav from /demo)");

console.log("\n--- SPA transition: /login -> click Wordmark -> / ---");
await page.click('main a[href="/"]');
await page.waitForURL((u) => u.pathname === "/");
await page.waitForTimeout(800);
await readState("on / (after SPA nav from /login)");
console.log("  url:", page.url(), " title:", await page.title());
console.log("  has <header class=mk-nav>:", await page.locator("header.mk-nav").count());
console.log(
  "  h1 text:",
  await page
    .locator("h1")
    .first()
    .textContent()
    .catch(() => "(none)"),
);
await page.screenshot({
  path: "C:/Users/Adam/AppData/Local/Temp/claude/c--Users-Adam--claude-projects/5a73410e-c57f-46e2-b844-9b0bb6652e49/scratchpad/transition-bug.png",
});

await page.waitForTimeout(1500);
await readState("on / (after SPA nav from /login) +1.5s more");

console.log("\n--- Hard load /login directly ---");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await readState("on /login (hard load, fresh context)");

console.log("\n--- SPA transition: / -> /signup via direct goto then check, then back to / ---");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await readState("on / (hard load)");
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await readState("on /signup (hard load)");

await browser.close();
console.log("\ndone");
