import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { CrossChannelDecisionDemo } from "@/components/site/cross-channel-decision-demo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/demo")({
  component: Demo,
  head: () => ({
    meta: [
      { title: "One enquiry · Enquiry" },
      {
        name: "description",
        content:
          "A form becomes a text. The scope changes. Enquiry keeps the request, the business checks and the next action current.",
      },
    ],
  }),
});

function Demo() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
        {/*
          Someone can land here from a shared link with no other context. The
          case study names a business, a customer and a phone number, so the
          page has to say what it is before it shows any of that - relying on
          /terms to disclose it is relying on a page nobody opens first.
        */}
        <p className="eyebrow">Demo · sample enquiry, not a real customer</p>
        <div className="mt-5">
          <CrossChannelDecisionDemo headingLevel="h1" />
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="min-h-12">
            <Link to="/early-access">Join early access</Link>
          </Button>
          <Button asChild variant="secondary" className="min-h-12">
            <Link to="/enquiries">Open the app</Link>
          </Button>
        </div>
      </section>
    </SiteShell>
  );
}
