import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, LoaderCircle, LockKeyhole, MailCheck } from "lucide-react";
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
import { AuthLayout } from "./auth-layout";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site/contact";

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
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sentTo) sentHeading.current?.focus();
  }, [sentTo]);

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

  if (isPending) {
    return (
      <AuthLayout>
        <div className="auth-loading" role="status">
          <LoaderCircle className="auth-spinner" size={24} aria-hidden="true" />
          <span>Checking your session...</span>
        </div>
      </AuthLayout>
    );
  }
  if (user) return <Navigate to={destination} />;

  const copy = sentStateCopy(intent);

  return (
    <AuthLayout>
      {!authEnabled ? (
        <>
          <h1 className="auth-title">Sign-in is off</h1>
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
          <div className="auth-state-icon" aria-hidden="true">
            <MailCheck size={28} />
          </div>
          <h1 ref={sentHeading} tabIndex={-1} className="auth-title">
            {copy.heading}
          </h1>
          <p className="auth-description auth-sent-address">
            {copy.body} <strong>{sentTo}</strong>.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            The link opens Enquiry directly. If it has not arrived in a couple of minutes, check
            spam, then resend. Still nothing after ten minutes? Email{" "}
            <a href={SUPPORT_MAILTO} className="underline underline-offset-4 hover:text-ink">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>

          {/* Status only. The visible error below is a role="alert", which
              announces on its own - carrying it here too reads it twice. */}
          <p aria-live="polite" className="sr-only">
            {error ? "" : status}
          </p>
          {error ? (
            <p role="alert" className="auth-error">
              {error}
            </p>
          ) : null}

          <div className="auth-sent-actions">
            <Button
              type="button"
              variant="secondary"
              className="auth-submit"
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
                requestAnimationFrame(() => emailInput.current?.focus());
              }}
              className="auth-change-email"
            >
              Use a different email
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="auth-title">{heading}</h1>
          <p className="auth-description">{lede}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void request(email.trim());
            }}
            className="auth-form"
            aria-busy={busy}
          >
            <label className="block text-sm">
              <span className="auth-label">Email address</span>
              <input
                ref={emailInput}
                type="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={error ? "auth-request-error" : undefined}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                className="field auth-input"
              />
            </label>
            {error ? (
              <p role="alert" id="auth-request-error" className="auth-error">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy} className="auth-submit">
              {busy ? "Sending…" : cta}
              {busy ? (
                <LoaderCircle size={18} className="auth-spinner" aria-hidden="true" />
              ) : (
                <ArrowRight size={18} aria-hidden="true" />
              )}
            </Button>
          </form>
          <p className="auth-reassurance">
            <LockKeyhole size={16} aria-hidden="true" />
            No password to remember.
          </p>

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

          <div className="auth-invitation">{footer}</div>
        </>
      )}
    </AuthLayout>
  );
}
