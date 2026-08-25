import assert from "node:assert/strict";
import { test } from "node:test";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import { BUSINESSES } from "../fixtures/businesses.ts";
import { BOOKINGS } from "../fixtures/bookings.ts";
import { briefing } from "./briefing.ts";

test("all-workspace briefing counts follow-up and booked value from fixtures", () => {
  const b = briefing(ENQUIRIES, BUSINESSES, BOOKINGS, "all");
  assert.ok(b.followUp >= 1);
  assert.ok(b.bookedValue > 0);
  assert.ok(b.needsYou > 0);
  assert.ok(b.openExactValue > 0);
});

test("Glow briefing does not include Harbour's Marcus follow-up", () => {
  const glow = briefing(ENQUIRIES, BUSINESSES, BOOKINGS, "glow");
  const all = briefing(ENQUIRIES, BUSINESSES, BOOKINGS, "all");
  assert.ok(glow.followUp < all.followUp || glow.followUp === 0);
  assert.equal(
    glow.followUp,
    ENQUIRIES.filter((e) => e.businessId === "glow" && e.followUpDue).length,
  );
});
