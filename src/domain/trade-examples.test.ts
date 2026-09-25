import assert from "node:assert/strict";
import { test } from "node:test";
import { tradeExamples, tradeOf } from "./trade-examples.ts";
import { readPriceLine } from "./price-sentence.ts";
import { readQuantityFromMessage } from "./quantity-reader.ts";

test("the owner's own words at onboarding pick the trade", () => {
  assert.equal(tradeOf("Painting"), "painting");
  assert.equal(tradeOf("house painter"), "painting");
  assert.equal(tradeOf("End of lease cleaning"), "cleaning");
  assert.equal(tradeOf("mobile makeup"), "beauty");
  assert.equal(tradeOf("Hair and makeup for weddings"), "beauty");
  assert.equal(tradeOf("photography"), "general");
  assert.equal(tradeOf(""), "general");
});

test("a painter never sees beauty defaults", () => {
  const ex = tradeExamples("painting");
  const all = JSON.stringify(ex);
  assert.doesNotMatch(all, /makeup|bridesmaid|guests|per person/i);
  assert.equal(ex.price.unit, "square metre");
  assert.equal(ex.price.field, "square metres");
  assert.equal(tradeExamples("cleaning").price.field, "bedrooms");
  assert.match(tradeExamples("mobile makeup").price.field, /people|guests/);
});

test("every sentence example is one the price reader accepts, and every message example gives its count", () => {
  for (const industry of ["painting", "cleaning", "makeup", "other"]) {
    const ex = tradeExamples(industry);
    for (const line of [ex.sentence, ex.flatSentence]) {
      const read = readPriceLine(line);
      assert.ok("rule" in read, `${industry}: ${line}`);
    }
    const read = readPriceLine(ex.sentence);
    if ("rule" in read && read.rule.kind === "per_unit") {
      assert.ok(
        readQuantityFromMessage(ex.message, read.rule.quantityField, read.rule.unit),
        `${industry}: the example message states the ${read.rule.quantityField}`,
      );
    }
  }
});
