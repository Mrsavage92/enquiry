import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Enquiry } from "@/domain/types";
import { nextNeedsYou } from "@/domain/labels";
import { SEND_TEXT } from "@/domain/send-flow";
import { usePrototype } from "@/store/prototype-store";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { useDeletePractice } from "@/lib/workspace/use-delete-practice";
import type { Recorded } from "./send-bar";
import { ownerError } from "@/lib/owner-error";

/**
 * After Yes: "Recorded as sent by you." with an Undo link, and the next step
 * the owner chooses - never an automatic jump (doc 50 section 6). The screen
 * stays here until they tap Next or leave; on the next visit it is Waiting,
 * with the lasting Undo there instead.
 */
export function RecordedBar({
  enquiry,
  recorded,
  onUndone,
  onDone,
}: {
  enquiry: Enquiry;
  recorded: Recorded;
  onUndone: () => void;
  onDone?: () => void;
}) {
  const actions = useFirstBetaActions();
  const voiceNotice = usePrototype((s) => s.voiceNotice);
  const decideVoice = usePrototype((s) => s.decideVoice);
  const businessFilter = usePrototype((s) => s.businessFilter);
  const nextId = usePrototype((s) => nextNeedsYou(s.enquiries, businessFilter, enquiry.id));
  const nextName = usePrototype((s) => s.enquiries.find((e) => e.id === nextId)?.customerName);
  const { remove, deleting } = useDeletePractice();
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageId = recorded.messageId;

  return (
    <div className="laser-bar" role="status">
      <p className="laser-bar-line">
        {recorded.practice
          ? SEND_TEXT.practiceEnd
          : nextId
            ? SEND_TEXT.recorded
            : `${SEND_TEXT.recorded} ${SEND_TEXT.allDone}`}
        {messageId && !recorded.duplicate ? (
          <button
            type="button"
            className="laser-link laser-copy-again"
            disabled={undoing}
            onClick={() => {
              setUndoing(true);
              setError(null);
              void actions
                .undoSend(enquiry.id, messageId)
                .then((res) => {
                  if (res.ok) onUndone();
                  else setError(res.message ?? "Could not undo that send record.");
                })
                .catch((err: unknown) => setError(ownerError(err)))
                .finally(() => setUndoing(false));
            }}
          >
            {undoing ? "Undoing..." : "Undo"}
          </button>
        ) : null}
      </p>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {voiceNotice?.enquiryId === enquiry.id ? (
        <div className="laser-voice">
          <p className="text-sm text-ink">Keep &ldquo;{voiceNotice.to}&rdquo; for next time?</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-11" onClick={() => decideVoice("teach")}>
              Yes
            </Button>
            <Button variant="secondary" className="min-h-11" onClick={() => decideVoice("enquiry")}>
              Just this once
            </Button>
          </div>
        </div>
      ) : null}
      <div className="laser-bar-actions">
        <Button className="laser-bar-button" onClick={onDone}>
          {nextId && nextName && !recorded.practice ? `Next: ${nextName}` : "Back to Today"}
        </Button>
        {recorded.practice ? (
          <Button
            variant="secondary"
            className="laser-bar-button"
            disabled={deleting}
            onClick={() => void remove(enquiry.id)}
          >
            Delete it
          </Button>
        ) : null}
      </div>
    </div>
  );
}
