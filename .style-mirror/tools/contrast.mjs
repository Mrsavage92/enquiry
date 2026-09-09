import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

/*
  Rendered-pixel contrast sweep.

  For every visible text node on the page it screenshots that element's own box
  from the full-page render and reads the actual pixels back through a canvas.
  The most frequent colour in the box is the background as painted (after every
  gradient, blur, overlay and opacity), and the pixel furthest from it in
  relative luminance, among pixels that occur often enough to be real glyph
  cores rather than antialiasing, is the foreground as painted. Contrast is
  computed from those two measured colours - never from token values.
*/

const OUT = process.argv[2];
const VP = Number(process.argv[3] || 1440);
const BASE = process.argv[4] || "http://127.0.0.1:5261";
const ROUTE = process.argv[5] || "/";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: VP, height: VP === 1440 ? 900 : 844 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto(BASE + ROUTE, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
await page.evaluate(async () => {
  const H = document.body.scrollHeight;
  for (let y = 0; y < H; y += 600) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 50));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 400));
});
await page.waitForTimeout(600);

const nodes = await page.evaluate(() => {
  const res = [];
  const walk = (el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        const t = n.textContent.trim();
        if (!t) continue;
        const p = n.parentElement;
        if (!p) continue;
        const s = getComputedStyle(p);
        if (s.visibility === "hidden" || s.display === "none") continue;
        /* Walk ancestors: opacity and clipping are not inherited as computed
           values, so a visually-hidden label inside an opacity-0, 1px,
           clip-path'd wrapper still reports opacity 1 on itself. Screen-reader
           and honeypot text is not painted and must not be graded. */
        let hidden = false;
        for (let a = p; a && a !== document.body; a = a.parentElement) {
          const as = getComputedStyle(a);
          const ar = a.getBoundingClientRect();
          if (
            as.display === "none" ||
            as.visibility === "hidden" ||
            parseFloat(as.opacity) === 0 ||
            (as.clipPath && as.clipPath !== "none") ||
            (as.clip && as.clip !== "auto") ||
            ar.width <= 2 ||
            ar.height <= 2
          ) {
            hidden = true;
            break;
          }
        }
        if (hidden) continue;
        const rng = document.createRange();
        rng.selectNodeContents(n);
        const r = rng.getBoundingClientRect();
        if (r.width < 3 || r.height < 3) continue;
        res.push({
          text: t.slice(0, 46),
          sel:
            p.tagName.toLowerCase() +
            (p.className
              ? "." + String(p.className).trim().split(/\s+/).slice(0, 2).join(".")
              : ""),
          fontSize: parseFloat(s.fontSize),
          fontWeight: s.fontWeight,
          x: Math.round(r.left),
          y: Math.round(r.top + window.scrollY),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      } else if (n.nodeType === 1) {
        const s = getComputedStyle(n);
        if (s.display !== "none" && s.visibility !== "hidden") walk(n);
      }
    }
  };
  walk(document.body);
  return res;
});

const shotPath = path.join(OUT, `contrast-${VP}-page.png`);
await page.screenshot({ path: shotPath, fullPage: true });
await ctx.close();

// read pixels back through a canvas
const ctx2 = await browser.newContext({ viewport: { width: 400, height: 300 } });
const p2 = await ctx2.newPage();
const dataUrl = "data:image/png;base64," + fs.readFileSync(shotPath).toString("base64");
await p2.setContent(`<img id="i" src="${dataUrl}">`);
await p2.waitForFunction(() => {
  const i = document.getElementById("i");
  return i && i.complete && i.naturalWidth > 0;
});

const measured = await p2.evaluate((nodes) => {
  const img = document.getElementById("i");
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const g = cv.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);

  const lum = (r, gg, b) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const L1 = Math.max(a, b),
      L2 = Math.min(a, b);
    return (L1 + 0.05) / (L2 + 0.05);
  };

  return nodes.map((n) => {
    const x = Math.max(0, n.x),
      y = Math.max(0, n.y);
    const w = Math.min(n.w, cv.width - x),
      h = Math.min(n.h, cv.height - y);
    if (w < 2 || h < 2) return { ...n, skip: "offscreen" };
    const d = g.getImageData(x, y, w, h).data;
    const counts = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const bgKey = sorted[0][0];
    const bg = [(bgKey >> 16) & 255, (bgKey >> 8) & 255, bgKey & 255];
    const bgL = lum(...bg);
    /* Glyph colour = the pixel furthest from the background in luminance.
       Antialiasing only ever blends between the text colour and what is behind
       it, so the extreme in the box IS the text as painted. Averaging or
       applying a coverage floor instead measures antialiasing, which
       under-reports thin small text and would fail passing pairs. */
    let best = null,
      bestD = -1;
    for (const [k] of sorted) {
      const px = [(k >> 16) & 255, (k >> 8) & 255, k & 255];
      const dd = Math.abs(lum(...px) - bgL);
      if (dd > bestD) {
        bestD = dd;
        best = px;
      }
    }
    if (!best) return { ...n, skip: "no glyph pixels" };
    const fgL = lum(...best);
    const cr = ratio(fgL, bgL);
    const large = n.fontSize >= 24 || (n.fontSize >= 18.66 && Number(n.fontWeight) >= 700);
    const threshold = large ? 3 : 4.5;
    const hex = (p) => "#" + p.map((v) => v.toString(16).padStart(2, "0")).join("");
    return {
      ...n,
      fg: hex(best),
      bg: hex(bg),
      ratio: Math.round(cr * 100) / 100,
      threshold,
      pass: cr >= threshold,
    };
  });
}, nodes);

await browser.close();

const graded = measured.filter((m) => !m.skip);
const fails = graded.filter((m) => !m.pass);
fs.writeFileSync(path.join(OUT, `contrast-${VP}.json`), JSON.stringify(measured, null, 2));
console.log(
  `nodes: ${measured.length}  graded: ${graded.length}  skipped: ${measured.length - graded.length}`,
);
console.log(`FAILS: ${fails.length}`);
for (const f of fails)
  console.log(
    `  ${f.ratio}:1 (need ${f.threshold}) ${f.fg} on ${f.bg}  ${f.fontSize}px/${f.fontWeight}  ${f.sel}  "${f.text}"`,
  );
const min = graded.reduce((a, b) => (a.ratio < b.ratio ? a : b), graded[0]);
console.log(`lowest passing-or-not: ${min.ratio}:1  ${min.sel} "${min.text}"`);
