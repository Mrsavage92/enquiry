import { chromium } from "playwright";

/*
  Measures the gap between a route's page-header's last content element and
  the first element of the next block, at a given viewport. Selectors are
  keyed per-route to match each route's actual markup (read from source).

  Usage: node header-gap.mjs [--port=5283] [--vp=1440|390]
*/
const flags = {};
for (const a of process.argv.slice(2)) {
  const m = /^--(port|vp)=(.*)$/.exec(a);
  if (m) flags[m[1]] = m[2];
}
const PORT = flags.port || "5283";
const VP = Number(flags.vp || "1440");
const BASE = `http://127.0.0.1:${PORT}`;
const HEIGHT = VP === 1440 ? 900 : 844;

const ROUTES = {
  "/how": {
    lastSel: "main section:first-of-type .mk-lede",
    nextSel: "main section:nth-of-type(2) .mk-label",
  },
  "/early-access": {
    lastSel: "main section:first-of-type .mt-10",
    nextSel: "main section:nth-of-type(2) h2.mk-h2",
  },
  "/updates": {
    lastSel: "main section:first-of-type .mk-lede",
    nextSel: "main .mk-divider",
  },
  "/roadmap": {
    lastSel: "main section:first-of-type",
    nextSel: "main section:first-of-type + div",
  },
  "/demo": {
    lastSel: "main section:first-of-type .mk-lede",
    nextSel: "main section:first-of-type .mk-page",
  },
};

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: VP, height: HEIGHT } });
const p = await c.newPage();

const results = {};
for (const [route, sel] of Object.entries(ROUTES)) {
  await p.goto(BASE + route, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const r = await p.evaluate(({ lastSel, nextSel }) => {
    const lastEl = document.querySelector(lastSel);
    const nextEl = document.querySelector(nextSel);
    const lastRect = lastEl ? lastEl.getBoundingClientRect() : null;
    const nextRect = nextEl ? nextEl.getBoundingClientRect() : null;
    const lastBottom = lastRect ? Math.round(lastRect.bottom + scrollY) : null;
    const nextTop = nextRect ? Math.round(nextRect.top + scrollY) : null;
    return {
      lastFound: !!lastEl,
      nextFound: !!nextEl,
      lastBottom,
      nextTop,
      gap: lastBottom !== null && nextTop !== null ? nextTop - lastBottom : null,
      h1Top: (() => {
        const h1 = document.querySelector("h1");
        return h1 ? Math.round(h1.getBoundingClientRect().top + scrollY) : null;
      })(),
    };
  }, sel);
  results[route] = r;
}

console.log(`viewport=${VP}x${HEIGHT}`);
console.log(JSON.stringify(results, null, 2));
await c.close();
await b.close();
