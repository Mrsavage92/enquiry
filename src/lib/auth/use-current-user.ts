import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { authEnabled, supabase } from "./client";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** True when this is the local prototype fallback (auth deliberately off). */
  isDevFallback: boolean;
};

/**
 * Stable fallback user, used ONLY when auth is disabled
 * (`VITE_AUTH_ENABLED=false`) or Supabase is unconfigured. Its id is the SAME
 * `"dev-user"` that `verify.server.ts` returns server-side, so rows written in
 * that mode belong to one consistent owner.
 *
 * `requireUserId` refuses this fallback whenever a real `DATABASE_URL` is set,
 * so it can never become a shared identity on a real database.
 */
export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user - `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving - do not treat `null` as signed out yet. */
  isPending: boolean;
};

function toAppUser(user: User): AppUser {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.full_name === "string" ? meta.full_name : null;
  const avatar = typeof meta.avatar_url === "string" ? meta.avatar_url : null;
  return {
    id: user.id,
    displayName: name ?? user.email ?? null,
    primaryEmail: user.email ?? null,
    profileImageUrl: avatar,
    isDevFallback: false,
  };
}

/**
 * Current user + loading state.
 *   - Auth enabled  -> the real signed-in user; `null` while the session
 *                      resolves (`isPending: true`) and when signed out
 *                      (`isPending: false`).
 *   - Auth disabled -> `DEV_USER`, never pending.
 *
 * Guard a route by waiting out `isPending` BEFORE acting on `user` - redirecting
 * on `user: null` alone bounces signed-in visitors to sign-in on every reload:
 *
 *   const { user, isPending } = useCurrentUserState();
 *   if (isPending) return null;              // still resolving
 *   if (!user) return <RedirectToSignIn />;  // definitely signed out
 *
 * `authEnabled` is a module constant fixed at load, so the guarded hook calls
 * below keep a stable hook order across every render of a given component.
 */
export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled || !supabase) return { user: DEV_USER, isPending: false };
  // Bind once so the effect closure keeps the narrowed non-null type.
  const client = supabase;

  /* eslint-disable react-hooks/rules-of-hooks -- authEnabled is constant for the app's lifetime */
  const [state, setState] = useState<CurrentUserState>({ user: null, isPending: true });

  useEffect(() => {
    let active = true;

    // Resolve whatever is already persisted before subscribing, so a reload does
    // not flash signed-out while the first auth event is still in flight.
    client.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const u = data.session?.user;
        setState({ user: u ? toAppUser(u) : null, isPending: false });
      })
      .catch(() => {
        if (active) setState({ user: null, isPending: false });
      });

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const u = session?.user;
      setState({ user: u ? toAppUser(u) : null, isPending: false });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  return state;
  /* eslint-enable react-hooks/rules-of-hooks */
}

/**
 * Convenience view of `useCurrentUserState().user` for display. NOTE: `null`
 * means *loading OR signed out* - for redirects and guards use
 * `useCurrentUserState()` and check `isPending`.
 */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
