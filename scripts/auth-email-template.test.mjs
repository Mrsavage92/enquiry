import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../emails/magic-link.html", import.meta.url), "utf8");

test("magic-link email preserves the provider verification URL in every action", () => {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(hrefs, ["{{ .ConfirmationURL }}", "{{ .ConfirmationURL }}"]);
  assert.doesNotMatch(html, /localhost|TokenHash|\.RedirectTo|\.SiteURL/);
});

test("magic-link email remains self-contained and email-client compatible", () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /role="presentation"/);
  assert.match(html, /\[if mso\]/);
  assert.match(html, /prefers-color-scheme: dark/);
  assert.doesNotMatch(html, /<script|<iframe|<form|<img|@import|<link\b/i);
  assert.ok(Buffer.byteLength(html) < 20_000, "Keep the transactional email small");
});

test("magic-link email has a clear action without unsupported login claims", () => {
  assert.match(html, /Sign in to Enquiry/);
  assert.match(html, /This link can only be used once/);
  assert.match(html, /Didn't request this email/);
  assert.doesNotMatch(html, /You are signed in|successfully signed|expires in \d+/i);
});
