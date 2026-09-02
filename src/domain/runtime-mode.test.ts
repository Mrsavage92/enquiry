import assert from "node:assert/strict";
import test from "node:test";
import {
  SERVER_AUTHORITATIVE_FIELDS,
  mayPersistField,
  mayUseFixtures,
  runtimeMode,
} from "./runtime-mode.ts";

test("an authenticated session is always live, even with a stale demo flag", () => {
  // The failure this prevents: a leftover demoMode boolean in storage showing a
  // real business someone else's fixture data.
  assert.equal(runtimeMode({ authenticated: true, demoMode: true }), "live");
  assert.equal(runtimeMode({ authenticated: true, demoMode: false }), "live");
});

test("demo mode only applies when signed out", () => {
  assert.equal(runtimeMode({ authenticated: false, demoMode: true }), "demo");
});

test("signed out without demo mode is still live, not demo by default", () => {
  assert.equal(runtimeMode({ authenticated: false, demoMode: false }), "live");
});

test("live mode persists no server-authoritative tenant content", () => {
  for (const f of SERVER_AUTHORITATIVE_FIELDS) {
    assert.equal(mayPersistField(f, "live"), false, `${f} must not persist in live mode`);
  }
});

test("presentation-only state still persists in live mode", () => {
  for (const f of ["businessFilter", "queueFilter", "brainTab", "installDismissed", "prefs"]) {
    assert.equal(mayPersistField(f, "live"), true, `${f} should persist`);
  }
});

test("demo mode persists everything, so the public demo keeps working", () => {
  for (const f of [...SERVER_AUTHORITATIVE_FIELDS, "businessFilter"]) {
    assert.equal(mayPersistField(f, "demo"), true);
  }
});

test("fixtures are demo-only", () => {
  assert.equal(mayUseFixtures("live"), false);
  assert.equal(mayUseFixtures("demo"), true);
});

test("the server-authoritative list covers every tenant-content field", () => {
  for (const f of ["businesses", "enquiries", "bookings", "audit"]) {
    assert.ok(
      (SERVER_AUTHORITATIVE_FIELDS as readonly string[]).includes(f),
      `${f} must be treated as server-authoritative`,
    );
  }
});
