import { useState } from "react";
import { Link, Navigate, createFileRoute, useSearch } from "@tanstack/react-router";
import { OAUTH_PROVIDERS, authEnabled, signInWithEmail, signInWithProvider } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DEFAULT_RETURN_PATH, safeReturnPath } from "@/lib/auth/return-path";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    // Only carry a redirect when one was actually supplied. Returning the
    // default here made every plain visit to /login redirect to
    // /login?redirect=/enquiries, because validateSearch was rewriting the URL
    // to a value that was never in it. The invariant still applies - anything
    // present is validated by the same rule used to build the auth redirect
    // URL (see lib/auth/return-path) - the default just belongs at the use site.
    if (typeof search.redirect !== "string" || !search.redirect) return {};
    return { redirect: safeReturnPath(search.redirect) };
  },
  head: () => ({ meta: [{ title: "Sign in - Enquiry" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = useSearch({ from: "/login" });
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const destination = redirect ?? DEFAULT_RETURN_PATH;

  // Do not strand an already signed-in visitor on the sign-in screen.
  if (isPending) return null;
  if (user) return <Navigate to={destination} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), { redirectTo: destination });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
      <Link to="/" className="mb-10 inline-block">
        <Wordmark />
      </Link>

      {!authEnabled ? (
        <>
          <h1 className="site-display">Sign-in is off</h1>
          <p className="site-lede mt-4">
            This build runs in local prototype mode, so everything is already open. Set{" "}
            <code className="font-mono text-sm">VITE_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-sm">VITE_SUPABASE_ANON_KEY</code> to turn real
            sign-in on.
          </p>
          <div className="mt-8">
            <Link to="/enquiries" className="text-sm underline underline-offset-4">
              Go to the app
            </Link>
          </div>
        </>
      ) : sent ? (
        <>
          <h1 className="site-display">Check your email</h1>
          <p className="site-lede mt-4">
            We sent a sign-in link to <strong>{email}</strong>. It opens Enquiry directly -
            no password to remember.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-8 self-start text-sm text-stone underline-offset-4 hover:text-ink hover:underline"
          >
            Use a different email
          </button>
        </>
      ) : (
        <>
          <h1 className="site-display">Sign in</h1>
          <p className="site-lede mt-3">Enquiry sends a link. There is no password.</p>

          <form onSubmit={submit} className="mt-8 space-y-3">
            <label className="block text-sm">
              <span className="mb-1.5 block text-stone">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                className="field w-full"
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy} className="min-h-11 w-full">
              {busy ? "Sending…" : "Email me a link"}
            </Button>
          </form>

          {OAUTH_PROVIDERS.length > 0 ? (
            <>
              <div className="my-7 flex items-center gap-3 text-xs uppercase tracking-wider text-stone">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="space-y-2">
                {OAUTH_PROVIDERS.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="secondary"
                    className="min-h-11 w-full"
                    onClick={() => {
                      setError("");
                      void signInWithProvider(p.id, { redirectTo: destination }).catch(
                        (err: unknown) =>
                          setError(
                            err instanceof Error ? err.message : "Sign-in failed.",
                          ),
                      );
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
