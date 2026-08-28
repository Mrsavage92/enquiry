import assert from "node:assert/strict";
import test from "node:test";
import { fixtureLinksAllowed } from "./public-links.ts";

// These routes expose a named customer's quote figure and booking terms with no
// account required, keyed by a guessable id. The gate is the containment, so it
// gets exhaustive coverage rather than a happy-path check.

test("a production-capable build never resolves fixture links", () => {
  // The case that matters: someone sets the opt-in on a real deployment.
  assert.equal(fixtureLinksAllowed({ optedIn: true, authEnabled: true }), false);
  assert.equal(fixtureLinksAllowed({ optedIn: false, authEnabled: true }), false);
});

test("prototype mode still needs an explicit opt-in", () => {
  assert.equal(fixtureLinksAllowed({ optedIn: false, authEnabled: false }), false);
});

test("both conditions together are the only way through", () => {
  assert.equal(fixtureLinksAllowed({ optedIn: true, authEnabled: false }), true);
});

test("the gate defaults closed across every combination", () => {
  const combos = [true, false].flatMap((optedIn) =>
    [true, false].map((authEnabled) => fixtureLinksAllowed({ optedIn, authEnabled })),
  );
  assert.equal(
    combos.filter(Boolean).length,
    1,
    "exactly one of four combinations may open the link",
  );
});
