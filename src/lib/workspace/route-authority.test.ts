import assert from "node:assert/strict";
import test from "node:test";
import { resolveRouteAuthority, SIGN_IN_PATH } from "./route-authority.ts";
import { ONBOARDING_PATH } from "../auth/completion.ts";
import { DEFAULT_RETURN_PATH } from "../auth/return-path.ts";

const base = {
  authEnabled: true,
  session: "signed-in",
  workspace: "ready",
  pathname: "/enquiries",
  isOnboardingRoute: false,
} as const;

test("the local prototype passes straight through when auth is off", () => {
  assert.deepEqual(
    resolveRouteAuthority({ ...base, authEnabled: false, session: "signed-out" }),
    { phase: "prototype-bypass" },
  );
});

test("a member with a workspace is allowed onto an operator route", () => {
  assert.deepEqual(resolveRouteAuthority(base), { phase: "allowed" });
});

test("a signed-out visitor is sent to sign-in carrying where they were going", () => {
  assert.deepEqual(
    resolveRouteAuthority({ ...base, session: "signed-out", pathname: "/bookings" }),
    { phase: "signed-out", to: SIGN_IN_PATH, redirect: "/bookings" },
  );
});

test("an unsafe pathname cannot become the return destination", () => {
  const authority = resolveRouteAuthority({
    ...base,
    session: "signed-out",
    pathname: "//evil.example",
  });
  assert.equal(authority.phase === "signed-out" && authority.redirect, DEFAULT_RETURN_PATH);
});

test("nothing is decided while the session or workspace is unknown", () => {
  assert.deepEqual(resolveRouteAuthority({ ...base, session: "pending" }), {
    phase: "session-pending",
  });
  for (const workspace of ["idle", "loading"] as const) {
    assert.deepEqual(resolveRouteAuthority({ ...base, workspace }), {
      phase: "workspace-pending",
    });
  }
});

test("a failed workspace call is its own state, not a guess either way", () => {
  assert.deepEqual(resolveRouteAuthority({ ...base, workspace: "failed" }), {
    phase: "workspace-failed",
  });
});

test("a signed-in user with zero memberships never reaches operator UI", () => {
  // This is the defect the guard exists for: identity passed the old check and
  // landed in /enquiries, where the prototype store rendered fixture
  // businesses as if they were the user's own.
  assert.deepEqual(resolveRouteAuthority({ ...base, workspace: "needs-onboarding" }), {
    phase: "needs-onboarding",
    to: ONBOARDING_PATH,
  });
});

test("onboarding is the one route a zero-membership user may see", () => {
  assert.deepEqual(
    resolveRouteAuthority({
      ...base,
      workspace: "needs-onboarding",
      pathname: ONBOARDING_PATH,
      isOnboardingRoute: true,
    }),
    { phase: "allowed" },
  );
});

test("someone who already has a workspace is not offered onboarding again", () => {
  assert.deepEqual(
    resolveRouteAuthority({
      ...base,
      workspace: "ready",
      pathname: ONBOARDING_PATH,
      isOnboardingRoute: true,
    }),
    { phase: "workspace-exists", to: DEFAULT_RETURN_PATH },
  );
});

test("no input combination produces a redirect back to the route being guarded", () => {
  // A guard that can send you where you already are is a redirect loop.
  for (const session of ["pending", "signed-in", "signed-out"] as const) {
    for (const workspace of ["idle", "loading", "needs-onboarding", "ready", "failed"] as const) {
      for (const isOnboardingRoute of [true, false]) {
        const pathname = isOnboardingRoute ? ONBOARDING_PATH : "/enquiries";
        const a = resolveRouteAuthority({
          ...base,
          session,
          workspace,
          pathname,
          isOnboardingRoute,
        });
        if ("to" in a) assert.notEqual(a.to, pathname, JSON.stringify({ session, workspace, pathname }));
      }
    }
  }
});
