import assert from "node:assert/strict";
import test from "node:test";
import { compilePrice, pluraliseUnit, selectRule } from "./price-compiler.ts";
import { parseBusinessRule, describeRule } from "./business-rule.ts";
import type { BusinessRule } from "./business-rule.ts";

const groupMakeup: BusinessRule = {
  kind: "per_unit", service: "Group makeup", amount: 145, currency: "AUD",
  unit: "person", quantityField: "guests", minimumQuantity: 3,
};
const bridalTrial: BusinessRule = {
  kind: "fixed_price", service: "Bridal trial", amount: 180, currency: "AUD",
};
const confirmed = (field: string, value: string) =>
  ({ field, value, status: "confirmed" as const });

test("a fixed-price service prices immediately", () => {
  const out = compilePrice([bridalTrial], "Bridal trial", []);
  assert.equal(out.kind, "EXACT");
  if (out.kind !== "EXACT") return;
  assert.equal(out.amountMinor, 18000);
});

test("a per-unit service prices from a confirmed quantity", () => {
  const out = compilePrice([groupMakeup], "Group makeup", [confirmed("guests", "4")]);
  assert.equal(out.kind, "EXACT");
  if (out.kind !== "EXACT") return;
  assert.equal(out.amountMinor, 58000); // 4 x 145
  assert.match(out.workings, /4 people at \$145 each/);
});

test("the minimum is a billing floor, not a rejection", () => {
  const out = compilePrice([groupMakeup], "Group makeup", [confirmed("guests", "2")]);
  assert.equal(out.kind, "EXACT");
  if (out.kind !== "EXACT") return;
  assert.equal(out.amountMinor, 43500, "2 guests must still bill the 3-person minimum");
  assert.match(out.workings, /minimum/);
});

test("a missing quantity BLOCKS rather than guessing a price", () => {
  // The single most important behaviour: never invent a number.
  const out = compilePrice([groupMakeup], "Group makeup", []);
  assert.equal(out.kind, "BLOCKED");
  if (out.kind !== "BLOCKED") return;
  assert.equal(out.missingField, "guests");
});

test("an UNCONFIRMED quantity cannot drive a price", () => {
  // An inferred "probably 4" becoming an invoiced number is fabricated
  // confidence - exactly what the product refuses to do.
  for (const status of ["inferred", "check_this", "unknown", "conflict", "range"] as const) {
    const out = compilePrice([groupMakeup], "Group makeup", [
      { field: "guests", value: "4", status },
    ]);
    assert.equal(out.kind, "BLOCKED", `${status} must not price`);
  }
});

test("the blocker is ONE field, and it is the one that decides the price", () => {
  const out = compilePrice([groupMakeup], "Group makeup", [
    confirmed("location", "New Farm"),
    confirmed("date", "19 Sep"),
  ]);
  assert.equal(out.kind, "BLOCKED");
  if (out.kind !== "BLOCKED") return;
  assert.equal(out.missingField, "guests");
  assert.match(out.reason, /guests decides the price/);
});

test("no matching rule is reported honestly, not priced at zero", () => {
  const out = compilePrice([groupMakeup], "Wedding photography", []);
  assert.equal(out.kind, "NO_RULE");
  if (out.kind !== "NO_RULE") return;
  assert.equal(out.service, "Wedding photography");
});

test("an empty rule set never produces a price", () => {
  assert.equal(compilePrice([], "Anything", [confirmed("guests", "9")]).kind, "NO_RULE");
});

test("service matching tolerates real customer phrasing", () => {
  assert.equal(selectRule([groupMakeup], "group makeup")?.service, "Group makeup");
  assert.equal(selectRule([groupMakeup], "Group makeup for 4")?.service, "Group makeup");
  assert.equal(selectRule([groupMakeup], "plumbing"), undefined);
});

test("money is exact at scale - no float drift", () => {
  const rule: BusinessRule = {
    kind: "per_unit", service: "Room", amount: 19.99, currency: "AUD",
    unit: "room", quantityField: "rooms",
  };
  const out = compilePrice([rule], "Room", [confirmed("rooms", "3")]);
  assert.equal(out.kind, "EXACT");
  if (out.kind !== "EXACT") return;
  assert.equal(out.amountMinor, 5997); // exactly 59.97, not 5996.9999
});

test("the same inputs always produce the same answer", () => {
  const a = compilePrice([groupMakeup], "Group makeup", [confirmed("guests", "5")]);
  const b = compilePrice([groupMakeup], "Group makeup", [confirmed("guests", "5")]);
  assert.deepEqual(a, b);
});

test("a rule payload from an untrusted source is validated, not trusted", () => {
  assert.equal(parseBusinessRule({ kind: "per_unit", service: "x", amount: 10, unit: "hour", quantityField: "hours" }).ok, true);
  assert.equal(parseBusinessRule(null).ok, false);
  assert.equal(parseBusinessRule({ kind: "fixed_price", amount: 10 }).ok, false, "needs a service");
  assert.equal(parseBusinessRule({ kind: "fixed_price", service: "x", amount: -5 }).ok, false);
  assert.equal(parseBusinessRule({ kind: "fixed_price", service: "x", amount: "ten" }).ok, false);
  assert.equal(parseBusinessRule({ kind: "sql_injection", service: "x", amount: 1 }).ok, false);
  assert.equal(parseBusinessRule({ kind: "fixed_price", service: "x", amount: 10, currency: "EUR" }).ok, false);
  assert.equal(parseBusinessRule({ kind: "per_unit", service: "x", amount: 10, unit: "h", quantityField: "h", minimumQuantity: 0 }).ok, false);
});

test("a rule reads back as a sentence the operator can check", () => {
  assert.equal(describeRule(bridalTrial), "Bridal trial: $180");
  assert.equal(describeRule(groupMakeup), "Group makeup: $145 per person, minimum 3 people");
});

test("a unit reads as a plural a customer would write", () => {
  // "4 persons at $145 each" went out in a real quote.
  assert.equal(pluraliseUnit("person", 4), "people");
  assert.equal(pluraliseUnit("person", 1), "person");
  assert.equal(pluraliseUnit("hour", 3), "hours");
  assert.equal(pluraliseUnit("box", 2), "boxes");
  assert.equal(pluraliseUnit("delivery", 2), "deliveries");
  assert.equal(pluraliseUnit("day", 2), "days");
  assert.equal(pluraliseUnit("child", 3), "children");
});
