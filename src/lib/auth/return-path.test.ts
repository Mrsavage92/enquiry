import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_RETURN_PATH, safeReturnPath, safeReturnUrl } from "./return-path.ts";

const APP_ORIGIN = "https://enquiry.example";

test("normal in-app paths survive intact, including query and hash", () => {
  assert.equal(safeReturnPath("/enquiries"), "/enquiries");
  assert.equal(safeReturnPath("/enquiries/f01?tab=why"), "/enquiries/f01?tab=why");
  assert.equal(safeReturnPath("/business#pricing"), "/business#pricing");
  assert.equal(safeReturnPath("/trust/automation?x=1&y=2"), "/trust/automation?x=1&y=2");
});

test("protocol-relative URLs are rejected", () => {
  // The original bug: this starts with "/" and resolves to another host.
  assert.equal(safeReturnPath("//evil.example"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("//evil.example/path"), DEFAULT_RETURN_PATH);
});

test("backslash authority tricks are rejected", () => {
  assert.equal(safeReturnPath("/\\evil.example"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("\\\\evil.example"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("/path\\..\\evil"), DEFAULT_RETURN_PATH);
});

test("absolute URLs and foreign schemes are rejected", () => {
  assert.equal(safeReturnPath("https://evil.example"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("http://evil.example"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("javascript:alert(1)"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("data:text/html,<script>"), DEFAULT_RETURN_PATH);
});

test("encoded host-changing forms are rejected", () => {
  assert.equal(safeReturnPath("/%2F%2Fevil.example"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("/%5Cevil.example"), DEFAULT_RETURN_PATH);
});

test("malformed, empty and non-string values fall back", () => {
  assert.equal(safeReturnPath("/%E0%A4%A"), DEFAULT_RETURN_PATH); // bad escape
  assert.equal(safeReturnPath(""), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("   "), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath(undefined), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath(null), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath(42), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath({ toString: () => "/enquiries" }), DEFAULT_RETURN_PATH);
});

test("relative paths without a leading slash fall back", () => {
  assert.equal(safeReturnPath("enquiries"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("../admin"), DEFAULT_RETURN_PATH);
});

test("a caller's deliberate fallback is honoured", () => {
  assert.equal(safeReturnPath("//evil.example", "/settings"), "/settings");
});

test("every accepted path resolves without changing the application origin", () => {
  const candidates = [
    "/enquiries",
    "/enquiries/f01?tab=why",
    "/business#pricing",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/%2F%2Fevil.example",
    "",
  ];
  for (const candidate of candidates) {
    const resolved = new URL(safeReturnPath(candidate), APP_ORIGIN);
    assert.equal(
      resolved.origin,
      APP_ORIGIN,
      `${candidate} escaped the origin as ${resolved.origin}`,
    );
  }
});

test("safeReturnUrl builds an absolute URL that stays on the app origin", () => {
  assert.equal(
    safeReturnUrl("/enquiries/f01?tab=why", APP_ORIGIN),
    "https://enquiry.example/enquiries/f01?tab=why",
  );
  assert.equal(
    safeReturnUrl("//evil.example", APP_ORIGIN),
    `${APP_ORIGIN}${DEFAULT_RETURN_PATH}`,
  );
  assert.equal(
    new URL(safeReturnUrl("javascript:alert(1)", APP_ORIGIN)).origin,
    APP_ORIGIN,
  );
});
