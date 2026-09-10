import { chromium } from "playwright";

/*
  Usage: node geom.mjs [--route=/roadmap] [--port=5273]
  --route and --port default to "/" and 5261 (home, the original hardcoded
  values), matching the flag sections.mjs and contrast.mjs now share.
*/
const flags = {};
for (const a of process.argv.slice(2)) {
  const m = /^--(route|port)=(.*)$/.exec(a);
  if (m) flags[m[1]] = m[2];
}
const ROUTE = flags.route || "/";
const BASE = `http://127.0.0.1:${flags.port || "5261"}`;

const b = await chromium.launch();
for (const w of [1440, 390]) {
  const c = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await c.newPage();
  await p.goto(BASE + ROUTE, { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    const g = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.width)];
    };
    return {
      h1: g("h1.mk-h1"),
      lede: g("main > section:first-of-type .mk-lede"),
      media: g(".mk-media"),
      container: g(".mk-container"),
      page: g(".mk-page"),
      navInner: g(".mk-nav-inner"),
      wordmark: g(".mk-wordmark"),
      entryAside: g(".mk-entry-aside"),
      entryBody: g(".mk-entry-body"),
      entryRule: g(".mk-entry-rule"),
      entryMarker: g(".mk-entry-marker"),
      divider: g(".mk-divider"),
      footerBrand: g(".mk-footer-brand"),
      footerCol2: (() => {
        const e = document.querySelectorAll(".mk-footer-grid > div")[1];
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return [Math.round(r.left), Math.round(r.width)];
      })(),
      h1Top: (() => {
        const e = document.querySelector("h1.mk-h1");
        return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null;
      })(),
    };
  });
  console.log(w, JSON.stringify(r, null, 0));
  await c.close();
}
await b.close();
