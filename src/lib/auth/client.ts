import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { safeReturnUrl } from "./return-path";

/**
 * Supabase Auth client for this React SPA (browser-side).
 *
 * Replaces the previous Better Auth + Grok-broker stack. That stack existed to
 * federate through the sandbox preview host and carried a committed OAuth client
 * secret to do it; Supabase Auth needs no such secret in source, which is why
 * the swap closes that hole by deletion rather than by patching it.
 *
 * Session storage is Supabase's default (localStorage), so a signed-in operator
 * stays signed in across tabs and restarts. That token is readable by injected
 * script, which is the accepted trade for every SPA that keeps you logged in;
 * the hardening step, if it is ever wanted, is cookie-backed sessions via
 * `@supabase/ssr` - not a bespoke storage scheme here.
 *
 * Nothing in this app queries Postgres from the browser. This client is used for
 * authentication only; all data access goes through server functions, which is
 * why every table has RLS on with no policies (see migrations/0005).
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the project is wired up at build time. */
export const supabaseConfigured = Boolean(supabaseUrl?.trim() && supabaseKey?.trim());

/**
 * True when sign-in UI should be shown.
 *
 * Two conditions, both required. `VITE_AUTH_ENABLED=false` is the deliberate
 * local-prototype escape hatch (see `DEV_USER` in `use-current-user`), and an
 * unconfigured Supabase project cannot authenticate anyone, so claiming auth is
 * on would strand every visitor on a sign-in screen that cannot work.
 *
 * Module-level and fixed at load, so hooks guarded on it keep a stable order.
 */
export const authEnabled =
  import.meta.env.VITE_AUTH_ENABLED !== "false" && supabaseConfigured;

/**
 * The browser Supabase client, or `null` when the project is not configured.
 * Null-checked at every call site rather than thrown from module scope, so an
 * unconfigured app still boots into disabled-auth prototype mode.
 */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl as string, supabaseKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The OAuth callback comes back with the session in the URL fragment.
        detectSessionInUrl: true,
      },
    })
  : null;

/** OAuth providers offered on the sign-in screen, in display order. */
export const OAUTH_PROVIDERS = [
  { id: "google", label: "Continue with Google" },
] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number]["id"];

/**
 * Current access token, or null. Forwarded by `authMiddleware` so server
 * functions can verify the caller without depending on cookie behaviour.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Send a magic link. No password is ever stored or handled by this app.
 *
 * Resolves once the mail is away - it does NOT mean the visitor is signed in.
 * The caller should tell them to check their inbox.
 */
export async function signInWithEmail(
  email: string,
  opts: { redirectTo?: string } = {},
): Promise<void> {
  if (!supabase) throw new Error("Sign-in is unavailable - auth is not configured.");
  // Validated, not merely defaulted: "starts with a slash" would let
  // //evil.example through and resolve it to another host.
  const emailRedirectTo =
    typeof window === "undefined"
      ? undefined
      : safeReturnUrl(opts.redirectTo, window.location.origin);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });
  if (error) throw new Error(error.message);
}

/** Start an OAuth redirect flow with one provider. */
export async function signInWithProvider(
  providerId: OAuthProviderId,
  opts: { redirectTo?: string } = {},
): Promise<void> {
  if (!supabase) throw new Error("Sign-in is unavailable - auth is not configured.");
  const redirectTo =
    typeof window === "undefined"
      ? undefined
      : safeReturnUrl(opts.redirectTo, window.location.origin);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: providerId,
    options: { redirectTo },
  });
  if (error) throw new Error(error.message);
}

/**
 * End the local session, then redirect.
 *
 * Rejects if Supabase does not confirm, so a caller never reports a sign-out
 * that did not happen. `<UserButton />` handles that; a hand-rolled control
 * must catch and let the visitor retry.
 */
export async function signOut(redirectTo = "/"): Promise<void> {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }
  if (typeof window !== "undefined") window.location.href = redirectTo;
}
