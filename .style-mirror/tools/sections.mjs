import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2];
const VP = Number(process.argv[3] || 1440);
const BASE = "http://127.0.0.1:5261";
fs.mkdirSync(OUT, { recursive: true });

const L = JSON.parse(fs.readFileSync("tokens.lock.json", "utf8"));
const scale = VP === 1440 ? L.typography.scale_1440 : L.typography.scale_390;
const px = (v) => String(v);

/* Expected values. Every one is a reference computed value from tokens.lock.json.
   `get` runs in the page and returns the actual. */
const SECTIONS = (vp) => {
  const wide = vp >= 1281;
  const mob = vp <= 640;
  return [
    {
      name: "nav",
      sel: "header.mk-nav",
      checks: [
        ["position", "fixed", (s) => s.position],
        [
          "height",
          mob ? "65px" : "73px",
          (s, e) => Math.round(e.getBoundingClientRect().height) + "px",
        ],
        ["backdropFilter", "blur(20px)", (s) => s.backdropFilter],
        [
          "borderBottom",
          "1px solid " + L.color.nav_border,
          (s) => `${s.borderBottomWidth} ${s.borderBottomStyle} ${s.borderBottomColor}`,
        ],
        [
          "backgroundImage",
          "linear-gradient(rgba(11, 11, 11, 0.8) 0%, oklab(0.149576 0.00000680983 0.00000298768 / 0.761905) 100%)",
          (s) => s.backgroundImage,
        ],
      ],
      sub: [
        {
          name: "nav link",
          sel: '.mk-nav-link:not([data-active="true"])',
          checks: [
            ["color", "rgb(138, 143, 152)", (s) => s.color],
            ["fontSize", "13px", (s) => s.fontSize],
            ["fontWeight", "400", (s) => s.fontWeight],
            ["lineHeight", "19.5px", (s) => s.lineHeight],
            ["height", "32px", (s, e) => Math.round(e.getBoundingClientRect().height) + "px"],
            ["paddingInline", "12px", (s) => s.paddingLeft],
            ["borderRadius", "9999px", (s) => s.borderRadius],
            ["fontFamily", "Inter", (s) => s.fontFamily.split(",")[0].replace(/"/g, "")],
          ],
        },
        {
          name: "nav CTA pill",
          sel: "header .mk-btn-primary",
          checks: [
            ["backgroundColor", "rgb(229, 229, 230)", (s) => s.backgroundColor],
            ["color", "rgb(8, 9, 10)", (s) => s.color],
            ["fontSize", "13px", (s) => s.fontSize],
            ["fontWeight", "510", (s) => s.fontWeight],
            ["height", "32px", (s, e) => Math.round(e.getBoundingClientRect().height) + "px"],
            ["paddingInline", "12px", (s) => s.paddingLeft],
            ["borderRadius", "9999px", (s) => s.borderRadius],
          ],
        },
        {
          name: "wordmark",
          sel: ".mk-wordmark",
          checks: [
            ["height", "32px", (s, e) => Math.round(e.getBoundingClientRect().height) + "px"],
            ["paddingInline", "8px", (s) => s.paddingLeft],
            ["marginLeft", "-8px", (s) => s.marginLeft],
            ["borderRadius", "6px", (s) => s.borderRadius],
          ],
        },
      ],
    },
    {
      name: "hero",
      sel: "main > section:first-of-type .mk-container",
      checks: [
        [
          "contentLeftEdge",
          mob ? "24px" : wide ? "80px" : null,
          (s, e) =>
            Math.round(
              e.getBoundingClientRect().left + parseFloat(getComputedStyle(e).paddingLeft),
            ) + "px",
        ],
      ],
      sub: [
        {
          name: "h1",
          sel: "h1.mk-h1",
          checks: [
            ["fontFamily", "Inter", (s) => s.fontFamily.split(",")[0].replace(/"/g, "")],
            ["fontSize", scale.h1_home.size, (s) => s.fontSize],
            ["fontWeight", String(scale.h1_home.weight), (s) => s.fontWeight],
            ["letterSpacing", scale.h1_home.letter_spacing, (s) => s.letterSpacing],
            ["lineHeight", scale.h1_home.line_height, (s) => s.lineHeight],
            ["color", "rgb(247, 248, 248)", (s) => s.color],
            ["opticalMargin", scale.h1_home.optical_margin_left, (s) => s.marginLeft],
          ],
        },
        {
          name: "lede",
          sel: "main > section:first-of-type .mk-lede",
          checks: [
            ["fontSize", "15px", (s) => s.fontSize],
            ["fontWeight", "400", (s) => s.fontWeight],
            ["letterSpacing", "-0.165px", (s) => s.letterSpacing],
            ["lineHeight", "24px", (s) => s.lineHeight],
            ["color", "rgb(138, 143, 152)", (s) => s.color],
          ],
        },
        {
          name: "label",
          sel: ".mk-label",
          checks: [
            ["fontSize", "12px", (s) => s.fontSize],
            ["lineHeight", "16.8px", (s) => s.lineHeight],
            ["textTransform", "none", (s) => s.textTransform],
            ["color", "rgb(138, 143, 152)", (s) => s.color],
            ["fontFamily", "ui-monospace", (s) => s.fontFamily.split(",")[0].replace(/"/g, "")],
          ],
        },
        {
          name: "hero form field",
          sel: "input[type=email].field",
          checks: [
            ["backgroundColor", "rgb(15, 16, 17)", (s) => s.backgroundColor],
            [
              "border",
              "1px solid rgb(35, 37, 42)",
              (s) => `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
            ],
            ["borderRadius", "8px", (s) => s.borderRadius],
            ["color", "rgb(247, 248, 248)", (s) => s.color],
            ["fontSize", "15px", (s) => s.fontSize],
          ],
        },
        {
          name: "hero CTA",
          sel: "main form button[type=submit]",
          checks: [
            ["backgroundColor", "rgb(229, 229, 230)", (s) => s.backgroundColor],
            ["color", "rgb(8, 9, 10)", (s) => s.color],
            ["borderRadius", "9999px", (s) => s.borderRadius],
          ],
        },
      ],
    },
    {
      name: "product-visual",
      sel: ".mk-media",
      checks: [
        ["plateBg", "rgb(9, 10, 11)", (s) => s.backgroundColor],
        ["platePadding", "8px", (s) => s.paddingTop],
        ["plateRadius", "12px", (s) => s.borderRadius],
      ],
      sub: [
        {
          name: "media panel",
          sel: ".mk-media-panel",
          checks: [
            ["backgroundColor", "rgb(16, 17, 18)", (s) => s.backgroundColor],
            [
              "border",
              "1px solid rgba(255, 255, 255, 0.08)",
              (s) => `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
            ],
            ["borderRadius", "12px", (s) => s.borderRadius],
          ],
        },
        {
          name: "media inner",
          sel: ".mk-media-inner",
          checks: [
            [
              "border",
              "1px solid rgba(255, 255, 255, 0.05)",
              (s) => `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
            ],
            ["borderRadius", "8px", (s) => s.borderRadius],
            ["boxShadow", "rgba(0, 0, 0, 0.2) 0px 0px 0px 2px", (s) => s.boxShadow],
          ],
        },
      ],
    },
    {
      name: "content-sections",
      sel: "section.mk-section",
      checks: [["paddingBlock", mob ? "0px" : vp <= 768 ? "48px" : "128px", (s) => s.paddingTop]],
      sub: [
        {
          name: "h2",
          sel: "h2.mk-h2",
          checks: [
            ["fontFamily", "Inter", (s) => s.fontFamily.split(",")[0].replace(/"/g, "")],
            ["fontSize", scale.h2_section.size, (s) => s.fontSize],
            ["fontWeight", String(scale.h2_section.weight), (s) => s.fontWeight],
            ["letterSpacing", scale.h2_section.letter_spacing, (s) => s.letterSpacing],
            ["lineHeight", scale.h2_section.line_height, (s) => s.lineHeight],
            ["color", "rgb(247, 248, 248)", (s) => s.color],
          ],
        },
        {
          name: "section head gap",
          sel: ".mk-section-head",
          checks: [
            ["paddingBottom", mob ? "48px" : vp <= 1024 ? "64px" : "96px", (s) => s.paddingBottom],
          ],
        },
        {
          name: "row divider",
          sel: ".mk-rows > *",
          checks: [
            [
              "borderTop",
              "1px solid rgb(35, 37, 42)",
              (s) => `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
            ],
          ],
        },
      ],
    },
    {
      name: "cards",
      sel: ".mk-card",
      checks: [
        ["backgroundColor", "rgb(15, 16, 17)", (s) => s.backgroundColor],
        [
          "backgroundImage",
          "linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.03))",
          (s) => s.backgroundImage,
        ],
        [
          "border",
          "1px solid rgba(255, 255, 255, 0.08)",
          (s) => `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
        ],
        ["borderRadius", "12px", (s) => s.borderRadius],
        ["boxShadow", "rgba(0, 0, 0, 0.2) 0px 0px 0px 1px", (s) => s.boxShadow],
      ],
      sub: [
        {
          name: "card title h3",
          sel: ".mk-card .mk-h3",
          checks: [
            ["fontSize", "20px", (s) => s.fontSize],
            ["fontWeight", "590", (s) => s.fontWeight],
            ["letterSpacing", "-0.24px", (s) => s.letterSpacing],
            ["lineHeight", "26.6px", (s) => s.lineHeight],
            ["color", "rgb(208, 214, 224)", (s) => s.color],
          ],
        },
      ],
    },
    {
      name: "changelog-entry",
      sel: ".mk-entry",
      checks: [
        ["gap", "32px", (s) => s.columnGap],
        [
          "columns",
          mob ? "block" : "12",
          (s) =>
            s.display === "grid" ? String(s.gridTemplateColumns.split(" ").length) : s.display,
        ],
      ],
      sub: [
        {
          name: "entry aside",
          sel: ".mk-entry-aside",
          checks: [
            ["paddingLeft", mob ? "0px" : "24px", (s) => s.paddingLeft],
            ["marginBottom", "16px", (s) => s.marginBottom],
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
          name: "entry date",
          sel: ".mk-entry-date",
          checks: [
            ["fontSize", "14px", (s) => s.fontSize],
            ["letterSpacing", "-0.182px", (s) => s.letterSpacing],
            ["lineHeight", "21px", (s) => s.lineHeight],
            ["color", "rgb(247, 248, 248)", (s) => s.color],
          ],
        },
        {
          name: "entry title",
          sel: ".mk-entry-title",
          checks: [
            ["fontSize", "24px", (s) => s.fontSize],
            ["fontWeight", "590", (s) => s.fontWeight],
            ["letterSpacing", "-0.288px", (s) => s.letterSpacing],
            ["lineHeight", "31.92px", (s) => s.lineHeight],
          ],
        },
        {
          name: "entry body",
          sel: ".mk-entry-body .mk-prose",
          checks: [
            ["fontSize", mob ? "15px" : "17px", (s) => s.fontSize],
            ["lineHeight", mob ? "24px" : "27.2px", (s) => s.lineHeight],
            ["color", "rgb(208, 214, 224)", (s) => s.color],
          ],
        },
        {
          name: "divider",
          sel: ".mk-divider",
          checks: [
            ["backgroundColor", "rgb(24, 25, 26)", (s) => s.backgroundColor],
            ["height", "1px", (s, e) => Math.round(e.getBoundingClientRect().height) + "px"],
            ["borderRadius", "9999px", (s) => s.borderRadius],
          ],
        },
      ],
    },
    {
      name: "footer",
      sel: "footer.mk-footer",
      checks: [
        ["backgroundColor", "rgb(8, 9, 10)", (s) => s.backgroundColor],
        [
          "borderTop",
          "1px solid rgb(35, 37, 42)",
          (s) => `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
        ],
      ],
      sub: [
        {
          name: "footer inner padding",
          sel: ".mk-footer-inner",
          checks: [["paddingTop", "56px", (s) => s.paddingTop]],
        },
        {
          name: "footer link",
          sel: ".mk-footer-link",
          checks: [
            ["fontSize", "13px", (s) => s.fontSize],
            ["fontWeight", "400", (s) => s.fontWeight],
            ["letterSpacing", "-0.13px", (s) => s.letterSpacing],
            ["lineHeight", "19.5px", (s) => s.lineHeight],
            ["color", "rgb(138, 143, 152)", (s) => s.color],
            ["minHeight", "28px", (s, e) => Math.round(e.getBoundingClientRect().height) + "px"],
          ],
        },
      ],
    },
  ];
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: VP, height: VP === 1440 ? 900 : 844 } });
const page = await ctx.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);

const specs = SECTIONS(VP);
const results = [];
for (const sec of specs) {
  const group = { name: sec.name, rows: [] };
  const all = [{ name: sec.name, sel: sec.sel, checks: sec.checks }, ...(sec.sub || [])];
  for (const item of all) {
    const rows = await page.evaluate(
      ({ sel, checks }) => {
        /* Several elements can match a vocabulary class (nav links exist in
           both the desktop row and the mobile sheet). Prefer the first one
           that is actually rendered, so a check never grades a hidden node. */
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
        expected: px(expected),
        actual: rows[i].actual,
        ok: px(expected) === rows[i].actual,
      });
    });
  }
  results.push(group);
}

// section screenshots
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
  push("nav", document.querySelector("header.mk-nav"));
  document.querySelectorAll("main > section").forEach((s, i) => push("section-" + i, s));
  push("footer", document.querySelector("footer"));
  return out;
});
for (const s of shots) {
  if (s.w < 10 || s.h < 10) continue;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  try {
    await page.screenshot({
      path: path.join(OUT, `built-${VP}-${s.name}.png`),
      clip: { x: s.x, y: s.y, width: s.w, height: s.h },
      fullPage: true,
    });
  } catch (err) {
    console.warn("clip failed for", s.name, String(err).slice(0, 80));
  }
}

await browser.close();
fs.writeFileSync(path.join(OUT, `sections-${VP}.json`), JSON.stringify(results, null, 2));
let fails = 0;
for (const g of results) {
  const bad = g.rows.filter((r) => !r.ok);
  fails += bad.length;
  console.log(`\n[${g.name}] ${g.rows.length - bad.length}/${g.rows.length} match`);
  for (const r of bad)
    console.log(`  MISMATCH ${r.el} / ${r.prop}: expected ${r.expected}  got ${r.actual}`);
}
console.log("\nTOTAL MISMATCHES:", fails, "at", VP);
