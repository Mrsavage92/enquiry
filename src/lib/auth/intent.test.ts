import assert from "node:assert/strict";
import test from "node:test";
import { classifyAuthError, sentStateCopy, shouldCreateUser } from "./intent.ts";

test("only signup may bring an account into existence", () => {
  assert.equal(shouldCreateUser("signup"), true);
  assert.equal(shouldCreateUser("signin"), false);
});

test("signing in to an address with no account does not say so", () => {
  // The whole point: this error answers "does this person have an account?".
  // Rendering it turns the sign-in form into an account-enumeration oracle.
  for (const error of [
    { code: "otp_disabled" },
    { code: "user_not_found" },
    new Error("Signups not allowed for otp"),
  ]) {
    const result = classifyAuthError(error, "signin");
    assert.equal(result.kind, "silent", JSON.stringify(error));
    assert.equal(result.treatAsSent, true);
    assert.equal(result.message, "");
  }
});

test("the same error on signup is a real, visible failure", () => {
  // Nothing to leak here - the customer just asked to create this account.
  const result = classifyAuthError({ code: "signup_disabled" }, "signup");
  assert.equal(result.kind, "unavailable");
  assert.equal(result.treatAsSent, false);
  assert.ok(result.message.length > 0);
});

test("rate limiting is reported honestly rather than as a sent link", () => {
  for (const error of [
    { code: "over_email_send_rate_limit" },
    { status: 429 },
    new Error("Email rate limit exceeded"),
  ]) {
    const result = classifyAuthError(error, "signup");
    assert.equal(result.kind, "rate-limited", JSON.stringify(error));
    assert.equal(result.treatAsSent, false);
  }
});

test("an unusable address is corrected, not swallowed", () => {
  const result = classifyAuthError({ code: "email_address_invalid" }, "signup");
  assert.equal(result.kind, "invalid-email");
  assert.equal(result.treatAsSent, false);
});

test("an unrecognised failure is not dressed up as success", () => {
  const result = classifyAuthError(new Error("boom"), "signin");
  assert.equal(result.kind, "unknown");
  assert.equal(result.treatAsSent, false);
});

test("no message ever reveals whether an account exists", () => {
  const forbidden = /already|exists|not found|no account|unknown user|registered/i;
  for (const intent of ["signup", "signin"] as const) {
    for (const error of [
      { code: "user_not_found" },
      { code: "over_request_rate_limit" },
      { code: "validation_failed" },
      new Error("whatever"),
    ]) {
      const { message } = classifyAuthError(error, intent);
      assert.doesNotMatch(message, forbidden, `${intent} ${JSON.stringify(error)}`);
    }
  }
});

test("the sent screen never claims the email was delivered", () => {
  for (const intent of ["signup", "signin"] as const) {
    const { heading, body } = sentStateCopy(intent);
    assert.ok(heading.length > 0);
    // "sent" as a claim of arrival is the lie; the API resolving only means the
    // request was accepted.
    assert.doesNotMatch(body, /\b(delivered|has arrived|we sent)\b/i);
  }
  // Sign-in must stay non-committal about whether the account exists at all.
  assert.match(sentStateCopy("signin").body, /if an enquiry account/i);
});
