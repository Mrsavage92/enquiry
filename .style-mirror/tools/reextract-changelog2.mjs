import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

/* Second pass: the tab row container, list marker treatment, the end-of-page
   block, and the 390 stacking of the date rail. */

const OUT = process.argv[2] || ".style-mirror/reextract";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function probe(vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp, height: vp === 1440 ? 900 : 844 },
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
        cls: String(e.className || "").slice(0, 70),
        text: (e.textContent || "").trim().slice(0, 60),
        box: box(e),
      };
      for (const k of keys) o[k] = s[k];
      return o;
    };
    const res = {};

    // --- tab row container -------------------------------------------------
    const tab = document.querySelector("a[class*='_tab']");
    const tabRow = tab?.parentElement;
    res.tab = pick(tab, [
      "fontSize",
      "fontWeight",
      "lineHeight",
      "color",
      "letterSpacing",
      "minHeight",
      "paddingLeft",
      "paddingRight",
      "borderRadius",
      "backgroundColor",
      "textDecorationLine",
      "transition",
    ]);
    res.tab_active = pick(
      [...document.querySelectorAll("a[class*='_tab']")].find(
        (a) => getComputedStyle(a).color === "rgb(247, 248, 248)",
      ),
      ["color", "fontWeight", "borderBottomWidth", "borderBottomColor", "textDecorationLine"],
    );
    res.tab_row = pick(tabRow, [
      "display",
      "gap",
      "columnGap",
      "position",
      "top",
      "marginTop",
      "paddingTop",
      "paddingBottom",
      "alignItems",
      "justifyContent",
    ]);
    res.tab_row_parent = pick(tabRow?.parentElement, [
      "display",
      "gap",
      "columnGap",
      "position",
      "top",
      "marginTop",
      "paddingTop",
      "paddingBottom",
      "justifyContent",
      "alignItems",
    ]);
    res.tab_row_siblings = [...(tabRow?.parentElement?.children || [])].map((e) =>
      pick(e, ["display", "position", "width", "justifyContent"]),
    );

    // --- lists -------------------------------------------------------------
    const ul = document.querySelector("div[class*='prose'] ul");
    res.ul = pick(ul, [
      "paddingLeft",
      "marginTop",
      "marginBottom",
      "listStyleType",
      "listStylePosition",
      "fontSize",
      "lineHeight",
      "color",
    ]);
    const li = ul?.querySelector("li");
    res.li = pick(li, [
      "marginTop",
      "paddingLeft",
      "listStyleType",
      "fontSize",
      "lineHeight",
      "color",
      "fontWeight",
    ]);
    res.li2 = pick(ul?.querySelectorAll("li")[1], ["marginTop", "listStyleType"]);
    if (li) {
      const m = getComputedStyle(li, "::marker");
      res.li_marker = { color: m.color, content: m.content, fontSize: m.fontSize };
    }
    res.li_strong = pick(li?.querySelector("strong,b"), ["fontSize", "fontWeight", "color"]);
    // headings inside a prose block
    res.prose_h3 = pick(document.querySelector("div[class*='prose'] h3"), [
      "fontSize",
      "fontWeight",
      "lineHeight",
      "color",
      "letterSpacing",
      "marginTop",
      "marginBottom",
    ]);
    res.prose_h4 = pick(document.querySelector("div[class*='prose'] h4"), [
      "fontSize",
      "fontWeight",
      "lineHeight",
      "color",
      "letterSpacing",
      "marginTop",
      "marginBottom",
    ]);

    // --- the entry title anchor + its trailing arrow -----------------------
    res.h2_first = pick(document.querySelector("h2"), [
      "fontSize",
      "fontWeight",
      "lineHeight",
      "letterSpacing",
      "color",
      "marginTop",
    ]);
    res.h2_second = pick(document.querySelectorAll("h2")[1], [
      "fontSize",
      "fontWeight",
      "lineHeight",
      "letterSpacing",
      "color",
      "marginTop",
    ]);

    // --- the date column ---------------------------------------------------
    const dateCol = document.querySelector("div[class*='changelogLeft']");
    res.date_col = pick(dateCol, [
      "position",
      "top",
      "gridColumn",
      "paddingLeft",
      "marginBottom",
      "display",
      "width",
      "height",
    ]);
    res.date_text = pick(dateCol?.querySelector("*") || dateCol, [
      "fontSize",
      "fontWeight",
      "letterSpacing",
      "lineHeight",
      "color",
      "marginBottom",
    ]);
    const bar = document.querySelector("div[class*='dateBar']");
    res.date_bar = pick(bar, [
      "position",
      "left",
      "top",
      "bottom",
      "width",
      "backgroundColor",
      "marginLeft",
      "marginTop",
      "display",
      "height",
    ]);
    if (bar) {
      const b = getComputedStyle(bar, "::before");
      const a = getComputedStyle(bar, "::after");
      res.date_bar_before = {
        content: b.content,
        background: b.backgroundColor,
        width: b.width,
        height: b.height,
        borderRadius: b.borderRadius,
        top: b.top,
        left: b.left,
        position: b.position,
      };
      res.date_bar_after = {
        content: a.content,
        background: a.backgroundColor,
        width: a.width,
        height: a.height,
        borderRadius: a.borderRadius,
        top: a.top,
        left: a.left,
        position: a.position,
      };
    }
    const entry = document.querySelector("div[class*='changelogEntry']");
    res.entry = pick(entry, [
      "display",
      "gridTemplateColumns",
      "columnGap",
      "rowGap",
      "position",
      "marginBottom",
      "paddingBottom",
    ]);
    res.entry_children = [...(entry?.children || [])].map((e) =>
      pick(e, [
        "gridColumn",
        "position",
        "paddingLeft",
        "marginBottom",
        "paddingBottom",
        "display",
      ]),
    );
    // all entry rows: pitch between them
    const entries = [...document.querySelectorAll("div[class*='changelogEntry']")]
      .slice(0, 6)
      .map((e) => box(e));
    res.entries = entries;
    res.entry_pitches = entries
      .slice(1)
      .map((e, i) => ({ gap: e.y - (entries[i].y + entries[i].h), pitch: e.y - entries[i].y }));

    // --- end of page --------------------------------------------------------
    const H = document.body.scrollHeight;
    const footer = document.querySelector("footer");
    const fy = footer ? box(footer).y : H;
    const tail = [];
    document.querySelectorAll("body *").forEach((e) => {
      const b = box(e);
      if (b.y > fy - 700 && b.y < fy && b.w > 40 && b.h > 8 && !e.closest("footer")) {
        tail.push(
          pick(e, [
            "fontSize",
            "fontWeight",
            "color",
            "backgroundColor",
            "borderRadius",
            "marginTop",
            "marginBottom",
            "height",
            "display",
            "paddingTop",
          ]),
        );
      }
    });
    res.tail = tail.slice(0, 26);
    res.footer_y = fy;
    return res;
  });

  fs.writeFileSync(path.join(OUT, `changelog2-${vp}.json`), JSON.stringify(out, null, 1));
  await ctx.close();
  return out;
}

