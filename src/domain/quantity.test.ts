import assert from "node:assert/strict";
import test from "node:test";
import { amountMinorFor, MAX_AMOUNT_MINOR, MAX_QUANTITY, parseQuantity } from "./quantity.ts";

const rejects = (raw: string, problem: string) => {
  const result = parseQuantity(raw, "guest", "guests");
  assert.equal(result.ok, false, `"${raw}" should be rejected`);
  if (!result.ok) assert.equal(result.problem, problem, `"${raw}" wrong problem class`);
};

test("parseQuantity rejects a range, in every written form", () => {
  rejects("5-6", "range");
  rejects("5 to 6", "range");
  rejects("between 5 and 6", "range");
  rejects("up to 5", "range");
  rejects("5+", "range");
});

test("parseQuantity rejects alternatives", () => {
  rejects("4 or 5", "alternatives");
  rejects("4/5", "alternatives");
  rejects("about 5", "alternatives");
  rejects("roughly 5", "alternatives");
});

test("parseQuantity rejects a negative number", () => {
  rejects("-5", "negative");
});

test("parseQuantity rejects multiple separately-stated counts", () => {
  rejects("5 adults and 2 children", "multiple");
});

test("parseQuantity rejects zero", () => {
  rejects("0", "zero");
});

test("parseQuantity rejects malformed input", () => {
  rejects("abc", "malformed");
  rejects("1,5", "malformed");
  rejects("1e6", "malformed");
});

test("parseQuantity rejects empty input", () => {
  rejects("", "empty");
  rejects("   ", "empty");
});

test("parseQuantity rejects a quantity beyond MAX_QUANTITY", () => {
  const result = parseQuantity(String(MAX_QUANTITY + 1), "guest", "guests");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.problem, "too_large");
});

test("parseQuantity accepts a bare number", () => {
  const result = parseQuantity("4", "person", "guests");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.quantity, 4);
});

test("parseQuantity accepts a number followed by its unit", () => {
  const result = parseQuantity("4 people", "person", "guests");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.quantity, 4);
});

test("parseQuantity accepts a decimal quantity", () => {
  const result = parseQuantity("2.5 hours", "hour", "duration");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.quantity, 2.5);
});

test("parseQuantity accepts a number with a multi-word unit", () => {
  const result = parseQuantity("40 square metres", "square metre", "area");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.quantity, 40);
});

test("parseQuantity accepts exactly MAX_QUANTITY", () => {
  const result = parseQuantity(String(MAX_QUANTITY), "person", "guests");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.quantity, MAX_QUANTITY);
});

test("amountMinorFor computes exact minor units at ordinary values", () => {
  assert.equal(amountMinorFor(145, 4), 58000);
  assert.equal(amountMinorFor(0, 4), 0);
});

test("amountMinorFor stays within bounds at the MAX_AMOUNT_MINOR edge", () => {
  const atBound = MAX_AMOUNT_MINOR / 100;
  assert.equal(amountMinorFor(atBound, 1), MAX_AMOUNT_MINOR);
});

test("amountMinorFor returns null once the result exceeds MAX_AMOUNT_MINOR", () => {
  const justOver = MAX_AMOUNT_MINOR / 100 + 0.01;
  assert.equal(amountMinorFor(justOver, 1), null);
});

test("amountMinorFor returns null once the result exceeds Number.MAX_SAFE_INTEGER", () => {
  assert.equal(amountMinorFor(Number.MAX_SAFE_INTEGER, 1000), null);
});

test("amountMinorFor returns null for a negative result", () => {
  assert.equal(amountMinorFor(-10, 1), null);
});

test("amountMinorFor returns null for non-finite input", () => {
  assert.equal(amountMinorFor(Number.NaN, 1), null);
  assert.equal(amountMinorFor(145, Number.POSITIVE_INFINITY), null);
});
