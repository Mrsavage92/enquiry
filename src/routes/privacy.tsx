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
      lastUpdated="12 October 2026"
      sections={[
        { id: "collect", title: "What we collect" },
        { id: "use", title: "What we use it for" },
        { id: "workspaces", title: "Demo and workspaces" },
        { id: "providers", title: "Service providers" },
        { id: "retention", title: "How long we keep it" },
        { id: "waitlist", title: "Keeping the waitlist" },
        { id: "choices", title: "Your choices" },
        { id: "complaints", title: "Complaints" },
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
        These services receive personal information so the site and the product can work. Some of
        them are in the United States, so your information may be handled there.
      </p>
      <p>
        Vercel hosts the site. The server code that handles a request, such as saving your email to
        the list, runs in Vercel&apos;s Washington DC region in the United States.
      </p>
      <p>
        Supabase stores the database and sends sign-in emails. The database is in Sydney,
        Australia.
      </p>
      <p>
        Resend sends our emails to you, such as the welcome email when you join the list, so it
        receives your email address. Resend is based in the United States.
      </p>
      <p>
        Anthropic (Claude) reads an enquiry to help prepare a response, where AI-assisted
        interpretation is enabled. This is processed in the United States. Enquiry and business
        context is sent to Anthropic only to prepare a response, and customer messages are not used
        to train models. Not every deployment or feature has AI processing enabled.
      </p>
      <p>
        Stripe will take payments once they open. Payments are not open yet. When they are, card
        details go to Stripe, not to us.
      </p>
      <p>
        Roadmap feedback, including an email address if you leave one, is forwarded to the founder
        through a private notification service so a person reads it.
      </p>
      <h2 id="retention">How long we keep it</h2>
      <p>
        Waitlist records are kept until you ask us to remove them or the early-access programme
        ends. You can remove yourself straight away with the unsubscribe link in any email from us,
        or with &quot;Remove me from the list&quot; on the early-access page. Workspace information
        is kept while your account is active and removed within 30 days of a deletion request,
        apart from records we must keep to show what actions were recorded and by whom. To ask for
        deletion, email the address below.
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
        <a
          href={SUPPORT_MAILTO}
          className="font-medium text-ink underline-offset-4 hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>{" "}
        from the address you joined with. You can also just not join.
      </p>
      <h2 id="complaints">Complaints</h2>
      <p>
        If you are unhappy with how we have handled your information, email{" "}
        <a
          href={SUPPORT_MAILTO}
          className="font-medium text-ink underline-offset-4 hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>{" "}
        first so we can put it right. If you are not satisfied with our answer, you can complain to
        the Office of the Australian Information Commissioner at{" "}
        <a
          href="https://www.oaic.gov.au"
          className="font-medium text-ink underline-offset-4 hover:underline"
        >
          www.oaic.gov.au
        </a>
        .
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
