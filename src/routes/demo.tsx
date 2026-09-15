import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { CrossChannelDecisionDemo } from "@/components/site/cross-channel-decision-demo";
import { Button } from "@/components/ui/button";
import { socialHead } from "@/lib/site/head";

export const Route = createFileRoute("/demo")({
  component: Demo,
  head: () =>
    socialHead({
      path: "/demo",
      title: "Try Enquiry · Sample demo",
      description:
        "Explore a sample enquiry. See how a new message changes the details that matter and the prepared next reply.",
    }),
});

function Demo() {
  return (
    <SiteShell>
      <header className="public-container public-page-heading public-demo-heading">
        <p className="public-kicker">Ridge & Co Painting · Sample business</p>
        <h1>Try Enquiry</h1>
        <p>A painting enquiry, a change of scope and a next step that changes with it.</p>
      </header>
      <section className="public-demo-band">
        <div className="public-container">
          {/*
          Someone can land here from a shared link with no other context. The
          case study names a business, a customer and a phone number, so the
          page has to say what it is before it shows any of that - relying on
          /terms to disclose it is relying on a page nobody opens first.
        */}
          <p className="demo-sample-label">Demo · sample enquiry, not a real customer</p>
          <div className="mt-5">
            <CrossChannelDecisionDemo compact />
          </div>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="min-h-12">
              <Link to="/early-access">Join early access</Link>
            </Button>
            <Button asChild variant="secondary" className="min-h-12">
              <Link to="/login">Already invited? Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
