import { createFileRoute } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { EnquiryStory } from "@/components/site/enquiry-story";
import { ProductWalkthrough } from "@/components/site/product-walkthrough";
import { EarlyAccessInvite } from "@/components/site/early-access-invite";

export const Route = createFileRoute("/how")({
  component: How,
  head: () =>
    socialHead({
      path: "/how",
      title: "How it works · Enquiry",
      description:
        "Bring in the customer conversation, review a prepared next step and keep the final call in your hands.",
    }),
});

function How() {
  return (
    <SiteShell>
      <header className="public-container public-page-heading public-editorial-heading">
        <div>
          <h1>How Enquiry works</h1>
          <p>
            A worked example. A changing request. What you can safely promise, and what still
            decides it. One enquiry and one next step at a time, built with owners with ADHD in
            mind.
          </p>
        </div>
      </header>
      <section className="public-story-band" aria-label="Maya's changing enquiry">
        <div className="public-container">
          <EnquiryStory />
        </div>
        <p className="public-container story-disclosure">
          An illustrative sample using Ridge's business rule, not a connected inbox. In early
          access, you add the enquiry and follow-up messages, review the reply, then send through
          your own channel.
        </p>
      </section>
      <ProductWalkthrough />
      <EarlyAccessInvite />
    </SiteShell>
  );
}
