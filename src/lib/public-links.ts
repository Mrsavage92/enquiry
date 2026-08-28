/**
 * Whether the fixture-backed public customer links may resolve.
 *
 * `/q/$enquiryId` and `/book/$bookingId` look a customer's quote or booking up
 * by an internal id - `f01`, `b1` - straight from the client store. That is a
 * demo mechanism, not a security model: the ids are short, sequential and
 * shipped in the bundle, so anyone can walk them.
 *
 * Replacing the short id with a longer one that still ships to the client would
 * change nothing. A real capability link needs a high-entropy token minted
 * server-side, stored hashed, mapped to an object server-side, expirable and
 * revocable, and validated on every read. That does not exist yet, so until it
 * does these routes are contained rather than dressed up.
 *
 * Containment is deliberately two conditions, not one. An explicit opt-in alone
 * could be set on a real deployment by accident; requiring prototype mode as
 * well means a build that can authenticate anyone can never serve them.
 */

export type PublicLinkInputs = {
  /** The explicit opt-in, `VITE_FIXTURE_PUBLIC_LINKS === "true"`. */
  optedIn: boolean;
  /** True when the build can actually authenticate someone. */
  authEnabled: boolean;
};

/**
 * Fixture links resolve ONLY when both are true: someone asked for them, and
 * this build is a local prototype rather than something production-capable.
 */
export function fixtureLinksAllowed({ optedIn, authEnabled }: PublicLinkInputs): boolean {
  return optedIn && !authEnabled;
}
