import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site/contact";
import { FROM_PAGE_FIELD, FROM_PAGE_VALUE } from "@/lib/launch/unsubscribe-form";

type Outcome = "ask" | "working" | "removed" | "already-removed" | "invalid" | "failed";
type UnsubscribeSearch = { t: string; result: Outcome | "" };

const API_PATH = "/api/unsubscribe";
const RESULTS = new Set<string>(["removed", "already-removed", "invalid"]);

export const Route = createFileRoute("/unsubscribe")({
  component: Unsubscribe,
  validateSearch: (search: Record<string, unknown>): UnsubscribeSearch => ({
    t: typeof search.t === "string" ? search.t.slice(0, 200) : "",
    result:
      typeof search.result === "string" && RESULTS.has(search.result)
        ? (search.result as Outcome)
        : "",
  }),
  head: () => ({
    meta: [{ title: "Unsubscribe" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

const HEADINGS: Record<Outcome, string> = {
  ask: "Leave the early-access list?",
  working: "Removing you from the list",
  removed: "You have been removed",
  "already-removed": "You are not on the list",
  invalid: "This link did not work",
  failed: "This link did not work",
};

const BODIES: Record<Outcome, string> = {
  ask: "Press the button to remove your email and answers. Nothing happens until you do.",
  working: "One moment.",
  removed: "Your email and answers are deleted. You will not get any more emails from the list.",
  "already-removed": "This email was already removed. Nothing else to do.",
  invalid: "The link may have been cut short when it was copied.",
  failed: "Something went wrong on our side.",
};

function initialOutcome(t: string, result: Outcome | ""): Outcome {
  if (result) return result;
  return t ? "ask" : "invalid";
}

/**
 * Opened from the unsubscribe link in a list email. Opening the page never
 * deletes anything: mail security scanners (Safe Links, Mimecast, Barracuda)
 * open links in a real browser that runs JavaScript, so the delete waits for
 * a press of the button. With JavaScript the button POSTs in place; without
 * it, the form POSTs and the server sends the browser back here with the
 * result. Mail clients' own one-click button POSTs to /api/unsubscribe
 * directly (RFC 8058) and never sees this page.
 */
function Unsubscribe() {
  const { t, result } = Route.useSearch();
  const [outcome, setOutcome] = useState<Outcome>(() => initialOutcome(t, result));
  const action = `${API_PATH}?t=${encodeURIComponent(t)}`;

  const remove = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (outcome === "working") return;
    setOutcome("working");
    fetch(action, { method: "POST", headers: { accept: "application/json" } })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { outcome?: string };
        setOutcome(
          body.outcome && RESULTS.has(body.outcome) ? (body.outcome as Outcome) : "failed",
        );
      })
      .catch(() => setOutcome("failed"));
  };

  const done = outcome === "removed" || outcome === "already-removed";
  const broken = outcome === "invalid" || outcome === "failed";
  const showButton = Boolean(t) && (outcome === "ask" || outcome === "working");

  return (
    <AuthLayout>
      <div className="entry-waitlist">
        {done ? (
          <div className="auth-state-icon auth-state-icon--success">
            <CheckCircle2 size={24} aria-hidden="true" />
          </div>
        ) : null}
        <h1 className="auth-title">{HEADINGS[outcome]}</h1>
        <p className="auth-description" role="status" aria-live="polite">
          {BODIES[outcome]}
        </p>
        {showButton ? (
          <form method="post" action={action} onSubmit={remove}>
            <input type="hidden" name={FROM_PAGE_FIELD} value={FROM_PAGE_VALUE} />
            <Button
              type="submit"
              variant="primary"
              className="auth-submit"
              disabled={outcome === "working"}
            >
              {outcome === "working" ? (
                <LoaderCircle size={17} className="auth-spinner" aria-hidden="true" />
              ) : null}
              Remove me from the list
            </Button>
          </form>
        ) : null}
        {broken ? (
          <p className="auth-description">
            Reply to any email from us, or write to{" "}
            <a href={SUPPORT_MAILTO} className="font-medium underline underline-offset-4">
              {SUPPORT_EMAIL}
            </a>
            , and we will remove you by hand.
          </p>
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
