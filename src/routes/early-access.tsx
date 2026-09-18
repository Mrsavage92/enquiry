import { Link, createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { socialHead } from "@/lib/site/head";
import { AuthLayout } from "@/components/auth/auth-layout";
import { WaitlistForm } from "@/components/site/waitlist-form";

export const Route = createFileRoute("/early-access")({
  component: EarlyAccess,
  head: () =>
    socialHead({
      path: "/early-access",
      title: "Early access · Enquiry",
      description:
        "Join Enquiry early access. We’re opening gradually with a founding-user offer for the first service businesses.",
    }),
});

const PROMISES = [
  {
    t: "Early access as the product is ready",
    b: "We invite businesses in small groups as the product is ready for them.",
  },
  {
    t: "A 20-minute setup call",
    b: "When your invitation arrives, we set up your services, prices and rules with you on a short call, so the first real enquiry lands in a workspace that already knows your business.",
  },
  {
    t: "30% off your first 12 months",
    b: "For the first 20 invited businesses. Join before public release and, if you become a paying customer, your first 12 months are 30% off the standard price.",
  },
  {
    t: "A direct line into what we learn",
    b: "In your first week we ask for 15 minutes of honest feedback. What early businesses tell us shapes what gets built next, and we publish what changed.",
  },
  {
    t: "No surprise charge",
    b: "Indicative pricing is A$29-49 per month inc GST, and founding members keep 30% off for the first 12 months. It is provisional: the final figure is confirmed before any paid access begins, with at least 30 days of written notice, and you decide whether to continue.",
  },
];

function EarlyAccess() {
  return (
    <AuthLayout>
      <WaitlistForm appearance="entry" />
      <section className="auth-offer" aria-labelledby="offer-title">
        <div className="auth-offer-card">
          <div className="auth-offer-head">
            <span className="auth-offer-pill">Founding offer</span>
            <h2 id="offer-title">For the first 20 businesses.</h2>
            <p>Join before public release, before any payment is asked for.</p>
          </div>
          <div className="auth-offer-price">
            <p className="auth-offer-value">
              <strong>
                30<span>%</span>
              </strong>
              <span className="auth-offer-value-label">
                off your first 12 months if you become a paying customer
              </span>
            </p>
            <p className="auth-offer-fine">
              The standard price is confirmed in writing before any paid access begins.
            </p>
          </div>
          <div className="auth-offer-list">
            <p className="auth-offer-list-title">What early access includes</p>
            <ul>
              {PROMISES.map((item) => (
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
