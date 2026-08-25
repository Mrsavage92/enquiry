import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { ProofCase } from "@/components/site/proof-case";
import { WaitlistForm } from "@/components/site/waitlist-form";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/site/motion";

export const Route = createFileRoute("/how")({
  component: How,
  head: () => ({
    meta: [
      { title: "How it works · Enquiry" },
      {
        name: "description",
        content:
          "Enquiry reads the job, drafts the reply in your voice, and you send. On the phone, between jobs.",
      },
    ],
  }),
});

function How() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-5 py-10 sm:py-20">
        <p className="eyebrow">How it works</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">You review. You send.</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          Enquiry decides what the request means and what should happen next. You approve. The
          system may do many operations underneath. You should mainly make judgement calls — not CRM
          data entry.
        </p>
      </article>

      <section className="border-t border-line bg-raised">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
          <ProofCase />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
        <ol>
          {[
            {
              t: "Work arrives",
              b: "A form, a text, an Instagram message, a Facebook DM, or an email. Public comments are not quotes. Enquiry opens a case file on the channel they used.",
            },
            {
              t: "It reads the Business Brain",
              b: "Services, prices, rules, voice. Customer-specific facts stay on that enquiry. A correction can teach the business, or stay on this job.",
            },
            {
              t: "The recommendation is ready",
              b: "What they want. What can be decided. What’s missing. The next action, and why. The quote is a sheet.",
            },
            {
              t: "You send from the phone or the desk",
              b: "Today, a job, send — when you’re on your feet. On a computer, the full case file: queue, correspondence, decision.",
            },
            {
              t: "It follows up if they go quiet",
              b: "Two working days. Silence is not a decline. The sent quote stays on file. You still send the chase.",
            },
          ].map((s, i) => (
            <Reveal key={s.t}>
              <li className="border-t border-line py-8 last:border-b">
                <p className="font-mono text-xs tabular-nums text-stone">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{s.t}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.b}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="min-h-12">
            <Link to="/early-access">Join early access</Link>
          </Button>
          <Button asChild variant="secondary" className="min-h-12">
            <Link to="/enquiries">Open the app</Link>
          </Button>
        </div>
      </section>
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
