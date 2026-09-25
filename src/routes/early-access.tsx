import { Link, createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
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
                a month inc GST, for as long as you stay. {OFFER.after}
              </span>
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
