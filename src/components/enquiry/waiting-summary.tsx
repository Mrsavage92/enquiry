import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sentQuoteAmount, waitingForPhrase } from "@/domain/labels";
import { decidingPhrase } from "@/domain/price-compiler";
import { comesBackCue, lastSent } from "@/domain/time-cues";
import { firstName, sentence } from "@/domain/customer-name";
import { undoableSend } from "@/domain/send-undo-window";
import type { Enquiry } from "@/domain/types";
import { usePrototype } from "@/store/prototype-store";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { AnswerBlocker } from "./answer-blocker";

/**
 * Undo "I've sent this" from the enquiry itself, for as long as the server
 * allows it. The toast's Undo is gone in seconds; an owner who notices the
 * mis-tap a few minutes later still has a way back. Disappears when the
 * window closes.
 */
export function LastingUndo({ enquiry }: { enquiry: Enquiry }) {
  const actions = useFirstBetaActions();
  const [, setTick] = useState(0);
  const [working, setWorking] = useState(false);
  const undo = undoableSend(enquiry, Date.now());
  const messageId = undo?.messageId;

  useEffect(() => {
    const open = undoableSend(enquiry, Date.now());
    if (!open) return;
    // Re-render once, at the moment the server's window closes.
    const t = window.setTimeout(() => setTick((n) => n + 1), open.msLeft + 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  if (!undo) return null;
  return (
    <button
      type="button"
      className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-mark-strong underline-offset-4 hover:underline"
      disabled={working}
      onClick={() => {
        setWorking(true);
        void actions
          .undoSend(enquiry.id, undo.messageId)
          .then((res) => {
            if (res.ok) toast("Send record removed. The reply is ready to check again.");
            else toast.error(res.message ?? "Could not undo that send record.");
          })
          .catch((err: unknown) =>
            toast.error(err instanceof Error ? err.message : "Could not undo that send record."),
          )
          .finally(() => setWorking(false));
      }}
    >
      {working ? "Undoing…" : "Undo “I’ve sent this”"}
    </button>
  );
}

/**
 * The top of a waiting enquiry on the phone: who you are waiting on, for what,
 * and the day it comes back to you. It used to sit at the bottom, under the
 * full sent reply, where the "Recorded as sent" toast covered it - so the one
 * thing an interrupted owner needs to know was the one thing out of sight.
 */
export function WaitingSummary({ enquiry }: { enquiry: Enquiry }) {
  const prefs = usePrototype((s) => s.prefs);
  const demoMode = usePrototype((s) => s.demoMode);
  const first = firstName(enquiry);
  const sent = lastSent(enquiry, new Date(), prefs.timezone || undefined);
  const waitingFor = enquiry.decision.missing.find((m) => m.blocking)?.label;
  const phrase = waitingFor ? decidingPhrase(waitingFor.toLowerCase()) : null;
  const amount = sentQuoteAmount(enquiry);
  return (
    <section
      className="border-b border-line bg-raised px-5 py-4"
      aria-label="Waiting on the customer"
    >
      <p className="text-base font-semibold text-ink">{sentence(`Waiting on ${first}`)}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        {amount
          ? `For their answer to your ${amount} quote.`
          : sentence(`for ${waitingForPhrase(enquiry)}.`)}{" "}
        {comesBackCue(enquiry, prefs)}
      </p>
      {sent ? <p className="mt-1 text-sm text-ink-2">You sent it {sent.when}.</p> : null}
      {demoMode ? null : <LastingUndo enquiry={enquiry} />}
      {phrase && !demoMode ? (
        <AnswerBlocker
          enquiry={enquiry}
          folded
          summary={sentence(`${first} answered? Enter ${phrase}`)}
        />
      ) : null}
    </section>
  );
}
