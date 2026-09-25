import assert from "node:assert/strict";
import { test } from "node:test";
import { decisionScrollDelta } from "./demo-scroll.ts";

test("no scroll when the verdict is already on screen", () => {
  assert.equal(decisionScrollDelta(120, 700, 844), 0);
});

test("scrolls just enough to show the verdict", () => {
  assert.equal(decisionScrollDelta(300, 900, 844), 72);
});

test("never scrolls the controls off the top", () => {
  assert.equal(decisionScrollDelta(60, 1400, 844), 44);
  assert.equal(decisionScrollDelta(10, 1400, 844), 0);
  assert.equal(decisionScrollDelta(-40, 1400, 844), 0);
});
