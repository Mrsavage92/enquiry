import { decidingPhrase } from "@/domain/price-compiler";
import { comesBackCue, lastSent } from "@/domain/time-cues";
import type { Enquiry } from "@/domain/types";
import { usePrototype } from "@/store/prototype-store";
import { AnswerBlocker } from "./answer-blocker";

/**
 * The top of a waiting enquiry on the phone: who you are waiting on, for what,
 * and the day it comes back to you. It used to sit at the bottom, under the
 * full sent reply, where the "Recorded as sent" toast covered it - so the one
 * thing an interrupted owner needs to know was the one thing out of sight.
 */
export function WaitingSummary({ enquiry }: { enquiry: Enquiry }) {
  const prefs = usePrototype((s) => s.prefs);
  const demoMode = usePrototype((s) => s.demoMode);
  const first = enquiry.customerName.split(/\s+/)[0] || "the customer";
  const sent = lastSent(enquiry, new Date(), prefs.timezone || undefined);
  const waitingFor = enquiry.decision.missing.find((m) => m.blocking)?.label;
  const phrase = waitingFor ? decidingPhrase(waitingFor.toLowerCase()) : null;
  const quoted = enquiry.state.commercial === "QUOTED" || enquiry.state.commercial === "ESTIMATED";
  const what = phrase
    ? `For ${phrase}.`
    : quoted
      ? "For their answer to your quote."
      : "For their answer.";
  return (
    <section
      className="border-b border-line bg-raised px-5 py-4"
      aria-label="Waiting on the customer"
    >
      <p className="text-base font-semibold text-ink">Waiting on {first}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        {what} {comesBackCue(enquiry, prefs)}
      </p>
      {sent ? <p className="mt-1 text-sm text-stone">You sent your reply {sent.when}.</p> : null}
      {phrase && !demoMode ? (
        <AnswerBlocker enquiry={enquiry} folded summary={`${first} answered? Enter ${phrase}`} />
      ) : null}
    </section>
  );
}
