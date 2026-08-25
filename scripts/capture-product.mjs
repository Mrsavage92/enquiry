import { chromium } from "playwright";
import { mkdir, cp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] || "http://127.0.0.1:8080";
const out = "/workspace/public/product";
await mkdir(out, { recursive: true });
await mkdir("/tmp/enquiry-film", { recursive: true });

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
  });
}

const browser = await chromium.launch({ headless: true });

async function phonePage() {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  return page;
}

const phone = await phonePage();
await phone.screenshot({ path: `${out}/phone-today.png` });

await phone.goto(`${base}/enquiries/f01`, { waitUntil: "networkidle" });
await phone.waitForTimeout(400);
await phone.screenshot({ path: `${out}/phone-job.png` });

await phone.getByRole("button", { name: "Thread" }).click();
await phone.waitForTimeout(400);
await phone.screenshot({ path: `${out}/phone-thread.png` });
await phone.keyboard.press("Escape");
await phone.waitForTimeout(200);

await phone.goto(`${base}/enquiries/f07`, { waitUntil: "networkidle" });
await phone.waitForTimeout(400);
await phone.screenshot({ path: `${out}/phone-photo.png` });

await phone.goto(`${base}/enquiries/f04`, { waitUntil: "networkidle" });
await phone.waitForTimeout(400);
await phone.screenshot({ path: `${out}/phone-paint.png` });

await phone.goto(`${base}/bookings`, { waitUntil: "networkidle" });
await phone.waitForTimeout(400);
await phone.screenshot({ path: `${out}/phone-booked.png` });
await phone.close();

const desk = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
await desk.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await desk.evaluate(() => sessionStorage.clear());
await desk.reload({ waitUntil: "networkidle" });
await desk.waitForTimeout(500);
await desk.goto(`${base}/enquiries/f01`, { waitUntil: "networkidle" });
await desk.waitForTimeout(500);
await desk.screenshot({ path: `${out}/desk.png` });

await desk.goto(`${base}/q/f01`, { waitUntil: "networkidle" });
await desk.waitForTimeout(400);
await desk.screenshot({ path: `${out}/quote.png` });
await desk.close();

const phoneCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir: "/tmp/enquiry-film", size: { width: 390, height: 844 } },
});
const phoneVid = await phoneCtx.newPage();
await phoneVid.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await phoneVid.evaluate(() => sessionStorage.clear());
await phoneVid.reload({ waitUntil: "networkidle" });
await phoneVid.waitForTimeout(800);
await phoneVid.locator("a[href*='/enquiries/f01']").first().click();
await phoneVid.waitForTimeout(1600);
await phoneVid.getByRole("button", { name: /Send quote/i }).click();
await phoneVid.waitForTimeout(1800);
const phoneWebm = await phoneVid.video().path();
await phoneCtx.close();

const deskCtx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: "/tmp/enquiry-film", size: { width: 1280, height: 720 } },
});
const deskVid = await deskCtx.newPage();
await deskVid.goto(`${base}/enquiries`, { waitUntil: "networkidle" });
await deskVid.evaluate(() => sessionStorage.clear());
await deskVid.reload({ waitUntil: "networkidle" });
await deskVid.waitForTimeout(600);
await deskVid.goto(`${base}/enquiries/f01`, { waitUntil: "networkidle" });
await deskVid.waitForTimeout(1400);
await deskVid.getByRole("button", { name: /Send quote/i }).click();
await deskVid.waitForTimeout(1800);
const deskWebm = await deskVid.video().path();
await deskCtx.close();

await browser.close();

await ffmpeg([
  "-y", "-i", phoneWebm,
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an",
  "-movflags", "+faststart",
  `${out}/send-phone.mp4`,
]);
await ffmpeg([
  "-y", "-i", deskWebm,
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an",
  "-movflags", "+faststart",
  `${out}/send.mp4`,
]);

await cp(`${out}/phone-job.png`, "/workspace/public/og.jpg");
await cp(`${out}/phone-job.png`, "/workspace/public/film/quote-still.jpg");
await cp(`${out}/send-phone.mp4`, "/workspace/public/film/send-phone.mp4");
await cp(`${out}/send.mp4`, "/workspace/public/film/send.mp4");

console.log("captured", out);
