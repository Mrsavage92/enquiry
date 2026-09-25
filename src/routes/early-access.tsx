import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";
import { socialHead } from "@/lib/site/head";
import { AuthLayout } from "@/components/auth/auth-layout";
import { WaitlistForm } from "@/components/site/waitlist-form";
import { FOUNDING_PRICE, OFFER, OFFER_PROMISES } from "@/lib/site/offer";

export const Route = createFileRoute("/early-access")({
  component: EarlyAccess,
  head: () =>
    socialHead({
      path: "/early-access",
      title: "Early access · Enquiry",
      description: `Join Enquiry as a founding member: ${OFFER.headline}`,
    }),
});

/** Moved from the home FAQ, which keeps only the four questions that decide joining. */
const MORE_QUESTIONS = [
  [
    "Who is Enquiry for?",
    "Owner-run service businesses: the people answering customers, organising the work and making the final call. Early access is opening in small groups so we can learn from real workflows.",
  ],
  [
    "Will it connect to my email and messages?",
    "Early access starts with you bringing the enquiry and new messages into Enquiry. Connected channels are on the roadmap. The demo shows a sample conversation, not a live connection to your inbox.",
  ],
  [
    "What if a price or date is uncertain?",
    "The uncertainty stays visible. Enquiry can prepare a question or flag a detail for you to check instead of presenting an unsupported price or availability as confirmed.",
  ],
] as const;

function EarlyAccess() {
  return (
    <AuthLayout>
      <WaitlistForm appearance="entry" />
      <section className="auth-offer" aria-labelledby="offer-title">
        <div className="auth-offer-card">
          <div className="auth-offer-head">
            <span className="auth-offer-pill">Founding member</span>
            <h2 id="offer-title">One price, kept for as long as you stay.</h2>
            <p>{OFFER.start}</p>
          </div>
          <div className="auth-offer-price">
            <p className="auth-offer-value">
              <strong>{FOUNDING_PRICE}</strong>
              <span className="auth-offer-value-label">
                a month inc GST, for as long as you stay.
              </span>
            </p>
            <p className="auth-offer-per-day">{OFFER.perDay}</p>
            <p className="auth-offer-window">{OFFER.window}</p>
            <p className="auth-offer-next">
              <strong>What happens next:</strong> {OFFER.next}
            </p>
          </div>
          <div className="auth-offer-list">
            <p className="auth-offer-list-title">What founding members get</p>
            <ul>
              {OFFER_PROMISES.map((item) => (
                <li key={item.t}>
                  <span className="auth-offer-check" aria-hidden="true">
                    <Check size={11} strokeWidth={2.5} />
                  </span>
                  <div>
                    <p>{item.t}</p>
                    <p>{item.b}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="auth-faq" id="more-questions" aria-labelledby="more-questions-title">
        <h2 id="more-questions-title">More questions</h2>
        {MORE_QUESTIONS.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
      <div className="auth-invitation">
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <p>
          Have an invitation? <Link to="/signup">Set up your account</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
