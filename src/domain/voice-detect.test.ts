import assert from "node:assert/strict";
import { test } from "node:test";
import { detectSheetLetterMismatch, alignLetterToSheet } from "./voice-detect.ts";

test("a letter that says $187 against a $190 hold is a mismatch", () => {
  const miss = detectSheetLetterMismatch(
    "If you'd like to hold the date, a $187 booking fee does that.",
    { total: 625, hold: 190 },
  );
  assert.ok(miss);
  assert.equal(miss!.sheet, "$190");
  assert.equal(miss!.letter, "$187");
});

test("alignLetterToSheet fixes the hold and leaves the total", () => {
  const fixed = alignLetterToSheet(
    "If you'd like to hold the date, a $187 booking fee does that. Makeup is $625.",
    { total: 625, hold: 190 },
  );
  assert.match(fixed, /\$190/);
  assert.doesNotMatch(fixed, /\$187/);
  assert.match(fixed, /\$625/);
});

test("an exact sheet letter is clean", () => {
  assert.equal(
    detectSheetLetterMismatch(
      "Makeup for four of you is $625. A $190 booking fee holds the date.",
      { total: 625, hold: 190 },
    ),
    null,
  );
});
