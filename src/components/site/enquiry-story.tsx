import { ArrowRight, CalendarDays, MessageSquareText, ShieldCheck, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { RIDGE_CREW_WINDOW_RULE, SIGNATURE_DEMO } from "@/lib/site/signature-demo";

export function EnquiryStory({ compact = false }: { compact?: boolean }) {
  const Heading = compact ? "h3" : "h2";
  return (
    <div className={`enquiry-story ${compact ? "enquiry-story-compact" : ""}`}>
      <div className="story-caption">
        <span className="story-avatar" aria-hidden="true">
          MC
        </span>
        <span>
          <strong>Maya's painting enquiry</strong>
          <small>Sample conversation · Ridge & Co Painting</small>
        </span>
      </div>
      <ol className="story-sequence">
        <li>
          <div className="story-chapter">
            <span className="story-number">01</span>
            <div>
              <Heading>A customer gets in touch.</Heading>
              <p>One place for the request and the details that matter.</p>
            </div>
          </div>
          <div className="story-message">
            <div className="story-message-meta">
              <MessageSquareText size={17} aria-hidden="true" />
              <span>{SIGNATURE_DEMO.form.channel}</span>
              <time>{SIGNATURE_DEMO.form.at}</time>
            </div>
            <blockquote>{SIGNATURE_DEMO.form.message}</blockquote>
            <span className="story-byline">{SIGNATURE_DEMO.customer}</span>
          </div>
        </li>
        <li>
          <div className="story-chapter">
            <span className="story-number">02</span>
            <div>
              <Heading>The details change.</Heading>
              <p>A shorter window. More work. This is no longer the same job.</p>
            </div>
          </div>
          <div className="story-change">
            <blockquote>{SIGNATURE_DEMO.text.message}</blockquote>
            <dl>
              <div>
                <dt>
                  <CalendarDays size={17} aria-hidden="true" />
                  Working window
                </dt>
                <dd>
                  <del>5 weekdays</del>
                  <ArrowRight size={15} aria-hidden="true" />
                  <strong>3 weekdays</strong>
                </dd>
              </div>
              <div>
                <dt>
                  <MessageSquareText size={17} aria-hidden="true" />
                  Scope
                </dt>
                <dd>
                  <strong>Ceilings added</strong>
                </dd>
              </div>
            </dl>
            <p className="story-unknowns">
              <strong>Still to confirm</strong>
              Site measure · crew availability · final price
            </p>
          </div>
        </li>
        <li>
          <div className="story-chapter">
            <span className="story-number">03</span>
            <div>
              <Heading>So does the next step.</Heading>
              <p>Your business context changes the recommendation, not just the wording.</p>
            </div>
          </div>
          <div className="story-next">
            <span className="story-next-label">
              <Users size={18} aria-hidden="true" />
              Extra crew needs confirming
            </span>
            <h3>{SIGNATURE_DEMO.text.nextAction}</h3>
            <p>
              Availability and the final price still need confirming. Nothing has been sent or
              booked.
            </p>
            {!compact ? (
              <details>
                <summary>
                  <ShieldCheck size={16} aria-hidden="true" />
                  Why this step?
                </summary>
                <p>{RIDGE_CREW_WINDOW_RULE.body}</p>
              </details>
            ) : null}
          </div>
        </li>
      </ol>
      <div className="story-ending">
        <p>The conversation moves. The context stays with it.</p>
        <Link to="/demo" className="public-text-link">
          Explore the sample <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
