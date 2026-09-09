import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:5274";
const N = Number(process.argv[3] || 5);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

let fails = 0;
for (let i = 0; i < N; i++) {
  await page.goto(`${BASE}/demo`, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.click('a:has-text("Already invited? Sign in")');
  await page.waitForURL(/\/login/, { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.click('main a[href="/"]');
  await page.waitForURL((u) => u.pathname === "/", { timeout: 15000 });
  await page.waitForTimeout(800);
  const s = await page.evaluate(() => ({
    dataSite: document.documentElement.getAttribute("data-site"),
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
  }));
  const ok = s.dataSite === "marketing" && s.themeColor === "#08090a";
  if (!ok) fails++;
  console.log(`run ${i + 1}: ${ok ? "OK" : "FAIL"} ${JSON.stringify(s)}`);
}
await ctx.close();
await browser.close();
console.log(`\n${fails}/${N} failed`);
