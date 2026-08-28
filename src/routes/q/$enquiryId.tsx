import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { BUSINESS_BY_ID } from "@/fixtures";
import { usePrototype } from "@/store/prototype-store";
import { QuoteSheet, quoteSheets } from "@/components/enquiry/quote-sheet";
import { toastUndo } from "@/lib/toast-undo";
import { fixtureLinksAllowed } from "@/lib/public-links";
import { authEnabled } from "@/lib/auth/client";

/**
 * R1D containment. These links are keyed by a short internal id that ships in
 * the client bundle, so they resolve only in an explicitly opted-in local
 * prototype build. Anything that can authenticate a user fails closed here
 * instead of serving one customer's record to whoever guesses the next id.
 */
const FIXTURE_LINKS_OK = fixtureLinksAllowed({
  optedIn: import.meta.env.VITE_FIXTURE_PUBLIC_LINKS === "true",
  authEnabled,
});

export const Route = createFileRoute("/q/$enquiryId")({
  // Chosen at the route boundary, not inside the component: an early return
  // before the hooks made every later hook conditional. Selecting the
  // component here also means the gated one never mounts at all.
  component: FIXTURE_LINKS_OK ? CustomerQuote : LinkUnavailable,
});

function LinkUnavailable() {
  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <Link to="/" className="mb-10 inline-block">
        <Wordmark />
      </Link>
      <p className="text-lg font-semibold tracking-tight">This link isn’t available</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Shareable customer links are not switched on for this deployment. If you were
        expecting a quote or a booking, reply to the message the business sent you and
        they’ll sort it out.
      </p>
      <Button asChild variant="secondary" className="mt-6">
        <Link to="/">Go to Enquiry</Link>
      </Button>
    </main>
  );
}

function CustomerQuote() {
  const { enquiryId } = Route.useParams();
  const enquiries = usePrototype((s) => s.enquiries);
  const businesses = usePrototype((s) => s.businesses);
  const accept = usePrototype((s) => s.acceptQuote);
  const ask = usePrototype((s) => s.recordClientQuestion);
  const enquiry = enquiries.find((e) => e.id === enquiryId);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [sentQuestion, setSentQuestion] = useState(false);
  if (!enquiry) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <p className="text-lg font-semibold tracking-tight">This quote isn’t here</p>
        <p className="mt-2 text-sm text-ink-2">It may have been reset with the prototype.</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link to="/">Home</Link>
        </Button>
      </main>
    );
  }
  const business =
    businesses.find((b) => b.id === enquiry.businessId) ?? BUSINESS_BY_ID[enquiry.businessId];
  const quote =
    quoteSheets(enquiry).find((q) => q.status === "sent" || q.status === "accepted") ??
    quoteSheets(enquiry).at(-1);
  const booked = enquiry.state.lifecycle === "BOOKED" || enquiry.state.commercial === "ACCEPTED";
  const asked = sentQuestion || enquiry.state.decision === "NEEDS_HUMAN";

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-paper px-5 pt-[max(2.5rem,var(--app-safe-top))] pb-[max(2.5rem,var(--app-safe-bottom))]">
      <p className="text-xl font-semibold tracking-tight">{business?.name}</p>
      <p className="mt-1 text-sm text-stone">Quote · no account required</p>
      <span className="page-rule" aria-hidden />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">{enquiry.serviceLabel}</h1>
      <p className="mt-2 text-sm text-ink-2">
        Prepared for {enquiry.customerName}
        {enquiry.dateLabel ? ` · ${enquiry.dateLabel}` : ""}
      </p>
      {quote && business ? (
        <div className="mt-6">
          <QuoteSheet quote={quote} enquiry={enquiry} business={business} customer />
        </div>
      ) : (
        <p className="mt-6 text-sm text-stone">No sheet on file yet.</p>
      )}
      {booked ? (
        <p className="mt-8 text-sm text-ok">Accepted. You’re booked.</p>
      ) : asked ? (
        <p className="mt-8 text-sm text-ink-2">Question sent to the studio. The quote stays as written.</p>
      ) : asking ? (
        <form
          className="mt-8 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const body = question.trim();
            if (!body) return;
            ask(enquiry.id, body.slice(0, 2000));
            setSentQuestion(true);
            setAsking(false);
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block text-stone">Your question</span>
            <textarea
              className="field min-h-24"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Could we move the date?"
              autoFocus
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="min-h-11 w-full" disabled={!question.trim()}>
              Send question
            </Button>
            <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-8 grid gap-2">
          <Button
            className="min-h-11 w-full"
            onClick={() => {
              accept(enquiry.id);
              toastUndo("Booked. A confirmation is on the case file.");
            }}
          >
            Accept this quote
          </Button>
          <Button variant="secondary" className="min-h-11 w-full" onClick={() => setAsking(true)}>
            Ask a question
          </Button>
        </div>
      )}
      <p className="mt-6 text-xs leading-relaxed text-stone">
        Accepting records the booking. The studio will write separately with start details. No card is collected on this page.
      </p>
      <p className="mt-16 flex justify-center opacity-60">
        <Link to="/">
          <Wordmark size="sm" />
        </Link>
      </p>
    </main>
  );
}
