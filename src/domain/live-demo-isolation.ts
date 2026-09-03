/**
 * The rule separating a real signed-in tenant from the fixture demo world.
 *
 * Pure, because this is the R2A blocker and it needs to be provable rather than
 * argued. Two things went wrong before it existed:
 *
 *  - the hard-coded demo arrival fired on `onboarded` alone, so a real business
 *    that finished onboarding was handed a fabricated Instagram enquiry 4.8
 *    seconds later as though a customer had contacted them;
 *  - the client store keeps seeded fixture businesses, enquiries and bookings,
 *    and nothing cleared them on the live path, so another studio's customers
 *    and prices rendered as the new tenant's own.
 *
 * Demo behaviour is opt-in. `demoMode` is the only thing that grants it.
 */

export type SessionShape = {
  /** Explicit sample/demo path. False for a real signed-in tenant. */
  demoMode: boolean;
  /** Onboarding finished in this browser. */
  onboarded: boolean;
  /** The scripted arrival has already run. */
  arrivalPlayed: boolean;
  /** Running inside the sandbox preview iframe. */
  framed: boolean;
};

/**
 * Whether the scripted demo arrival may fire.
 *
 * `demoMode` first and non-negotiable: a live tenant must never receive a
 * fabricated enquiry, regardless of every other flag.
 */
export function mayPlayDemoArrival(s: SessionShape): boolean {
  if (!s.demoMode) return false;
  return s.onboarded && !s.arrivalPlayed && !s.framed;
}

/**
 * Whether fixture tenant content may be rendered as this session's own.
 * Only ever in explicit demo mode.
 */
export function mayShowFixtureContent(s: Pick<SessionShape, "demoMode">): boolean {
  return s.demoMode;
}

/**
 * Whether the workspace's Cmd/Ctrl+Enter keyboard shortcut may record a send.
 *
 * Demo only, deliberately. A real send copies the letter and records it
 * through the same approval preview as a click on the Send button; a
 * keyboard shortcut that quietly marked something sent without either step
 * would be exactly the theatre this product exists to remove. There is no
 * live-mode path here to gate more finely - it is demoMode or nothing.
 */
export function mayRecordSendViaShortcut(demoMode: boolean): boolean {
  return demoMode;
}

/** The client state a successful LIVE onboarding must leave behind. */
export type LiveHandoffState = {
  onboarded: boolean;
  demoMode: boolean;
  businesses: unknown[];
  enquiries: unknown[];
  bookings: unknown[];
  arrivalPlayed: boolean;
  /**
   * Same-session demo transient state. Optional so every existing caller
   * asserting only the six fields above keeps compiling; a field simply
   * absent from the state passed in is treated as already clear, so this
   * never weakens a check that was already passing.
   *
   * Each of these renders unconditionally on being non-null/non-empty, with
   * no demoMode or id check of its own at the point it displays - a stale one
   * carried across the live handoff surfaces directly: undo restores fixture
   * enquiries/bookings/businesses/drafts on the next Undo; events becomes
   * TrustAudit's fallback "what Enquiry did" history; lastAutomated becomes a
   * fabricated "Autopilot sent to {customer}" Notices item; teach and
   * brainPreview are dialogs that pop open showing demo proposal/pricing text.
   */
  undo?: unknown;
  events?: unknown[];
  lastAutomated?: unknown;
  teach?: unknown;
  brainPreview?: unknown;
  lastMerge?: unknown;
  voiceNotice?: unknown;
  /**
   * Not tenant content, but the same class of leak: the Lab's demo-only
   * "Pretend you're offline" toggle sets `offline` directly, and
   * system-banners.tsx reads `offline` unconditionally to show "Offline.
   * Nothing will send." - a stale `true` here silently blocks every live send
   * action with no way to recover except a hard reload. `offline` is checked
   * on its own, not derived from the other two, because it is itself the flag
   * the two setters write - clearing only the inputs would leave it stuck.
   */
  offline?: boolean;
  offlineSimulated?: boolean;
  networkOffline?: boolean;
};

/**
 * True when the post-onboarding client state is safe for a real tenant: demo
 * off, no fixture content carried over, the scripted arrival disarmed, no
 * demo-only transient state (undo snapshot, tracking log, automation notice,
 * open dialog) left over from browsing before the handoff, and no simulated
 * offline state left blocking live sends.
 */
export function isLiveHandoffClean(s: LiveHandoffState): boolean {
  return (
    s.onboarded &&
    !s.demoMode &&
    s.businesses.length === 0 &&
    s.enquiries.length === 0 &&
    s.bookings.length === 0 &&
    s.arrivalPlayed &&
    !s.undo &&
    (s.events?.length ?? 0) === 0 &&
    !s.lastAutomated &&
    !s.teach &&
    !s.brainPreview &&
    !s.lastMerge &&
    !s.voiceNotice &&
    !s.offline &&
    !s.offlineSimulated &&
    !s.networkOffline
  );
}
