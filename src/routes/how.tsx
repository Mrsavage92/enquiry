import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { CrossChannelDecisionDemo } from "@/components/site/cross-channel-decision-demo";
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
      <header className="public-container public-page-heading">
        <h1>How Enquiry works</h1>
        <p>
          A customer asks. The details change. Enquiry helps you keep track of what matters and
          prepare what comes next.
        </p>
        <div className="public-actions">
          <Link to="/early-access" className="public-button">
            Join early access <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link to="/demo" className="public-text-link">
            Try a sample enquiry <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <section className="public-workflow-band">
        <div className="public-container public-section">
          <h2 className="site-display">From a new request to a clear next step.</h2>
          <ol className="public-process">
            {[
              [
                "01",
                "Bring the conversation together",
                "Add the enquiry yourself, then bring in new messages as they arrive. Live channel connections are being developed; they are not required to try the sample demo.",
              ],
              [
                "02",
                "Put your business in the picture",
                "Services, prices, policies and how you work give the request context. Missing information, conflicts and uncertain availability stay visible.",
              ],
              [
                "03",
                "Review and move it forward",
                "Check the prepared reply and its reasoning. Edit it when needed, send through your channel and record the action accurately. A copied reply is not marked as sent.",
              ],
            ].map(([number, title, body]) => (
              <li key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
          <div className="public-review-note">
            <Check size={18} aria-hidden="true" />
            <p>
              Your judgement stays part of the process. Enquiry does not fill uncertainty with a
              confident guess.
            </p>
          </div>
        </div>
      </section>
      <section className="public-container public-section" aria-labelledby="example-title">
        <div className="public-section-heading">
          <p className="public-kicker">A sample enquiry</p>
          <h2 id="example-title">
            One new message.
            <br />A different next step.
          </h2>
          <p>
            Maya changes the scope of a painting job. See what that changes before a reply is
            prepared. This is a demonstration, not a connected inbox.
          </p>
        </div>
        <div className="mt-8">
          <CrossChannelDecisionDemo compact />
        </div>
      </section>
      <EarlyAccessInvite />
    </SiteShell>
  );
}
