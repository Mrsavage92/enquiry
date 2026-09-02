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
        <CrossChannelDecisionDemo headingLevel="h1" />
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
