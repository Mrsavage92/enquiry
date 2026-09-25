import assert from "node:assert/strict";
import { test } from "node:test";
import { readQuantityFromMessage } from "./quantity-reader.ts";

const read = (text: string, field: string, unit = "") =>
  readQuantityFromMessage(text, field, unit)?.value;

test("square metres in every common spelling", () => {
  const cases: [string, string][] = [
    ["Walls and ceilings, roughly 120 square metres.", "120"],
    ["about 120m2 all up", "120"],
    ["It's 120 m2", "120"],
    ["around 85 sqm", "85"],
    ["95 sq m of decking", "95"],
    ["150 square meters", "150"],
    ["60m² bathroom and hall", "60"],
    ["~120 square metres", "120"],
    ["120ish square metres", "120"],
    ["40.5 square metres", "40.5"],
  ];
  for (const [text, want] of cases) {
    assert.equal(read(text, "square metres", "square metre"), want, text);
  }
});

test("bedrooms: digits, words, shorthand", () => {
  const cases: [string, string][] = [
    ["need an end of lease clean for a 2 bed unit", "2"],
    ["two bedrooms and a study", "2"],
    ["3 bedroom house in Chermside", "3"],
    ["4 x bedrooms, 2 bathrooms", "4"],
    ["a 3-bedroom townhouse", "3"],
    ["Bedrooms: 5.", "5"],
    ["it's a one bedroom flat", "1"],
    ["twelve bedrooms (it's a lodge)", "12"],
    ["Six beds", "6"],
    ["2br apartment", "2"],
  ];
  for (const [text, want] of cases) {
    assert.equal(read(text, "bedrooms", "bedroom"), want, text);
  }
});

test("every number word from one to twelve", () => {
  const words = [
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
  ];
  words.forEach((word, i) => {
    assert.equal(read(`We have ${word} guests coming`, "guests", "guest"), String(i + 1), word);
  });
});

test("people, guests, hours and rooms", () => {
  assert.equal(read("makeup for 5 people on the day", "people", "person"), "5");
  assert.equal(read("makeup for 5 people on the day", "guests", "guest"), "5");
  assert.equal(read("about 3 hours of work", "hours", "hour"), "3");
  assert.equal(read("2.5 hrs", "hours", "hour"), "2.5");
  assert.equal(read("paint 4 rooms please", "rooms", "room"), "4");
});

test("an approximate marker is kept, never dropped silently", () => {
  const r = readQuantityFromMessage("roughly 120 square metres", "square metres", "square metre");
  assert.equal(r?.approximate, true);
  assert.equal(r?.span, "roughly 120 square metres");
  assert.equal(
    readQuantityFromMessage("120 square metres", "square metres", "square metre")?.approximate,
    false,
  );
  assert.equal(readQuantityFromMessage("about two bedrooms", "bedrooms")?.approximate, true);
});

test("the unit must be the one the price needs", () => {
  const karen =
    "Hi there, we need the inside of our 3 bedroom house painted before we sell. Walls and ceilings, roughly 120 square metres. Could you do it on Saturday 3 October?";
  assert.equal(read(karen, "square metres", "square metre"), "120");
  assert.equal(read(karen, "bedrooms", "bedroom"), "3");
  // "bedroom" is not "rooms".
  assert.equal(read("3 bedroom house", "rooms", "room"), undefined);
  assert.equal(read("Moving out on the 30th", "bedrooms"), undefined);
});

test("ranges, choices and conflicting counts are not a reading", () => {
  assert.equal(read("3-4 bedrooms", "bedrooms"), undefined);
  assert.equal(read("3 or 4 bedrooms", "bedrooms"), undefined);
  assert.equal(read("three or four bedrooms", "bedrooms"), undefined);
  assert.equal(read("100 to 120 square metres", "square metres"), undefined);
  assert.equal(read("2 bedrooms, sorry I mean 3 bedrooms", "bedrooms"), undefined);
  // The same count said twice is still one count.
  assert.equal(read("2 bed unit. Yes 2 bedrooms.", "bedrooms"), "2");
});

test("never reads money, dates or words inside other words", () => {
  assert.equal(read("budget $120 square metres", "square metres"), undefined);
  assert.equal(read("nobody bedrooms", "bedrooms"), undefined);
  assert.equal(read("someone bedrooms", "bedrooms"), undefined);
  assert.equal(read("", "bedrooms"), undefined);
});

test("an owner's own unit word works without a built-in family", () => {
  assert.equal(read("6 windows at the front", "windows", "window"), "6");
  assert.equal(read("a single window", "windows", "window"), undefined);
});

test("thousands separators are one number, never its last digits", () => {
  const cases: [string, string, string, string][] = [
    ["about 1,200 square metres of wall", "square metres", "1200", "about 1,200 square metres"],
    ["12,000 square metres warehouse", "square metres", "12000", "12,000 square metres"],
    ["roughly 1 200 sqm", "square metres", "1200", "roughly 1 200 sqm"],
    ["a gala for 1,000 guests", "guests", "1000", "1,000 guests"],
  ];
  for (const [text, field, value, span] of cases) {
    const r = readQuantityFromMessage(text, field);
    assert.equal(r?.value, value, text);
    assert.equal(r?.span, span, text);
    // What the owner is shown is exactly what the customer wrote.
    assert.ok(text.includes(r!.span), `${text}: span is a substring`);
  }
});

test("ranges, bounds, corrections and per-item sizes are not a reading", () => {
  const none: [string, string][] = [
    ["between 3 and 4 bedrooms", "bedrooms"],
    ["4 and 5 bedrooms", "bedrooms"],
    ["one hour or two", "hours"],
    ["3 bedrooms - 4 if we count the study", "bedrooms"],
    ["not 3 bedrooms, 4", "bedrooms"],
    ["3 bedrooms, sorry I mean 4", "bedrooms"],
    ["3 bedrooms actually 4", "bedrooms"],
    ["2 rooms each 3 metres squared", "square metres"],
    ["3 square metres each", "square metres"],
    ["up to 5 guests", "guests"],
    ["less than 100 square metres", "square metres"],
    ["no more than 6 people", "people"],
    ["at least 3 hours", "hours"],
    ["over 100 square metres", "square metres"],
    ["under 50 sqm", "square metres"],
  ];
  for (const [text, field] of none) assert.equal(read(text, field), undefined, text);
  // A different unit after a comma is not a correction.
  assert.equal(read("4 x bedrooms, 2 bathrooms", "bedrooms"), "4");
  assert.equal(read("2 bed unit in Nundah, carpets too. Moving out on the 30th.", "bedrooms"), "2");
});
