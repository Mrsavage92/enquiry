import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

/*
  Section-by-section computed-style diff for /roadmap, in the shape of the
  lead's sections.mjs. Every expected value is a reference computed value from
  either tokens.lock.json or the 2026-09-09 re-extraction of
  https://linear.app/changelog (.style-mirror/reextract/changelog*.json).

  sections.mjs itself is shared with three other route builders this pass, so
  the roadmap spec lives beside it rather than inside it.

  Usage: node .style-mirror/tools/sections-roadmap.mjs <outdir> <1440|390>
*/

const OUT = process.argv[2];
const VP = Number(process.argv[3] || 1440);
const BASE = process.argv[4] || "http://127.0.0.1:5271";
fs.mkdirSync(OUT, { recursive: true });

const mob = VP <= 640;

const SPEC = [
  {
    name: "page header",
    sel: "main > section:first-of-type",
    checks: [
      /* Reference: h1 top at y=150 under a 73px header -> 77px. */
      ["paddingTop", "77px", (s) => s.paddingTop],
    ],
    sub: [
      {
        name: "h1",
        sel: "main h1",
        checks: [
          ["fontFamily", "Inter", (s) => s.fontFamily.split(",")[0].replace(/"/g, "")],
          ["fontSize", "48px", (s) => s.fontSize],
          ["fontWeight", "510", (s) => s.fontWeight],
          ["letterSpacing", "-1.056px", (s) => s.letterSpacing],
          ["lineHeight", "48px", (s) => s.lineHeight],
          ["color", "rgb(247, 248, 248)", (s) => s.color],
          ["opticalMargin", mob ? "-1px" : "-2px", (s) => s.marginLeft],
        ],
      },
      {
        name: "label",
        sel: "main .mk-label",
        checks: [
          ["fontSize", "12px", (s) => s.fontSize],
          ["lineHeight", "16.8px", (s) => s.lineHeight],
          ["textTransform", "none", (s) => s.textTransform],
          ["color", "rgb(138, 143, 152)", (s) => s.color],
          ["fontFamily", "ui-monospace", (s) => s.fontFamily.split(",")[0].replace(/"/g, "")],
        ],
      },
      {
        name: "lede",
        sel: "main .mk-lede",
        checks: [
          ["fontSize", "15px", (s) => s.fontSize],
          ["fontWeight", "400", (s) => s.fontWeight],
          ["letterSpacing", "-0.165px", (s) => s.letterSpacing],
          ["lineHeight", "24px", (s) => s.lineHeight],
          ["color", "rgb(138, 143, 152)", (s) => s.color],
        ],
      },
      {
        name: "content left edge",
        sel: "main > section:first-of-type",
        checks: [
          [
            "contentLeftEdge",
            mob ? "24px" : "80px",
            (s, e) =>
              Math.round(
                e.getBoundingClientRect().left + parseFloat(getComputedStyle(e).paddingLeft),
              ) + "px",
          ],
        ],
      },
      {
        name: "primary CTA",
        sel: "main .mk-btn-primary",
        checks: [
          ["backgroundColor", "rgb(229, 229, 230)", (s) => s.backgroundColor],
          ["color", "rgb(8, 9, 10)", (s) => s.color],
          ["height", "44px", (s, e) => Math.round(e.getBoundingClientRect().height) + "px"],
          ["paddingInline", "20px", (s) => s.paddingLeft],
          ["borderRadius", "9999px", (s) => s.borderRadius],
          ["fontSize", "16px", (s) => s.fontSize],
          ["fontWeight", "510", (s) => s.fontWeight],
        ],
      },
      {
        name: "secondary CTA",
        sel: "main .mk-btn-secondary",
        checks: [
          ["backgroundColor", "rgba(255, 255, 255, 0.05)", (s) => s.backgroundColor],
          ["color", "rgb(247, 248, 248)", (s) => s.color],
          ["height", "44px", (s, e) => Math.round(e.getBoundingClientRect().height) + "px"],
          ["borderRadius", "9999px", (s) => s.borderRadius],
        ],
      },
    ],
  },
  {
    name: "era nav (reference tab row)",
    sel: 'nav[aria-label="Roadmap stages"]',
    checks: [
      ["display", "flex", (s) => s.display],
      [
        "height",
        mob ? null : "40px",
        (s, e) => Math.round(e.getBoundingClientRect().height) + "px",
      ],
      [
        "justifyContent",
        mob ? "normal" : "space-between",
        (s) => (s.justifyContent === "flex-start" ? "normal" : s.justifyContent),
      ],
    ],
    sub: [
      {
        name: "tab (idle)",
        sel: '.mk-tab:not([data-active="true"])',
        checks: [
          ["fontSize", "16px", (s) => s.fontSize],
          ["fontWeight", "400", (s) => s.fontWeight],
          ["lineHeight", "24px", (s) => s.lineHeight],
          ["color", "rgb(138, 143, 152)", (s) => s.color],
          ["textDecorationLine", "none", (s) => s.textDecorationLine],
          ["backgroundColor", "rgba(0, 0, 0, 0)", (s) => s.backgroundColor],
          ["paddingInline", "0px", (s) => s.paddingLeft],
        ],
      },
      {
        name: "tab (current)",
        sel: '.mk-tab[data-active="true"]',
        checks: [
          ["color", "rgb(247, 248, 248)", (s) => s.color],
          ["fontSize", "16px", (s) => s.fontSize],
          ["borderBottomWidth", "0px", (s) => s.borderBottomWidth],
        ],
      },
      {
        name: "tab row gap",
        sel: 'nav[aria-label="Roadmap stages"] > div',
        checks: [["columnGap", "16px", (s) => s.columnGap]],
      },
      {
        name: "header divider",
        sel: 'main .mk-divider[data-divider="header"]',
        checks: [
          ["backgroundColor", "rgb(24, 25, 26)", (s) => s.backgroundColor],
          ["height", "1px", (s, e) => Math.round(e.getBoundingClientRect().height) + "px"],
          ["borderRadius", "9999px", (s) => s.borderRadius],
          ["marginTop", "32px", (s) => s.marginTop],
          ["marginBottom", "64px", (s) => s.marginBottom],
        ],
      },
    ],
  },
  {
    name: "entry",
    sel: ".mk-entry",
    checks: [
      ["gap", mob ? null : "32px", (s) => s.columnGap],
      [
        "columns",
        mob ? "block" : "12",
        (s) => (s.display === "grid" ? String(s.gridTemplateColumns.split(" ").length) : s.display),
      ],
      ["position", "relative", (s) => s.position],
    ],
    sub: [
      {
        name: "entry aside",
        sel: ".mk-entry-aside",
        checks: [
          ["paddingLeft", mob ? "0px" : "24px", (s) => s.paddingLeft],
          ["marginBottom", "16px", (s) => s.marginBottom],
          ["position", mob ? "relative" : "sticky", (s) => s.position],
          ["top", mob ? "20px" : "96px", (s) => s.top],
        ],
      },
      {
        name: "entry aside geometry",
        sel: ".mk-entry-aside",
        checks: [
          [
            "width",
            mob ? null : "296px",
            (s, e) => Math.round(e.getBoundingClientRect().width) + "px",
          ],
          [
            "left",
            mob ? null : "80px",
            (s, e) => Math.round(e.getBoundingClientRect().left) + "px",
          ],
        ],
      },
      {
        name: "entry rule",
        sel: ".mk-entry-rule",
        checks: [
          [
            "background",
            mob ? "none" : "rgb(35, 37, 42)",
            (s) => (s.display === "none" ? "none" : s.backgroundColor),
          ],
          [
            "width",
            mob ? "none" : "1px",
            (s, e) =>
              s.display === "none" ? "none" : Math.round(e.getBoundingClientRect().width) + "px",
          ],
          [
            "bottomOvershoot",
            mob ? "none" : "-9px",
            (s) => (s.display === "none" ? "none" : s.bottom),
          ],
          [
            "left",
            mob ? "none" : "89px",
            (s, e) =>
              s.display === "none" ? "none" : Math.round(e.getBoundingClientRect().left) + "px",
          ],
        ],
      },
      {
        name: "entry marker",
        sel: ".mk-entry-marker",
        checks: [
          [
            "background",
            mob ? "none" : "rgb(252, 120, 64)",
            (s) => (s.display === "none" ? "none" : s.backgroundColor),
          ],
          [
            "size",
            mob ? "none" : "6px",
            (s, e) =>
              s.display === "none" ? "none" : Math.round(e.getBoundingClientRect().width) + "px",
          ],
        ],
      },
      {
        name: "rail label",
        sel: ".mk-entry-date",
        checks: [
          ["fontSize", "14px", (s) => s.fontSize],
          ["letterSpacing", "-0.182px", (s) => s.letterSpacing],
          ["lineHeight", "21px", (s) => s.lineHeight],
          ["color", "rgb(247, 248, 248)", (s) => s.color],
        ],
      },
      {
        name: "entry body geometry",
        sel: ".mk-entry-body",
        checks: [
          [
            "width",
            mob ? null : "624px",
            (s, e) => Math.round(e.getBoundingClientRect().width) + "px",
          ],
          [
            "left",
            mob ? null : "408px",
            (s, e) => Math.round(e.getBoundingClientRect().left) + "px",
          ],
          ["paddingBottom", "48px", (s) => s.paddingBottom],
        ],
      },
      {
        name: "entry title (featured)",
        sel: '.mk-entry-title[data-featured="true"]',
        checks: [
          ["fontSize", mob ? "24px" : "32px", (s) => s.fontSize],
          ["fontWeight", "590", (s) => s.fontWeight],
          ["letterSpacing", mob ? "-0.288px" : "-0.704px", (s) => s.letterSpacing],
          ["lineHeight", mob ? "31.92px" : "36px", (s) => s.lineHeight],
          ["color", "rgb(247, 248, 248)", (s) => s.color],
        ],
      },
      {
        name: "entry lead (strong tier, 12px above)",
        sel: ".mk-entry-body > p.mk-prose:first-of-type",
        checks: [
          ["fontSize", mob ? "15px" : "17px", (s) => s.fontSize],
          ["fontWeight", "590", (s) => s.fontWeight],
          ["lineHeight", mob ? "24px" : "27.2px", (s) => s.lineHeight],
          ["color", "rgb(247, 248, 248)", (s) => s.color],
          ["marginTop", "12px", (s) => s.marginTop],
        ],
      },
      {
        name: "entry prose",
        sel: ".mk-entry-body > p.mk-prose:nth-of-type(2)",
        checks: [
          ["fontSize", mob ? "15px" : "17px", (s) => s.fontSize],
          ["fontWeight", "400", (s) => s.fontWeight],
          ["lineHeight", mob ? "24px" : "27.2px", (s) => s.lineHeight],
          ["color", "rgb(208, 214, 224)", (s) => s.color],
          ["marginTop", "20px", (s) => s.marginTop],
        ],
      },
      {
        name: "entry list",
        sel: ".mk-entry-body ul",
        checks: [
          ["paddingLeft", "24px", (s) => s.paddingLeft],
          ["marginTop", "12px", (s) => s.marginTop],
          ["listStyleType", "disc", (s) => s.listStyleType],
          ["fontSize", mob ? "15px" : "17px", (s) => s.fontSize],
          ["lineHeight", mob ? "24px" : "27.2px", (s) => s.lineHeight],
          ["color", "rgb(208, 214, 224)", (s) => s.color],
        ],
      },
      {
        name: "entry list item",
        sel: ".mk-entry-body ul > li + li",
        checks: [
          ["marginTop", "8px", (s) => s.marginTop],
          ["fontSize", mob ? "15px" : "17px", (s) => s.fontSize],
          ["lineHeight", mob ? "24px" : "27.2px", (s) => s.lineHeight],
          ["color", "rgb(208, 214, 224)", (s) => s.color],
        ],
      },
      {
        name: "entry figure",
        sel: ".mk-entry-body figure",
        checks: [
          ["marginTop", mob ? "32px" : "48px", (s) => s.marginTop],
          ["marginBottom", mob ? "32px" : "48px", (s) => s.marginBottom],
          ["backgroundColor", "rgba(0, 0, 0, 0)", (s) => s.backgroundColor],
          ["borderTopWidth", "0px", (s) => s.borderTopWidth],
        ],
      },
    ],
  },
  {
    name: "closing divider",
    sel: 'main .mk-divider[data-divider="close"]',
    checks: [
      ["backgroundColor", "rgb(24, 25, 26)", (s) => s.backgroundColor],
      ["marginTop", "32px", (s) => s.marginTop],
      ["marginBottom", "16px", (s) => s.marginBottom],
      ["borderRadius", "9999px", (s) => s.borderRadius],
    ],
  },
  {
    name: "prefooter CTA",
    sel: "main .mk-prefooter",
    checks: [["marginBlock", mob ? "96px" : "224px", (s) => s.marginTop]],
    sub: [
      {
        name: "h2",
        sel: ".mk-prefooter .mk-h2",
        checks: [
          ["fontSize", mob ? "24px" : "48px", (s) => s.fontSize],
          ["fontWeight", "510", (s) => s.fontWeight],
          ["letterSpacing", mob ? "-0.288px" : "-1.056px", (s) => s.letterSpacing],
          ["lineHeight", mob ? "31.92px" : "48px", (s) => s.lineHeight],
          ["color", "rgb(247, 248, 248)", (s) => s.color],
        ],
      },
      {
        name: "waitlist field",
        sel: ".mk-prefooter input[type=email].field",
        checks: [
          ["backgroundColor", "rgb(15, 16, 17)", (s) => s.backgroundColor],
          [
            "border",
            "1px solid rgb(35, 37, 42)",
            (s) => `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
          ],
          ["borderRadius", "8px", (s) => s.borderRadius],
          ["fontSize", "15px", (s) => s.fontSize],
        ],
      },
    ],
  },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: VP, height: VP === 1440 ? 900 : 844 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto(BASE + "/roadmap", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);

const results = [];
for (const sec of SPEC) {
  const group = { name: sec.name, rows: [] };
  const all = [{ name: sec.name, sel: sec.sel, checks: sec.checks }, ...(sec.sub || [])];
  for (const item of all) {
    const rows = await page.evaluate(
      ({ sel, checks }) => {
        const all = [...document.querySelectorAll(sel)];
        const e = all.find((n) => n.getBoundingClientRect().height > 0) || all[0];
        if (!e) return checks.map(([k]) => ({ prop: k, actual: "ELEMENT NOT FOUND" }));
        const s = getComputedStyle(e);
        return checks.map(([k, , fnSrc]) => {
          let actual;
          try {
            actual = new Function("s", "e", "return (" + fnSrc + ")(s,e)")(s, e);
          } catch (err) {
            actual = "ERR " + err.message;
          }
          return { prop: k, actual: String(actual) };
        });
      },
      { sel: item.sel, checks: item.checks.map(([k, v, fn]) => [k, v, fn.toString()]) },
    );
    item.checks.forEach(([k, expected], i) => {
      if (expected === null) return;
      group.rows.push({
        el: item.name,
        prop: k,
        expected: String(expected),
        actual: rows[i].actual,
        ok: String(expected) === rows[i].actual,
      });
    });
  }
  results.push(group);
}

/* Section boxes + one full-page render. Cropping the single render in Python
   is far cheaper than six clipped fullPage screenshots of an 8000px page. */
const shots = await page.evaluate(() => {
  const out = [];
  const push = (name, el) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    out.push({
      name,
      x: Math.max(0, Math.round(r.left)),
      y: Math.round(r.top + window.scrollY),
      w: Math.round(r.width),
      h: Math.min(1600, Math.round(r.height)),
    });
  };
  push("header", document.querySelector("main > section"));
  push("eranav", document.querySelector('nav[aria-label="Roadmap stages"]')?.parentElement);
  const entries = document.querySelectorAll(".mk-entry");
  push("entry-first", entries[0]);
  push("entry-mid", entries[3]);
  push("closing", entries[entries.length - 3]);
  push("cta", document.querySelector(".mk-prefooter"));
  return out;
});
/* The page render is produced by shoot.mjs; keeping it out of this run
   avoids a second fullPage rasterisation of an 8000px page in the same
   process, which tripped a CDP assertion and then a V8 OOM. */
fs.writeFileSync(path.join(OUT, `boxes-${VP}.json`), JSON.stringify(shots, null, 2));

await browser.close();
fs.writeFileSync(path.join(OUT, `sections-roadmap-${VP}.json`), JSON.stringify(results, null, 2));
let fails = 0;
for (const g of results) {
  const bad = g.rows.filter((r) => !r.ok);
  fails += bad.length;
  console.log(`\n[${g.name}] ${g.rows.length - bad.length}/${g.rows.length} match`);
  for (const r of bad)
    console.log(`  MISMATCH ${r.el} / ${r.prop}: expected ${r.expected}  got ${r.actual}`);
}
console.log("\nTOTAL MISMATCHES:", fails, "at", VP);
