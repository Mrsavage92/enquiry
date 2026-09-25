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
