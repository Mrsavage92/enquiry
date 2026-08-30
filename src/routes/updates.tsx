import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { WaitlistForm } from "@/components/site/waitlist-form";

export const Route = createFileRoute("/updates")({
  component: Updates,
  head: () => ({
    meta: [
      { title: "Updates · Enquiry" },
      {
        name: "description",
        content: "Meaningful notes from building Enquiry in public. Not a changelog.",
      },
    ],
  }),
});

const POSTS = [
  {
    date: "26 Aug 2026",
    title: "One enquiry, even when the conversation moves",
    body: "A website form and a later text can be the same enquiry when identity is safely established. Changed facts change the business decision, not just the reply. That is not all your messages in one inbox. Supported channels will roll out progressively — not every integration is live.",
  },
  {
    date: "26 Aug 2026",
    title: "What we mean by building in public",
    body: "We publish progress that changes what Enquiry is, or how we think about it — not every fix and refactor. The public roadmap is direction, not a contract. If evidence changes the plan, we update the page rather than quietly leaving an old promise.",
  },
  {
    date: "26 Aug 2026",
    title: "Why Enquiry sometimes refuses to answer",
    body: "If a price cannot be decided, Enquiry does not invent one. If pricing does not apply to this enquiry, there is no price to show. Unknown is a valid outcome. We would rather ask, or wait, than guess.",
  },
  {
    date: "25 Aug 2026",
    title: "Why Enquiry is not another CRM",
    body: "A CRM with a chatbot is not the product. Enquiry decides what the request means before it drafts. The useful parts of the record keep themselves — waiting, needs you, ready — without a board you drag cards across. If it has to guess, it asks. You still send.",
  },
  {
    date: "24 Aug 2026",
    title: "Learning the business without silently changing the rules",
    body: "A correction can stay on this enquiry, or teach Enquiry. High-impact rules — what you never do, prices where they apply, who you will travel for — wait for an explicit yes. Provenance sits on what it learned.",
  },
];

function Updates() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-5 pb-16 pt-10 sm:pb-20 sm:pt-20">
        <p className="eyebrow">In public</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Updates</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-2">
          Meaningful notes from building Enquiry in public. Not a changelog — only progress that
          changes what the product is, or how we think about it.
        </p>
        <ul className="mt-12">
          {POSTS.map((p) => (
            <li key={p.title} className="border-t border-line py-8 last:border-b">
              <p className="text-xs uppercase tracking-wider text-stone">{p.date}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-ink-2">
          What’s in motion is on the{" "}
          <Link to="/roadmap" className="font-medium underline-offset-4 hover:underline">
            roadmap
          </Link>
          . The live product is in the{" "}
          <Link to="/enquiries" className="font-medium underline-offset-4 hover:underline">
            app
          </Link>
          .
        </p>
      </article>
      <section className="border-t border-line">
        <div className="mx-auto max-w-xl px-5 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Join early access</h2>
          <p className="mt-2 text-sm text-ink-2">Email first. A few optional questions after.</p>
          <div className="mt-6">
            <WaitlistForm />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
