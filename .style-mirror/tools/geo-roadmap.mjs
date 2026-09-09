import { chromium } from "playwright";
const VP = Number(process.argv[2] || 390);
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: VP, height: VP === 1440 ? 900 : 844 }, deviceScaleFactor: 1 });
const p = await c.newPage();
await p.goto("http://127.0.0.1:5271/roadmap", { waitUntil: "networkidle", timeout: 60000 });
await p.waitForTimeout(2000);
const out = await p.evaluate(() => {
  const bx = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
  const first = document.querySelector(".mk-entry");
  const label = first.querySelector(".mk-entry-date");
  const num = first.querySelector(".mk-entry-aside p:last-child");
  const title = first.querySelector(".mk-entry-title");
  const g = (e) => { const r = e.getBoundingClientRect(); return { y: Math.round(r.top + scrollY), h: Math.round(r.height), x: Math.round(r.left) }; };
  return {
    h1: bx("main h1"),
    nav: bx('nav[aria-label="Roadmap stages"]'),
    headerDivider: bx('.mk-divider[data-divider="header"]'),
    firstEntry: g(first),
    label: g(label),
    number: num ? g(num) : null,
    title: g(title),
    labelToTitle: g(title).y - (g(label).y + g(label).h),
    docHeight: document.body.scrollHeight,
    entries: [...document.querySelectorAll(".mk-entry")].map((e) => g(e)),
  };
});
console.log(VP, JSON.stringify(out, null, 1));
await b.close();