for (const vp of [1440, 390]) {
  const d = await probe(vp);
  console.log(`\n===== ${vp} =====`);
  console.log("tab      ", JSON.stringify(d.tab));
  console.log("tab_row  ", JSON.stringify(d.tab_row));
  console.log("tab_par  ", JSON.stringify(d.tab_row_parent));
  console.log("ul       ", JSON.stringify(d.ul));
  console.log("li       ", JSON.stringify(d.li));
  console.log("li2      ", JSON.stringify(d.li2));
  console.log("li_marker", JSON.stringify(d.li_marker));
  console.log("li_strong", JSON.stringify(d.li_strong));
  console.log("prose_h3 ", JSON.stringify(d.prose_h3));
  console.log("prose_h4 ", JSON.stringify(d.prose_h4));
  console.log("h2_1     ", JSON.stringify(d.h2_first));
  console.log("h2_2     ", JSON.stringify(d.h2_second));
  console.log("date_col ", JSON.stringify(d.date_col));
  console.log("date_txt ", JSON.stringify(d.date_text));
  console.log("date_bar ", JSON.stringify(d.date_bar));
  console.log("bar::bef ", JSON.stringify(d.date_bar_before));
  console.log("bar::aft ", JSON.stringify(d.date_bar_after));
  console.log("entry    ", JSON.stringify(d.entry));
  console.log("entry kid", JSON.stringify(d.entry_children));
  console.log("pitches  ", JSON.stringify(d.entry_pitches));
  console.log("--- tail ---");
  for (const t of d.tail) console.log("  ", JSON.stringify(t));
}
await browser.close();
