import assert from "node:assert/strict";
import { test } from "node:test";
import { readPriceLine, readPriceSentences } from "./price-sentence.ts";
import { describeRule } from "./business-rule.ts";

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

test("'an hour' is a price per hour, not a unit called 'n'", () => {
  const read = readPriceLine("Lawn mowing $60 an hour");
  assert.ok("rule" in read && read.rule.kind === "per_unit");
  if (!("rule" in read) || read.rule.kind !== "per_unit") return;
  assert.equal(read.rule.unit, "hour");
  assert.equal(read.rule.quantityField, "hours");
  assert.equal(read.rule.amount, 60);
});

test("anything that is not one set price is refused with its reason, never guessed", () => {
  for (const line of [
    "Deck stain between $300 and $500",
    "$5,500 all inclusive",
    "Roof wash $1.5k",
    "Exterior repaint about $5,500",
    "$300 or $400",
    "$5,500 + GST",
    "$50 per room plus $30 call-out",
    "$120ish",
    "Repaint $5,500, touch-up $300",
  ]) {
    const read = readPriceLine(line);
    assert.ok(!("rule" in read), `${line} was read as a price`);
    if ("rule" in read) continue;
    assert.ok(read.reason.length > 10, `${line} has no reason`);
  }
});

test("the simple forms still read", () => {
  for (const [line, amount] of [
    ["Exterior repaint $5,500", 5500],
    ["Oven clean $80.", 80],
    ["Floor sanding $40 per metre", 40],
    ["Window cleaning: $12 a window", 12],
  ] as const) {
    const read = readPriceLine(line);
    assert.ok("rule" in read, `${line} was refused`);
    if ("rule" in read) assert.equal(read.rule.amount, amount);
  }
});

// Review pass 4, item 6.
test("area units read as square metres, singular and plural, never 'm' or 'sqms'", () => {
  for (const line of [
    "Interior wall painting $28 per sqm",
    "Interior wall painting $28 per sqms",
    "Interior wall painting $28/m2",
    "Interior wall painting $28 per m²",
    "Interior wall painting $28 per sq m",
    "Interior wall painting $28 per square meter",
  ]) {
    const read = readPriceLine(line);
    assert.ok("rule" in read, line);
    if (!("rule" in read) || read.rule.kind !== "per_unit") continue;
    assert.equal(read.rule.unit, "square metre", line);
    assert.equal(read.rule.quantityField, "square metres", line);
  }
  const deck = readPriceLine("Deck staining $40 per m");
  assert.ok("rule" in deck && deck.rule.kind === "per_unit" && deck.rule.unit === "metre");
});

test("'flat' is filler, not the end of the service name", () => {
  const read = readPriceLine("Feature wall - flat $450");
  assert.ok("rule" in read);
  if ("rule" in read) assert.equal(read.rule.service, "Feature wall");
  const rate = readPriceLine("Feature wall flat rate $450");
  assert.ok("rule" in rate && rate.rule.service === "Feature wall");
});

test("a conditional price is refused as conditional, not called approximate", () => {
  const read = readPriceLine("Oven clean $120 if it is really dirty");
  assert.ok(!("rule" in read));
  if (!("rule" in read)) {
    assert.match(read.reason, /conditional/);
    assert.doesNotMatch(read.reason, /approximate/i);
  }
  const under = readPriceLine("Small room $150 if under 20 sqm");
  assert.ok(!("rule" in under) && /conditional/.test(under.reason));
});

test("cents are always shown to two places", () => {
  const read = readPriceLine("Window clean $4.5 per pane");
  assert.ok("rule" in read);
  if ("rule" in read) assert.equal(describeRule(read.rule), "Window clean: $4.50 per pane");
});
