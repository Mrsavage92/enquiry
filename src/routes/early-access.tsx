import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
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
    t: "30% off your first 12 months",
    b: "Join before public release and, if you become a paying customer, your first 12 months are 30% off the standard price.",
  },
  {
    t: "A direct line into what we learn",
    b: "Early businesses can tell us where Enquiry helps, where it gets in the way, and what still needs work.",
  },
  {
    t: "No surprise charge",
    b: "Enquiry is intended to be a paid product. We’ll share the full pricing before any paid access begins, and you decide whether to continue.",
  },
];

function EarlyAccess() {
  return (
    <AuthLayout>
      <WaitlistForm appearance="entry" />
      <div className="auth-offer">
        <div className="auth-founding-offer">
          <strong className="auth-offer-value">
            30<span>%</span>
          </strong>
          <p>
            <strong>For the first businesses.</strong>
            <br />
            Off your first 12 months if you join before public release and become a paying customer.
          </p>
        </div>
        <details>
          <summary>
            How early access works
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <ul>
            {PROMISES.map((item) => (
              <li key={item.t}>
                <p>{item.t}</p>
                <p>{item.b}</p>
              </li>
            ))}
          </ul>
        </details>
      </div>
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
