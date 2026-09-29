import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
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
            <h2 id="offer-title">What happens when you join</h2>
            <p>{OFFER.payWhen}</p>
          </div>
          <div className="auth-offer-price">
            <p className="auth-offer-value">
              <strong>{FOUNDING_PRICE}</strong>
              <span className="auth-offer-value-label">
                a month inc GST, for as long as you stay. {OFFER.perDay}
              </span>
            </p>
            <p className="auth-offer-window">{OFFER.window}</p>
            <p className="auth-offer-next">{OFFER.next}</p>
          </div>
          <div className="auth-offer-list">
            <h3>What founding members get</h3>
            {OFFER_PROMISES.map((item) => (
              <div key={item.t} className="auth-offer-promise">
                <h4>{item.t}</h4>
                <p>{item.b}</p>
              </div>
            ))}
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
