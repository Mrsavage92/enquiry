import { createFileRoute, Link } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { LegalLayout } from "@/components/site/legal-layout";
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
    <LegalLayout
      title="Privacy"
      sections={[
        { id: "collect", title: "What we collect" },
        { id: "use", title: "What we use it for" },
        { id: "workspaces", title: "Demo and workspaces" },
        { id: "providers", title: "Service providers" },
        { id: "retention", title: "How long we keep it" },
        { id: "waitlist", title: "Keeping the waitlist" },
        { id: "choices", title: "Your choices" },
      ]}
    >
      <p>
        This page covers the Enquiry website, early-access list, sample demo and signed-in
        workspaces. The public demo and a real business workspace handle information differently.
      </p>
      <h2 id="collect">What we collect</h2>
      <p>
        If you join early access we store the email you give us. Optional questions - business type,
        how work arrives, roughly how many enquiries, what hurts - help us invite the right first
        businesses. We also keep first-touch attribution (campaign, referrer) so we know how you
        found Enquiry.
      </p>
      <h2 id="use">What we use it for</h2>
      <p>
        To email you about Enquiry access, cohort invites, and product notes you asked for. We do
        not sell the list. We do not use it for unrelated marketing.
      </p>
      <h2 id="workspaces">Sample demo and signed-in workspaces</h2>
      <p>
        The public demo uses sample customers. Do not enter real customer information into a sample
        workspace. When you sign in to a real workspace, Enquiry stores account and business
        information, customer enquiries, messages and recorded actions on the server. This
        information is not limited to your browser session.
      </p>
      <p>
        We use workspace information to provide the service: organise enquiries, apply the business
        details you provide and prepare next steps. Only bring information you are authorised to
        use. A prepared reply does not by itself send customer information to the recipient.
      </p>
      <h2 id="providers">Service providers</h2>
      <p>
        Enquiry runs on Vercel (hosting), Supabase (database and sign-in email; the database is in
        Sydney, Australia) and, where AI-assisted interpretation is enabled, Anthropic (Claude,
        processed in the United States). Enquiry and business context is sent to Anthropic only to
        prepare a response, and customer messages are not used to train models. Not every
        deployment or feature has AI processing enabled.
      </p>
      <h2 id="retention">How long we keep it</h2>
      <p>
        Waitlist records are kept until you ask us to remove them or the early-access programme
        ends. Workspace information is kept while your account is active and removed within 30 days
        of a deletion request, apart from records we must keep to show what actions were recorded
        and by whom.
      </p>
      <h2 id="waitlist">Keeping the waitlist</h2>
      <p>
        Waitlist records live in our database so a refresh does not lose your place. The website
        records page views and selected interactions alongside campaign attribution and a browser
        session identifier. Browser storage remembers your waitlist progress and roadmap feedback.
        Roadmap interest is not a public leaderboard.
      </p>
      <h2 id="choices">Your choices</h2>
      <p>
        To see, correct or remove anything we hold about you, email{" "}
        <a href={SUPPORT_MAILTO} className="font-medium text-ink underline-offset-4 hover:underline">
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
    </LegalLayout>
  );
}
