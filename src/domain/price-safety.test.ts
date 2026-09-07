import assert from "node:assert/strict";
import test from "node:test";
import { compilePrice, impliedAmountsMinor, matchRule } from "./price-compiler.ts";
import type { BusinessRule, FixedPriceRule } from "./business-rule.ts";
import type { CompilerFact } from "./price-compiler.ts";

/**
 * CC1 commercial-correctness regressions (acceptance IDs Q01-Q07, S01-S05, A01).
 *
 * These are the review's own safety probes, promoted out of
 * `docs/implementation/CC1_COMMERCIAL_CORRECTNESS/probes/` into the default
 * discovered suite, plus the cases the acceptance matrix adds around them.
 * Every assertion here states a commercial invariant: a confirmed answer must
 * keep its meaning, an ambiguous request must not acquire a definite price by
 * array order, and a service the owner has not confirmed must not present
 * itself as a decided commercial premise.
 */

const perPerson: BusinessRule = {
  kind: "per_unit",
  service: "Group makeup",
  amount: 100,
  currency: "AUD",
  unit: "person",
  quantityField: "guests",
};

const makeupAt145: BusinessRule = {
  kind: "per_unit",
  service: "Group makeup",
  amount: 145,
  currency: "AUD",
  unit: "person",
  quantityField: "guests",
};

const makeupAt145Min3: BusinessRule = { ...makeupAt145, minimumQuantity: 3 };

const perHour: BusinessRule = {
  kind: "per_unit",
  service: "Deep clean",
  amount: 60,
  currency: "AUD",
  unit: "hour",
  quantityField: "hours",
};

const bridal: FixedPriceRule = {
  kind: "fixed_price",
  service: "Bridal makeup",
  amount: 190,
  currency: "AUD",
};
const event: FixedPriceRule = {
  kind: "fixed_price",
  service: "Event makeup",
  amount: 170,
  currency: "AUD",
};

const confirmed = (field: string, value: string): CompilerFact => ({
  field,
  value,
  status: "confirmed",
});

// ---------------------------------------------------------------------------
// CC1-01 / P1-01 - a confirmed answer keeps its meaning (Q01-Q07)
// ---------------------------------------------------------------------------

/**
 * The reviewed parser deleted every character that was not a digit or a dot,
 * so "5-6" became the number 56 and produced an exact AUD 5,600. Each of these
 * values carries a meaning that no single quantity can represent; none of them
 * may become a different exact quantity.
 */
const MEANING_DESTROYING = [
  { value: "5-6", label: "a range", wouldHaveBeen: 5600 },
  { value: "4 or 5", label: "alternatives", wouldHaveBeen: 4500 },
  { value: "-5", label: "a negative", wouldHaveBeen: 500 },
  { value: "5 to 6", label: "a spelled range", wouldHaveBeen: 5600 },
  { value: "4/5", label: "a slash alternative", wouldHaveBeen: 4500 },
  { value: "5 adults and 2 children", label: "two quantities", wouldHaveBeen: 5200 },
];

for (const { value, label, wouldHaveBeen } of MEANING_DESTROYING) {
  test(`Q01-Q03: ${label} (${JSON.stringify(value)}) never becomes an exact quantity`, () => {
    const out = compilePrice([perPerson], "Group makeup", [confirmed("guests", value)]);
    assert.notEqual(out.kind, "EXACT", `${JSON.stringify(value)} produced ${JSON.stringify(out)}`);
    assert.equal(out.kind, "UNRESOLVED_QUANTITY");
    if (out.kind !== "UNRESOLVED_QUANTITY") return;
    // The original answer is preserved verbatim so the desk can show the owner
    // what they actually confirmed, rather than a cleaned-up approximation.
    assert.equal(out.value, value);
    assert.equal(out.field, "guests");
    // And the number the destructive parser would have invented is nowhere in
    // the outcome.
    assert.ok(
      !JSON.stringify(out).includes(String(wouldHaveBeen)),
      `the fabricated amount ${wouldHaveBeen} must not appear anywhere in the outcome`,
    );
  });
}

test("Q04: empty, whitespace, zero, malformed decimals and overflow are deliberate outcomes, never a price", () => {
  for (const value of [
    "",
    "   ",
    "0",
    "0.0",
    "1.2.3",
    ".5",
    "5.",
    "abc",
    "1e6",
    "٤",
    "1,5",
    "99999999",
    "Infinity",
    "NaN",
  ]) {
    const out = compilePrice([perPerson], "Group makeup", [confirmed("guests", value)]);
    assert.notEqual(
      out.kind,
      "EXACT",
      `${JSON.stringify(value)} must not price, got ${JSON.stringify(out)}`,
    );
    assert.ok(
      out.kind === "UNRESOLVED_QUANTITY" || out.kind === "BLOCKED",
      `${JSON.stringify(value)} produced ${out.kind}`,
    );
  }
});

