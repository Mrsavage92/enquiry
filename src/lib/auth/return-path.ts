/**
 * The post-auth return-path invariant.
 *
 * > A return target may preserve an in-app path, query and hash, but it must
 * > never resolve to a different origin, scheme or host.
 *
 * "Starts with a slash" is NOT that invariant, and believing it was is what put
 * an open redirect in the sign-in flow. `//evil.example` starts with a slash and
 * is a protocol-relative URL; `new URL("//evil.example", origin)` resolves to
 * `https://evil.example`. A backslash can be normalised into the authority
 * position by URL parsers the same way.
 *
 * The rule is enforced by resolving against a sentinel origin and demanding the
 * origin come back unchanged, rather than by pattern-matching the shapes we
 * happened to think of. Prefix checks run first only to reject the obvious cases
 * before parsing.
 *
 * This is the primary protection. The Supabase redirect allowlist is a second
 * layer and must not be relied on as the first.
 */

/** Resolution target. `.invalid` is reserved by RFC 2606 and can never be real. */
const SENTINEL_ORIGIN = "https://sentinel.invalid";

/** Where a rejected or absent value lands. */
export const DEFAULT_RETURN_PATH = "/enquiries";

/**
 * Decode once, tolerantly. A malformed escape throws in `decodeURIComponent`,
 * and a value we cannot even decode is one we should not be following.
 */
function decodeOnce(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** True when this form could change the host once parsed or normalised. */
function looksHostChanging(value: string): boolean {
  if (value.includes("\\")) return true; // backslash can normalise into authority
  if (value.startsWith("//")) return true; // protocol-relative
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return true; // any scheme, incl. javascript:
  return false;
}

/**
 * Return `value` when it is a safe in-app path, otherwise `fallback`.
 *
 * Accepts `/enquiries`, `/enquiries/abc?tab=why`, `/business#pricing`.
 * Rejects `//evil.example`, `/\evil.example`, `https://evil.example`,
 * `javascript:alert(1)`, anything that decodes into one of those, and anything
 * malformed or empty.
 */
export function safeReturnPath(
  value: unknown,
  fallback: string = DEFAULT_RETURN_PATH,
): string {
  if (typeof value !== "string") return fallback;
  const raw = value.trim();
  if (!raw || !raw.startsWith("/")) return fallback;

  // Check the value as given AND as decoded, so an encoded host-changing form
  // cannot slip past the cheap checks and get decoded later by something else.
  if (looksHostChanging(raw)) return fallback;
  const decoded = decodeOnce(raw);
  if (decoded === null) return fallback;
  if (looksHostChanging(decoded)) return fallback;

  // The actual invariant: resolving must not move the origin.
  let url: URL;
  try {
    url = new URL(raw, SENTINEL_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== SENTINEL_ORIGIN) return fallback;

  // Re-serialise from the parsed URL rather than echoing the input back, so what
  // the caller navigates to is exactly what was validated.
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

/**
 * Absolute URL for an auth provider to return to, built from a validated path.
 * Same invariant, applied at the second place it matters.
 */
export function safeReturnUrl(value: unknown, origin: string): string {
  return new URL(safeReturnPath(value), origin).toString();
}
