import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "http://127.0.0.1:8080";
await mkdir("/tmp/hero/desk", { recursive: true });

function persistBoot() {
  sessionStorage.setItem(
    "enquiry-proto-v8",
    JSON.stringify({
      state: {
        onboarded: true,
        demoMode: true,
        arrivalPlayed: true,
        lastArrivalId: "f01",
        installDismissed: true,
        onboardingStep: 8,
      },
      version: 0,
    }),
  );
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: "/tmp/hero/desk", size: { width: 1600, height: 900 } },
});
await context.addInitScript(persistBoot);
const page = await context.newPage();
await page.goto(`${BASE}/enquiries/f01`, { waitUntil: "networkidle" });
const send = page.getByRole("button", { name: /Send quote/i });
await send.waitFor({ timeout: 10000 });
await page.waitForTimeout(2400);
await send.click();
await page.getByText(/^Sent\.?$/).first().waitFor({ timeout: 8000 });
await page.waitForTimeout(2200);
await page.getByText(/Yes that works/i).waitFor({ timeout: 12000 });
await page.getByText(/^Booked$|booked/i).first().waitFor({ timeout: 8000 });
await page.waitForTimeout(3000);
await context.close();
await browser.close();
console.log("desk done");
