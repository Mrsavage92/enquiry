#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.LAUNCH_QA_URL || "http://127.0.0.1:8080";
const OUT = "/workspace/screenshots";
mkdirSync(OUT, { recursive: true });

const fail = [];
const ok = [];

function note(pass, msg) {
  (pass ? ok : fail).push(msg);
  if (!pass) console.error("FAIL", msg);
  else console.log("ok  ", msg);
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/launch-${name}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const d = await desk.newPage();
  const p = await phone.newPage();
  d.setDefaultTimeout(15000);
  p.setDefaultTimeout(15000);

  // Marketing
  for (const path of ["/", "/how", "/roadmap", "/early-access", "/updates", "/privacy", "/terms"]) {
    const res = await d.goto(BASE + path, { waitUntil: "networkidle" });
    note(res?.ok() === true, `desk ${path} ${res?.status()}`);
    const text = await d.locator("body").innerText();
    note(text.length > 80, `desk ${path} has copy`);
  }
  await d.goto(BASE + "/", { waitUntil: "networkidle" });
  await shot(d, "home-desk");
  note(await d.getByRole("link", { name: /join early access/i }).count() > 0, "desk header join");
  note(await d.getByRole("link", { name: /privacy/i }).count() > 0, "footer privacy");
  note(await d.getByRole("link", { name: /terms/i }).count() > 0, "footer terms");

  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await shot(p, "home-phone");
  note(await p.getByRole("link", { name: /^join$/i }).count() > 0, "phone header join");
  await p.getByRole("button", { name: /menu/i }).click();
  note(await p.getByRole("link", { name: /open the app/i }).count() > 0, "phone menu open app");

  const missing = await d.goto(BASE + "/this-page-is-not-real", { waitUntil: "networkidle" });
  note(await d.getByText(/isn’t here/i).count() > 0, "404 copy");
  note(missing?.status() !== 500, `404 status ${missing?.status()}`);
  await shot(d, "404");

  // Waitlist
  await d.goto(BASE + "/early-access", { waitUntil: "networkidle" });
  const email = `launch-${Date.now()}@yourstudio.com`;
  await d.getByLabel(/email/i).fill(email);
  await d.getByRole("button", { name: /join early access/i }).click();
  await d.getByText(/you’re on the list/i).waitFor({ timeout: 10000 });
  note(true, "waitlist joined + qualify");
  await d.getByRole("button", { name: /skip for now/i }).click();
  await d.getByText(/early-access list/i).waitFor();
  await shot(d, "waitlist-done");

  await d.goto(BASE + "/", { waitUntil: "networkidle" });
  note(await d.getByText(/early-access list/i).count() > 0, "homepage compact done syncs");
  await shot(d, "home-joined");

  // App phone — send Priya
  await p.goto(BASE + "/enquiries", { waitUntil: "networkidle" });
  await p.evaluate(() => sessionStorage.clear());
  await p.reload({ waitUntil: "networkidle" });
  await shot(p, "app-today");
  const priya = p.getByText(/priya shah/i).first();
  await priya.click();
  await p.getByRole("button", { name: /send quote/i }).waitFor({ timeout: 10000 });
  await shot(p, "app-job");
  await p.getByRole("button", { name: /send quote/i }).click();
  await p.getByText(/^sent$/i).first().waitFor({ timeout: 8000 });
  note(true, "phone send shows Sent in thread");
  note(await p.getByRole("button", { name: /more on this job/i }).count() > 0, "phone post-send more");
  await shot(p, "app-sent");
  await p.getByRole("button", { name: /^more on this job$/i }).click();
  note(await p.getByRole("button", { name: /they accepted off-channel/i }).count() > 0, "phone waiting actions");
  await shot(p, "app-more");

  // App desk
  await d.goto(BASE + "/enquiries", { waitUntil: "networkidle" });
  await shot(d, "app-desk");
  note(await d.getByText(/priya shah/i).count() > 0, "desk queue has Priya");

  await d.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
  await shot(d, "onboarding");
  await p.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
  await shot(p, "onboarding-phone");

  await d.goto(BASE + "/privacy", { waitUntil: "networkidle" });
  await shot(d, "privacy");
  await d.goto(BASE + "/terms", { waitUntil: "networkidle" });
  await shot(d, "terms");
  await p.goto(BASE + "/how", { waitUntil: "networkidle" });
  await shot(p, "how-phone");
  await p.goto(BASE + "/roadmap", { waitUntil: "networkidle" });
  await shot(p, "roadmap-phone");

  await browser.close();
  console.log(`\n${ok.length} passed, ${fail.length} failed`);
  if (fail.length) {
    for (const f of fail) console.error(" -", f);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