test("Q04: a supported quantity can never produce a non-finite or out-of-bounds amount", () => {
  const out = compilePrice([perPerson], "Group makeup", [confirmed("guests", "1000000")]);
  if (out.kind === "EXACT") {
    assert.ok(Number.isSafeInteger(out.amountMinor), "amountMinor must stay a safe integer");
    assert.ok(out.amountMinor > 0);
  } else {
    assert.equal(out.kind, "UNRESOLVED_QUANTITY");
  }
});

test("Q05: an ordinary confirmed count still prices exactly (4 at AUD 145 = AUD 580)", () => {
  const out = compilePrice([makeupAt145], "Group makeup", [confirmed("guests", "4")]);
  assert.equal(out.kind, "EXACT");
  if (out.kind !== "EXACT") return;
  assert.equal(out.amountMinor, 58_000);
});

test("Q05: a count written with its unit word still prices exactly", () => {
  for (const value of ["4 people", "4 guests", " 4 "]) {
    const out = compilePrice([makeupAt145], "Group makeup", [confirmed("guests", value)]);
    assert.equal(out.kind, "EXACT", `${JSON.stringify(value)} gave ${JSON.stringify(out)}`);
    if (out.kind !== "EXACT") continue;
    assert.equal(out.amountMinor, 58_000);
  }
});

test("Q06: the minimum billable quantity still applies (2 at AUD 145, minimum 3 = AUD 435)", () => {
  const out = compilePrice([makeupAt145Min3], "Group makeup", [confirmed("guests", "2")]);
  assert.equal(out.kind, "EXACT");
  if (out.kind !== "EXACT") return;
  assert.equal(out.amountMinor, 43_500);
  assert.match(out.workings, /minimum/);
});

test("Q07: a legitimately fractional quantity keeps its precision - no universal integer coercion", () => {
  const out = compilePrice([perHour], "Deep clean", [confirmed("hours", "2.5")]);
  assert.equal(out.kind, "EXACT");
  if (out.kind !== "EXACT") return;
  assert.equal(out.amountMinor, 15_000); // 2.5 hours x AUD 60
});

test("Q07: a fractional area quantity prices without drift", () => {
  const perSqm: BusinessRule = {
    kind: "per_unit",
    service: "Rendering",
    amount: 19.99,
    currency: "AUD",
    unit: "square metre",
    quantityField: "area",
  };
  const out = compilePrice([perSqm], "Rendering", [confirmed("area", "3")]);
  assert.equal(out.kind, "EXACT");
  if (out.kind !== "EXACT") return;
  assert.equal(out.amountMinor, 5997);
});

// ---------------------------------------------------------------------------
// CC1-02 / P1-02 - ambiguity is explicit, never resolved by array order
// ---------------------------------------------------------------------------

test("S01: a request matching several services asks the owner to choose, it does not price", () => {
  const out = compilePrice([bridal, event], "makeup", []);
  assert.notEqual(out.kind, "EXACT");
  assert.equal(out.kind, "AMBIGUOUS_SERVICE");
  if (out.kind !== "AMBIGUOUS_SERVICE") return;
  assert.equal(out.reason, "multiple_services");
  assert.deepEqual(out.choices.map((c) => c.service).sort(), ["Bridal makeup", "Event makeup"]);
});

test("S02: reversing the rule order cannot change the commercial outcome", () => {
  const a = compilePrice([bridal, event], "makeup", []);
  const b = compilePrice([event, bridal], "makeup", []);
  assert.deepEqual(a, b);
});

test("S02: rule order cannot change the outcome for a priced request either", () => {
  const other: FixedPriceRule = {
    kind: "fixed_price",
    service: "Bridal trial",
    amount: 180,
    currency: "AUD",
  };
  const a = compilePrice([bridal, other], "Bridal makeup", []);
  const b = compilePrice([other, bridal], "Bridal makeup", []);
  assert.deepEqual(a, b);
  assert.equal(a.kind, "EXACT");
});

test("S03: two different simultaneously Active prices for one service is a conflict, not a coin toss", () => {
  const cheap: FixedPriceRule = { ...bridal, amount: 190 };
  const dear: FixedPriceRule = { ...bridal, amount: 240 };
  const a = compilePrice([cheap, dear], "Bridal makeup", []);
  const b = compilePrice([dear, cheap], "Bridal makeup", []);
  assert.equal(a.kind, "AMBIGUOUS_SERVICE");
  if (a.kind !== "AMBIGUOUS_SERVICE") return;
  assert.equal(a.reason, "conflicting_rules");
  assert.deepEqual(a, b, "which of two conflicting prices wins must not depend on array order");
});

