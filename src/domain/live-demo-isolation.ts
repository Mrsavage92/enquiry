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

/** The client state a successful LIVE onboarding must leave behind. */
export type LiveHandoffState = {
  onboarded: boolean;
  demoMode: boolean;
  businesses: unknown[];
  enquiries: unknown[];
  bookings: unknown[];
  arrivalPlayed: boolean;
};

/**
 * True when the post-onboarding client state is safe for a real tenant: demo
 * off, no fixture content carried over, and the scripted arrival disarmed.
 */
export function isLiveHandoffClean(s: LiveHandoffState): boolean {
  return (
    s.onboarded &&
    !s.demoMode &&
    s.businesses.length === 0 &&
    s.enquiries.length === 0 &&
    s.bookings.length === 0 &&
    s.arrivalPlayed
  );
}
