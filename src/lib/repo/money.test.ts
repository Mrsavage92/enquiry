import assert from "node:assert/strict";
import test from "node:test";
import {
  fromMinor,
  moneyFromColumns,
  moneyRangeFromColumns,
  moneyToColumns,
  toMinor,
} from "./money.ts";

test("a round trip through minor units preserves the amount", () => {
  for (const amount of [0, 1, 45, 625, 1234.56, 99999.99]) {
    assert.equal(fromMinor(toMinor(amount)), amount);
  }
});

test("fractional cents round rather than truncate", () => {
  // 0.1 + 0.2 style drift is exactly how a quote ends up a cent short.
  assert.equal(toMinor(0.615), 62);
  assert.equal(toMinor(19.995), 2000);
  assert.equal(toMinor(0.1 + 0.2), 30);
});

test("a non-finite amount throws instead of writing NaN to the database", () => {
  assert.throws(() => toMinor(Number.NaN), RangeError);
  assert.throws(() => toMinor(Number.POSITIVE_INFINITY), RangeError);
});

test("an unset price stays unset rather than becoming zero", () => {
  // Rendering $0.00 for "no price yet" is the exact fabricated-confidence the
  // product refuses to do.
  assert.deepEqual(moneyToColumns(undefined), { minor: null, currency: null });
  assert.equal(moneyFromColumns(null, "AUD"), undefined);
  assert.equal(moneyFromColumns(undefined, "AUD"), undefined);
});

test("zero is a real price and survives the round trip", () => {
  assert.deepEqual(moneyToColumns({ amount: 0, currency: "AUD" }), {
    minor: 0,
    currency: "AUD",
  });
  assert.deepEqual(moneyFromColumns(0, "AUD"), { amount: 0, currency: "AUD" });
});

test("bigint columns arriving as strings are still read correctly", () => {
  assert.deepEqual(moneyFromColumns("62500", "AUD"), { amount: 625, currency: "AUD" });
});

test("a range needs both bounds, or it is not a range", () => {
  assert.deepEqual(moneyRangeFromColumns(10000, 20000, "AUD"), {
    min: 100,
    max: 200,
    currency: "AUD",
  });
  assert.equal(moneyRangeFromColumns(10000, null, "AUD"), undefined);
  assert.equal(moneyRangeFromColumns(null, 20000, "AUD"), undefined);
});

test("currency falls back rather than throwing on a legacy null", () => {
  assert.deepEqual(moneyFromColumns(62500, null), { amount: 625, currency: "AUD" });
});
