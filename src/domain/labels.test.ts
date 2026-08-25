import assert from "node:assert/strict";
import { test } from "node:test";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import { commercialValue, nextNeedsYou, queueSection } from "./labels.ts";

function byId(id: string) {
  return ENQUIRIES.find((e) => e.id === id)!;
}

test("Priya is an exact quote", () => {
  const v = commercialValue(byId("f01"));
  assert.equal(v.kind, "exact");
  assert.equal(v.amountLabel, "$625");
  assert.equal(v.caption, "Exact quote");
});

test("Jordan's event hours are an estimate", () => {
  const v = commercialValue(byId("f02"));
  assert.equal(v.kind, "estimate");
  assert.equal(v.amountLabel, "$720–$1,080");
});

test("A. Patel has no invented price", () => {
  const v = commercialValue(byId("f03"));
  assert.equal(v.kind, "not_ready");
  assert.equal(v.amountLabel, "Price not ready");
});

test("Chris's assumed $210 is not a locked exact quote", () => {
  const v = commercialValue(byId("f15"));
  assert.equal(v.kind, "not_ready");
  assert.equal(v.amountLabel, "Price not ready");
});

test("Elena's price conflict is not ready", () => {
  const v = commercialValue(byId("f11"));
  assert.equal(v.kind, "not_ready");
});

test("Tash's Instagram DM is an exact quote", () => {
  const v = commercialValue(byId("f18"));
  assert.equal(v.kind, "exact");
  assert.equal(v.amountLabel, "$210");
});

test("nextNeedsYou skips the current card", () => {
  const current = ENQUIRIES.find((e) => queueSection(e) === "needs_you");
  assert.ok(current);
  const next = nextNeedsYou(ENQUIRIES, "all", current.id);
  assert.ok(next);
  assert.notEqual(next, current.id);
  assert.equal(queueSection(ENQUIRIES.find((e) => e.id === next)!), "needs_you");
});
