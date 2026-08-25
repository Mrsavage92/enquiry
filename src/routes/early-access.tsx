import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";
import { WaitlistForm } from "@/components/site/waitlist-form";

export const Route = createFileRoute("/early-access")({
  component: EarlyAccess,
  head: () => ({
    meta: [
      { title: "Early access · Enquiry" },
      {
        name: "description",
        content:
          "Join Enquiry early access. Email first. Optional qualification. We onboard service businesses in small cohorts.",
      },
    ],
  }),
});

function EarlyAccess() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-xl px-5 py-10 sm:py-20">
        <p className="eyebrow">Early access</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Join the list</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          We’re onboarding businesses gradually while we test Enquiry across different service
          businesses. Email first. A few optional questions after — they help us invite the right
          first five, not pad a list.
        </p>
        <p className="mt-4 text-sm text-ink-2">
          Preparing Cohort 1. Five high-fit businesses. Founder-led. Then about twenty, then more —
          only as learning can absorb them.
        </p>
        <ul className="mt-8 text-sm leading-relaxed text-ink-2">
          <li className="border-t border-line py-3">Early beta, when your cohort is ready</li>
          <li className="border-t border-line py-3">A say in the research, not a vote that ships features</li>
          <li className="border-t border-line py-3">Notice when something you asked for is Building or Shipped</li>
          <li className="border-t border-line py-3 last:border-b">
            Enquiry is intended to become a paid product. Founding-user pricing only if we later know
            the commercial model is real — no permanent discount promised in advance.
          </li>
        </ul>
        <div className="mt-10">
          <WaitlistForm />
        </div>
      </article>
    </SiteShell>
  );
}
