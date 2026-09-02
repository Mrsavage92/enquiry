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
  businessFilter: "all",
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
  const demoAgain = {
    ...seeded,
    ...MARK_ONBOARDED_LOCALLY_PATCH,
    demoMode: true,
    arrivalPlayed: false,
  };
  assert.equal(mayPlayDemoArrival({ ...demoAgain, framed: false }), true);
});

/**
 * hydrateFromServer's exact committed patch, mirrored the same way.
 *
 * This is the "stale local/session state" case: a browser that previously ran
 * demo mode, or opened /lab, or has a year-old localStorage snapshot, loading
 * the live app again. zustand's persist middleware restores that JSON as the
 * store's boot state before any component reads it - so the guarantee is not
 * "the seed is clean" (it explicitly isn't, demoMode:true by design) but "the
 * one function every live session runs before rendering anything overwrites
 * ALL of it, unconditionally, no matter what was there".
 */
function hydrateFromServerPatch(
  prior: { businessFilter: string },
  server: { businesses: { id: string }[]; enquiries: unknown[]; bookings: unknown[] },
) {
  return {
    businesses: server.businesses,
    enquiries: server.enquiries,
    bookings: server.bookings,
    demoMode: false,
    arrivalPlayed: true,
    lastArrivalId: null,
    businessFilter:
      prior.businessFilter === "all" || server.businesses.some((b) => b.id === prior.businessFilter)
        ? prior.businessFilter
        : "all",
  };
}

/** Every way a browser could arrive with demo/fixture content already loaded. */
const DIRTY_PRIOR_STATES = [
  { label: "the fixture boot seed", state: seeded },
  { label: "an open demo session mid-browse", state: { ...seeded, businessFilter: "ridge" } },
  {
    label: "a year-old persisted snapshot with a stale fixture filter",
    state: { ...seeded, businessFilter: "glow", arrivalPlayed: true },
  },
] as const;

for (const { label, state } of DIRTY_PRIOR_STATES) {
  test(`hydrateFromServer overwrites ${label} for a tenant with no real content yet`, () => {
    const server = {
      businesses: [] as { id: string }[],
      enquiries: [] as unknown[],
      bookings: [] as unknown[],
    };
    const after = { ...state, ...hydrateFromServerPatch(state, server) };
    assert.equal(isLiveHandoffClean({ ...after, onboarded: true }), true);
    assert.equal(mayPlayDemoArrival({ ...after, onboarded: true, framed: false }), false);
  });

  test(`hydrateFromServer overwrites ${label} for a tenant with real content`, () => {
    const server = {
      businesses: [{ id: "b8f2-real-uuid", name: "Aurora Mobile Makeup" }],
      enquiries: [{ id: "e-real-1" }],
      bookings: [] as unknown[],
    };
    const after = { ...state, ...hydrateFromServerPatch(state, server) };
    // No fixture id survives, in either array or the filter.
    assert.ok(!after.businesses.some((b: { id: string }) => b.id === "glow" || b.id === "ridge"));
    assert.deepEqual(after.enquiries, server.enquiries);
    assert.notEqual(after.businessFilter, "glow");
    assert.notEqual(after.businessFilter, "ridge");
    assert.equal(after.demoMode, false);
    assert.equal(mayPlayDemoArrival({ ...after, onboarded: true, framed: false }), false);
  });
}

/**
 * persist's `merge` option, mirrored the same way. This is the bug the two
 * fixtures above cannot see, because they start from `hydrateFromServer`'s
 * OUTPUT rather than from a fresh page load rehydrating that output back in.
 *
 * The real sequence: a live tenant's browser writes demoMode:false to storage
 * (partialize keeps that key), but partialize DROPS businesses/enquiries/
 * bookings/drafts/audit whenever demoMode is false - a live snapshot legitimately
 * carries no tenant arrays. The persisted JSON therefore has demoMode:false with
 * those keys simply absent. The old merge function fell back to `current` -
 * the freshly seeded, fixture-populated module state - for any array missing
 * from the persisted JSON, with no regard for demoMode. Net result on the very
 * next page load: demoMode:false merged with a full fixture workspace. Every
 * demo guard in this codebase keys off demoMode, so every one of them would
 * have waved this straight through as "live, trust it".
 *
 * Reproduced end to end in a real browser during this correction: a plain
 * page reload after onboarding rendered "$16,627" and 19 fixture enquiries
 * under demoMode:false.
 */
function mergePersistedState(
  persisted: {
    demoMode?: boolean;
    businesses?: { id: string }[];
    enquiries?: unknown[];
    bookings?: unknown[];
  },
  current: { businesses: { id: string }[]; enquiries: unknown[]; bookings: unknown[] },
) {
  const p = persisted;
  const wasLive = p.demoMode === false;
  return {
    businesses: Array.isArray(p.businesses) ? p.businesses : wasLive ? [] : current.businesses,
    enquiries: Array.isArray(p.enquiries) ? p.enquiries : wasLive ? [] : current.enquiries,
    bookings: Array.isArray(p.bookings) ? p.bookings : wasLive ? [] : current.bookings,
    demoMode: p.demoMode ?? true,
  };
}

test("a live tenant's persisted snapshot never rehydrates onto the fixture seed", () => {
  // The exact defect: partialize wrote demoMode:false with no tenant arrays at
  // all (not even empty ones - the keys are absent), and the fresh module's
  // `current` is the fixture-populated seed.
  const persistedLiveSnapshot = { demoMode: false };
  const freshSeed = { businesses: [{ id: "glow" }], enquiries: [{ id: "f01" }], bookings: [] };

  const after = mergePersistedState(persistedLiveSnapshot, freshSeed);

  assert.equal(after.demoMode, false);
  assert.deepEqual(after.businesses, []);
  assert.deepEqual(after.enquiries, []);
  assert.deepEqual(after.bookings, []);
  assert.equal(
    mayPlayDemoArrival({ ...after, onboarded: true, arrivalPlayed: false, framed: false }),
    false,
  );
});

test("a demo/prototype snapshot still rehydrates onto the fixture seed", () => {
  // The fix must not break the one path that legitimately wants this: local
  // dev / prototype mode picking its fixture browsing back up after a reload.
  const persistedDemoSnapshot = { demoMode: true };
  const freshSeed = { businesses: [{ id: "glow" }], enquiries: [{ id: "f01" }], bookings: [] };

  const after = mergePersistedState(persistedDemoSnapshot, freshSeed);

  assert.equal(after.demoMode, true);
  assert.deepEqual(after.businesses, freshSeed.businesses);
  assert.deepEqual(after.enquiries, freshSeed.enquiries);
});

test("a browser with nothing persisted yet still boots into the fixture prototype", () => {
  // First-ever load: demoMode is absent from storage entirely, not `false`.
  // Must not be treated as "was live".
  const after = mergePersistedState(
    {},
    { businesses: [{ id: "glow" }], enquiries: [{ id: "f01" }], bookings: [] },
  );
  assert.deepEqual(after.businesses, [{ id: "glow" }]);
  assert.deepEqual(after.enquiries, [{ id: "f01" }]);
});

test("an explicit array in the persisted snapshot always wins, live or demo", () => {
  // hydrateFromServer's own writes (when persist happens to catch demoMode
  // true mid-transition, or any future code path that persists a real array)
  // must never be discarded in favour of either fallback.
  const real = [{ id: "b8f2-real-uuid" }];
  const after = mergePersistedState(
    { demoMode: false, businesses: real },
    { businesses: [{ id: "glow" }], enquiries: [], bookings: [] },
  );
  assert.deepEqual(after.businesses, real);
});
