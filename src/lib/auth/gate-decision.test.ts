import assert from "node:assert/strict";
import test from "node:test";
import { decideAuthGate, SIGN_IN_PATH } from "./gate-decision.ts";

test("a resolving session waits rather than bouncing a signed-in operator", () => {
  assert.deepEqual(decideAuthGate({ isPending: true, hasUser: false, pathname: "/enquiries" }), {
    kind: "wait",
  });
});

test("a signed-in operator is let through", () => {
  assert.deepEqual(decideAuthGate({ isPending: false, hasUser: true, pathname: "/enquiries" }), {
    kind: "allow",
  });
});

test("a signed-out visitor is sent to sign-in carrying where they were going", () => {
  assert.deepEqual(decideAuthGate({ isPending: false, hasUser: false, pathname: "/enquiries" }), {
    kind: "redirect",
    to: SIGN_IN_PATH,
    redirectTo: "/enquiries",
  });
});

test("the guard never redirects from the sign-in route to itself", () => {
  // The regression: the guard re-rendered after its own navigation, with the
  // pathname now /login, and overwrote the real destination with /login - so
  // signing in returned the operator to the sign-in screen.
  assert.deepEqual(decideAuthGate({ isPending: false, hasUser: false, pathname: SIGN_IN_PATH }), {
    kind: "hold",
  });
});

test("a deep link keeps its query and nested path", () => {
  assert.deepEqual(
    decideAuthGate({ isPending: false, hasUser: false, pathname: "/enquiries/f01" }),
    { kind: "redirect", to: SIGN_IN_PATH, redirectTo: "/enquiries/f01" },
  );
});
