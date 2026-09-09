import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

/* Screenshot a local route at a viewport: fold + full. */
const OUT = process.argv[2];
const VP = Number(process.argv[3] || 1440);
/* Git Bash rewrites a bare "/roadmap" argument into a Windows path, so the
   route is passed without its leading slash and normalised here. */
const ROUTE = "/" + String(process.argv[4] || "roadmap").replace(/^.*[/\\]/, "");
const TAG = process.argv[5] || "built";
const BASE = process.argv[6] || "http://127.0.0.1:5271";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: VP, height: VP === 1440 ? 900 : 844 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto(BASE + ROUTE, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, `${TAG}-${VP}-fold.png`) });
await page.evaluate(async () => {
  const H = document.body.scrollHeight;
  for (let y = 0; y < H; y += 700) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 40));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 300));
});
await page.screenshot({ path: path.join(OUT, `${TAG}-${VP}-full.png`), fullPage: true });
const h = await page.evaluate(() => document.body.scrollHeight);
console.log(`${TAG} ${VP} height=${h}`);
await browser.close();
