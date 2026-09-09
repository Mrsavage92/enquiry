import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

/* Third pass: every list inside an entry (are they all pill-led?), the pill's
   own box, and the header block's vertical rhythm. */

const OUT = process.argv[2] || ".style-mirror/reextract";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto("https://linear.app/changelog", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(4000);

const out = await page.evaluate(() => {
  const box = (e) => {
    const r = e.getBoundingClientRect();
    return {
      x: Math.round(r.left),
      y: Math.round(r.top + scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  };
  const pick = (e, keys) => {
    if (!e) return null;
    const s = getComputedStyle(e);
    const o = {
      tag: e.tagName.toLowerCase(),
      cls: String(e.className || "").slice(0, 60),
      text: (e.textContent || "").trim().slice(0, 44),
      box: box(e),
    };
    for (const k of keys) o[k] = s[k];
    return o;
  };
  const res = {};

  // every ul/ol inside an entry body
  const lists = [];
  document
    .querySelectorAll("div[class*='changelogEntry'] ul, div[class*='changelogEntry'] ol")
    .forEach((ul) => {
      const li = ul.querySelector("li");
      const firstChild = li?.firstElementChild;
      lists.push({
        ul: pick(ul, [
          "paddingLeft",
          "marginTop",
          "marginBottom",
          "listStyleType",
          "fontSize",
          "lineHeight",
          "color",
        ]),
        liCount: ul.children.length,
        li: pick(li, [
          "marginTop",
          "paddingLeft",
          "listStyleType",
          "fontSize",
          "lineHeight",
          "color",
        ]),
        liMarker: (() => {
          const m = getComputedStyle(li, "::marker");
          return { content: m.content, color: m.color };
        })(),
        liBefore: (() => {
          const b = getComputedStyle(li, "::before");
          return {
            content: b.content,
            color: b.color,
            background: b.backgroundColor,
            width: b.width,
            height: b.height,
            borderRadius: b.borderRadius,
            marginLeft: b.marginLeft,
            position: b.position,
            left: b.left,
          };
        })(),
        firstChild: pick(firstChild, [
          "fontSize",
          "fontWeight",
          "color",
          "backgroundColor",
          "borderRadius",
          "borderTopWidth",
          "borderTopColor",
          "boxShadow",
          "paddingLeft",
          "paddingRight",
          "height",
          "marginRight",
          "display",
        ]),
      });
    });
  res.lists = lists.slice(0, 12);
  res.list_count = document.querySelectorAll(
    "div[class*='changelogEntry'] ul, div[class*='changelogEntry'] ol",
  ).length;

  // the pill
  const pill = document.querySelector("div[class*='_5p4vjG_root']");
  res.pill = pick(pill, [
    "fontSize",
    "fontWeight",
    "color",
    "backgroundColor",
    "borderRadius",
    "borderTopWidth",
    "borderTopColor",
    "boxShadow",
    "paddingLeft",
    "paddingRight",
    "height",
    "marginRight",
    "display",
    "letterSpacing",
    "lineHeight",
  ]);

  // header rhythm
  const h1 = document.querySelector("h1");
  const tabRow = document.querySelector("div[class*='tabRow']");
  const div0 = document.querySelector("div[class*='b6oLUa_root']");
  const entry0 = document.querySelector("div[class*='changelogEntry']");
  res.rhythm = {
    h1: box(h1),
    h1_parent: pick(h1.parentElement, [
      "display",
      "justifyContent",
      "alignItems",
      "marginTop",
      "paddingTop",
    ]),
    h1_grandparent: pick(h1.parentElement?.parentElement, [
      "display",
      "paddingTop",
      "marginTop",
      "gap",
      "rowGap",
    ]),
    tabRow: box(tabRow),
    tabRow_style: pick(tabRow, ["marginTop", "paddingTop", "height"]),
    divider: box(div0),
    divider_style: pick(div0, [
      "marginTop",
      "marginBottom",
      "backgroundColor",
      "height",
      "borderRadius",
    ]),
    entry0: box(entry0),
    nav_h: (() => {
      const h = document.querySelector("header");
      return h ? box(h) : null;
    })(),
  };

  // paragraph rhythm inside a body: first p after a title vs later p
  const body = document.querySelector("div[class*='changelogEntry'] div[class*='_9PBFba_b']");
  res.body_children = [...(body?.children || [])]
    .slice(0, 6)
    .map((e) => pick(e, ["marginTop", "marginBottom", "display"]));
  const prose = body?.querySelector("div[class*='prose']");
  res.prose_children = [...(prose?.children || [])]
    .slice(0, 10)
    .map((e) =>
      pick(e, [
        "marginTop",
        "marginBottom",
        "fontSize",
        "fontWeight",
        "lineHeight",
        "color",
        "paddingLeft",
      ]),
    );
  res.prose_root = pick(prose, ["marginTop", "fontSize", "lineHeight", "color"]);

  return res;
});

fs.writeFileSync(path.join(OUT, "changelog3-1440.json"), JSON.stringify(out, null, 1));
console.log("list_count", out.list_count);
for (const l of out.lists) {
  console.log("\nUL", JSON.stringify(l.ul));
  console.log("  li", JSON.stringify(l.li), "n=", l.liCount);
  console.log("  ::marker", JSON.stringify(l.liMarker), " ::before", JSON.stringify(l.liBefore));
  console.log("  firstChild", JSON.stringify(l.firstChild));
}
console.log("\nPILL", JSON.stringify(out.pill));
console.log("\nRHYTHM", JSON.stringify(out.rhythm, null, 1));
console.log("\nPROSE ROOT", JSON.stringify(out.prose_root));
console.log("BODY KIDS", JSON.stringify(out.body_children, null, 1));
console.log("PROSE KIDS", JSON.stringify(out.prose_children, null, 1));

await browser.close();
