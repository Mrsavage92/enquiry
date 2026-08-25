import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

async function audit(name, url) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(400);
  const shot = `/workspace/screenshots/phone-opt-${name}.png`;
  await page.screenshot({ path: shot, fullPage: false });
  const info = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth;
    const overflowY = Math.max(doc.scrollHeight, body.scrollHeight);
    const small = [...document.querySelectorAll("button, a, [role='button']")].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      if (r.bottom < 0 || r.top > innerHeight) return false;
      return r.height < 40 || r.width < 40;
    }).slice(0, 12).map((el) => ({
      t: (el.innerText || el.getAttribute("aria-label") || el.tagName).slice(0, 40),
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
    }));
    const vw = window.innerWidth;
    const tooWide = [...document.querySelectorAll("*")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > vw + 8 && r.left < vw;
    }).slice(0, 8).map((el) => ({
      t: el.tagName + "." + (el.className || "").toString().slice(0, 60),
      w: Math.round(el.getBoundingClientRect().width),
    }));
    return {
      title: document.title,
      overflowX,
      scrollHeight: overflowY,
      innerH: window.innerHeight,
      small,
      tooWide,
      text: document.body.innerText.slice(0, 400),
    };
  });
  console.log("\n==", name, url);
  console.log(JSON.stringify(info, null, 2));
  return info;
}

const results = {};
results.home = await audit("home", "http://127.0.0.1:8080/");
results.early = await audit("early", "http://127.0.0.1:8080/early-access");
results.roadmap = await audit("roadmap", "http://127.0.0.1:8080/roadmap");
results.today = await audit("today", "http://127.0.0.1:8080/enquiries");
results.job = await audit("job", "http://127.0.0.1:8080/enquiries/f01");
results.bookings = await audit("bookings", "http://127.0.0.1:8080/bookings");
results.how = await audit("how", "http://127.0.0.1:8080/how");

writeFileSync("/workspace/screenshots/phone-opt.json", JSON.stringify(results, null, 2));
await browser.close();
console.log("\nDONE");
