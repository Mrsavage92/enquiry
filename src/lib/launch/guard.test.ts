import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asString,
  canonicalFeatureId,
  featureIdFamily,
  honeypotFilled,
  isAllowedEvent,
  isAllowedFeature,
  isEmail,
  isUuid,
  rateLimit,
  resetRateLimit,
  sanitizePath,
} from "./guard.ts";

test("email accepts studio addresses and plus tags", () => {
  assert.equal(isEmail("mina@glow.studio"), true);
  assert.equal(isEmail("owner+waitlist@studio.example"), true);
});

test("email rejects junk", () => {
  assert.equal(isEmail(""), false);
  assert.equal(isEmail("not-an-email"), false);
  assert.equal(isEmail("a@b.c"), false);
  assert.equal(isEmail("owner@localhost"), false);
  assert.equal(isEmail("owner@.studio"), false);
  assert.equal(isEmail("a".repeat(250) + "@x.co"), false);
});

test("uuid is strict", () => {
  assert.equal(isUuid("3c7116e8-bef2-410c-b59a-d235086c6b34"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid(""), false);
});

test("paths cannot be protocols or protocol-relative", () => {
  assert.equal(sanitizePath("/early-access"), "/early-access");
  assert.equal(sanitizePath("javascript:alert(1)"), "/");
  assert.equal(sanitizePath("//evil.example"), "/");
  assert.equal(sanitizePath("https://evil.example"), "/");
  assert.equal(sanitizePath("/roadmap?utm_source=li"), "/roadmap?utm_source=li");
});

test("events and features are allowlisted", () => {
  assert.equal(isAllowedEvent("page_view"), true);
  assert.equal(isAllowedEvent("drop_table"), false);
  assert.equal(isAllowedFeature("understand"), true);
  assert.equal(isAllowedFeature("continuity"), true);
  assert.equal(isAllowedFeature("keep-moving"), true);
  assert.equal(isAllowedFeature("prove"), true);
  assert.equal(isAllowedFeature("pipeline"), true);
  assert.equal(isAllowedFeature(""), true);
  assert.equal(isAllowedFeature("'; drop table waitlist --"), false);
});

test("legacy roadmap interest IDs map onto current eras", () => {
  assert.equal(canonicalFeatureId("pipeline"), "keep-moving");
  assert.equal(canonicalFeatureId("autopilot"), "trusted-action");
  assert.equal(canonicalFeatureId("learn"), "business-brain");
  assert.equal(canonicalFeatureId("prove"), "understand");
  assert.equal(canonicalFeatureId("continuity"), "continuity");
  assert.ok(featureIdFamily("keep-moving").includes("pipeline"));
  assert.ok(featureIdFamily("trusted-action").includes("autopilot"));
});

test("honeypot trips on any filled trap", () => {
  assert.equal(honeypotFilled(""), false);
  assert.equal(honeypotFilled("https://spam.example"), true);
  assert.equal(honeypotFilled(undefined), false);
});

test("asString trims and caps", () => {
  assert.equal(asString("  hi  ", 2), "hi");
  assert.equal(asString(12), "");
});

test("rate limit rejects after the window fills", () => {
  resetRateLimit();
  const now = 1_000_000;
  assert.equal(rateLimit("t:1", 2, 1000, now), true);
  assert.equal(rateLimit("t:1", 2, 1000, now + 1), true);
  assert.equal(rateLimit("t:1", 2, 1000, now + 2), false);
  assert.equal(rateLimit("t:1", 2, 1000, now + 1001), true);
});
