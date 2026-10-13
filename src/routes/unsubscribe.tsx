import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site/contact";

type UnsubscribeSearch = { t: string };
type Outcome = "working" | "removed" | "already-removed" | "invalid" | "failed";

const API_PATH = "/api/unsubscribe";

export const Route = createFileRoute("/unsubscribe")({
  component: Unsubscribe,
  validateSearch: (search: Record<string, unknown>): UnsubscribeSearch => ({
    t: typeof search.t === "string" ? search.t.slice(0, 200) : "",
  }),
  head: () => ({
    meta: [{ title: "Unsubscribe" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

const HEADINGS: Record<Outcome, string> = {
  working: "Removing you from the list",
  removed: "You have been removed",
  "already-removed": "You are not on the list",
  invalid: "This link did not work",
  failed: "This link did not work",
};

const BODIES: Record<Outcome, string> = {
  working: "One moment.",
  removed: "Your email and answers are deleted. You will not get any more emails from the list.",
  "already-removed": "This email was already removed. Nothing else to do.",
  invalid: "The link may have been cut short when it was copied.",
  failed: "Something went wrong on our side.",
};

/**
 * Opened from the unsubscribe link in a list email. Opening it removes the
 * row straight away, the same hard delete as "Remove me from the list". The
 * delete is a POST sent from the page, so mail scanners that only fetch the
 * link remove nobody. Without JavaScript, the button does the same POST.
 */
function Unsubscribe() {
  const { t } = Route.useSearch();
  const [outcome, setOutcome] = useState<Outcome>(t ? "working" : "invalid");
  const started = useRef(false);
  const action = `${API_PATH}?t=${encodeURIComponent(t)}`;

  useEffect(() => {
    if (!t || started.current) return;
    started.current = true;
    fetch(action, { method: "POST", headers: { accept: "application/json" } })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { outcome?: Outcome };
        const known = body.outcome && body.outcome in HEADINGS ? body.outcome : null;
        setOutcome(known ?? "failed");
      })
      .catch(() => setOutcome("failed"));
  }, [action, t]);

  const done = outcome === "removed" || outcome === "already-removed";
  const broken = outcome === "invalid" || outcome === "failed";

  return (
    <AuthLayout>
      <div className="entry-waitlist" role="status" aria-live="polite">
        {done ? (
          <div className="auth-state-icon auth-state-icon--success">
            <CheckCircle2 size={24} aria-hidden="true" />
          </div>
        ) : null}
        <h1 className="auth-title">
          {outcome === "working" ? (
            <LoaderCircle size={22} className="auth-spinner" aria-hidden="true" />
          ) : null}{" "}
          {HEADINGS[outcome]}
        </h1>
        <p className="auth-description">{BODIES[outcome]}</p>
        {broken ? (
          <p className="auth-description">
            Reply to any email from us, or write to{" "}
            <a href={SUPPORT_MAILTO} className="font-medium underline underline-offset-4">
              {SUPPORT_EMAIL}
            </a>
            , and we will remove you by hand.
          </p>
        ) : null}
        {t ? (
          <noscript>
            <form method="post" action={action}>
              <button type="submit" className="auth-submit">
                Remove me from the list
              </button>
            </form>
          </noscript>
        ) : null}
        <p className="auth-description">
          <Link to="/privacy" className="font-medium underline underline-offset-4">
            How we handle your information
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
