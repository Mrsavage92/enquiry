import assert from "node:assert/strict";
import { test } from "node:test";
import { blockerInput } from "./blocker-input.ts";

test("a count gets a number pad and a number example", () => {
  assert.deepEqual(blockerInput("guests", "Guest count"), {
    inputMode: "numeric",
    placeholder: "e.g. 4",
  });
});

test("dates and places get a text field with an example in their own shape", () => {
  assert.equal(blockerInput("event_date", "Event date").placeholder, "e.g. Sat 17 Oct");
  assert.equal(blockerInput("suburb", "Suburb").inputMode, "text");
  assert.equal(blockerInput("hours", "Hours needed").placeholder, "e.g. 3 hours");
});

test("notices default off and a half-typed time zone is never stored", async () => {
  const { DEFAULT_PREFS, cleanPrefs } = await import("./workspace-prefs.ts");
  assert.equal(DEFAULT_PREFS.notifyArrival, false);
  assert.equal(DEFAULT_PREFS.notifyFollowUp, false);
  assert.equal(DEFAULT_PREFS.notifyLearning, false);
  assert.equal(cleanPrefs({ timezone: "Australia/Bris" }).timezone, undefined);
  assert.equal(cleanPrefs({ timezone: "Australia/Sydney" }).timezone, "Australia/Sydney");
});
