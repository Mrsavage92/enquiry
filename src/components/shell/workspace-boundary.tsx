import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { fetchWorkspace } from "@/lib/server/workspace";
import { usePrototype } from "@/store/prototype-store";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { resolveRouteAuthority } from "@/lib/workspace/route-authority";
import { ONBOARDING_PATH, type SessionPhase, type WorkspacePhase } from "@/lib/auth/completion";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

/**
 * The single live workspace-loading boundary for the signed-in operator app.
 *
 * One parent rather than every screen fetching for itself, so there is exactly
 * one place that decides what a tenant is allowed to see. It waits for verified
 * auth, reads the authenticated workspace, sends a brand-new account to
 * onboarding, and otherwise hydrates the client store as a cache of server
 * state.
 *
 * The rule it exists to enforce: **a failed server read is not permission to
 * show sample data as the user's business.** On error it retries or stops. It
 * never falls back to fixtures, and it never creates a second workspace.
 *
 * The routing decision itself is `resolveRouteAuthority`, a pure function with
 * its own tests, because the states are easy to collapse by accident: treating
 * a pending session as signed out bounces every hard reload to `/login`, and
 * treating a failed workspace read as "no workspace" invites an existing
 * customer to create a second one.
 *
 * With auth disabled this is a pass-through, so the local prototype and the
 * public demo keep working untouched.
 */

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
      <Wordmark />
      <div className="mt-8">{children}</div>
    </main>
  );
}

/**
 * Read the workspace once auth is verified.
 *
 * `hydrate` is deliberately only called for a real workspace: onboarding must
 * not warm the store with anything, and a failure must leave it untouched.
 */
function useWorkspacePhase(session: SessionPhase): {
  workspace: WorkspacePhase;
  message: string;
  retry: () => void;
} {
  const hydrate = usePrototype((s) => s.hydrateFromServer);
  const [workspace, setWorkspace] = useState<WorkspacePhase>("idle");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (session !== "signed-in") return;
    let live = true;
    setWorkspace("loading");
    fetchWorkspace()
      .then((data) => {
        if (!live) return;
        if (data.needsOnboarding) {
          setWorkspace("needs-onboarding");
          return;
        }
        hydrate({
          businesses: data.businesses,
          enquiries: data.enquiries,
          bookings: data.bookings,
          audit: data.audit,
        });
        setWorkspace("ready");
      })
      .catch((err: unknown) => {
        if (!live) return;
        // Deliberately no fixture fallback. Showing sample data here would tell
        // an operator their business looks a way it does not.
        setMessage(
          err instanceof Error && err.message ? err.message : "Could not load your workspace.",
        );
        setWorkspace("failed");
      });
    return () => {
      live = false;
    };
  }, [session, hydrate, attempt]);

  return { workspace, message, retry: () => setAttempt((n) => n + 1) };
}

/**
 * Guard one authenticated surface.
 *
 * `isOnboardingRoute` is what lets the same guard protect both directions: a
 * zero-membership user may only see onboarding, and a user who already has a
 * workspace may not run it again.
 */
export function WorkspaceGate({
  children,
  isOnboardingRoute = false,
}: {
  children: ReactNode;
  isOnboardingRoute?: boolean;
}) {
  // Auth disabled: local prototype mode. Nothing to load, nothing to isolate.
  if (!authEnabled) return <>{children}</>;
  return <LiveWorkspaceGate isOnboardingRoute={isOnboardingRoute}>{children}</LiveWorkspaceGate>;
}

/** Kept as the previous name so existing route files read unchanged. */
export function WorkspaceBoundary({ children }: { children: ReactNode }) {
  return <WorkspaceGate>{children}</WorkspaceGate>;
}

function LiveWorkspaceGate({
  children,
  isOnboardingRoute,
}: {
  children: ReactNode;
  isOnboardingRoute: boolean;
}) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const session: SessionPhase = isPending ? "pending" : user ? "signed-in" : "signed-out";
  const { workspace, message, retry } = useWorkspacePhase(session);

  const authority = resolveRouteAuthority({
    authEnabled: true,
    session,
    workspace,
    pathname,
    isOnboardingRoute,
  });

  switch (authority.phase) {
    case "allowed":
    case "prototype-bypass":
      return <>{children}</>;

    case "signed-out":
      return <Navigate to={authority.to} search={{ redirect: authority.redirect }} replace />;

    case "needs-onboarding":
      return <Navigate to={ONBOARDING_PATH} replace />;

    case "workspace-exists":
      return <Navigate to={authority.to} replace />;

    case "workspace-failed":
      return (
        <Centered>
          <h1 className="site-display">Could not load your workspace</h1>
          <p className="site-lede mt-4">{message}</p>
          <p className="mt-2 text-sm text-stone">
            You are still signed in. Nothing has been changed.
          </p>
          <Button className="mt-8 min-h-11" onClick={retry}>
            Try again
          </Button>
        </Centered>
      );

    default:
      return (
        <Centered>
          <p className="site-lede" role="status" aria-live="polite">
            Loading your workspace…
          </p>
        </Centered>
      );
  }
}
