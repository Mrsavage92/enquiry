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
        content: "Notes from building Enquiry — the app, the waitlist, and the public roadmap.",
      },
    ],
  }),
});

const POSTS = [
  {
    date: "25 Aug 2026",
    title: "The sheet is the figure. The letter is how you say it.",
    body: "If a draft almost-but-not names the hold on the sheet, Enquiry says so. One tap uses the sheet. $190 is $190 — not 30% rounded into $187.",
  },
  {
    date: "25 Aug 2026",
    title: "The website and the app are both the product",
    body: "Early access, waitlist and this public roadmap live on the site. The operator app — Today, a job, send — is what you open on the phone. The desk is the same product on a computer.",
  },
  {
    date: "25 Aug 2026",
    title: "I nearly built Enquiry wrong",
    body: "A CRM with a chatbot is not the product. Enquiry decides what the request means before it drafts. If it has to guess, it asks. The quote is a document. You still send.",
  },
  {
    date: "25 Aug 2026",
    title: "Work can arrive as a form, a text, or a DM",
    body: "Email is one pipe. A website form that lands in hello@ is still a form. Instagram and Facebook messages become case files. A public comment is not a quote.",
  },
  {
    date: "24 Aug 2026",
    title: "The quote is a document",
    body: "Enquiry will not bury a price in a chat bubble. The sheet stays on file. Editing the letter does not change the figure.",
  },
  {
    date: "24 Aug 2026",
    title: "Business Brain, then a decision",
    body: "Enquiry learns how the business works. Then every enquiry arrives with a recommended next action, and why. You still send.",
  },
];

function Updates() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
        <p className="eyebrow">Build</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Updates</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-2">
          Notes from the build. The public roadmap is what is in motion; this is what we wrote down
          as we made it.
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
          The live product is in the app.{" "}
          <Link to="/enquiries" className="font-medium underline-offset-4 hover:underline">
            Open it
          </Link>
          .
        </p>
      </article>
      <section className="border-t border-line">
        <div className="mx-auto max-w-xl px-5 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Join early access</h2>
          <div className="mt-6">
            <WaitlistForm />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
