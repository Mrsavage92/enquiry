import assert from "node:assert/strict";
import test from "node:test";
import { readBusinessDetails } from "./business-details-read.ts";
import { closedRangeCovers, describeDetail, type BusinessDetail } from "./business-detail.ts";
import { compilePrice } from "./price-compiler.ts";
import { describeRule, type BusinessRule } from "./business-rule.ts";

/**
 * Review 6b (41/52 on eed60b9): each untrue reply it found, reproduced here as
 * the reading or decision that caused it, and now true.
 */

const TUE_29_SEP = new Date("2026-09-29T10:00:00+10:00");

function detailsOf(line: string): BusinessDetail[] {
  return readBusinessDetails(line, TUE_29_SEP).details.map((d) => d.detail);
}

test("2: 'Not available Saturday 10 October' is one closed date, never every Saturday", () => {
  for (const line of ["Not available Saturday 10 October", "not available Sat 10 Oct"]) {
    const [detail, ...rest] = detailsOf(line);
    assert.equal(rest.length, 0, line);
    assert.deepEqual(detail, { kind: "closed_dates", from: "10-10", to: "10-10", year: 2026 });
    assert.equal(describeDetail(detail!), "Closed on Saturday 10 October only");
    assert.equal(closedRangeCovers("2026-10-10", detail as never), true);
    assert.equal(closedRangeCovers("2026-10-17", detail as never), false, "not the next Saturday");
    assert.equal(closedRangeCovers("2027-10-10", detail as never), false, "not next year");
  }
});

test("2: one-off and yearly dates read as dates; only recurring words make a weekday rule", () => {
  assert.deepEqual(detailsOf("closed Christmas Day"), [
    { kind: "closed_dates", from: "12-25", to: "12-25" },
  ]);
  assert.equal(
    describeDetail(detailsOf("closed Christmas Day")[0]!),
    "Closed on 25 December every year",
  );
  assert.deepEqual(detailsOf("away 20-27 Dec"), [
    { kind: "closed_dates", from: "12-20", to: "12-27", year: 2026 },
  ]);
  for (const [line, days, said] of [
    ["no Saturdays", [6], "You don't work Saturdays"],
    ["not working weekends", [0, 6], "You don't work Saturdays or Sundays"],
    ["we don't work Saturdays", [6], "You don't work Saturdays"],
    ["closed Saturdays", [6], "You don't work Saturdays"],
  ] as const) {
    const read = detailsOf(line);
    assert.deepEqual(read, [{ kind: "closed_days", days: [...days] }], line);
    assert.equal(describeDetail(read[0]!), said);
  }
});

test("4: a weekend surcharge and a fortnightly discount are rules, not notes", () => {
  assert.deepEqual(detailsOf("Weekend jobs add 20%"), [
    { kind: "surcharge", percent: 20, days: [0, 6] },
  ]);
  assert.deepEqual(detailsOf("Fortnightly cleans get 10% off"), [
    { kind: "discount", percent: 10, frequency: "fortnightly" },
  ]);
  const travel = readBusinessDetails("Travel $1 per km after the first 20 km", TUE_29_SEP);
  assert.equal(travel.unread[0]?.note, true, "travel stays a note");
});

function tier(text: string): BusinessRule {
  const read = readBusinessDetails(text, TUE_29_SEP);
  assert.equal(read.unread.length, 0, JSON.stringify(read.unread));
  assert.equal(read.prices.length, 1);
  return read.prices[0]!.rule;
}

function quote(rule: BusinessRule, bedrooms: string): number {
  const price = compilePrice([rule], rule.service, [
    { field: "service", value: rule.service, status: "confirmed" },
    { field: "bedrooms", value: bedrooms, status: "confirmed" },
  ]);
  assert.equal(price.kind, "EXACT");
  return price.kind === "EXACT" ? price.amountMinor : 0;
}

test("5: '$160 for up to 3 bedrooms, extra bedrooms $35 each' quotes 4 bed $195 and 5 bed $230", () => {
  const rule = tier("Regular house clean $160 for up to 3 bedrooms, extra bedrooms $35 each");
  assert.equal(
    describeRule(rule),
    "Regular house clean: $160 for up to 3 bedrooms, then $35 per extra bedroom",
  );
  assert.equal(quote(rule, "2"), 16000);
  assert.equal(quote(rule, "3"), 16000);
  assert.equal(quote(rule, "4"), 19500);
  assert.equal(quote(rule, "5"), 23000);
});

test("5: split over two lines the threshold is kept; an extra price with no threshold is refused", () => {
  const joined = tier("Regular house clean $160 for up to 3 bedrooms\nExtra bedrooms $35 each");
  assert.equal(quote(joined, "4"), 19500);
  const pair = readBusinessDetails("Regular house clean $160\nExtra bedroom $35", TUE_29_SEP);
  assert.equal(pair.prices.length, 0, "neither line of the pair is saved on its own");
  assert.equal(pair.unread.length, 2);
  assert.match(pair.unread[1]!.reason, /no price says how many bedrooms come before/);
  const alone = readBusinessDetails("Regular house clean $160 for up to 3 bedrooms", TUE_29_SEP);
  assert.equal(alone.prices.length, 0);
  assert.match(alone.unread[0]!.reason, /not what each bedroom after that costs/);
  assert.notEqual(alone.unread[0]!.note, true, "never kept as a harmless note");
});
