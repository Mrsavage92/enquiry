import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Inbox,
  Mail,
  MessageSquareText,
  Settings2,
} from "lucide-react";
import { socialHead } from "@/lib/site/head";
import { SiteShell } from "@/components/site/site-shell";
import { ProductShowcase } from "@/components/site/product-showcase";
import { EarlyAccessInvite } from "@/components/site/early-access-invite";
import { EnquiryStory } from "@/components/site/enquiry-story";
import { BrandHero } from "@/components/site/brand-hero";
import { CrossMark } from "@/components/site/cross-mark";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site/contact";

type HomeSearch = { view?: "today" | "enquiry" | "business" };

export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: (search: Record<string, unknown>): HomeSearch =>
    search.view === "today" || search.view === "enquiry" || search.view === "business"
      ? { view: search.view }
      : {},
  head: () =>
    socialHead({
      path: "/",
      title: "Enquiry - know what you can safely promise before you reply",
      description:
        "Enquiry checks each customer request against how your business works, asks only for the detail that would change the answer, and prepares the reply for you to send. Join early access.",
    }),
});

const QUESTION_GROUPS = [
  {
    title: "About early access",
    items: [
      [
        "Who is Enquiry for?",
        "Owner-run service businesses: the people answering customers, organising the work and making the final call. Early access is opening in small groups so we can learn from real workflows.",
      ],
      [
        "What does joining early access mean?",
        "It puts you on the list for an invitation, not into a paid subscription. Invited businesses get a 20-minute setup call and the founding offer: 30% off your first 12 months once billing begins, with at least 30 days of notice before anyone pays. Final plan prices and access timing are not yet announced.",
      ],
      [
        "What does it cost?",
        "Indicative pricing is A$29-49 per month inc GST, and founding members keep 30% off for the first 12 months. It is provisional: the final figure is confirmed in writing before any paid access begins, with at least 30 days of notice.",
      ],
      [
        "What if I decide not to continue?",
        `Nothing is charged and nothing needs cancelling. Joining the list creates no account or subscription. If early access is not for you, reply to any email from us or write to ${SUPPORT_EMAIL} and we remove you.`,
      ],
    ],
  },
  {
    title: "About how it works",
    items: [
      [
        "Will it connect to my email and messages?",
        "Early access starts with you bringing the enquiry and new messages into Enquiry. Connected channels are on the roadmap. The demo shows a sample conversation, not a live connection to your inbox.",
      ],
      [
        "Does Enquiry send replies for me?",
        "You review the prepared reply. Copying a reply is not sending it, and recording an action is not delivery. Enquiry keeps those states separate; it does not silently send a message on your behalf.",
      ],
      [
        "What if a price or date is uncertain?",
        "The uncertainty stays visible. Enquiry can prepare a question or flag a detail for you to check instead of presenting an unsupported price or availability as confirmed.",
      ],
    ],
  },
] as const;

function Home() {
  const { view } = Route.useSearch();
  return (
    <SiteShell>
      <BrandHero />
      <ProductShowcase initialView={view} />
      <section className="public-section public-container" aria-labelledby="work-title">
        <div className="public-section-heading">
          <p className="public-kicker">Before you promise anything</p>
          <h2 id="work-title">
            Yes. No. Not yet.
            <br />
            Know before you reply.
          </h2>
          <p>
            Replying quickly is the easy part. Knowing what you can safely say is the hard part, and
            it is the part Enquiry does first.
          </p>
        </div>
        <div className="public-benefits">
          {[
            {
              icon: Inbox,
              title: "Not yet is a real answer",
              body: "If a price or a date cannot be decided yet, it says so and shows why, instead of putting an unsupported number in front of a customer.",
              tone: "violet",
            },
            {
              icon: MessageSquareText,
              title: "Only asks what changes the answer",
              body: "It works out which missing detail actually moves the price, the date or whether you can do the job, and asks for that one. Nothing else.",
              tone: "rose",
            },
            {
              icon: Settings2,
              title: "Your rules decide, not a script",
              body: "Your services, prices and policies do the checking. The same message can get a different correct answer at a different business.",
              tone: "green",
            },
          ].map(({ icon: Icon, title, body, tone }) => (
            <article key={title} className="public-benefit">
              <CrossMark position="top-start" />
              <CrossMark position="bottom-end" />
              <span className={`public-icon public-icon-${tone}`}>
                <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="public-workflow-band">
        <div className="public-container public-section">
          <div className="public-section-heading public-heading-row">
            <div>
              <p className="public-kicker">A conversation, not a pipeline</p>
              <h2>
                The details change.
                <br />
                So does what you can promise.
              </h2>
            </div>
            <Link to="/how" className="public-text-link">
              How it works <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <EnquiryStory compact />
          <p className="story-disclosure">
            An illustrative sample, not a connected inbox. Prepared does not mean sent. You stay in
            control of the customer conversation.
          </p>
        </div>
      </section>
      <section
        className="public-container public-section public-faq"
        aria-labelledby="questions-title"
      >
        <CrossMark position="top-start" />
        <CrossMark position="bottom-end" />
        <div className="public-section-heading public-faq-intro">
          <span className="public-icon public-icon-violet">
            <CalendarDays size={23} aria-hidden="true" />
          </span>
          <h2 id="questions-title">Before you join.</h2>
          <p>A few things worth knowing about early access.</p>
          <div className="public-faq-contact">
            <span className="public-icon public-icon-violet" aria-hidden="true">
              <Mail size={20} strokeWidth={1.7} />
            </span>
            <div>
              <strong>Something not covered?</strong>
              <p>
                Questions go to a person, not a queue. <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>
              </p>
            </div>
          </div>
        </div>
        <div className="public-faq-list">
          {QUESTION_GROUPS.map((group) => (
            <div key={group.title} className="public-faq-group">
              <h3>{group.title}</h3>
              {group.items.map(([question, answer]) => (
                <details
                  key={question}
                  id={question
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")}
                >
                  <summary>
                    {question}
                    <ChevronDown size={19} aria-hidden="true" />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          ))}
        </div>
      </section>
      <EarlyAccessInvite />
    </SiteShell>
  );
}
