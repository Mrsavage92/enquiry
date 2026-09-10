import assert from "node:assert/strict";
import test from "node:test";
import { parseBusinessRule, ruleFingerprint, type BusinessRule } from "./business-rule.ts";

test("ruleFingerprint does not collide when a per_unit field contains a literal delimiter character", () => {
  const a: BusinessRule = {
    kind: "per_unit",
    service: "Cleaning",
    amount: 100,
    currency: "AUD",
    unit: "room|x",
    quantityField: "rooms",
  };
  const b: BusinessRule = {
    kind: "per_unit",
    service: "Cleaning",
    amount: 100,
    currency: "AUD",
    unit: "room",
    quantityField: "x|rooms",
  };
  assert.notEqual(ruleFingerprint(a), ruleFingerprint(b));
});

test("ruleFingerprint matches for equal rules regardless of case and surrounding whitespace", () => {
  const a: BusinessRule = {
    kind: "per_unit",
    service: "  Group Makeup ",
    amount: 145,
    currency: "AUD",
    unit: " Person",
    quantityField: "Guests ",
    minimumQuantity: 3,
  };
  const b: BusinessRule = {
    kind: "per_unit",
    service: "group makeup",
    amount: 145,
    currency: "AUD",
    unit: "person",
    quantityField: "guests",
    minimumQuantity: 3,
  };
  assert.equal(ruleFingerprint(a), ruleFingerprint(b));
});

test("ruleFingerprint matches for equal fixed_price rules regardless of case and whitespace", () => {
  const a: BusinessRule = {
    kind: "fixed_price",
    service: " Wedding Package ",
    amount: 450,
    currency: "AUD",
  };
  const b: BusinessRule = {
    kind: "fixed_price",
    service: "wedding package",
    amount: 450,
    currency: "AUD",
  };
  assert.equal(ruleFingerprint(a), ruleFingerprint(b));
});

test("ruleFingerprint distinguishes fixed_price from a per_unit rule with the same service and amount", () => {
  const fixed: BusinessRule = {
    kind: "fixed_price",
    service: "Cleaning",
    amount: 100,
    currency: "AUD",
  };
  const perUnit: BusinessRule = {
    kind: "per_unit",
    service: "Cleaning",
    amount: 100,
    currency: "AUD",
    unit: "room",
    quantityField: "rooms",
  };
  assert.notEqual(ruleFingerprint(fixed), ruleFingerprint(perUnit));
});

test("parseBusinessRule requires a non-empty service name", () => {
  const result = parseBusinessRule({ kind: "fixed_price", service: "  ", amount: 100 });
  assert.equal(result.ok, false);
});

test("parseBusinessRule requires a non-negative, finite amount", () => {
  for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY, "lots"]) {
    const result = parseBusinessRule({ kind: "fixed_price", service: "Cleaning", amount });
    assert.equal(result.ok, false, `amount ${String(amount)} must be rejected`);
  }
  const ok = parseBusinessRule({ kind: "fixed_price", service: "Cleaning", amount: 0 });
  assert.equal(ok.ok, true, "zero is a valid, non-negative amount");
});

test("parseBusinessRule accepts only AUD, case-insensitively", () => {
  const upper = parseBusinessRule({
    kind: "fixed_price",
    service: "Cleaning",
    amount: 100,
    currency: "aud",
  });
  assert.equal(upper.ok, true);
  const other = parseBusinessRule({
    kind: "fixed_price",
    service: "Cleaning",
    amount: 100,
    currency: "USD",
  });
  assert.equal(other.ok, false);
});

test("parseBusinessRule defaults currency to AUD when absent", () => {
  const result = parseBusinessRule({ kind: "fixed_price", service: "Cleaning", amount: 100 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.rule.currency, "AUD");
});

test("parseBusinessRule requires unit and quantityField for per_unit", () => {
  const noUnit = parseBusinessRule({
    kind: "per_unit",
    service: "Cleaning",
    amount: 50,
    quantityField: "rooms",
  });
  assert.equal(noUnit.ok, false);
  const noField = parseBusinessRule({
    kind: "per_unit",
    service: "Cleaning",
    amount: 50,
    unit: "room",
  });
  assert.equal(noField.ok, false);
  const ok = parseBusinessRule({
    kind: "per_unit",
    service: "Cleaning",
    amount: 50,
    unit: "room",
    quantityField: "rooms",
  });
  assert.equal(ok.ok, true);
});

test("parseBusinessRule requires minimumQuantity to be at least 1, and floors it", () => {
  const zero = parseBusinessRule({
    kind: "per_unit",
    service: "Cleaning",
    amount: 50,
    unit: "room",
    quantityField: "rooms",
    minimumQuantity: 0,
  });
  assert.equal(zero.ok, false);
  const negative = parseBusinessRule({
    kind: "per_unit",
    service: "Cleaning",
    amount: 50,
    unit: "room",
    quantityField: "rooms",
    minimumQuantity: -2,
  });
  assert.equal(negative.ok, false);
  const floored = parseBusinessRule({
    kind: "per_unit",
    service: "Cleaning",
    amount: 50,
    unit: "room",
    quantityField: "rooms",
    minimumQuantity: 2.9,
  });
  assert.equal(floored.ok, true);
  if (floored.ok && floored.rule.kind === "per_unit") assert.equal(floored.rule.minimumQuantity, 2);
});

test("parseBusinessRule rejects an unknown rule kind and a non-object payload", () => {
  assert.equal(
    parseBusinessRule({ kind: "percentage_off", service: "Cleaning", amount: 10 }).ok,
    false,
  );
  assert.equal(parseBusinessRule(null).ok, false);
  assert.equal(parseBusinessRule("not a rule").ok, false);
});
