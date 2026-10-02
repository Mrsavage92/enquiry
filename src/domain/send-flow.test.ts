import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CHECK_INTERVAL_MS,
  SEND_TEXT,
  auDigits,
  checkDelay,
  copyText,
  openLink,
  openLinksEnabled,
  settledLine,
  smsHref,
  waHref,
} from "./send-flow.ts";
import type { Enquiry } from "./types.ts";

test("a pre-check starts at most once every 2 seconds per enquiry", () => {
  assert.equal(checkDelay(null, 10_000), 0);
  assert.equal(checkDelay(10_000, 10_000), CHECK_INTERVAL_MS);
  assert.equal(checkDelay(10_000, 11_500), 500);
  assert.equal(checkDelay(10_000, 12_000), 0);
  assert.equal(checkDelay(10_000, 30_000), 0);
});

test("Copy calls writeText synchronously in the tap, with nothing awaited before it", async () => {
  const calls: string[] = [];
  const g = globalThis as { navigator?: unknown };
  const before = g.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: (t: string) => {
          calls.push(t);
          return Promise.resolve();
        },
      },
    },
  });
  try {
    const done = copyText("Hi Tom");
    // Called before the promise settles: the write is the first statement.
    assert.deepEqual(calls, ["Hi Tom"]);
    await done;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText: () => Promise.reject(new Error("NotAllowedError")) } },
    });
    await assert.rejects(copyText("x"), /NotAllowedError/);
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
    await assert.rejects(copyText("x"), "a missing clipboard is a failure, never a false Copied");
  } finally {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: before });
  }
  // The handler source keeps the rule: no await before writeText.
  const src = readFileSync(new URL("./send-flow.ts", import.meta.url), "utf8");
  const body = src.slice(
    src.indexOf("export function copyText"),
    src.indexOf("export function auDigits"),
  );
  assert.ok(
    body.indexOf("writeText") < (body.includes("await") ? body.indexOf("await") : Infinity),
  );
});

test("numbers become 61... for sms and wa.me; iOS uses &body=, Android ?body=", () => {
  assert.equal(auDigits("0412 555 019"), "61412555019");
  assert.equal(auDigits("+61 412 555 019"), "61412555019");
  assert.equal(auDigits("12345"), null);
  const body = "Hi Tom,\n\nFor the job, that comes to $2,040 & more.";
  const ios = smsHref(
    "0412 555 019",
    body,
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)",
  );
  assert.equal(ios, `sms:+61412555019&body=${encodeURIComponent(body)}`);
  const android = smsHref("0412 555 019", body, "Mozilla/5.0 (Linux; Android 15)");
  assert.equal(android, `sms:+61412555019?body=${encodeURIComponent(body)}`);
  assert.match(android!, /%0A%0AFor/);
  assert.equal(waHref("0412555019", "Hi"), "https://wa.me/61412555019?text=Hi");
});

test("Open in Messages only for an enquiry that came by text, and only behind the flag", () => {
  const sms = { source: "sms", customerPhone: "0412 555 019" } as Pick<
    Enquiry,
    "source" | "customerPhone"
  >;
  assert.equal(openLink(sms, "Hi", "Android")?.label, "Open in Messages");
  assert.equal(openLink({ ...sms, source: "email" }, "Hi", "Android"), null);
  assert.equal(openLink({ ...sms, customerPhone: "" }, "Hi", "Android"), null);
  assert.equal(openLinksEnabled(null), false, "off by default");
  assert.equal(openLinksEnabled({ getItem: () => null }), false);
  assert.equal(openLinksEnabled({ getItem: () => "on" }), true);
  assert.equal(
    openLinksEnabled({
      getItem: () => {
        throw new Error("blocked");
      },
    }),
    false,
  );
});

test("the settled line names every promise and refusal after the count", () => {
  const enquiry = {
    decision: {
      asked: [
        { id: "service", kind: "service", text: "Interior painting", status: "answered" },
        { id: "q", kind: "question", text: "Ceilings", status: "come_back" },
        { id: "d", kind: "date", text: "Sat 14 Nov", status: "answered", closed: true },
        { id: "x", kind: "extra", text: "Deck", status: "left_out" },
        { id: "o", kind: "extra", text: "Oven", status: "open" },
      ],
    },
  } as unknown as Pick<Enquiry, "decision">;
  const line = settledLine(
    enquiry,
    "Just let me know if you'd like to go ahead and I'll confirm the day.",
  );
  assert.equal(line.count, 4);
  assert.deepEqual(line.parts, ["back on ceilings", "not Sat 14 Nov", "no deck", "day to confirm"]);
});

test("the string table has no em dash and no product name", () => {
  for (const value of Object.values(SEND_TEXT)) {
    const text = typeof value === "function" ? value("2:14 pm") : value;
    assert.doesNotMatch(text, /—/);
    assert.doesNotMatch(text, /\bEnquiry\b/);
  }
  assert.equal(SEND_TEXT.copiedOnReturn("2:14 pm"), "You copied this at 2:14 pm. Sent it?");
});
