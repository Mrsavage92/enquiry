import { createFileRoute, Link } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { OPERATOR_LINE, SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site/contact";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () =>
    socialHead({
      path: "/privacy",
      title: "Privacy · Enquiry",
      description:
        "How Enquiry handles early-access emails, website activity and signed-in workspace information.",
    }),
});

function Privacy() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:pb-20 sm:pt-20">
        <div className="max-w-xl">
          <p className="eyebrow">Legal</p>
          <h1 className="site-display-proof mt-3">Privacy</h1>
          <p className="mt-4 text-sm text-stone">Last updated 15 September 2026</p>
          <div className="mt-10 space-y-6 text-sm leading-relaxed text-ink-2">
            <p>
              This page covers the Enquiry website, early-access list, sample demo and signed-in
              workspaces. The public demo and a real business workspace handle information
              differently.
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-ink">What we collect</h2>
            <p>
              If you join early access we store the email you give us. Optional questions - business
              type, how work arrives, roughly how many enquiries, what hurts - help us invite the
              right first businesses. We also keep first-touch attribution (campaign, referrer) so
              we know how you found Enquiry.
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-ink">What we use it for</h2>
            <p>
              To email you about Enquiry access, cohort invites, and product notes you asked for. We
              do not sell the list. We do not use it for unrelated marketing.
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              Sample demo and signed-in workspaces
            </h2>
            <p>
              The public demo uses sample customers. Do not enter real customer information into a
              sample workspace. When you sign in to a real workspace, Enquiry stores account and
              business information, customer enquiries, messages and recorded actions on the server.
              This information is not limited to your browser session.
            </p>
            <p>
              We use workspace information to provide the service: organise enquiries, apply the
              business details you provide and prepare next steps. Only bring information you are
              authorised to use. A prepared reply does not by itself send customer information to
              the recipient.
            </p>
            <h2 className="text-lg font-semibold text-ink">Service providers</h2>
            <p>
              Enquiry runs on Vercel (hosting), Supabase (database and sign-in email; the database
              is in Sydney, Australia) and, where AI-assisted interpretation is enabled, Anthropic
              (Claude, processed in the United States). Enquiry and business context is sent to
              Anthropic only to prepare a response, and customer messages are not used to train
              models. Not every deployment or feature has AI processing enabled.
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-ink">How long we keep it</h2>
            <p>
              Waitlist records are kept until you ask us to remove them or the early-access
              programme ends. Workspace information is kept while your account is active and
              removed within 30 days of a deletion request, apart from records we must keep to show
              what actions were recorded and by whom.
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Keeping the waitlist</h2>
            <p>
              Waitlist records live in our database so a refresh does not lose your place. The
              website records page views and selected interactions alongside campaign attribution
              and a browser session identifier. Browser storage remembers your waitlist progress and
              roadmap feedback. Roadmap interest is not a public leaderboard.
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Your choices</h2>
            <p>
              To see, correct or remove anything we hold about you, email{" "}
              <a
                href={SUPPORT_MAILTO}
                className="font-medium text-ink underline-offset-4 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              from the address you joined with. You can also just not join.
            </p>
            <p>
              {OPERATOR_LINE}{" "}
              <Link to="/terms" className="font-medium text-ink underline-offset-4 hover:underline">
                Terms
              </Link>{" "}
              sit next to this page.
            </p>
          </div>
        </div>
      </article>
    </SiteShell>
  );
}
