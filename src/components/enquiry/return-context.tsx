import type { Enquiry } from "@/domain/types";
import { ChevronDown } from "lucide-react";
import { usePrototype } from "@/store/prototype-store";

export function ReturnContext({ enquiry }: { enquiry: Enquiry }) {
  const demoMode = usePrototype((s) => s.demoMode);
  const changes = enquiry.decision.changeDiff ?? [];
  const recorded =
    enquiry.conversation.some((message) => message.direction === "outbound") ||
    enquiry.decision.quotes.some((quote) => Boolean(quote.sentAt));
  return (
    <section className="enquiry-return-context" aria-label="Current enquiry context">
      <div className="return-context-status">
        <span>
          {recorded ? "Previous reply recorded" : demoMode ? "Nothing sent" : "No send recorded"}
        </span>
        {demoMode && enquiry.fixtureId === "UI1_PAINTING" ? (
          <span>Synthetic example · sample crew rule</span>
        ) : null}
      </div>
      {changes.length ? (
        <details className="return-context-changes">
          <summary>
            <span className="change-summary-copy">
              <strong>Plan updated</strong>
              <span>{changes.map((change) => change.to).join(" · ")}</span>
            </span>
            <span className="change-disclosure-label">View changes</span>
            <ChevronDown size={16} aria-hidden />
          </summary>
          <dl>
            {changes.map((change, index) => (
              <div key={`${change.factLabel}-${index}`}>
                <dt>{change.factLabel}</dt>
                <dd>
                  <span>{change.from}</span>
                  <span aria-hidden> → </span>
                  <strong>{change.to}</strong>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </section>
  );
}
