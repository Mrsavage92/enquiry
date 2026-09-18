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
    iso: "2026-08-26",
    title: "One enquiry, even when the conversation moves",
    body: "A website form and a later text can be the same enquiry when identity is safely established. Changed facts change the business decision, not just the reply. That is not all your messages in one inbox. Supported channels will roll out progressively - not every integration is live.",
  },
  {
    date: "26 Aug 2026",
    iso: "2026-08-26",
    title: "What we mean by building in public",
    body: "We publish progress that changes what Enquiry is, or how we think about it - not every fix and refactor. The public roadmap is direction, not a contract. If evidence changes the plan, we update the page rather than quietly leaving an old promise.",
  },
  {
    date: "26 Aug 2026",
    iso: "2026-08-26",
    title: "Why Enquiry sometimes refuses to answer",
    body: "If a price cannot be decided, Enquiry does not invent one. If pricing does not apply to this enquiry, there is no price to show. Unknown is a valid outcome. We would rather ask, or wait, than guess.",
  },
  {
    date: "25 Aug 2026",
    iso: "2026-08-25",
    title: "Why Enquiry is not another CRM",
    body: "A CRM with a chatbot is not the product. Enquiry decides what the request means before it drafts. The useful parts of the record keep themselves - waiting, needs you, ready - without a board you drag cards across. If it has to guess, it asks. You still send.",
  },
  {
    date: "24 Aug 2026",
    iso: "2026-08-24",
    title: "Learning the business without silently changing the rules",
    body: "A correction can stay on this enquiry, or teach Enquiry. High-impact rules - what you never do, prices where they apply, who you will travel for - wait for an explicit yes. Provenance sits on what it learned.",
  },
];

const VISUALS = [
  {
    src: "/product/ui1/enquiry-desktop.jpg",
    alt: "An enquiry in the current sample workspace.",
    to: "/demo",
    scene: "text",
  },
  {
    src: "/product/roadmap/roadmap-desktop.jpg",
    alt: "The public roadmap, separating current and planned outcomes.",
    to: "/roadmap",
  },
  {
    src: "/product/ui1/enquiry-mobile.jpg",
    alt: "The current mobile sample enquiry, with its next step and uncertainties.",
    to: "/demo",
    scene: "text",
  },
  {
    src: "/product/ui1/today-desktop.jpg",
    alt: "Today's enquiries in the current sample workspace.",
    to: "/demo",
  },
  {
    src: "/product/ui1/business-desktop.jpg",
    alt: "Business information in the current sample workspace.",
    to: "/demo",
  },
] as const;

function Updates() {
  return (
    <SiteShell>
      <article className="public-container pb-16">
        <header className="public-page-heading journal-heading">
          <div>
            <h1>Updates</h1>
            <p>The product, the progress, and why it matters to your working day.</p>
          </div>
          <p>
            Built with care.
            <br />
            Shared as we go.
          </p>
        </header>
        <ol className="product-journal" aria-label="Product updates">
          <li>
            <div className="journal-meta">
              <span className="journal-kind">Roadmap</span>
              <time className="journal-date" dateTime="2026-09-15">
                15 Sep 2026
              </time>
            </div>
            <div className="journal-entry">
              <div className="journal-copy">
                <h2>A clearer view of what's next.</h2>
                <p>
                  From the next customer reply to Enquiry in your pocket. Our new roadmap puts the
                  outcomes first, with a clear distinction between what is here and what is planned.
                </p>
                <Link to="/roadmap" className="public-text-link">
                  Explore the roadmap <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
              <figure className="journal-visual">
                <img
                  src="/product/roadmap/roadmap-desktop.jpg"
                  width="1270"
                  height="714"
                  alt="The Enquiry roadmap with Now, Next, Later and Exploring horizons."
                />
                <figcaption>From the live roadmap · September 2026</figcaption>
              </figure>
            </div>
          </li>
          {POSTS.map((post, index) => (
            <li key={post.title}>
              <div className="journal-meta">
                <span className="journal-kind">Note</span>
                <time className="journal-date" dateTime={post.iso}>
                  {post.date}
                </time>
              </div>
              <div className="journal-entry">
                <div className="journal-copy">
                  <h2>{post.title}</h2>
                  <p>{post.body}</p>
                  {VISUALS[index].to === "/roadmap" ? (
                    <Link to="/roadmap" className="public-text-link">
                      View the roadmap <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  ) : (
                    <Link
                      to="/demo"
                      search={"scene" in VISUALS[index] ? { scene: "text" } : {}}
                      className="public-text-link"
                    >
                      {"scene" in VISUALS[index]
                        ? "See the follow-up in the sample"
                        : "Explore the sample"}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  )}
                </div>
                <figure className="journal-visual">
                  <img
                    src={VISUALS[index].src}
                    alt={VISUALS[index].alt}
                    width="1280"
                    height="800"
                    loading="lazy"
                  />
                  <figcaption>
                    {VISUALS[index].to === "/roadmap"
                      ? "Current roadmap · Plans, not release promises"
                      : "Current sample workspace · Not customer data"}
                  </figcaption>
                </figure>
              </div>
            </li>
          ))}
        </ol>
      </article>
      <EarlyAccessInvite />
    </SiteShell>
  );
}
