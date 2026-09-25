import { ArrowRight, CalendarDays, MessageSquareText, ShieldCheck, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { RIDGE_CREW_WINDOW_RULE } from "@/lib/site/signature-demo";
import { useSignatureDemo } from "@/lib/site/use-signature-demo";

const STAGES = [
  { title: "The initial enquiry", detail: "Maya gets in touch about painting her new home." },
  {
    title: "The details change",
    detail: "Fewer days. Ceilings added. Still the same conversation.",
  },
  {
    title: "Keep the bigger picture",
    detail: "The request meets your services, rules and working day.",
  },
  {
    title: "What you can promise",
    detail: "One detail still decides it. Check that before committing.",
  },
];

export function EnquiryStory({ compact = false }: { compact?: boolean }) {
  const { demo } = useSignatureDemo();
  const Heading = compact ? "h3" : "h2";
  return (
    <div className={`enquiry-story ${compact ? "enquiry-story-compact" : ""}`}>
      <ol className="story-progress" aria-label="From enquiry to next step">
        {STAGES.map((stage, index) => (
          <li key={stage.title}>
            <span className="story-progress-track" aria-hidden="true">
              <span className="story-number">{index + 1}</span>
              {index < STAGES.length - 1 ? <ArrowRight size={14} /> : null}
            </span>
            <Heading>{stage.title}</Heading>
            <p>{stage.detail}</p>
          </li>
        ))}
      </ol>
      <div className="story-caption">
        <span className="story-avatar" aria-hidden="true">
          MC
        </span>
        <span>
          <strong>Maya's painting enquiry</strong>
          <small>Sample conversation · Ridge & Co Painting</small>
        </span>
      </div>
      <div className="story-surfaces">
        <article className="story-message">
          <div className="story-message-meta">
            <MessageSquareText size={16} aria-hidden="true" />
            <span>Original request · {demo.form.channel}</span>
          </div>
          <time>{demo.form.at}</time>
          <blockquote>{demo.form.message}</blockquote>
          <span className="story-byline">{demo.customer}</span>
        </article>
        <article className="story-message story-change">
          <div className="story-message-meta">
            <MessageSquareText size={16} aria-hidden="true" />
            <span>Follow-up · {demo.text.channel}</span>
          </div>
          <time>{demo.text.at}</time>
          <blockquote>{demo.text.message}</blockquote>
          <dl>
            <div>
              <dt>
                <CalendarDays size={15} aria-hidden="true" /> Window
              </dt>
              <dd>
                <del>5 weekdays</del>
                <ArrowRight size={13} aria-hidden="true" />
                <strong>3 weekdays</strong>
              </dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>
                <strong>Ceilings added</strong>
              </dd>
            </div>
          </dl>
        </article>
        <article className="story-next">
          <p className="story-verdict">
            <span>Verdict</span>
            <strong>{demo.text.verdict}.</strong>
          </p>
          <span className="story-next-label">
            <Users size={17} aria-hidden="true" /> Next step
          </span>
          <h3>{demo.text.nextAction}</h3>
          <p>
            Availability and the final price still need confirming. Nothing has been sent or booked.
          </p>
          {!compact ? (
            <details>
              <summary>
                <ShieldCheck size={16} aria-hidden="true" /> Why this step?
              </summary>
              <p>{RIDGE_CREW_WINDOW_RULE.body}</p>
            </details>
          ) : null}
          <Link to="/demo" className="public-button">
            Explore the sample <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </article>
      </div>
      <div className="story-ending">
        <ShieldCheck size={17} aria-hidden="true" />
        <p>The conversation moves. The context stays with it.</p>
      </div>
    </div>
  );
}
