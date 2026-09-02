import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { fetchWorkspace } from "@/lib/server/workspace";
import { usePrototype } from "@/store/prototype-store";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
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
 * With auth disabled this is a pass-through, so the local prototype and the
 * public demo keep working untouched.
 */

type LoadState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready" }
  | { phase: "onboarding" }
  | { phase: "error"; message: string };

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
      <Wordmark />
      <div className="mt-8">{children}</div>
    </main>
  );
}

export function WorkspaceBoundary({ children }: { children: ReactNode }) {
  // Auth disabled: local prototype mode. Nothing to load, nothing to isolate.
  if (!authEnabled) return <>{children}</>;
  return <LiveWorkspaceBoundary>{children}</LiveWorkspaceBoundary>;
}

function LiveWorkspaceBoundary({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const hydrate = usePrototype((s) => s.hydrateFromServer);
  const [state, setState] = useState<LoadState>({ phase: "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Wait for verified auth before reading anything. RequireAuth handles the
    // signed-out redirect; this only decides when it is safe to fetch.
    if (isPending || !user) return;
    let live = true;
    setState({ phase: "loading" });
    fetchWorkspace()
      .then((data) => {
        if (!live) return;
        if (data.needsOnboarding) {
          setState({ phase: "onboarding" });
          return;
        }
        hydrate({
          businesses: data.businesses,
          enquiries: data.enquiries,
          bookings: data.bookings,
          audit: data.audit,
        });
        setState({ phase: "ready" });
      })
      .catch((err: unknown) => {
        if (!live) return;
        // Deliberately no fixture fallback. Showing sample data here would tell
        // an operator their business looks a way it does not.
        setState({
          phase: "error",
          message:
            err instanceof Error && err.message
              ? err.message
              : "Could not load your workspace.",
        });
      });
    return () => {
      live = false;
    };
  }, [isPending, user, hydrate, attempt]);

  if (isPending || state.phase === "idle" || state.phase === "loading") {
    return (
      <Centered>
        <p className="site-lede" role="status" aria-live="polite">
          Loading your workspace…
        </p>
      </Centered>
    );
  }

  if (state.phase === "onboarding") return <Navigate to="/onboarding" />;

  if (state.phase === "error") {
    return (
      <Centered>
        <h1 className="site-display">Could not load your workspace</h1>
        <p className="site-lede mt-4">{state.message}</p>
        <p className="mt-2 text-sm text-stone">
          You are still signed in. Nothing has been changed.
        </p>
        <Button className="mt-8 min-h-11" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </Centered>
    );
  }

  return <>{children}</>;
}
