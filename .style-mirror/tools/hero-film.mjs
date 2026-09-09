import { chromium } from "playwright";

/*
  Proves the hero film starts playing on load without a scroll.

  SiteVideo starts playback only when its IntersectionObserver reports
  intersectionRatio >= 0.5, so this measures the real ratio against the
  viewport and then reads the element's own `paused` and `currentTime` after
  giving it a moment. A ratio alone is not proof - a video can be in view and
  still not play - so both are checked.
*/

const BASE = process.argv[2] || "http://127.0.0.1:5261";
const browser = await chromium.launch();

for (const [w, h] of [
  [1440, 900],
  [390, 844],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3500);

  const r = await page.evaluate(() => {
    const vids = [...document.querySelectorAll("video")];
    const vh = window.innerHeight;
    return {
      scrollY: window.scrollY,
      videos: vids.map((v) => {
        const b = v.getBoundingClientRect();
        const visible = Math.max(0, Math.min(b.bottom, vh) - Math.max(b.top, 0));
        return {
          src: v.getAttribute("src"),
          top: Math.round(b.top),
          height: Math.round(b.height),
          width: Math.round(b.width),
          visiblePx: Math.round(visible),
          ratio: b.height ? Math.round((visible / b.height) * 1000) / 1000 : 0,
          paused: v.paused,
          currentTime: Math.round(v.currentTime * 100) / 100,
          readyState: v.readyState,
          poster: v.getAttribute("poster"),
        };
      }),
    };
  });

  console.log(`\n=== ${w}x${h}  scrollY=${r.scrollY}`);
  for (const v of r.videos) {
    const gate = v.ratio >= 0.5 ? "IN VIEW >=0.5" : "BELOW 0.5";
    console.log(
      `  ${v.src}\n    box top=${v.top} ${v.width}x${v.height}  visible=${v.visiblePx}px ratio=${v.ratio}  ${gate}  paused=${v.paused} t=${v.currentTime} readyState=${v.readyState} poster=${v.poster}`,
    );
  }
  await ctx.close();
}
await browser.close();
