import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

/*
  Re-extraction of https://linear.app/changelog for the /roadmap rebuild.
  Complements tokens.lock.json: page header, the date rail, entry title/body,
  the media frame inside an entry, the inline link style, the left rail /
  timeline treatment, the spacing between entries, and whatever navigation the
  page carries of its own - at 1440 and 390.
*/

const OUT = process.argv[2] || ".style-mirror/reextract";
fs.mkdirSync(OUT, { recursive: true });

const PROPS = [
  "display",
  "position",
  "top",
  "gridTemplateColumns",
  "gridColumn",
  "columnGap",
  "rowGap",
  "gap",
  "width",
  "height",
  "minHeight",
  "maxWidth",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "color",
  "backgroundColor",
  "backgroundImage",
  "borderTopWidth",
  "borderTopStyle",
  "borderTopColor",
  "borderBottomWidth",
  "borderBottomColor",
  "borderRadius",
  "boxShadow",
  "textDecorationLine",
  "textTransform",
  "opacity",
  "overflow",
  "objectFit",
  "aspectRatio",
  "transition",
  "zIndex",
];

const browser = await chromium.launch();

async function probe(vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp, height: vp === 1440 ? 900 : 844 },
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  await page.goto("https://linear.app/changelog", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(4000);

  const data = await page.evaluate((PROPS) => {
    const box = (e) => {
      const r = e.getBoundingClientRect();
      return {
        x: Math.round(r.left),
        y: Math.round(r.top + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    const styles = (e) => {
      const s = getComputedStyle(e);
      const o = {};
      for (const p of PROPS) o[p] = s[p];
      return o;
    };
    const desc = (e) =>
      e
        ? {
            tag: e.tagName.toLowerCase(),
            cls: String(e.className || "").slice(0, 90),
            text: (e.textContent || "").trim().slice(0, 70),
            box: box(e),
            styles: styles(e),
          }
        : null;

    const out = { url: location.href, vw: innerWidth, vh: innerHeight };

    // --- page header: the h1 and everything sitting above the first entry ---
    const h1 = document.querySelector("h1");
    out.h1 = desc(h1);
    if (h1) {
      const wrap = h1.parentElement;
      out.h1_parent = desc(wrap);
      out.h1_siblings = [...(wrap?.children || [])].map(desc);
    }

    // --- navigation the page carries of its own -------------------------
    // Anything link-like or tab-like sitting between the h1 and the first
    // article/entry, plus any sticky/fixed element that is not the site nav.
    const nav = [];
    document.querySelectorAll("a,button").forEach((e) => {
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const inHeader = e.closest("header");
      if (inHeader) return;
      const y = r.top + window.scrollY;
      if (y > 1400) return;
      nav.push(desc(e));
    });
    out.candidate_nav_above_1400 = nav.slice(0, 40);

    const sticky = [];
    document.querySelectorAll("*").forEach((e) => {
      const s = getComputedStyle(e);
      if (s.position === "sticky" || (s.position === "fixed" && !e.closest("header"))) {
        const r = e.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        sticky.push({ ...desc(e), position: s.position, top: s.top });
      }
    });
    out.sticky_or_fixed = sticky.slice(0, 20);

    // --- entries -----------------------------------------------------------
    // Find the repeating entry container: the deepest ancestor shared by an
    // h2 and its date, repeated down the page.
    const h2s = [...document.querySelectorAll("h2")];
    out.h2_count = h2s.length;
    out.entry_titles = h2s.slice(0, 8).map(desc);

    // The row container for each h2: walk up until the box spans > 900px at 1440
    const rows = h2s.slice(0, 8).map((h) => {
      let e = h;
      for (let i = 0; i < 8 && e.parentElement; i++) {
        e = e.parentElement;
        const r = e.getBoundingClientRect();
        if (r.width > innerWidth * 0.6) break;
      }
      return desc(e);
    });
    out.entry_rows = rows;

    // spacing between consecutive entry rows
    out.entry_gaps = [];
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i] || !rows[i - 1]) continue;
      out.entry_gaps.push({
        from: rows[i - 1].text.slice(0, 26),
        to: rows[i].text.slice(0, 26),
        gap: rows[i].box.y - (rows[i - 1].box.y + rows[i - 1].box.h),
        pitch: rows[i].box.y - rows[i - 1].box.y,
      });
    }

    // --- the date rail -----------------------------------------------------
    // Any element whose text parses as a date, sitting left of the title.
    const dateRe =
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s*\d{0,4}$/i;
    const dates = [];
    document.querySelectorAll("p,span,div,time,h3").forEach((e) => {
      const t = (e.textContent || "").trim();
      if (t.length > 24 || !dateRe.test(t)) return;
      if (e.children.length > 0) return;
      dates.push(desc(e));
    });
    out.dates = dates.slice(0, 10);
    if (dates.length) {
      // the wrapper the date sits in, and its siblings (the rail lives there)
      const first = document.querySelectorAll("p,span,div,time,h3");
      out.date_wrappers = dates.slice(0, 3).map((d) => {
        const el = [...document.querySelectorAll("p,span,div,time,h3")].find(
          (e) => (e.textContent || "").trim() === d.text && e.children.length === 0,
        );
        if (!el) return null;
        const w = el.parentElement;
        return {
          wrapper: desc(w),
          grandparent: desc(w?.parentElement),
          wrapper_siblings: [...(w?.parentElement?.children || [])].map(desc),
        };
      });
    }

    // --- thin vertical elements: the rail / timeline -----------------------
    const thin = [];
    document.querySelectorAll("*").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.width <= 3 && r.height > 40) {
        thin.push({ ...desc(e), parent: desc(e.parentElement) });
      }
    });
    out.vertical_rules = thin.slice(0, 12);

    // small round elements: the marker dot
    const dots = [];
    document.querySelectorAll("*").forEach((e) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      if (r.width >= 4 && r.width <= 14 && Math.abs(r.width - r.height) <= 2 && s.borderRadius) {
        if (parseFloat(s.borderRadius) >= r.width / 2 - 1 || s.borderRadius.includes("9999")) {
          dots.push(desc(e));
        }
      }
    });
    out.marker_dots = dots.slice(0, 10);

    // --- horizontal dividers -----------------------------------------------
    const hrs = [];
    document.querySelectorAll("*").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.height > 0 && r.height <= 2 && r.width > 200) hrs.push(desc(e));
    });
    out.horizontal_dividers = hrs.slice(0, 10);

    // --- entry body prose + lists ------------------------------------------
    const proseSel = [];
    h2s.slice(0, 6).forEach((h) => {
      let row = h;
      for (let i = 0; i < 8 && row.parentElement; i++) {
        row = row.parentElement;
        const r = row.getBoundingClientRect();
        if (r.width > innerWidth * 0.6) break;
      }
      row.querySelectorAll("p,li,ul,ol,h3,h4,strong,em,blockquote,code").forEach((e) => {
        if ((e.textContent || "").trim().length < 3) return;
        proseSel.push(desc(e));
      });
    });
    out.entry_prose = proseSel.slice(0, 40);

    // --- links inside an entry ---------------------------------------------
    const links = [];
    h2s.slice(0, 8).forEach((h) => {
      let row = h;
      for (let i = 0; i < 8 && row.parentElement; i++) {
        row = row.parentElement;
        const r = row.getBoundingClientRect();
        if (r.width > innerWidth * 0.6) break;
      }
      row.querySelectorAll("a").forEach((e) => links.push(desc(e)));
    });
    out.entry_links = links.slice(0, 20);

    // --- media inside an entry ----------------------------------------------
    const media = [];
    document.querySelectorAll("img,video,picture,figure").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 120 || r.height < 60) return;
      media.push({
        ...desc(e),
        parent: desc(e.parentElement),
        gp: desc(e.parentElement?.parentElement),
      });
    });
    out.entry_media = media.slice(0, 10);

    // --- end of page --------------------------------------------------------
    const main = document.querySelector("main") || document.body;
    const kids = [...main.children];
    out.main_children = kids.map(desc);
    const footer = document.querySelector("footer");
    out.footer = desc(footer);
    // the last two blocks before the footer
    out.page_end = kids.slice(-3).map(desc);
    out.doc_height = document.body.scrollHeight;

    return out;
  }, PROPS);

  fs.writeFileSync(path.join(OUT, `changelog-${vp}.json`), JSON.stringify(data, null, 1));

  await page.screenshot({ path: path.join(OUT, `ref-changelog-${vp}-fold.png`) });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(OUT, `ref-changelog-${vp}-full.png`),
    fullPage: true,
  });
  await ctx.close();
  return data;
}

for (const vp of [1440, 390]) {
  const d = await probe(vp);
  console.log(
    `\n=== ${vp} === h2s=${d.h2_count} rules=${d.vertical_rules.length} dots=${d.marker_dots.length} media=${d.entry_media.length} height=${d.doc_height}`,
  );
}
await browser.close();
