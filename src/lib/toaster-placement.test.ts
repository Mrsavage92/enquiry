import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Review 5b: on /enquiries/:id the toaster is top-centred, but a phone rule
 * forced `bottom` on every toaster with !important. The list then spanned
 * y 8..772, sat above everything, and swallowed the tap on "Yes, 25 square
 * metres" and "That's everything" while a toast showed. These checks read the
 * shipped CSS so the rule cannot come back.
 */
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const root = readFileSync(new URL("../routes/__root.tsx", import.meta.url), "utf8");

function rules(selectorPart: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1]!.replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (selector.includes(selectorPart)) out.push({ selector, body: m[2]! });
  }
  return out;
}

test("no toaster rule pins an edge for every position", () => {
  for (const r of rules("[data-sonner-toaster]")) {
    const pinsEdge = /(^|\s|;)(top|bottom)\s*:/.test(r.body);
    if (!pinsEdge) continue;
    assert.match(
      r.selector,
      /data-y-position=["']?(top|bottom)/,
      `"${r.selector}" sets top/bottom for every toaster position`,
    );
  }
});

test("a top toaster releases the bottom edge, a bottom toaster releases the top", () => {
  const top = rules('[data-y-position="top"]').find((r) => r.selector.includes("app-root"));
  const bottom = rules('[data-y-position="bottom"]').find((r) => r.selector.includes("app-root"));
  assert.ok(top && /bottom:\s*auto/.test(top.body), "top toaster must set bottom: auto");
  assert.ok(bottom && /top:\s*auto/.test(bottom.body), "bottom toaster must set top: auto");
});

test("the toaster list never takes a tap; only a visible toast does", () => {
  const list = rules("[data-sonner-toaster]").find(
    (r) => r.selector.trim() === "[data-sonner-toaster]",
  );
  assert.ok(list && /pointer-events:\s*none/.test(list.body), "toaster list must be click-through");
  const toast = rules("[data-sonner-toast]").find((r) => /pointer-events:\s*auto/.test(r.body));
  assert.ok(toast, "a visible toast must stay tappable (Undo)");
});

test("enquiry screens still place toasts at the top, other screens at the bottom", () => {
  assert.match(root, /onEnquiry \? "top-center" : "bottom-center"/);
});
