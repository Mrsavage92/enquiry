import { useState } from "react";
import type { Enquiry } from "@/domain/types";
import { WaitingSummary } from "../waiting-summary";
import { WaitingDesk } from "../waiting-desk";
import { isWaitingForInformation, isWaitingOnCustomer } from "../reply-presentation";

/**
 * Waiting on the customer, with nothing to send (doc 50 section 6): who and
 * what for, what you sent (first three lines, the rest in place), the lasting
 * Undo, and the waiting actions, unchanged.
 */
export function WaitingView({ enquiry, onDone }: { enquiry: Enquiry; onDone?: () => void }) {
  const [all, setAll] = useState(false);
  const sent = [...enquiry.conversation].reverse().find((m) => m.direction === "outbound");
  const lines = sent?.body.trim().split("\n") ?? [];
  const waiting = isWaitingOnCustomer(enquiry);
  return (
    <section className="laser-waiting" aria-label="Waiting on the customer">
      {waiting ? <WaitingSummary enquiry={enquiry} /> : null}
      {sent ? (
        <div className="laser-sent">
          <p className="laser-reply-label">
            {isWaitingForInformation(enquiry) ? "What you asked them" : "What you sent"}
          </p>
          <p className="laser-sent-text" data-count="customer">
            {all ? sent.body.trim() : lines.slice(0, 3).join("\n")}
          </p>
          {!all && lines.length > 3 ? (
            <button type="button" className="laser-link" onClick={() => setAll(true)}>
              Show all
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="laser-waiting-actions">
        <WaitingDesk enquiry={enquiry} onDone={onDone} />
      </div>
    </section>
  );
}
