import { chromium } from "playwright";
import fs from "node:fs";

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 800, height: 600 } });
const p = await c.newPage();
const url = "data:image/png;base64," + fs.readFileSync(process.argv[2]).toString("base64");
await p.setContent(`<img id="i" src="${url}" style="display:block">`);
await p.waitForFunction(() => {
  const i = document.getElementById("i");
  return i && i.complete && i.naturalWidth > 0;
});
const pts = JSON.parse(process.argv[3]);
const r = await p.evaluate((pts) => {
  const img = document.getElementById("i");
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const cx = cv.getContext("2d");
  cx.drawImage(img, 0, 0);
  return pts.map(([x, y, label]) => {
    const d = cx.getImageData(x, y, 1, 1).data;
    return {
      label,
      x,
      y,
      rgb: `rgb(${d[0]}, ${d[1]}, ${d[2]})`,
      hex: "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""),
    };
  });
}, pts);
await b.close();
console.log(JSON.stringify(r, null, 1));
