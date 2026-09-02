import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import {
  OAUTH_PROVIDERS,
  authEnabled,
  enabledOAuthProviders,
  signInWithEmail,
  signInWithProvider,
  type OAuthProviderId,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { classifyAuthError, sentStateCopy, type AuthIntent } from "@/lib/auth/intent";
import { canResend, resendCooldownRemainingMs, resendLabel } from "@/lib/auth/resend";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

/**
 * The one email-link request screen, in two intents.
 *
 * `/signup` and `/login` share this because the form is genuinely the same
 * form; what differs is what the request is allowed to DO. Signup may create an
 * account, sign-in may not, and the copy says which of those is happening -
 * previously both were one call under a page headed "Sign in", so a typo
 * silently created a second account and mailed a "Confirm Your Signup" email.
 *
 * The sent state is deliberately not a dead end. It shows the address it went
 * to, lets the customer resend on a visible cooldown or correct the address,
 * and never claims the mail was delivered - the API resolving only means the
 * request was accepted.
 */

export function AuthRequestForm({
  intent,
  destination,
  heading,
  lede,
  cta,
  footer,
}: {
  intent: AuthIntent;
  /** Safe in-app path to land on once the link is used. */
  destination: string;
  heading: string;
  lede: string;
  cta: string;
  footer: React.ReactNode;
}) {
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [lastRequestedAt, setLastRequestedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [providers, setProviders] = useState<OAuthProviderId[]>([]);

  useEffect(() => {
    let live = true;
    void enabledOAuthProviders().then((ids) => {
      if (live) setProviders(ids);
    });
    return () => {
      live = false;
    };
  }, []);

  // Ticks only while a cooldown is actually running.
  useEffect(() => {
    if (lastRequestedAt === null) return;
    if (canResend(lastRequestedAt, Date.now())) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [lastRequestedAt, now]);

  // Guard against a double submit landing two requests before `busy` paints.
  const inFlight = useRef(false);

  const offered = OAUTH_PROVIDERS.filter((p) => providers.includes(p.id));
  const remaining = resendCooldownRemainingMs(lastRequestedAt, now);
  const blocked = remaining > 0;

  const request = async (address: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await signInWithEmail(address, { redirectTo: destination, intent });
      setSentTo(address);
      setLastRequestedAt(Date.now());
      setNow(Date.now());
      setStatus("Link requested.");
    } catch (err) {
      const classified = classifyAuthError(err, intent);
      if (classified.treatAsSent) {
        // Sign-in for an address with no account. Saying so would answer
        // "does this person have an account?" for anyone who asks.
        setSentTo(address);
        setLastRequestedAt(Date.now());
        setNow(Date.now());
        setStatus("Link requested.");
      } else {
        setError(classified.message);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (isPending) return null;
  if (user) return <Navigate to={destination} />;

  const copy = sentStateCopy(intent);

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
            <code className="font-mono text-sm">VITE_SUPABASE_ANON_KEY</code> to turn real sign-in
            on.
          </p>
          <div className="mt-8">
            <Link to="/enquiries" className="text-sm underline underline-offset-4">
              Go to the app
            </Link>
          </div>
        </>
      ) : sentTo ? (
        <>
          <h1 className="site-display">{copy.heading}</h1>
          <p className="site-lede mt-4">
            {copy.body} <strong>{sentTo}</strong>.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            The link opens Enquiry directly. If it has not arrived in a couple of minutes, check
            spam, then resend.
          </p>

          {/* Status only. The visible error below is a role="alert", which
              announces on its own - carrying it here too reads it twice. */}
          <p aria-live="polite" className="sr-only">
            {error ? "" : status}
          </p>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={busy || blocked}
              onClick={() => void request(sentTo)}
            >
              {resendLabel(remaining, busy)}
            </Button>
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setError("");
                setStatus("");
              }}
              className="min-h-11 self-start text-sm text-stone underline-offset-4 hover:text-ink hover:underline"
            >
              Use a different email
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="site-display">{heading}</h1>
          <p className="site-lede mt-3">{lede}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void request(email.trim());
            }}
            className="mt-8 space-y-3"
          >
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
              {busy ? "Sending…" : cta}
            </Button>
          </form>

          {offered.length > 0 ? (
            <>
              <div className="my-7 flex items-center gap-3 text-xs uppercase tracking-wider text-stone">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="space-y-2">
                {offered.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="secondary"
                    className="min-h-11 w-full"
                    onClick={() => {
                      setError("");
                      void signInWithProvider(p.id, { redirectTo: destination }).catch(
                        (err: unknown) => setError(classifyAuthError(err, intent).message),
                      );
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </>
          ) : null}

          <div className="mt-8 text-sm text-ink-2">{footer}</div>
        </>
      )}
    </main>
  );
}
