import { DEFAULT_RETURN_PATH, safeReturnPath } from "../auth/return-path.ts";
import { ONBOARDING_PATH, type SessionPhase, type WorkspacePhase } from "../auth/completion.ts";

/**
 * Who is allowed onto an operator route, decided once.
 *
 * `RequireAuth` only ever asked "is there a user?". That is not the question a
 * multi-tenant workspace needs: a confirmed user with zero memberships passed
 * that check and landed in `/enquiries`, where the prototype store cheerfully
 * rendered fixture businesses and fixture enquiries as if they were theirs.
 * Signing in is identity; having a workspace is tenancy, and only the second
 * one earns the operator UI.
 *
 * "We do not know yet" is a first-class answer here. Treating a pending session
 * as signed out bounces every hard reload to `/login`; treating a failed
 * workspace call as "no workspace" pushes an existing customer into onboarding
 * and invites them to create a second one.
 *
 * This is a UX boundary, not authorization. Every server function still
 * verifies the caller and re-derives ownership through `business_member`.
 */

export type RouteAuthorityInput = {
  /** False in local prototype mode (`VITE_AUTH_ENABLED=false` or no Supabase). */
  authEnabled: boolean;
  session: SessionPhase;
  workspace: WorkspacePhase;
  /** The path being guarded, carried into `/login` so sign-in returns here. */
  pathname: string;
  /** True for `/onboarding`, which is the one route a zero-membership user may see. */
  isOnboardingRoute: boolean;
};

export type RouteAuthority =
  /** Auth is deliberately off: the local prototype passes straight through. */
  | { phase: "prototype-bypass" }
  | { phase: "session-pending" }
  | { phase: "signed-out"; to: string; redirect: string }
  | { phase: "workspace-pending" }
  | { phase: "workspace-failed" }
  /** Zero memberships: onboarding owns initial creation. */
  | { phase: "needs-onboarding"; to: string }
  /** Already has a workspace, so onboarding is not theirs to run again. */
  | { phase: "workspace-exists"; to: string }
  | { phase: "allowed" };

export const SIGN_IN_PATH = "/login";

export function resolveRouteAuthority({
  authEnabled,
  session,
  workspace,
  pathname,
  isOnboardingRoute,
}: RouteAuthorityInput): RouteAuthority {
  // With auth off there is no tenant to resolve and no real database behind it
  // (`resolveAccessMode` refuses that combination), so the prototype keeps its
  // current behaviour rather than being redirected into onboarding it cannot
  // complete.
  if (!authEnabled) return { phase: "prototype-bypass" };

  if (session === "pending") return { phase: "session-pending" };
  if (session === "signed-out") {
    return {
      phase: "signed-out",
      to: SIGN_IN_PATH,
      redirect: safeReturnPath(pathname, DEFAULT_RETURN_PATH),
    };
  }

  switch (workspace) {
    case "idle":
    case "loading":
      return { phase: "workspace-pending" };
    case "failed":
      // Never guess. Guessing "no workspace" sends an existing customer to
      // onboarding; guessing "workspace" sends a new one to fixture-backed UI.
      return { phase: "workspace-failed" };
    case "needs-onboarding":
      return isOnboardingRoute
        ? { phase: "allowed" }
        : { phase: "needs-onboarding", to: ONBOARDING_PATH };
    case "ready":
      return isOnboardingRoute
        ? { phase: "workspace-exists", to: DEFAULT_RETURN_PATH }
        : { phase: "allowed" };
  }
}
