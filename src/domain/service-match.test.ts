import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestService } from "./service-match.ts";

const PAINTER = ["Interior painting", "Exterior repaint", "Deck staining"];
const CLEANER = ["End of lease clean", "Carpet steam clean", "Regular clean"];

test("a message that names one service pre-selects it", () => {
  assert.equal(
    suggestService("Can you quote interior painting for 3 rooms?", PAINTER),
    "Interior painting",
  );
  assert.equal(
    suggestService("need an end of lease clean for a 2 bed unit", CLEANER),
    "End of lease clean",
  );
  assert.equal(suggestService("Our deck needs staining", PAINTER), "Deck staining");
});

test("a message that could be two services selects nothing", () => {
  // "painted" fits neither name completely: Enquiry does not guess.
  assert.equal(
    suggestService("we need the inside of our house painted before we sell", PAINTER),
    undefined,
  );
  assert.equal(suggestService("clean please", ["Regular clean", "Deep clean"]), undefined);
});

test("the more specific of two matching names wins", () => {
  assert.equal(
    suggestService("end of lease clean and carpets", ["Clean", "End of lease clean"]),
    "End of lease clean",
  );
});

test("nothing to match against, nothing suggested", () => {
  assert.equal(suggestService("anything", []), undefined);
  assert.equal(suggestService("", PAINTER), undefined);
});
