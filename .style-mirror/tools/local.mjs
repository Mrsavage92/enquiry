import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2];
const TAG = process.argv[3] || "local";
const BASE = process.argv[4] || "http://127.0.0.1:5261";
const ROUTE = process.argv[5] || "/";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const out = {};

for (const vp of [
  { w: 1440, h: 900, tag: "1440" },
  { w: 390, h: 844, tag: "390" },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errs.push("PAGEERROR " + String(e).slice(0, 200)));
  await page.goto(BASE + ROUTE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  // settle scroll reveals
  await page.evaluate(async () => {
    const H = document.body.scrollHeight;
    for (let y = 0; y < H; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
  await page.waitForTimeout(800);

  out[vp.tag] = await page.evaluate(() => {
    const g = (el, label) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        label,
        tag: el.tagName,
        cls: String(el.className || "").slice(0, 90),
        txt: (el.textContent || "").trim().slice(0, 44),
        color: s.color,
        bg: s.backgroundColor,
        bgImage: s.backgroundImage.slice(0, 160),
        ff: s.fontFamily.split(",")[0],
        fw: s.fontWeight,
        fs: s.fontSize,
        ls: s.letterSpacing,
        lh: s.lineHeight,
        tt: s.textTransform,
        pad: s.padding,
        mar: s.margin,
        r: s.borderRadius,
        bw: s.borderWidth,
        bc: s.borderColor,
        bt: s.borderTopWidth + " " + s.borderTopColor,
        sh: s.boxShadow.slice(0, 120),
        mw: s.maxWidth,
        gap: s.gap,
        bf: s.backdropFilter,
        pos: s.position,
        w: Math.round(r.width),
        h: Math.round(r.height),
        x: Math.round(r.left),
        y: Math.round(r.top + window.scrollY),
      };
    };
    const o = {};
    o.html = g(document.documentElement, "html");
    o.body = g(document.body, "body");
    o.header = g(document.querySelector("header"), "header");
    o.h1 = g(document.querySelector("h1"), "h1");
    o.h2 = [...document.querySelectorAll("h2")].slice(0, 5).map((e, i) => g(e, "h2_" + i));
    o.h3 = [...document.querySelectorAll("h3")].slice(0, 4).map((e, i) => g(e, "h3_" + i));
    o.lede = g(document.querySelector(".site-lede, .mk-lede"), "lede");
    o.eyebrow = g(document.querySelector(".eyebrow, .mk-eyebrow"), "eyebrow");
    o.navLinks = [...document.querySelectorAll("header nav a")]
      .slice(0, 6)
      .map((e, i) => g(e, "nav_" + i));
    o.navCta = g(
      [...document.querySelectorAll("header a")].find((a) => /Join/.test(a.textContent || "")),
      "navCta",
    );
    o.sections = [...document.querySelectorAll("main > section, main section")]
      .slice(0, 14)
      .map((e, i) => g(e, "section_" + i));
    o.footer = g(document.querySelector("footer"), "footer");
    o.footerLink = g(document.querySelector("footer a"), "footerLink");
    o.buttons = [...document.querySelectorAll("button, a[class*=btn], main a[class*=inline-flex]")]
      .filter((e) => e.getBoundingClientRect().height > 24)
      .slice(0, 8)
      .map((e, i) => g(e, "btn_" + i));
    o.input = g(document.querySelector("input[type=email]"), "input");
    o.mediaFrames = [...document.querySelectorAll("[class*=Frame], .mk-media, [class*=frame]")]
      .slice(0, 4)
      .map((e, i) => g(e, "media_" + i));
    o.demo = g(document.querySelector("[class*=live-phone], #demo, [data-demo]"), "demo");
    // every visible text node for the contrast sweep
    o.textNodes = (() => {
      const res = [];
      const walk = (el) => {
        for (const n of el.childNodes) {
          if (n.nodeType === 3 && n.textContent.trim().length > 0) {
            const p = n.parentElement;
            if (!p) continue;
            const s = getComputedStyle(p);
            const r = p.getBoundingClientRect();
            if (r.width < 4 || r.height < 4 || s.visibility === "hidden" || s.display === "none")
              continue;
            if (parseFloat(s.opacity) < 0.05) continue;
            res.push({
              text: n.textContent.trim().slice(0, 40),
              color: s.color,
              fs: parseFloat(s.fontSize),
              fw: s.fontWeight,
              x: Math.round(r.left + Math.min(r.width / 2, 40)),
              y: Math.round(r.top + window.scrollY + r.height / 2),
              vx: Math.round(r.left),
              vy: Math.round(r.top + window.scrollY),
              w: Math.round(r.width),
              h: Math.round(r.height),
              sel: p.tagName + "." + String(p.className || "").split(" ")[0],
            });
          } else if (n.nodeType === 1) walk(n);
        }
      };
      walk(document.body);
      return res;
    })();
    o.docHeight = document.body.scrollHeight;
    return o;
  });
  out[vp.tag].consoleErrors = errs;

  await page.screenshot({ path: path.join(OUT, `${TAG}-${vp.tag}-fold.png`) });
  await page.screenshot({ path: path.join(OUT, `${TAG}-${vp.tag}.png`), fullPage: true });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, `${TAG}-probe.json`), JSON.stringify(out, null, 2));
console.log(
  "ok",
  TAG,
  "1440 textNodes:",
  out["1440"].textNodes.length,
  "errors:",
  JSON.stringify(out["1440"].consoleErrors.slice(0, 3)),
);
