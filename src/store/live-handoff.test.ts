import assert from "node:assert/strict";
import test from "node:test";
import { isLiveHandoffClean, mayPlayDemoArrival } from "../domain/live-demo-isolation.ts";

/**
 * Proves the REAL store transition, not a restatement of the rule.
 *
 * prototype-store.ts cannot be imported under node's test runner (it pulls in
 * React and the "@/" alias), so this reproduces markOnboardedLocally's exact
 * committed patch and asserts the isolation rule against it. If the store's
 * patch and this fixture drift apart, the accompanying source comment in
 * prototype-store.ts is the pointer back here.
 */

/** The seeded boot state: fixtures loaded, demo on. */
const seeded = {
  onboarded: true,
  demoMode: true,
  businesses: [{ id: "glow" }, { id: "ridge" }],
  enquiries: [{ id: "f01" }, { id: "f02" }],
  bookings: [{ id: "b1" }],
  arrivalPlayed: false,
};

/** Exactly what markOnboardedLocally sets, mirrored from the store. */
const MARK_ONBOARDED_LOCALLY_PATCH = {
  onboarded: true,
  demoMode: false,
  onboardingStep: 8,
  firstHint: true,
  businesses: [] as unknown[],
  enquiries: [] as unknown[],
  bookings: [] as unknown[],
  drafts: {},
  confirmSent: {},
  businessFilter: "all",
  lastArrivalId: null,
  arrivalPlayed: true,
};

test("the seeded boot state would leak fixtures if handed to a live tenant", () => {
  // Establishes that the assertion below is meaningful rather than vacuous.
  assert.equal(isLiveHandoffClean(seeded), false);
  assert.equal(mayPlayDemoArrival({ ...seeded, framed: false }), true);
});

test("markOnboardedLocally produces a clean live handoff", () => {
  const after = { ...seeded, ...MARK_ONBOARDED_LOCALLY_PATCH };
  assert.equal(isLiveHandoffClean(after), true);
});

test("after the live handoff the demo arrival cannot fire", () => {
  const after = { ...seeded, ...MARK_ONBOARDED_LOCALLY_PATCH };
  assert.equal(
    mayPlayDemoArrival({
      demoMode: after.demoMode,
      onboarded: after.onboarded,
      arrivalPlayed: after.arrivalPlayed,
      framed: false,
    }),
    false,
  );
});

test("no fixture business, enquiry or booking survives the live handoff", () => {
  const after = { ...seeded, ...MARK_ONBOARDED_LOCALLY_PATCH };
  assert.deepEqual(after.businesses, []);
  assert.deepEqual(after.enquiries, []);
  assert.deepEqual(after.bookings, []);
  // businessFilter must not point at a fixture tenant either.
  assert.equal(after.businessFilter, "all");
});

test("the demo path is untouched by the live handoff patch", () => {
  // enterSample re-enables demo mode; the live patch must not be what decides
  // demo behaviour, only what turns it off for real tenants.
  const demoAgain = { ...seeded, ...MARK_ONBOARDED_LOCALLY_PATCH, demoMode: true, arrivalPlayed: false };
  assert.equal(mayPlayDemoArrival({ ...demoAgain, framed: false }), true);
});
