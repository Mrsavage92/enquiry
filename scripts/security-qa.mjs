import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

const d = await desktop.newPage();
d.on("pageerror", (e) => errors.push(`desk: ${e.message}`));
const p = await phone.newPage();
p.on("pageerror", (e) => errors.push(`phone: ${e.message}`));

await d.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
const homeText = await d.locator("body").innerText();
if (!/Stop managing enquiries|Enquiry/i.test(homeText)) throw new Error("home missing copy");
const trap = d.locator('form input[tabindex="-1"]');
if (await trap.count()) {
  const hidden = await trap.first().evaluate((el) => {
    const parent = el.closest("[aria-hidden]");
    const r = el.getBoundingClientRect();
    return Boolean(parent) && r.width <= 2 && r.height <= 2;
  });
  if (!hidden) throw new Error("honeypot visible");
}
await shot(d, "sec-home");

await d.goto("http://127.0.0.1:8080/privacy", { waitUntil: "networkidle" });
if (!/What we collect/i.test(await d.locator("body").innerText())) throw new Error("privacy missing");
await shot(d, "sec-privacy");

await d.goto("http://127.0.0.1:8080/terms", { waitUntil: "networkidle" });
if (!/The waitlist/i.test(await d.locator("body").innerText())) throw new Error("terms missing");

await d.goto("http://127.0.0.1:8080/q/f01", { waitUntil: "networkidle" });
const qText = await d.locator("body").innerText();
if (!/Ask a question|Accept this quote/i.test(qText)) throw new Error("quote page missing actions");
if (/Back to owner/i.test(qText)) throw new Error("quote page leaks owner chrome");
await d.getByRole("button", { name: "Ask a question" }).click();
await d.getByPlaceholder("Could we move the date?").fill("Can you do Sunday instead?");
await d.getByRole("button", { name: "Send question" }).click();
await d.waitForTimeout(400);
const afterAsk = await d.locator("body").innerText();
if (!/Question sent/i.test(afterAsk)) throw new Error("question not recorded");
if (/Accept this quote/i.test(afterAsk)) throw new Error("accept still showing after question");
await shot(d, "sec-quote-asked");

await d.goto("http://127.0.0.1:8080/book/missing", { waitUntil: "networkidle" });
const missing = await d.locator("body").innerText();
if (/Back to (owner )?bookings/i.test(missing)) throw new Error("missing booking leaks operator");
await shot(d, "sec-book-missing");

await p.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await shot(p, "sec-home-phone");
const join = p.getByRole("link", { name: /Join/i }).first();
if (!(await join.count())) throw new Error("mobile join CTA missing");

await p.goto("http://127.0.0.1:8080/enquiries", { waitUntil: "networkidle" });
const today = await p.locator("body").innerText();
if (!/Priya|need you|Today/i.test(today)) throw new Error("app queue empty");
await shot(p, "sec-app-today");

console.log(JSON.stringify({ ok: errors.length === 0, errors }, null, 2));
if (errors.length) process.exit(1);
await browser.close();
