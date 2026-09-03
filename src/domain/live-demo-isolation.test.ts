import assert from "node:assert/strict";
import test from "node:test";
import {
  isLiveHandoffClean,
  mayPlayDemoArrival,
  mayRecordSendViaShortcut,
  mayShowFixtureContent,
} from "./live-demo-isolation.ts";
import type { LiveHandoffState } from "./live-demo-isolation.ts";

const live = { demoMode: false, onboarded: true, arrivalPlayed: false, framed: false };
const demo = { demoMode: true, onboarded: true, arrivalPlayed: false, framed: false };

test("the demo arrival cannot fire for a real signed-in tenant", () => {
  // The R2A blocker. This fired on `onboarded` alone, so a real business was
  // handed a fabricated Instagram enquiry moments after finishing setup.
  assert.equal(mayPlayDemoArrival(live), false);
});

test("no combination of other flags can make a live session play the arrival", () => {
  for (const onboarded of [true, false]) {
    for (const arrivalPlayed of [true, false]) {
      for (const framed of [true, false]) {
        assert.equal(
          mayPlayDemoArrival({ demoMode: false, onboarded, arrivalPlayed, framed }),
          false,
          `live session played the arrival with ${JSON.stringify({ onboarded, arrivalPlayed, framed })}`,
        );
      }
    }
  }
});

test("explicit demo mode still gets its arrival", () => {
  assert.equal(mayPlayDemoArrival(demo), true);
});

test("demo mode still respects the existing once-only and preview guards", () => {
  assert.equal(mayPlayDemoArrival({ ...demo, arrivalPlayed: true }), false);
  assert.equal(mayPlayDemoArrival({ ...demo, framed: true }), false);
  assert.equal(mayPlayDemoArrival({ ...demo, onboarded: false }), false);
});

test("fixture content is demo-only", () => {
  assert.equal(mayShowFixtureContent({ demoMode: false }), false);
  assert.equal(mayShowFixtureContent({ demoMode: true }), true);
});

test("the Cmd/Ctrl+Enter workspace shortcut can only record a send in demo mode", () => {
  // A real send always goes through the same copy-and-record step as a
  // click on the Send button (which itself now always opens the approval
  // preview - see isCustomerFacingSend in commercial.ts). A keyboard
  // shortcut that skipped both would be a silent-send regression.
  assert.equal(mayRecordSendViaShortcut(false), false);
  assert.equal(mayRecordSendViaShortcut(true), true);
});

test("a clean live handoff carries no fixture business, enquiry or booking", () => {
  assert.equal(
    isLiveHandoffClean({
      onboarded: true,
      demoMode: false,
      businesses: [],
      enquiries: [],
      bookings: [],
      arrivalPlayed: true,
    }),
    true,
  );
});

test("any fixture content left behind fails the handoff", () => {
  const base = {
    onboarded: true,
    demoMode: false,
    businesses: [] as unknown[],
    enquiries: [] as unknown[],
    bookings: [] as unknown[],
    arrivalPlayed: true,
  };
  assert.equal(isLiveHandoffClean({ ...base, businesses: [{ id: "glow" }] }), false);
  assert.equal(isLiveHandoffClean({ ...base, enquiries: [{ id: "f01" }] }), false);
  assert.equal(isLiveHandoffClean({ ...base, bookings: [{ id: "b1" }] }), false);
});

test("every demo-only transient field independently fails a clean handoff - each is checked, none is a free pass", () => {
  // `live-handoff.test.ts` proves the end-to-end store scenarios for several
  // of these (undo, events, lastAutomated, offline). This is the pure
  // per-field truth table `isLiveHandoffClean` itself owns: a stale value
  // left in ANY one of these fields must fail the handoff on its own, with
  // every other field clean - so a future field added to
  // `LiveHandoffState` without being wired into the check here is caught by
  // a new failing test, not silently waved through.
  const clean: LiveHandoffState = {
    onboarded: true,
    demoMode: false,
    businesses: [],
    enquiries: [],
    bookings: [],
    arrivalPlayed: true,
  };
  assert.equal(isLiveHandoffClean(clean), true, "sanity: the base state is clean on its own");

  const dirtyPatches: Record<string, Partial<LiveHandoffState>> = {
    undo: { undo: { snapshot: "fixture" } },
    events: { events: [{ id: "demo-event" }] },
    lastAutomated: { lastAutomated: { customer: "Priya" } },
    teach: { teach: { from: "old voice", to: "new voice" } },
    brainPreview: { brainPreview: { proposal: "something" } },
    lastMerge: { lastMerge: { winnerId: "f01", loserId: "f02" } },
    voiceNotice: { voiceNotice: { reason: "demo voice drift" } },
    offline: { offline: true },
    offlineSimulated: { offlineSimulated: true },
    networkOffline: { networkOffline: true },
  };
  for (const [field, patch] of Object.entries(dirtyPatches)) {
    assert.equal(
      isLiveHandoffClean({ ...clean, ...patch }),
      false,
      `a stale '${field}' must fail the handoff on its own`,
    );
  }
});

test("a live handoff that leaves demo mode on fails", () => {
  assert.equal(
    isLiveHandoffClean({
      onboarded: true,
      demoMode: true,
      businesses: [],
      enquiries: [],
      bookings: [],
      arrivalPlayed: true,
    }),
    false,
  );
});

test("a live handoff that leaves the arrival armed fails", () => {
  assert.equal(
    isLiveHandoffClean({
      onboarded: true,
      demoMode: false,
      businesses: [],
      enquiries: [],
      bookings: [],
      arrivalPlayed: false,
    }),
    false,
  );
});

test("onboarding that did not complete is not a clean handoff", () => {
  // Server failure must leave onboarding incomplete rather than half-done.
  assert.equal(
    isLiveHandoffClean({
      onboarded: false,
      demoMode: false,
      businesses: [],
      enquiries: [],
      bookings: [],
      arrivalPlayed: true,
    }),
    false,
  );
});
