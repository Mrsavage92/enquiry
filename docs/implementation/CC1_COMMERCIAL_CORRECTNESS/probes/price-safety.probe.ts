/**
 * Diagnostic seeds for source 6eba9a4, not a replacement for the release suite.
 * Run from repo root with Node's strip-types/test runner; see ../evidence/BASELINE.md.
 * Six failures were observed on the reviewed source. Integrate final regressions
 * into src after implementation. See CC1-03 for the provisional-price boundary.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compilePrice } from "../../../../src/domain/price-compiler.ts";
import type { BusinessRule, FixedPriceRule } from "../../../../src/domain/business-rule.ts";

const perPerson: BusinessRule = {
  kind: "per_unit",
  service: "Group makeup",
  amount: 100,
  currency: "AUD",
  unit: "person",
  quantityField: "guests",
};

for (const value of ["5-6", "4 or 5", "-5"]) {
  test(`SAFETY: confirmed text ${JSON.stringify(value)} must not become an exact positive quantity`, () => {
    const out = compilePrice([perPerson], "Group makeup", [
      { field: "guests", value, status: "confirmed" },
    ]);
    assert.notEqual(out.kind, "EXACT", JSON.stringify(out));
  });
}

const bridal: FixedPriceRule = {
  kind: "fixed_price", service: "Bridal makeup", amount: 190, currency: "AUD",
};
const event: FixedPriceRule = {
  kind: "fixed_price", service: "Event makeup", amount: 170, currency: "AUD",
};

test("SAFETY: ambiguous service must not select a definite price", () => {
  assert.notEqual(compilePrice([bridal, event], "makeup", []).kind, "EXACT");
});

test("SAFETY: ambiguous service price must not depend on rule array order", () => {
  const a = compilePrice([bridal, event], "makeup", []);
  const b = compilePrice([event, bridal], "makeup", []);
  assert.deepEqual(a, b);
});

test("SAFETY: an explicitly unconfirmed model service fact must not unlock exact pricing", () => {
  const out = compilePrice([bridal], "Bridal makeup", [
    { field: "service", value: "Bridal makeup", status: "check_this" },
  ]);
  assert.notEqual(out.kind, "EXACT", JSON.stringify(out));
});
