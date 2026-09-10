import { chromium } from "playwright";
import fs from "node:fs";

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const out = {};

for (const vp of [
  { w: 1440, h: 900, tag: "1440" },
  { w: 390, h: 844, tag: "390" },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  await page.goto("https://linear.app/login", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  out[vp.tag] = await page.evaluate(() => {
    const g = (el, label) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        label,
        tag: el.tagName,
        cls: String(el.className || "").slice(0, 120),
        txt: (el.textContent || "").trim().slice(0, 60),
        color: s.color,
        bg: s.backgroundColor,
        bgImage: s.backgroundImage.slice(0, 200),
        ff: s.fontFamily.split(",")[0],
        fw: s.fontWeight,
        fs: s.fontSize,
        pad: s.padding,
        r: s.borderRadius,
        bw: s.borderWidth,
        bc: s.borderColor,
        sh: s.boxShadow.slice(0, 160),
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
    o.headerPresent = !!document.querySelector("header");
    o.nav = g(document.querySelector("nav"), "nav");
    o.h1 = g(document.querySelector("h1"), "h1");
    o.h2 = g(document.querySelector("h2"), "h2");
    o.form = g(document.querySelector("form"), "form");
    o.inputs = [...document.querySelectorAll("input")]
      .slice(0, 4)
      .map((e, i) => g(e, "input_" + i));
    o.buttons = [...document.querySelectorAll("button, a[role=button]")]
      .filter((e) => e.getBoundingClientRect().height > 20)
      .slice(0, 8)
      .map((e, i) => g(e, "btn_" + i));
    o.links = [...document.querySelectorAll("a")]
      .filter((e) => e.getBoundingClientRect().height > 10)
      .slice(0, 10)
      .map((e, i) => g(e, "link_" + i));
    o.mainCard = g(document.querySelector("main > div, main form, [class*=card]"), "mainCard");
    o.footer = g(document.querySelector("footer"), "footer");
    o.footerPresent = !!document.querySelector("footer");
    o.bodyHTML = document.body.innerHTML.slice(0, 3000);
    return o;
  });

  await page.screenshot({ path: `${OUT}/linear-login-${vp.tag}.png`, fullPage: false });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/linear-login-probe.json`, JSON.stringify(out, null, 2));
console.log("done");
