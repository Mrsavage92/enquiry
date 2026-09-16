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
    b: "Enquiry is intended to be a paid product. We’ll share the full pricing before any paid access begins, give at least 30 days of written notice, and you decide whether to continue.",
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
