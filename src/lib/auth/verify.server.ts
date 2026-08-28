import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { resolveAccessMode } from "./access-mode";

/**
 * Server-side session resolution (server-only).
 *
 * The browser holds a Supabase access token and `authMiddleware` forwards it as
 * `Authorization: Bearer …`. Here it is handed to Supabase for verification -
 * NEVER decoded and trusted locally, and never taken as a client-supplied user
 * id. `getUser(token)` validates the signature and expiry upstream and returns
 * the authoritative identity.
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

/** True when auth can actually verify anyone server-side. */
export const authConfigured =
  process.env.VITE_AUTH_ENABLED !== "false" &&
  Boolean(supabaseUrl?.trim() && supabaseKey?.trim());

/** True when a real database is configured server-side. */
const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

if (databaseConfigured && !authConfigured) {
  console.error(
    "[auth] DATABASE_URL is set but auth is not configured " +
      "(VITE_AUTH_ENABLED=false, or missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) " +
      "- requireUserId() will reject every request (fail closed) rather than " +
      "share one dev user on a real database.",
  );
}

/** Dev fallback user id, used only when auth is deliberately disabled. */
export const DEV_USER_ID = "dev-user";

/**
 * Thrown by `requireUserId` when the caller has no valid session. Carries
 * `status: 401`; the message is a stable contract - match
 * `err.message === "Unauthorized"` client-side to send the visitor to sign-in.
 */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

/** Stateless verifier. No session persistence: one token in, one identity out. */
const verifier =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

/** Pull the bearer token off the current request, if the client sent one. */
function bearerFromRequest(): string | null {
  const request = getRequest();
  const header = request?.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") return null;
  return token;
}

/**
 * Resolve the signed-in user for the current request, or `null` when auth is not
 * configured or nobody is signed in. Safe from server functions and SSR loaders.
 */
export async function getSessionUser(
  bearerToken?: string,
): Promise<VerifiedUser | null> {
  if (!authConfigured || !verifier) return null;
  const token = bearerToken ?? bearerFromRequest();
  if (!token) return null;
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Resolve the current user id for a server function, or throw when unauthorized.
 * Prefer `authMiddleware` (`./middleware`), which calls this for you.
 *
 * - Auth configured -> the verified user id; throws `UnauthorizedError` when
 *   signed out.
 * - Auth off + `DATABASE_URL` set -> throws (fail closed). One shared dev user
 *   on a real database would let every visitor read and write everyone's rows.
 * - Auth off + no database -> the shared dev user id (local prototype mode).
 */
export async function requireUserId(bearerToken?: string): Promise<string> {
  const mode = resolveAccessMode({ authConfigured, databaseConfigured });
  if (mode === "refuse") {
    throw new Error(
      "Auth is not configured but DATABASE_URL is set - refusing to fall back " +
        "to the shared dev user against a real database.",
    );
  }
  if (mode === "dev-user") return DEV_USER_ID;
  const user = await getSessionUser(bearerToken);
  if (!user) throw new UnauthorizedError();
  return user.id;
}
