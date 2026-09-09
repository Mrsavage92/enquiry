import { createFileRoute, Link } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { WaitlistForm } from "@/components/site/waitlist-form";

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
      {/*
        Page-header pattern, distinct from home's hero tier. Re-extracted live
        from https://linear.app/changelog (.style-mirror/tools/_scratch not
        kept - see section-log.md "updates" for the numbers): the "Now" h1
        computes to 48px/510/-1.056px/lh 48px at BOTH 1440 and 390 (unchanged,
        unlike the home hero's h1 which shrinks to 38px), optical margin -2px
        at 1440 / -1px at 390, top padding 77px under the nav at both widths.
        tokens.lock.json already carried this as typography.scale_*.h1_page;
        this route is the first to consume it, so there is no shared class for
        it yet - built with the same values as arbitrary utilities rather than
        reusing .mk-h1 (64px hero tier, wrong here) or .mk-h2 (shrinks to 24px
        at 640, wrong here - this title must stay 48px at every width, exactly
        as the reference's "Now" does).

        The reference page has no eyebrow above "Now" - ours keeps "In public"
        because that copy already existed and is not this pass's to remove.
      */}
      <section className="mk-container pt-[77px] pb-16">
        <p className="mk-label">In public</p>
        <h1 className="mt-5 max-w-[20ch] -ml-[2px] text-[48px] font-[510] leading-[48px] tracking-[-1.056px] text-ink max-[640px]:-ml-[1px]">
          Updates
        </h1>
        <p className="mk-lede mt-6 max-w-xl">
          Meaningful notes from building Enquiry in public. Not a changelog - only progress that
          changes what the product is, or how we think about it.
        </p>
      </section>

      {/*
        The changelog-entry pattern from .style-mirror/system.md §4, one
        .mk-entry per post - the same vocabulary home's roadmap preview uses.
        Every entry keeps its own date (reference-consistent: the rule is a
        sibling of the aside inside .mk-entry, so consecutive entries' rules
        read as one continuous line even without merging same-date entries).
        The newest entry gets the marker dot and the 32px featured title tier,
        both measured off the reference's own newest changelog post.
      */}
      <div className="mk-container">
        <div className="mk-divider mb-16" />
        {POSTS.map((post, i) => (
          <div key={post.title} className="mk-entry">
            <span className="mk-entry-rule" aria-hidden />
            {i === 0 ? <span className="mk-entry-marker" aria-hidden /> : null}
            <div className="mk-entry-aside">
              <p className="mk-entry-date">{post.date}</p>
            </div>
            <div className="mk-entry-body">
              <h2 className="mk-entry-title" data-featured={i === 0 ? "true" : undefined}>
                {post.title}
              </h2>
              <p className="mk-prose mt-5">{post.body}</p>
            </div>
          </div>
        ))}
        <p className="mk-small max-w-2xl">
          What’s in motion is on the{" "}
          <Link to="/roadmap" className="mk-inline-link">
            roadmap
          </Link>
          . Want to see the product?{" "}
          <Link to="/demo" className="mk-inline-link">
            Try the demo
          </Link>
          .
        </p>
      </div>

      <section className="mk-prefooter">
        <div className="mk-container">
          <h2 className="mk-h2 max-w-[20ch]">Join early access</h2>
          <p className="mk-lede mt-5 max-w-xl">Email first. A few optional questions after.</p>
          <div className="mt-10 max-w-xl">
            <WaitlistForm />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
