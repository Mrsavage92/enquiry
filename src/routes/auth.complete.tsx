import { useEffect, useState } from "react";
import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import {
  parseAuthCallbackError,
  resolveAuthCompletion,
  type AuthLinkError,
  type SessionPhase,
  type WorkspacePhase,
} from "@/lib/auth/completion";
import { safeReturnPath } from "@/lib/auth/return-path";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

type CompleteSearch = { redirect?: string };

export const Route = createFileRoute("/auth/complete")({
  validateSearch: (search: Record<string, unknown>): CompleteSearch => {
    if (typeof search.redirect !== "string" || !search.redirect) return {};
    return { redirect: safeReturnPath(search.redirect) };
  },
  head: () => ({ meta: [{ title: "Confirming - Enquiry" }] }),
  component: AuthCompletePage,
});

/**
 * The only destination an email link or OAuth handshake returns to.
 *
 * Having one return route is what makes the Supabase redirect allow list a
 * short, exact list rather than a wildcard, and it is the only place that can
 * honestly answer "did this actually work?" - four things resolve here at
 * different times (the link, the session, the workspace, and where the person
 * was originally heading), and deciding that inline is how a screen ends up
 * redirecting to /enquiries while the workspace call is still in flight.
 *
 * The decision itself lives in `lib/auth/completion` as a pure function, so
 * every state including "we do not know yet" is named and tested.
 */
function AuthCompletePage() {
  const { redirect } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const [linkError, setLinkError] = useState<AuthLinkError | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePhase>("idle");
  const [attempt, setAttempt] = useState(0);

  // Read the provider's own verdict off the URL before trusting any session:
  // Supabase can leave a stale session in local storage while refusing the
  // link that was just clicked.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setLinkError(parseAuthCallbackError(window.location.hash, window.location.search));
  }, []);

  const session: SessionPhase = isPending ? "pending" : user ? "signed-in" : "signed-out";

  useEffect(() => {
    if (session !== "signed-in" || linkError) return;
    let live = true;
    setWorkspace("loading");
    void (async () => {
      try {
        const { fetchWorkspace } = await import("@/lib/server/workspace");
        const data = await fetchWorkspace();
        if (!live) return;
        setWorkspace(data.needsOnboarding ? "needs-onboarding" : "ready");
      } catch {
        // Never guess which way to route from a failed call.
        if (live) setWorkspace("failed");
      }
    })();
    return () => {
      live = false;
    };
  }, [session, linkError, attempt]);

  const view = resolveAuthCompletion({ linkError, session, workspace, returnPath: redirect });

  if (view.phase === "redirect") return <Navigate to={view.to} replace />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
      <Link to="/" className="mb-10 inline-block">
        <Wordmark />
      </Link>

      {view.phase === "confirming" || view.phase === "resolving" ? (
        <>
          <h1 className="site-display">
            {view.phase === "confirming" ? "Confirming your email" : "Opening your workspace"}
          </h1>
          <p className="site-lede mt-4" aria-live="polite">
            One moment.
          </p>
        </>
      ) : view.phase === "link-expired" ? (
        <>
          <h1 className="site-display">That link has expired</h1>
          <p className="site-lede mt-4">
            Confirmation links are short-lived, and each one can only be used once. Ask for a fresh
            one and it will work.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/login">
              <Button className="min-h-11">Send a new link</Button>
            </Link>
            <Link
              to="/signup"
              className="min-h-11 self-center text-sm text-stone underline-offset-4 hover:text-ink hover:underline"
            >
              Set up a new workspace
            </Link>
          </div>
        </>
      ) : view.phase === "link-invalid" ? (
        <>
          <h1 className="site-display">That link did not work</h1>
          <p className="site-lede mt-4">
            {view.detail ?? "The link could not be used. Requesting a new one usually fixes it."}
          </p>
          <div className="mt-8">
            <Link to="/login">
              <Button className="min-h-11">Send a new link</Button>
            </Link>
          </div>
        </>
      ) : view.phase === "no-session" ? (
        <>
          <h1 className="site-display">You are not signed in yet</h1>
          <p className="site-lede mt-4">
            The link did not produce a session. That usually means it was already used, or it was
            opened in a different browser from the one that asked for it.
          </p>
          <div className="mt-8">
            <Link to="/login">
              <Button className="min-h-11">Send a new link</Button>
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="site-display">Could not open your workspace</h1>
          <p className="site-lede mt-4">
            You are signed in, but we could not load your workspace just now. Nothing has been
            changed.
          </p>
          <div className="mt-8">
            <Button className="min-h-11" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
