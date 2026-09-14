import { createFileRoute, Link } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { EarlyAccessInvite } from "@/components/site/early-access-invite";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/updates")({
  component: Updates,
  head: () =>
    socialHead({
      path: "/updates",
      title: "Updates · Enquiry",
      description: "Meaningful notes from building Enquiry in public. Not a changelog.",
    }),
});

const POSTS = [
  {
    date: "26 Aug 2026",
    title: "One enquiry, even when the conversation moves",
    body: "A website form and a later text can be the same enquiry when identity is safely established. Changed facts change the business decision, not just the reply. That is not all your messages in one inbox. Supported channels will roll out progressively - not every integration is live.",
  },
  {
    date: "26 Aug 2026",
    title: "What we mean by building in public",
    body: "We publish progress that changes what Enquiry is, or how we think about it - not every fix and refactor. The public roadmap is direction, not a contract. If evidence changes the plan, we update the page rather than quietly leaving an old promise.",
  },
  {
    date: "26 Aug 2026",
    title: "Why Enquiry sometimes refuses to answer",
    body: "If a price cannot be decided, Enquiry does not invent one. If pricing does not apply to this enquiry, there is no price to show. Unknown is a valid outcome. We would rather ask, or wait, than guess.",
  },
  {
    date: "25 Aug 2026",
    title: "Why Enquiry is not another CRM",
    body: "A CRM with a chatbot is not the product. Enquiry decides what the request means before it drafts. The useful parts of the record keep themselves - waiting, needs you, ready - without a board you drag cards across. If it has to guess, it asks. You still send.",
  },
  {
    date: "24 Aug 2026",
    title: "Learning the business without silently changing the rules",
    body: "A correction can stay on this enquiry, or teach Enquiry. High-impact rules - what you never do, prices where they apply, who you will travel for - wait for an explicit yes. Provenance sits on what it learned.",
  },
];

function Updates() {
  return (
    <SiteShell>
      <article className="public-container pb-16">
        <div className="public-page-heading">
          <h1>Updates</h1>
          <p>
            Notes on what we are building, what we are learning and the decisions behind Enquiry.
          </p>
          <div className="public-actions">
            <Link to="/early-access" className="public-button">
              Join early access <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link to="/roadmap" className="public-text-link">
              See the roadmap <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <ul className="public-updates">
          {POSTS.map((p) => (
            <li key={p.title}>
              <time>{p.date}</time>
              <div>
                <h2>{p.title}</h2>
                <p>{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-3xl text-sm text-ink-2">
          What’s in motion is on the{" "}
          <Link to="/roadmap" className="font-medium underline-offset-4 hover:underline">
            roadmap
          </Link>
          . Want to see the product?{" "}
          <Link to="/demo" className="font-medium underline-offset-4 hover:underline">
            Try the demo
          </Link>
          .
        </p>
      </article>
      <EarlyAccessInvite />
    </SiteShell>
  );
}
