import { createFileRoute, Link } from "@tanstack/react-router";
import { socialHead } from "@/lib/site/head";
import { LegalLayout } from "@/components/site/legal-layout";

export const Route = createFileRoute("/terms")({
  component: Terms,
  head: () =>
    socialHead({
      path: "/terms",
      title: "Terms · Enquiry",
      description:
        "Terms for the Enquiry website, waitlist, sample demo and early-access workspaces.",
    }),
});

function Terms() {
  return (
    <LegalLayout
      title="Terms"
      sections={[
        { id: "waitlist", title: "The waitlist" },
        { id: "workspace", title: "Demo and workspace" },
        { id: "changes", title: "Product changes" },
        { id: "acceptable-use", title: "Acceptable use" },
        { id: "liability", title: "Liability" },
      ]}
    >
      <p>
        These terms cover this website, the early-access list, the sample demo and invited
        early-access use of Enquiry. Some capabilities are still being developed.
      </p>
      <h2 id="waitlist">The waitlist</h2>
      <p>
        Joining early access is a request, not a purchase and not a guarantee of a place. We invite
        businesses in small groups as the product is ready. Enquiry is intended to become a paid
        product. The founding offer is 30% off the first 12 months once billing begins; final plan
        prices have not been announced. Joining the list does not create a paid subscription.
      </p>
      <h2 id="workspace">The demo and your workspace</h2>
      <p>
        The public demo uses sample enquiries and does not send messages to real customers. It is
        separate from a signed-in business workspace, where information is stored on the server. Do
        not put real customer information into a sample workspace.
      </p>
      <p>
        In your workspace, review prepared replies, prices and booking details before taking action.
        Copying a reply or recording an action is not proof of delivery. You are responsible for the
        information you provide and for the messages you actually send. Keep independent records of
        important commitments during early access.
      </p>
      <h2 id="changes">The product will change</h2>
      <p>
        Features, access, and this site will move. The public roadmap is direction, not a delivery
        contract. We may pause or close early access.
      </p>
      <h2 id="acceptable-use">Acceptable use</h2>
      <p>
        Don’t abuse the waitlist, scrape the site, or treat sample customers as real people to
        contact. The names in the prototype are fixtures.
      </p>
      <h2 id="liability">Liability</h2>
      <p>
        The site and prototype are provided as-is while we build. To the extent Australian law
        allows, we are not liable for decisions you make from the demonstration. Nothing here limits
        rights you cannot waive.
      </p>
      <p>
        <Link to="/privacy" className="font-medium text-ink underline-offset-4 hover:underline">
          Privacy
        </Link>{" "}
        explains the waitlist. Questions belong on a reply to any Enquiry email we send you.
      </p>
    </LegalLayout>
  );
}
