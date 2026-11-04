// Rendered contrast sweep: every visible text element on each in-app screen,
// measured against the first opaque background behind it (alpha composited).
// usage: node .style-mirror/contrast-sweep.mjs   (server on :4360, workspace already set up)
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4360";
const PATHS = ["/today", "/enquiries", "/business", "/settings", "/more", "/account"];

const browser = await chromium.launch();
const pairs = new Map();
const failures = [];

for (const width of [390, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
  await page.goto(`${BASE}/enquiries`);
  await page.waitForLoadState("networkidle");
  const enquiry = await page.$$eval("a[href*='/enquiries/']", (as) =>
    as.map((a) => a.getAttribute("href")).find((h) => /\/enquiries\/[^/?#]+/.test(h ?? "")),
  );
  for (const path of [...PATHS, ...(enquiry ? [enquiry] : [])]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    const found = await page.evaluate(() => {
      const parse = (c) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const [r, g, b, a = 1] = m[1]
          .split(/[ ,/]+/)
          .filter(Boolean)
          .map(Number);
        return { r, g, b, a };
      };
      const over = (top, under) => ({
        r: top.r * top.a + under.r * (1 - top.a),
        g: top.g * top.a + under.g * (1 - top.a),
        b: top.b * top.a + under.b * (1 - top.a),
        a: 1,
      });
      const bgOf = (el) => {
        const layers = [];
        for (let n = el; n; n = n.parentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c.a > 0) {
            layers.push(c);
            if (c.a >= 1) break;
          }
        }
        let acc = { r: 255, g: 255, b: 255, a: 1 };
        for (const l of layers.reverse()) acc = over(l, acc);
        return acc;
      };
      const lum = ({ r, g, b }) =>
        [r, g, b]
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const hex = ({ r, g, b }) =>
        "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const el = t.parentElement;
        if (!el || seen.has(el) || !t.textContent.trim()) continue;
        seen.add(el);
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || el.closest(".sr-only"))
          continue;
        if (Number(cs.opacity) < 1) continue;
        const fgRaw = parse(cs.color);
        if (!fgRaw) continue;
        const bg = bgOf(el);
        const fg = fgRaw.a < 1 ? over(fgRaw, bg) : fgRaw;
        const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
        const ratio = (hi + 0.05) / (lo + 0.05);
        const size = parseFloat(cs.fontSize);
        const weight = Number(cs.fontWeight);
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        out.push({
          fg: hex(fg),
          bg: hex(bg),
          ratio: Math.round(ratio * 100) / 100,
          large,
          text: t.textContent.trim().slice(0, 40),
        });
      }
      return out;
    });
    for (const f of found) {
      const key = `${f.fg} on ${f.bg}`;
      const prev = pairs.get(key);
      if (!prev) pairs.set(key, { ...f, where: `${path}@${width}` });
      if (f.ratio < (f.large ? 3 : 4.5)) failures.push({ ...f, where: `${path}@${width}` });
    }
  }
  await page.close();
}
await browser.close();

console.log("PAIRS");
for (const [key, p] of [...pairs].sort((a, b) => a[1].ratio - b[1].ratio))
  console.log(`${p.ratio.toFixed(2)}  ${key}  "${p.text}"  ${p.where}`);
console.log(`FAILURES ${failures.length}`);
for (const f of failures) console.log(`${f.ratio} ${f.fg} on ${f.bg} "${f.text}" ${f.where}`);
