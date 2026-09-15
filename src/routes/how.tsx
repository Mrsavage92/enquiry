import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { EnquiryStory } from "@/components/site/enquiry-story";
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
        <p className="public-kicker">From the first question to the next step</p>
        <h1>How Enquiry works</h1>
        <p>A real-world request rarely stands still. Neither should the next step.</p>
        <div className="public-actions">
          <Link to="/early-access" className="public-button">
            Join early access <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link to="/demo" className="public-text-link">
            Try a sample enquiry <ArrowRight size={16} aria-hidden="true" />
          </Link>
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
      <EarlyAccessInvite />
    </SiteShell>
  );
}
