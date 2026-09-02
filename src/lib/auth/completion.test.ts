import assert from "node:assert/strict";
import test from "node:test";
import {
  ONBOARDING_PATH,
  parseAuthCallbackError,
  resolveAuthCompletion,
  type AuthCompletionInput,
} from "./completion.ts";
import { DEFAULT_RETURN_PATH } from "./return-path.ts";

const base: AuthCompletionInput = {
  linkError: null,
  session: "signed-in",
  workspace: "ready",
};

test("a confirmed user with no workspace goes to onboarding", () => {
  assert.deepEqual(resolveAuthCompletion({ ...base, workspace: "needs-onboarding" }), {
    phase: "redirect",
    to: ONBOARDING_PATH,
  });
});

test("an existing member goes to where they were heading", () => {
  assert.deepEqual(resolveAuthCompletion({ ...base, returnPath: "/bookings" }), {
    phase: "redirect",
    to: "/bookings",
  });
  assert.deepEqual(resolveAuthCompletion(base), {
    phase: "redirect",
    to: DEFAULT_RETURN_PATH,
  });
});

test("a poisoned return path cannot move the host", () => {
  for (const bad of ["//evil.example", "https://evil.example", "javascript:alert(1)"]) {
    assert.deepEqual(resolveAuthCompletion({ ...base, returnPath: bad }), {
      phase: "redirect",
      to: DEFAULT_RETURN_PATH,
    });
  }
});

test("nothing is decided while the session or workspace is still unknown", () => {
  assert.deepEqual(resolveAuthCompletion({ ...base, session: "pending" }), {
    phase: "confirming",
  });
  for (const workspace of ["idle", "loading"] as const) {
    assert.deepEqual(resolveAuthCompletion({ ...base, workspace }), { phase: "resolving" });
  }
});

test("a failed workspace call never routes optimistically", () => {
  // Guessing "no workspace" invites an existing customer to create a second
  // one; guessing "workspace" drops a new one into operator UI they do not own.
  assert.deepEqual(resolveAuthCompletion({ ...base, workspace: "failed" }), {
    phase: "workspace-failed",
  });
});

test("a link that produced no session asks for a fresh one", () => {
  assert.deepEqual(resolveAuthCompletion({ ...base, session: "signed-out" }), {
    phase: "no-session",
  });
});

test("a link error outranks a stale session left in local storage", () => {
  // Supabase can leave an old session behind while refusing the link just
  // clicked. Routing onward on that session hides a real failure as success.
  const view = resolveAuthCompletion({
    ...base,
    session: "signed-in",
    workspace: "ready",
    linkError: { code: "otp_expired", description: "Email link is invalid or has expired" },
  });
  assert.deepEqual(view, { phase: "link-expired" });
});

test("expiry is recognised from the code or the description", () => {
  assert.equal(
    resolveAuthCompletion({ ...base, linkError: { code: "token_expired", description: null } })
      .phase,
    "link-expired",
  );
  assert.equal(
    resolveAuthCompletion({
      ...base,
      linkError: { code: "access_denied", description: "Email link has expired" },
    }).phase,
    "link-expired",
  );
});

test("a non-expiry refusal is reported as invalid, with its detail", () => {
  const view = resolveAuthCompletion({
    ...base,
    linkError: { code: "access_denied", description: "Something else" },
  });
  assert.deepEqual(view, { phase: "link-invalid", detail: "Something else" });
});

test("provider errors are read from the fragment and the query string", () => {
  // Implicit flow puts them in the fragment; PKCE puts them in the query.
  const fromHash = parseAuthCallbackError(
    "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid",
    "",
  );
  assert.equal(fromHash?.code, "otp_expired");
  assert.equal(fromHash?.description, "Email link is invalid");

  const fromSearch = parseAuthCallbackError("", "?error=access_denied&error_code=bad_oauth_state");
  assert.equal(fromSearch?.code, "bad_oauth_state");

  assert.equal(parseAuthCallbackError("", ""), null);
  assert.equal(parseAuthCallbackError("#access_token=abc&type=magiclink", ""), null);
});
