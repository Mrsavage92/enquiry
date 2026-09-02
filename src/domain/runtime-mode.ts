/**
 * Which runtime the operator app is in, and what may be persisted in each.
 *
 * Live operator mode and demo mode are separate runtimes (R2B product
 * invariant). The distinction is NOT inferred from whether an id happens to
 * equal "glow" - it is an explicit flag, because id-shape inference is exactly
 * how fixture data leaked into live tenants before.
 */

export type RuntimeMode = "live" | "demo";

export type RuntimeInputs = {
  /** Auth is configured AND a session is verified. */
  authenticated: boolean;
  /** The explicit sample/demo path. */
  demoMode: boolean;
};

/**
 * Authenticated wins. A signed-in operator is in live mode even if a stale
 * demoMode flag survived in storage, because the alternative - showing a real
 * business fixture data because of a leftover boolean - is the failure this
 * whole slice exists to prevent.
 */
export function runtimeMode({ authenticated, demoMode }: RuntimeInputs): RuntimeMode {
  if (authenticated) return "live";
  return demoMode ? "demo" : "live";
}

/**
 * Tenant content that is server-authoritative and must never be restored from
 * device storage over newer server state.
 */
export const SERVER_AUTHORITATIVE_FIELDS = [
  "businesses",
  "enquiries",
  "bookings",
  "audit",
  "drafts",
  "confirmSent",
] as const;

export type ServerAuthoritativeField = (typeof SERVER_AUTHORITATIVE_FIELDS)[number];

/**
 * Whether a given store field may be written to device storage in this mode.
 *
 * In live mode the answer is no for anything server-authoritative. Persisting a
 * tenant snapshot means a stale tab, or a deploy that changes the shape, can put
 * yesterday's enquiries back on screen as though they were current - and worse,
 * survive a sign-out into whoever uses the browser next.
 *
 * Presentation-only state (filters, tabs, dismissals) persists in both modes.
 */
export function mayPersistField(field: string, mode: RuntimeMode): boolean {
  if (mode === "demo") return true;
  return !(SERVER_AUTHORITATIVE_FIELDS as readonly string[]).includes(field);
}

/** Whether fixture content may be used as this runtime's data. */
export function mayUseFixtures(mode: RuntimeMode): boolean {
  return mode === "demo";
}