test("S04: no match, one exact match, an identical duplicate and a deliberate alias each behave correctly", () => {
  // No match at all.
  assert.equal(compilePrice([bridal], "Plumbing", []).kind, "NO_RULE");

  // One confirmed exact match.
  const exact = compilePrice([bridal], "Bridal makeup", []);
  assert.equal(exact.kind, "EXACT");

  // An identical duplicate rule is the same commercial answer, not a conflict.
  const dup = compilePrice([bridal, { ...bridal }], "Bridal makeup", []);
  assert.equal(dup.kind, "EXACT", `identical duplicates gave ${JSON.stringify(dup)}`);
  if (dup.kind !== "EXACT") return;
  assert.equal(dup.amountMinor, 19_000);

  // A phrasing that only one service can plausibly mean still resolves.
  const alias = compilePrice([bridal, event], "bridal", []);
  assert.equal(alias.kind, "EXACT");
});

test("S04: matchRule reports the same three outcomes the compiler acts on", () => {
  assert.equal(matchRule([bridal], "Plumbing").kind, "none");
  assert.equal(matchRule([bridal], "Bridal makeup").kind, "one");
  assert.equal(matchRule([bridal, event], "makeup").kind, "ambiguous");
  // Real customer phrasing that names one service still resolves to that one.
  assert.equal(matchRule([makeupAt145], "Group makeup for 4").kind, "one");
});

// ---------------------------------------------------------------------------
// CC1-03 / P1-03 - an unconfirmed service is not a confirmed commercial premise
// ---------------------------------------------------------------------------

test("A01: a model-proposed service marked check_this cannot unlock an exact price", () => {
  const out = compilePrice([bridal], "Bridal makeup", [
    { field: "service", value: "Bridal makeup", status: "check_this" },
  ]);
  assert.notEqual(out.kind, "EXACT", JSON.stringify(out));
  assert.equal(out.kind, "PROVISIONAL");
  if (out.kind !== "PROVISIONAL") return;
  // The arithmetic is still available so the desk can show it as provisional -
  // it simply is not a decided commercial premise.
  assert.equal(out.amountMinor, 19_000);
  assert.equal(out.premise, "service_unconfirmed");
});

test("A01: every non-confirmed service status leaves the price provisional", () => {
  for (const status of ["inferred", "check_this", "unknown", "conflict", "range"] as const) {
    const out = compilePrice([bridal], "Bridal makeup", [
      { field: "service", value: "Bridal makeup", status },
    ]);
    assert.equal(out.kind, "PROVISIONAL", `${status} produced ${out.kind}`);
  }
});

test("A02: an owner-confirmed service premise prices exactly", () => {
  const out = compilePrice([bridal], "Bridal makeup", [confirmed("service", "Bridal makeup")]);
  assert.equal(out.kind, "EXACT");
  if (out.kind !== "EXACT") return;
  assert.equal(out.amountMinor, 19_000);
});

test("A01: an unconfirmed service also leaves a per-unit price provisional, quantity notwithstanding", () => {
  const out = compilePrice([makeupAt145], "Group makeup", [
    confirmed("guests", "4"),
    { field: "service", value: "Group makeup", status: "check_this" },
  ]);
  assert.equal(out.kind, "PROVISIONAL");
  if (out.kind !== "PROVISIONAL") return;
  assert.equal(out.amountMinor, 58_000);
});

// ---------------------------------------------------------------------------
// CC1-05 - what a priced decision implies about money (B-1 regression)
// ---------------------------------------------------------------------------

test("P01/P02: a per-unit decision implies its total AND its unit rate", () => {
  const out = compilePrice([makeupAt145], "Group makeup", [confirmed("guests", "4")]);
  assert.equal(out.kind, "EXACT");
  // "That comes to $580. 4 people at $145 each." - both figures come from the
  // same structured rule, so neither is a disagreement.
  assert.deepEqual(impliedAmountsMinor(out), [14_500, 58_000]);
});

test("P01/P02: a minimum-billed decision also implies the floor total", () => {
  const out = compilePrice([makeupAt145Min3], "Group makeup", [confirmed("guests", "2")]);
  assert.equal(out.kind, "EXACT");
  assert.deepEqual(impliedAmountsMinor(out), [14_500, 43_500]);
});

test("P01: a fixed price implies exactly one amount", () => {
  const out = compilePrice([bridal], "Bridal makeup", [confirmed("service", "Bridal makeup")]);
  assert.deepEqual(impliedAmountsMinor(out), [19_000]);
});

test("P01: an unpriced outcome implies no amounts at all", () => {
  for (const out of [
    compilePrice([makeupAt145], "Group makeup", []),
    compilePrice([bridal], "Plumbing", []),
    compilePrice([bridal, event], "makeup", []),
    compilePrice([makeupAt145], "Group makeup", [confirmed("guests", "5-6")]),
  ]) {
    assert.deepEqual(impliedAmountsMinor(out), [], `${out.kind} must imply nothing`);
  }
});

test("A01: a provisional price implies the same amounts it would if confirmed", () => {
  const out = compilePrice([makeupAt145], "Group makeup", [
    confirmed("guests", "4"),
    { field: "service", value: "Group makeup", status: "check_this" },
  ]);
  assert.equal(out.kind, "PROVISIONAL");
  assert.deepEqual(impliedAmountsMinor(out), [14_500, 58_000]);
});
