import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTION_CATALOGUE,
  initialActionPolicies,
  initialGates,
} from "./action-catalogue.ts";

// A new tenant has approved nothing. Every assertion here is about what a real
// business is NOT granted on day one, because the failure mode is silent: an
// action that starts automatic sends something on a business's behalf before
// they ever agreed to it.

test("no action starts automatic", () => {
  const automatic = initialActionPolicies().filter(
    (p) => p.mode === "Automatic when safe",
  );
  assert.deepEqual(automatic, [], "a new tenant must grant nothing automatically");
});

test("high-risk classes start at Never, not merely Ask", () => {
  const decline = initialActionPolicies().find((p) => p.action === "DECLINE");
  assert.equal(decline?.mode, "Never");
  assert.equal(decline?.risk, "HIGH");
});

test("every other class starts at Ask every time", () => {
  for (const p of initialActionPolicies()) {
    const expected = p.action === "DECLINE" ? "Never" : "Ask every time";
    assert.equal(p.mode, expected, `${p.action} should start ${expected}`);
  }
});

test("no synthetic automation evidence is fabricated", () => {
  // Seeded comparable counts would let an action graduate on a demo's history.
  for (const p of initialActionPolicies()) {
    assert.equal(p.evidence, undefined, `${p.action} must carry no evidence`);
  }
});

test("no gate starts passing", () => {
  for (const gate of initialGates()) {
    assert.equal(gate.passing, false, `${gate.id} must not start passing`);
  }
  assert.ok(initialGates().some((g) => g.id === "send"));
});

test("the catalogue is product-owned and self-contained", () => {
  assert.ok(ACTION_CATALOGUE.length > 0);
  const actions = ACTION_CATALOGUE.map((e) => e.action);
  assert.equal(new Set(actions).size, actions.length, "no duplicate action classes");
  for (const entry of ACTION_CATALOGUE) {
    assert.ok(entry.label.length > 0, `${entry.action} needs an operator-facing label`);
    assert.ok(["LOW", "MEDIUM", "HIGH", "PROHIBITED_AUTO"].includes(entry.risk));
  }
});

test("policies derive from the catalogue, one per class", () => {
  assert.equal(initialActionPolicies().length, ACTION_CATALOGUE.length);
});
