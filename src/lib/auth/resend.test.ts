import assert from "node:assert/strict";
import test from "node:test";
import {
  RESEND_COOLDOWN_MS,
  canResend,
  cooldownSeconds,
  resendCooldownRemainingMs,
  resendLabel,
} from "./resend.ts";

test("the first send is never blocked", () => {
  assert.equal(resendCooldownRemainingMs(null, 1_000), 0);
  assert.equal(canResend(null, 1_000), true);
});

test("a send blocks the next one for the cooldown, then releases exactly once", () => {
  const t0 = 10_000;
  assert.equal(resendCooldownRemainingMs(t0, t0), RESEND_COOLDOWN_MS);
  assert.equal(canResend(t0, t0), false);
  assert.equal(canResend(t0, t0 + RESEND_COOLDOWN_MS - 1), false);
  // Exactly at the boundary is allowed, not one tick later.
  assert.equal(resendCooldownRemainingMs(t0, t0 + RESEND_COOLDOWN_MS), 0);
  assert.equal(canResend(t0, t0 + RESEND_COOLDOWN_MS), true);
});

test("remaining time never goes negative", () => {
  assert.equal(resendCooldownRemainingMs(1_000, 999_999), 0);
});

test("a clock that jumped backwards blocks rather than stranding the button", () => {
  // A suspended laptop or a system time change would otherwise disable resend
  // for the size of the jump.
  assert.equal(resendCooldownRemainingMs(50_000, 10_000), RESEND_COOLDOWN_MS);
  assert.equal(canResend(50_000, 10_000), false);
});

test("the countdown rounds up, so it never reads 0s while still blocked", () => {
  assert.equal(cooldownSeconds(1), 1);
  assert.equal(cooldownSeconds(1_001), 2);
  assert.equal(cooldownSeconds(0), 0);
  assert.equal(cooldownSeconds(-5), 0);
});

test("the label states what is actually true right now", () => {
  assert.equal(resendLabel(0, true), "Sending…");
  assert.equal(resendLabel(30_000, false), "Resend in 30s");
  assert.equal(resendLabel(0, false), "Resend the link");
  // Busy outranks the countdown: a request in flight is the more useful fact.
  assert.equal(resendLabel(30_000, true), "Sending…");
});
