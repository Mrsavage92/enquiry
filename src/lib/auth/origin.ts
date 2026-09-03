import { safeReturnPath } from "./return-path.ts";

/**
 * Where an auth email or OAuth handshake is allowed to send someone back to.
 *
 * The rule this file enforces:
 *
 * > The return origin is owned by the deployment, not by whichever browser
 * > happened to make the request.
 *
 * `window.location.origin` is not that. A signup requested from a laptop on
 * `http://localhost:8080` produced `emailRedirectTo=http://localhost:8080/...`,
 * which is a dead link in the recipient's inbox - and when Supabase rejects it
 * for not being on the allow list, the customer is silently sent to the
 * project's Site URL instead, so the failure never surfaces as a failure.
 *
 * Production therefore requires an explicit HTTPS origin and fails CLOSED. A
 * thrown configuration error at the send button is recoverable; an inbox full
 * of localhost links is not. Local development may still resolve to loopback,
 * because that is the only origin a developer's mail can usefully return to.
 *
 * Nothing here trusts a caller-supplied path either: the in-app destination is
 * re-validated through `safeReturnPath`, so a poisoned `?redirect=` cannot move
 * the host even once it has been folded into an absolute URL.
 */

/** The one destination every email and OAuth return lands on. */
export const AUTH_COMPLETE_PATH = "/auth/complete";

/** The env var a deployment sets to own its public origin. */
export const PUBLIC_APP_ORIGIN_VAR = "VITE_PUBLIC_APP_ORIGIN";

export type AuthOriginEnvironment = "development" | "production";

export type AuthOriginInputs = {
  /** `VITE_PUBLIC_APP_ORIGIN` - the deployment-owned public origin. */
  configuredOrigin?: string | null;
  environment: AuthOriginEnvironment;
  /** `window.location.origin`. A development fallback only, never used in production. */
  runtimeOrigin?: string | null;
};

export type AuthOriginFailure =
  /** Production with no `VITE_PUBLIC_APP_ORIGIN` configured. */
  | "missing-public-origin"
  /** Production resolved to localhost / 127.0.0.0/8 / [::1] / 0.0.0.0. */
  | "loopback-in-production"
  /** Production origin was not HTTPS. */
  | "insecure-scheme"
  /** Unparseable, or carried a path, query or fragment. */
  | "malformed-origin";

export type AuthOriginResult =
  | { ok: true; origin: string; source: "configured" | "runtime" }
  | { ok: false; reason: AuthOriginFailure; message: string };

/**
 * Loopback in every spelling a URL parser will accept.
 *
 * `127.0.0.1` is not the only loopback address: the whole `127.0.0.0/8` block
 * is, and `127.1` normalises into it. `.localhost` is reserved for loopback by
 * RFC 6761, so `app.localhost` is loopback too. `0.0.0.0` is not loopback but is
 * equally useless as a public return origin, so it is rejected here rather than
 * given its own near-identical branch.
 */
export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  if (/^127(\.\d+){0,3}$/.test(host)) return true;
  return false;
}

/**
 * Parse an origin candidate. Returns `null` for anything that is not a bare
 * origin: a value carrying a path, query or fragment is a configuration mistake
 * that would silently truncate, so it is refused rather than normalised.
 */
function parseOrigin(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.pathname !== "/" || url.search || url.hash) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url;
}

function fail(reason: AuthOriginFailure, message: string): AuthOriginResult {
  return { ok: false, reason, message };
}

/**
 * Resolve the origin every auth return URL is built from.
 *
 * Production: `VITE_PUBLIC_APP_ORIGIN` is required, must be HTTPS, and must not
 * be loopback. There is no fallback - a missing value is an error, not a cue to
 * guess from the browser.
 *
 * Development: the configured origin is used when present (loopback and plain
 * HTTP allowed), otherwise the browser's own origin.
 */
export function resolveAuthOrigin({
  configuredOrigin,
  environment,
  runtimeOrigin,
}: AuthOriginInputs): AuthOriginResult {
  const configured = (configuredOrigin ?? "").trim();
  const isProduction = environment === "production";

  if (configured) {
    const url = parseOrigin(configured);
    if (!url) {
      return fail(
        "malformed-origin",
        `${PUBLIC_APP_ORIGIN_VAR} must be a bare origin such as https://app.example.com (no path, query or fragment).`,
      );
    }
    if (isProduction && url.protocol !== "https:") {
      return fail(
        "insecure-scheme",
        `${PUBLIC_APP_ORIGIN_VAR} must use https in production.`,
      );
    }
    if (isProduction && isLoopbackHostname(url.hostname)) {
      return fail(
        "loopback-in-production",
        `${PUBLIC_APP_ORIGIN_VAR} resolves to a loopback address, which cannot receive a confirmation link from a customer's inbox.`,
      );
    }
    return { ok: true, origin: url.origin, source: "configured" };
  }

  if (isProduction) {
    return fail(
      "missing-public-origin",
      `${PUBLIC_APP_ORIGIN_VAR} is not set, so this deployment has no public origin to send confirmation links back to.`,
    );
  }

  const runtime = (runtimeOrigin ?? "").trim();
  const url = runtime ? parseOrigin(runtime) : null;
  if (!url) {
    return fail(
      "malformed-origin",
      `No usable app origin. Set ${PUBLIC_APP_ORIGIN_VAR} for this environment.`,
    );
  }
  return { ok: true, origin: url.origin, source: "runtime" };
}

/**
 * The absolute URL an auth provider returns to: always `/auth/complete` on the
 * resolved origin, carrying the validated in-app destination as `redirect`.
 *
 * The path is re-validated here rather than trusted from the caller, because
 * this is the last place it stops being a string and becomes a real URL.
 */
export function authReturnUrl(origin: string, returnPath?: unknown): string {
  const url = new URL(AUTH_COMPLETE_PATH, origin);
  url.searchParams.set("redirect", safeReturnPath(returnPath));
  return url.toString();
}

/**
 * Resolve and build in one step. Throws the resolver's operator-facing message
 * when the environment is misconfigured, so the send button reports a broken
 * deployment instead of mailing an unreachable link.
 */
export function requireAuthReturnUrl(
  inputs: AuthOriginInputs,
  returnPath?: unknown,
): string {
  const resolved = resolveAuthOrigin(inputs);
  if (!resolved.ok) throw new Error(resolved.message);
  return authReturnUrl(resolved.origin, returnPath);
}
