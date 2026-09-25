import assert from "node:assert/strict";
import { test } from "node:test";
import { readPriceLine, readPriceSentences } from "./price-sentence.ts";

test("a flat price in the owner's own words becomes a fixed-price rule", () => {
  const read = readPriceLine("Exterior repaint will be $5,500.");
  assert.ok("rule" in read);
  assert.deepEqual(read.rule, {
    kind: "fixed_price",
    service: "Exterior repaint",
    amount: 5500,
    currency: "AUD",
  });
});

test("a price per something asks for the count of that thing", () => {
  const read = readPriceLine("End of lease clean $190 per bedroom");
  assert.ok("rule" in read);
  assert.equal(read.rule.kind, "per_unit");
  if (read.rule.kind !== "per_unit") return;
  assert.equal(read.rule.service, "End of lease clean");
  assert.equal(read.rule.amount, 190);
  assert.equal(read.rule.unit, "bedroom");
  assert.equal(read.rule.quantityField, "bedrooms");
});

test("per person, per hour with a minimum, and the service after the price", () => {
  const people = readPriceLine("Group makeup is $160 a person, minimum 3");
  assert.ok("rule" in people && people.rule.kind === "per_unit");
  if (!("rule" in people) || people.rule.kind !== "per_unit") return;
  assert.equal(people.rule.quantityField, "people");
  assert.equal(people.rule.minimumQuantity, 3);

  const hours = readPriceLine("$85/hour for garden maintenance");
  assert.ok("rule" in hours && hours.rule.kind === "per_unit");
  if (!("rule" in hours) || hours.rule.kind !== "per_unit") return;
  assert.equal(hours.rule.service, "Garden maintenance");
  assert.equal(hours.rule.quantityField, "hours");
});

test("a multi-sentence price list reads every line", () => {
  const out = readPriceSentences(
    "End of lease clean is $190 per bedroom. Carpet steam clean $45 per room.\nOven clean $80.",
  );
  assert.equal(out.prices.length, 3);
  assert.deepEqual(
    out.prices.map((p) => p.rule.service),
    ["End of lease clean", "Carpet steam clean", "Oven clean"],
  );
  assert.equal(out.unread.length, 0);
});

test("anything that is not a set price is named with the reason, never guessed", () => {
  const out = readPriceSentences(
    "Deep clean from $300. Painting $300-$500. We do not work Sundays. $90 per hour.",
  );
  assert.equal(out.prices.length, 0);
  assert.deepEqual(
    out.unread.map((u) => u.reason),
    [
      'A "from" price is not a set price, so Enquiry cannot quote it.',
      "A price range is not a set price, so Enquiry cannot quote it.",
      "There is no dollar amount in it.",
      "It does not say which service the price is for.",
    ],
  );
});
