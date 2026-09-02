import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_COMPLETE_PATH,
  authReturnUrl,
  isLoopbackHostname,
  requireAuthReturnUrl,
  resolveAuthOrigin,
} from "./origin.ts";

const PROD_ORIGIN = "https://app.enquiry.example";

function ok(result: ReturnType<typeof resolveAuthOrigin>) {
  assert.equal(result.ok, true, `expected ok, got ${JSON.stringify(result)}`);
  return result as Extract<typeof result, { ok: true }>;
}

test("production uses the configured HTTPS origin", () => {
  const result = ok(
    resolveAuthOrigin({
      configuredOrigin: PROD_ORIGIN,
      environment: "production",
      runtimeOrigin: "http://localhost:8080",
    }),
  );
  assert.equal(result.origin, PROD_ORIGIN);
  assert.equal(result.source, "configured");
});

test("production never falls back to the browser origin", () => {
  const result = resolveAuthOrigin({
    configuredOrigin: "",
    environment: "production",
    runtimeOrigin: PROD_ORIGIN,
  });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "missing-public-origin");
});

test("production rejects every spelling of loopback", () => {
  for (const origin of [
    "https://localhost",
    "https://localhost:8080",
    "https://127.0.0.1:8080",
    "https://127.1",
    "https://[::1]:8080",
    "https://0.0.0.0",
    "https://app.localhost",
  ]) {
    const result = resolveAuthOrigin({
      configuredOrigin: origin,
      environment: "production",
    });
    assert.equal(result.ok, false, `${origin} should be rejected`);
    assert.equal(result.ok === false && result.reason, "loopback-in-production", origin);
  }
});

test("production rejects a non-HTTPS origin", () => {
  const result = resolveAuthOrigin({
    configuredOrigin: "http://app.enquiry.example",
    environment: "production",
  });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "insecure-scheme");
});

test("an origin carrying a path, query or fragment is a configuration error", () => {
  for (const origin of [
    "https://app.enquiry.example/app",
    "https://app.enquiry.example/?x=1",
    "https://app.enquiry.example/#/",
    "app.enquiry.example",
    "not a url",
  ]) {
    const result = resolveAuthOrigin({ configuredOrigin: origin, environment: "production" });
    assert.equal(result.ok, false, origin);
    assert.equal(result.ok === false && result.reason, "malformed-origin", origin);
  }
});

test("development may resolve to loopback from the browser", () => {
  const result = ok(
    resolveAuthOrigin({
      configuredOrigin: null,
      environment: "development",
      runtimeOrigin: "http://localhost:8080",
    }),
  );
  assert.equal(result.origin, "http://localhost:8080");
  assert.equal(result.source, "runtime");
});

test("development still prefers an explicitly configured origin", () => {
  const result = ok(
    resolveAuthOrigin({
      configuredOrigin: "http://127.0.0.1:8080",
      environment: "development",
      runtimeOrigin: "http://localhost:8080",
    }),
  );
  assert.equal(result.origin, "http://127.0.0.1:8080");
  assert.equal(result.source, "configured");
});

test("development with no browser origin fails rather than guessing", () => {
  const result = resolveAuthOrigin({ environment: "development", runtimeOrigin: null });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "malformed-origin");
});

test("return URLs stay on the resolved origin and land on the completion route", () => {
  const url = new URL(authReturnUrl(PROD_ORIGIN, "/enquiries/f01?tab=why"));
  assert.equal(url.origin, PROD_ORIGIN);
  assert.equal(url.pathname, AUTH_COMPLETE_PATH);
  assert.equal(url.searchParams.get("redirect"), "/enquiries/f01?tab=why");
});

test("an unsafe return path cannot change the host of the return URL", () => {
  for (const hostile of [
    "//evil.example",
    "https://evil.example/enquiries",
    String.raw`/\evil.example`,
    "javascript:alert(1)",
    "/%2F%2Fevil.example",
  ]) {
    const url = new URL(authReturnUrl(PROD_ORIGIN, hostile));
    assert.equal(url.origin, PROD_ORIGIN, hostile);
    assert.equal(url.searchParams.get("redirect"), "/enquiries", hostile);
  }
});

test("no production return URL can contain a loopback host", () => {
  // The whole point of the slice: a link that reaches a customer's inbox.
  const url = requireAuthReturnUrl(
    {
      configuredOrigin: PROD_ORIGIN,
      environment: "production",
      runtimeOrigin: "http://localhost:8080",
    },
    "/enquiries",
  );
  assert.ok(!url.includes("localhost"));
  assert.ok(!url.includes("127.0.0.1"));
  assert.ok(url.startsWith(`${PROD_ORIGIN}${AUTH_COMPLETE_PATH}`));
});

test("a misconfigured production deployment throws instead of mailing a dead link", () => {
  assert.throws(
    () => requireAuthReturnUrl({ environment: "production", runtimeOrigin: "http://localhost:8080" }),
    /VITE_PUBLIC_APP_ORIGIN/,
  );
});

test("isLoopbackHostname covers the reserved forms", () => {
  assert.equal(isLoopbackHostname("LOCALHOST"), true);
  assert.equal(isLoopbackHostname("127.0.0.53"), true);
  assert.equal(isLoopbackHostname("[::1]"), true);
  assert.equal(isLoopbackHostname("enquiry.example"), false);
  assert.equal(isLoopbackHostname("notlocalhost"), false);
});
