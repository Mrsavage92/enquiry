import assert from "node:assert/strict";
import test from "node:test";
import { isLiveHandoffClean, mayPlayDemoArrival } from "../domain/live-demo-isolation.ts";
import { outboundBlocked } from "../domain/situation.ts";

/**
 * Proves the REAL store transition, not a restatement of the rule.
 *
 * prototype-store.ts cannot be imported under node's test runner (it pulls in
 * React and the "@/" alias), so this reproduces markOnboardedLocally's exact
 * committed patch and asserts the isolation rule against it. If the store's
 * patch and this fixture drift apart, the accompanying source comment in
 * prototype-store.ts is the pointer back here.
 */

/**
 * The seeded boot state: fixtures loaded, demo on, AND every demo-only
 * transient field populated as if the browser had actually been used - an
 * approved demo send (undo + lastAutomated), a demo click tracked (events), a
 * teach proposal and a Brain price change left open (teach + brainPreview),
 * and a cross-channel merge banner showing a demo customer's name (lastMerge).
 * If any of these survive a live handoff, the corresponding "after" assertion
 * below would fail.
 */
const seeded = {
  onboarded: true,
  demoMode: true,
  businesses: [{ id: "glow" }, { id: "ridge" }],
  enquiries: [{ id: "f01" }, { id: "f02" }],
  bookings: [{ id: "b1" }],
  arrivalPlayed: false,
  businessFilter: "all",
  undo: {
    enquiries: [{ id: "f01" }],
    bookings: [{ id: "b1" }],
    businesses: [{ id: "glow" }],
    drafts: { f01: "Hi Priya, ..." },
    confirmSent: {},
  },
  events: [{ id: "ev1", fixtureId: "f01", action: "approve_quote", at: Date.now() }],
  lastAutomated: {
    enquiryId: "f01",
    customerName: "Priya Shah",
    at: Date.now(),
    reason: "Missing-info question, low risk",
  },
  teach: { enquiryId: "f01", factId: "fact1", proposal: "Always needs a 15% deposit" },
  brainPreview: {
    input: "raise prices 10%",
    current: "$145",
    next: "$160",
    appliesTo: "Group makeup",
  },
  lastMerge: { fromId: "f01", toId: "f02", toName: "Priya Shah" },
  voiceNotice: {
    enquiryId: "f01",
    businessId: "glow",
    from: "Warm",
    to: "Reserved",
    reason: "edited reply",
    patch: {},
  },
  // The Lab's "Pretend you're offline" toggle: setOfflineSimulated(true) sets
  // both fields together (offline: v || networkOffline).
  offlineSimulated: true,
  offline: true,
  networkOffline: false,
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
  undo: null,
  events: [] as unknown[],
  lastAutomated: null,
  teach: null,
  brainPreview: null,
  lastMerge: null,
  voiceNotice: null,
  offline: false,
  offlineSimulated: false,
  networkOffline: false,
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
 * Three consumers of the transient fields above, mirrored the same way as
 * `undoLast`/`TrustAudit`/`Notices` themselves - proving the FIELD is null is
 * necessary but not sufficient; these prove the thing a real operator would
 * actually see is also clean, the same distinction that made the TrustAudit
 * fallback worth gating at its own render site rather than trusting the store
 * alone.
 */

/** undoLast's exact restore semantics, mirrored from the store. */
function undoLastResult(s: {
  undo: null | {
    enquiries: unknown[];
    bookings: unknown[];
    businesses: unknown[];
    drafts: unknown;
    confirmSent: unknown;
  };
  enquiries: unknown[];
  bookings: unknown[];
  businesses: unknown[];
}) {
  if (!s.undo)
    return {
      changed: false,
      enquiries: s.enquiries,
      bookings: s.bookings,
      businesses: s.businesses,
    };
  return {
    changed: true,
    enquiries: s.undo.enquiries,
    bookings: s.undo.bookings,
    businesses: s.undo.businesses,
  };
}

/** TrustAudit's row selection, mirrored from the post-fix component. */
function trustAuditRows(s: { audit: unknown[]; demoMode: boolean; events: unknown[] }) {
  if (s.audit.length > 0) return s.audit;
  if (!s.demoMode) return [];
  return [...s.events].reverse();
}

/** Notices' automation item, mirrored from the component. */
function noticesHasAutopilotItem(s: { lastAutomated: unknown }) {
  return Boolean(s.lastAutomated);
}

test("demo action -> live onboarding -> the Undo shortcut restores nothing", () => {
  // Before this fix: a demo approve left a fixture snapshot in `undo`. The
  // global "u" key and every toastUndo() button call undoLast() with no gate
  // of any kind, so onboarding straight into a live workspace and pressing
  // "u" restored fixture enquiries/bookings/businesses over the real (empty)
  // ones - on a tenant who never took the action that "Undo" claimed to undo.
  const dirty = undoLastResult({
    ...seeded,
    enquiries: seeded.enquiries,
    bookings: seeded.bookings,
    businesses: seeded.businesses,
  });
  assert.equal(dirty.changed, true); // meaningful: the seed really would have restored something

  const after = { ...seeded, ...MARK_ONBOARDED_LOCALLY_PATCH };
  const result = undoLastResult(after);
  assert.equal(result.changed, false);
  assert.deepEqual(result.enquiries, []);
  assert.deepEqual(result.bookings, []);
  assert.deepEqual(result.businesses, []);
});

test("demo action -> live Trust Audit shows no history, not the demo click log", () => {
  // Before this fix: TrustAudit fell back to `events` whenever `audit` was
  // empty, with no regard for demoMode - the ordinary state for a brand-new
  // live tenant is an empty `audit`, so this rendered a demo customer's
  // fixture id and action as the live tenant's own "what Enquiry did" history.
  const dirtyRows = trustAuditRows({ audit: [], demoMode: seeded.demoMode, events: seeded.events });
  assert.ok(dirtyRows.length > 0); // meaningful: the seed really would have shown demo history

  const after = { ...seeded, ...MARK_ONBOARDED_LOCALLY_PATCH };
  const rows = trustAuditRows({
    audit: after.businesses.length ? [] : [],
    demoMode: after.demoMode,
    events: after.events,
  });
  assert.deepEqual(rows, []);
});

test("demo automation -> live Notices carries no fabricated autopilot item", () => {
  // Before this fix: Notices pushed an "Autopilot sent to {customerName}" item
  // whenever `lastAutomated` was non-null, unconditionally - a demo automated
  // send announced a fabricated send to the live operator's notice bell.
  assert.equal(noticesHasAutopilotItem(seeded), true); // meaningful: the seed really would have shown it

  const after = { ...seeded, ...MARK_ONBOARDED_LOCALLY_PATCH };
  assert.equal(noticesHasAutopilotItem(after), false);
});

/** SystemBanners' offline banner condition, mirrored from the component. */
function offlineBannerShown(s: { offline: boolean }) {
  return s.offline;
}

test("Lab offline simulation -> live onboarding -> live actions are not blocked and no offline banner remains", () => {
  // Before this fix: the Lab's "Pretend you're offline" toggle sets
  // `offlineSimulated` and derives `offline` directly - neither live handoff
  // function touched either field. A demo session that had toggled this on,
  // then onboarded into a live account in the same browser tab, carried a
  // permanently offline live workspace: SystemBanners showed "Offline.
  // Nothing will send." with no way to turn it off from the live UI, AND
  // outboundBlocked (the actual gate approve() checks before sending) refused
  // every send on that basis - not a cosmetic banner, a real block.
  //
  // outboundBlocked is imported directly, not mirrored, per the review note
  // that consumer-level mirrors alone leave room for source/mirror drift -
  // this uses the exact function approve() calls.
  assert.equal(offlineBannerShown(seeded), true); // meaningful: the seed really would show it
  assert.ok(outboundBlocked(undefined, seeded.offline) !== null); // meaningful: the seed really would block

  const after = { ...seeded, ...MARK_ONBOARDED_LOCALLY_PATCH };
  assert.equal(offlineBannerShown(after), false);
  assert.equal(outboundBlocked(undefined, after.offline), null);
  assert.equal(after.offlineSimulated, false);
  assert.equal(after.networkOffline, false);
  assert.equal(isLiveHandoffClean(after), true);
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
    // Same-session demo carryover, mirrored the same way as
    // MARK_ONBOARDED_LOCALLY_PATCH above - see the source comment in
    // hydrateFromServer for what each one leaks if left uncleared.
    undo: null,
    events: [] as unknown[],
    lastAutomated: null,
    teach: null,
    brainPreview: null,
    lastMerge: null,
    voiceNotice: null,
    offline: false,
    offlineSimulated: false,
    networkOffline: false,
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
