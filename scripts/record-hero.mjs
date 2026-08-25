import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "http://127.0.0.1:8080";
await mkdir("/tmp/hero/phone", { recursive: true });

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
  viewport: { width: 390, height: 694 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir: "/tmp/hero/phone", size: { width: 390, height: 694 } },
});
await context.addInitScript(persistBoot);
const page = await context.newPage();
await page.goto(`${BASE}/enquiries`, { waitUntil: "networkidle" });
await page.getByText("Just arrived").waitFor({ timeout: 10000 });
await page.waitForTimeout(1400);
await page.getByRole("button", { name: /Priya Shah/i }).first().click();
const send = page.getByRole("button", { name: /Send quote/i });
await send.waitFor({ timeout: 8000 });
await page.waitForTimeout(1800);
await page.getByRole("button", { name: /Hi Priya/i }).click();
const ta = page.locator("textarea").first();
await ta.waitFor({ timeout: 8000 });
await page.waitForTimeout(700);
await ta.evaluate(async (el) => {
  el.scrollTop = 0;
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  const steps = 28;
  for (let i = 1; i <= steps; i++) {
    el.scrollTop = (max * i) / steps;
    await new Promise((r) => setTimeout(r, 38));
  }
});
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Done" }).click();
await send.waitFor({ state: "visible", timeout: 8000 });
await page.waitForTimeout(2000);
await send.click();
await page.getByText(/^Sent$/).first().waitFor({ timeout: 8000 });
await page.getByText(/Hi Priya/i).first().waitFor({ timeout: 8000 });
await page.waitForTimeout(1100);
const thread = page.locator("ol").first();
await thread.evaluate(async (el) => {
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  const steps = 36;
  for (let i = 1; i <= steps; i++) {
    el.scrollTop = (max * i) / steps;
    await new Promise((r) => setTimeout(r, 42));
  }
});
await page.waitForTimeout(1600);
await page.getByText(/Yes that works/i).waitFor({ timeout: 12000 });
await page.waitForTimeout(700);
await page.getByText(/^Booked$/).first().waitFor({ timeout: 8000 });
await page.waitForTimeout(2800);
await context.close();
await browser.close();
console.log("phone done");
