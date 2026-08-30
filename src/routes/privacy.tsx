import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/site-shell";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () => ({
    meta: [
      { title: "Privacy · Enquiry" },
      {
        name: "description",
        content: "How Enquiry handles early-access emails and the in-browser demo.",
      },
    ],
  }),
});

function Privacy() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-xl px-5 pb-16 pt-10 sm:pb-20 sm:pt-20">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-4 text-sm text-stone">Last updated 25 August 2026</p>
        <div className="mt-10 space-y-6 text-sm leading-relaxed text-ink-2">
          <p>
            Enquiry is in early access. This page covers the waitlist and the in-browser app on this
            site — not a finished product with every integration switched on.
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">What we collect</h2>
          <p>
            If you join early access we store the email you give us. Optional questions — business
            type, how work arrives, roughly how many enquiries, what hurts — help us invite the
            right first businesses. We also keep first-touch attribution (campaign, referrer) so we
            know how you found Enquiry.
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">What we use it for</h2>
          <p>
            To email you about Enquiry access, cohort invites, and product notes you asked for. We
            do not sell the list. We do not use it for unrelated marketing.
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">The app in the browser</h2>
          <p>
            The operator app is a prototype. Sample jobs and anything you type there stay on this
            device for the session. They are not your production mailbox, and they are not a
            customer database we keep.
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Keeping the waitlist</h2>
          <p>
            Waitlist records live in our database so a refresh does not lose your place. Roadmap
            “I need this” is tied to a browser session, not a public leaderboard.
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Your choices</h2>
          <p>
            To see, correct, or remove your waitlist email, write from that same address after you
            receive an Enquiry email — we will reply from there. You can also just not join.
          </p>
          <p>
            Enquiry is being built from Australia.{" "}
            <Link to="/terms" className="font-medium text-ink underline-offset-4 hover:underline">
              Terms
            </Link>{" "}
            sit next to this page.
          </p>
        </div>
      </article>
    </SiteShell>
  );
}
