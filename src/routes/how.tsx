import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { ProofCase } from "@/components/site/proof-case";
import { CrossChannelDecisionDemo } from "@/components/site/cross-channel-decision-demo";
import { WaitlistForm } from "@/components/site/waitlist-form";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/site/motion";
import { SIGNATURE_DEMO } from "@/lib/site/signature-demo";

export const Route = createFileRoute("/how")({
  component: How,
  head: () => ({
    meta: [
      { title: "How it works · Enquiry" },
      {
        name: "description",
        content:
          "Work arrives from any channel. Enquiry reconstructs the request, applies how your business works, and prepares the next action.",
      },
    ],
  }),
});

function How() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-5 py-10 sm:py-20">
        <p className="eyebrow">How it works</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Work arrives. The next action is ready.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          Enquiry reconstructs the request, applies how this business works, and works out what can
          safely be decided now. You approve. You should mainly make judgement calls — not CRM data
          entry.
        </p>
      </article>

      <section className="border-t border-line bg-raised">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
          <Reveal>
            <p className="eyebrow">{SIGNATURE_DEMO.business}</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
              {SIGNATURE_DEMO.headline}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-base">
              {SIGNATURE_DEMO.supporting}
            </p>
          </Reveal>
          <div className="mt-8">
            <CrossChannelDecisionDemo compact />
          </div>
          <p className="mt-8 max-w-xl text-sm leading-relaxed text-ink-2">
            {SIGNATURE_DEMO.takeaway}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
        <ol>
          {[
            {
              t: "Work arrives",
              b: "A form, a text, an Instagram message, a Facebook DM, or an email. Those are ways an enquiry can arrive. Enquiry reconstructs the request from what came in.",
            },
            {
              t: "Enquiry reconstructs the request",
              b: "What they want. What’s known. What’s missing, ambiguous, or conflicting. Enquiry does not guess to fill the gaps.",
            },
            {
              t: "Business Brain supplies the truth",
              b: "Services, rules, voice, and prices where they apply. Customer-specific facts stay on that enquiry. A correction can teach the business, or stay on this job.",
            },
            {
              t: "What can be decided now",
              b: "Enquiry runs only the checks that matter for this request. What can be decided. What’s blocking the next decision. Why. Unknown is a valid answer.",
            },
            {
              t: "You review, then you send",
              b: "The next action is prepared — the reply, the hold, the question that unblocks the rest. Nothing goes out unless that kind of action is allowed. Early access is review-first.",
            },
            {
              t: "The enquiry stays current",
              b: "If they write again, or go quiet, the case file stays up to date until the work is booked or lost. Follow-up returns only when something needs you.",
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
      </section>

      <section className="border-t border-line bg-paper-2">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
          <Reveal>
            <p className="eyebrow">When the price can be decided</p>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
              A different job. Exact quote, ready to send.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
              Some enquiries resolve to a number. That is still Enquiry — it is not the whole product.
            </p>
          </Reveal>
          <div className="mt-8">
            <ProofCase />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
        <div className="flex flex-col gap-3 sm:flex-row">
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
