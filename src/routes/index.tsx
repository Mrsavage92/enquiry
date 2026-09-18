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

export const Route = createFileRoute("/")({
  component: Home,
  head: () =>
    socialHead({
      path: "/",
      title: "Enquiry - a clearer next step for your business",
      description:
        "Keep customer enquiries moving. Bring the conversation together, prepare the next reply and stay in control. Join Enquiry early access.",
    }),
});

const QUESTIONS = [
  [
    "Who is Enquiry for?",
    "Owner-run service businesses: the people answering customers, organising the work and making the final call. Early access is opening in small groups so we can learn from real workflows.",
  ],
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
  [
    "What does joining early access mean?",
    "It puts you on the list for an invitation, not into a paid subscription. Invited businesses get a 20-minute setup call and the founding offer: 30% off your first 12 months once billing begins, with at least 30 days of notice before anyone pays. Final plan prices and access timing are not yet announced.",
  ],
] as const;

function Home() {
  return (
    <SiteShell>
      <BrandHero />
      <ProductShowcase />
      <section className="public-section public-container" aria-labelledby="work-title">
        <div className="public-section-heading">
          <p className="public-kicker">For the person who runs the business</p>
          <h2 id="work-title">
            Less piecing it together.
            <br />
            More moving it forward.
          </h2>
          <p>
            From the first question to the booked job, keep the conversation, the important details
            and the next step together.
          </p>
        </div>
        <div className="public-benefits">
          {[
            {
              icon: Inbox,
              title: "Know what needs you",
              body: "A focused daily view of enquiries needing attention and the bookings ahead.",
              tone: "violet",
            },
            {
              icon: MessageSquareText,
              title: "Start with a prepared reply",
              body: "Review a useful next step, with missing details and anything uncertain made clear.",
              tone: "rose",
            },
            {
              icon: Settings2,
              title: "Keep it true to your business",
              body: "Your services, pricing, policies and voice give each enquiry its context.",
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
                The next step should too.
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
                Questions go to a person, not a queue.{" "}
                <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>
              </p>
            </div>
          </div>
        </div>
        <div className="public-faq-list">
          {QUESTIONS.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={19} aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <EarlyAccessInvite />
    </SiteShell>
  );
}
