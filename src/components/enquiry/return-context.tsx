import type { Enquiry } from "@/domain/types";
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
        <div className="return-context-changes">
          <h2>What changed</h2>
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
        </div>
      ) : null}
    </section>
  );
}
