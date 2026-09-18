import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { CrossChannelDecisionDemo } from "@/components/site/cross-channel-decision-demo";
import { Button } from "@/components/ui/button";
import { socialHead } from "@/lib/site/head";

type DemoSearch = { scene?: "text" };

export const Route = createFileRoute("/demo")({
  component: Demo,
  validateSearch: (search: Record<string, unknown>): DemoSearch =>
    search.scene === "text" ? { scene: "text" } : {},
  head: () =>
    socialHead({
      path: "/demo",
      title: "Try Enquiry · Sample demo",
      description:
        "Explore a sample enquiry. See how a new message changes the details that matter and the prepared next reply.",
    }),
});

function Demo() {
  const { scene } = Route.useSearch();
  return (
    <SiteShell>
      <header className="public-container public-page-heading public-demo-heading">
        <div>
          <h1>Try Enquiry</h1>
          <p>One enquiry. A changing request. See how the next step changes with it.</p>
        </div>
        <p className="demo-sample-label">
          <strong>Sample demo</strong>Not a real customer.
          <br />
          Ridge & Co Painting · Sample business
        </p>
      </header>
      <section className="public-demo-band">
        <div className="public-container">
          <CrossChannelDecisionDemo compact initialScene={scene ?? "form"} syncUrl />
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
