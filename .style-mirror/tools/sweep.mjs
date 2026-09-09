import { chromium } from "playwright";
import fs from "node:fs";

const WIDTHS = [390, 480, 560, 640, 700, 768, 860, 900, 1024, 1100, 1140, 1200, 1280, 1360, 1440];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("https://linear.app", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);
const rows = [];
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(700);
  rows.push(
    await page.evaluate((w) => {
      const cs = getComputedStyle(document.documentElement);
      const h1 = document.querySelector("h1");
      const hs = h1 ? getComputedStyle(h1) : {};
      const hr = h1?.getBoundingClientRect();
      const hd = document.querySelector("header");
      const wrap = document.querySelector("._7bwwmq_root, [class*=homepage]");
      const ws = wrap ? getComputedStyle(wrap) : {};
      const sec = [...document.querySelectorAll("section")].find(
        (e) => e.className && String(e.className).includes("b-30Va_root"),
      );
      const hdr = sec?.querySelector("[class*=header]");
      const lede = [...document.querySelectorAll("p")].find((p) =>
        (p.textContent || "").includes("Purpose-built"),
      );
      const sec2 = sec ? getComputedStyle(sec) : {};
      const h2 = sec?.querySelector("h2");
      return {
        w,
        outerPad: cs.getPropertyValue("--homepage-outer-padding").trim(),
        inset: cs.getPropertyValue("--homepage-padding-inset").trim(),
        maxW: cs.getPropertyValue("--homepage-max-width").trim(),
        headerH: cs.getPropertyValue("--header-height").trim(),
        headerBox: hd ? Math.round(hd.getBoundingClientRect().height) : null,
        wrapPad: ws.paddingLeft,
        wrapMaxW: ws.maxWidth,
        h1fs: hs.fontSize,
        h1ls: hs.letterSpacing,
        h1lh: hs.lineHeight,
        h1x: hr ? Math.round(hr.left) : null,
        ledeFs: lede ? getComputedStyle(lede).fontSize : null,
        ledeX: lede ? Math.round(lede.getBoundingClientRect().left) : null,
        secPad: sec2.padding,
        secHdrPad: hdr ? getComputedStyle(hdr).padding : null,
        h2fs: h2 ? getComputedStyle(h2).fontSize : null,
        h2ls: h2 ? getComputedStyle(h2).letterSpacing : null,
        h2lh: h2 ? getComputedStyle(h2).lineHeight : null,
      };
    }, w),
  );
}
await b.close();
fs.writeFileSync(process.argv[2], JSON.stringify(rows, null, 2));
for (const r of rows)
  console.log(
    `${String(r.w).padStart(4)} pad=${r.outerPad} inset=${r.inset} maxW=${r.maxW} hdr=${r.headerH}/${r.headerBox} wrapPad=${r.wrapPad} h1=${r.h1fs}/${r.h1ls}/${r.h1lh} x=${r.h1x} lede=${r.ledeFs}@${r.ledeX} sec=${r.secPad} secHdr=${r.secHdrPad} h2=${r.h2fs}/${r.h2ls}/${r.h2lh}`,
  );
