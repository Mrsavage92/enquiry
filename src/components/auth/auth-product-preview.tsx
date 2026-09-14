import {
  CalendarDays,
  FlaskConical,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Store,
} from "lucide-react";
import { UI1_PAINTING } from "@/fixtures/ui1-painting";

// Read-only, authored sample. This never mounts a live workspace or auth session.
export function AuthProductPreview() {
  const sample = UI1_PAINTING;
  const message = sample.conversation.at(-1);
  const replyExcerpt = sample.decision.draft?.body.split("\n\n").slice(2, 4).join("\n\n");
  return (
    <aside className="auth-product" aria-label="Sample enquiry preview">
      <p className="auth-product-label">
        <FlaskConical size={15} aria-hidden="true" />
        Sample workspace - not your data.
      </p>
      <div className="auth-product-window">
        <div className="auth-product-rail" aria-hidden="true">
          <span className="auth-product-dot" />
          <LayoutDashboard size={19} />
          <span className="auth-product-selected">
            <Inbox size={19} />
          </span>
          <CalendarDays size={19} />
          <Store size={19} />
        </div>
        <div className="auth-product-case">
          <header className="auth-product-customer">
            <span className="auth-product-avatar" aria-hidden="true">
              MC
            </span>
            <div>
              <h2>{sample.customerName}</h2>
              <p>{sample.serviceLabel}</p>
            </div>
            <span className="auth-product-status">Needs you</span>
          </header>
          <div className="auth-product-thread">
            <div className="auth-product-message-meta">
              <span>{sample.customerName}</span>
              <span>Nothing sent</span>
            </div>
            <blockquote className="auth-product-message">{message?.body}</blockquote>
            <section className="auth-product-next">
              <p className="auth-product-section-label">Suggested next step</p>
              <h3>{sample.decision.recommendation.label}</h3>
              <p>{sample.decision.recommendation.reason}</p>
            </section>
            <section className="auth-product-draft">
              <p className="auth-product-section-label">
                <MessageSquare size={15} aria-hidden="true" />
                Prepared reply excerpt
              </p>
              <p>{replyExcerpt}</p>
            </section>
          </div>
        </div>
      </div>
    </aside>
  );
}
