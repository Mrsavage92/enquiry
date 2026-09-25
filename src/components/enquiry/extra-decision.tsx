import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { EXTRA_CHOICE } from "@/domain/extras";
import { formatMinorAud } from "@/domain/money-format";
import type { Enquiry } from "@/domain/types";

/**
 * Something else the customer asked for, beside the main job: "plus oven
 * please". The owner either adds it to the quote or leaves it out, and a
 * left-out extra puts an honest line in the reply. Until one of those happens
 * nothing is ready to send, so no total can quietly drop it.
 *
 * With no saved price for it, adding a price is the main step (the footer's
 * link to pricing); this offers the other way forward.
 */
export function ExtraDecision({ enquiry }: { enquiry: Enquiry }) {
  const extra = enquiry.decision.extraPending;
  const actions = useFirstBetaActions();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!extra) return null;

  const choose = async (choice: string) => {
    setSaving(choice);
    setError(null);
    try {
      await actions.answerFact(enquiry.id, extra.field, choice);
      toast.dismiss();
      toast.success(
        choice === EXTRA_CHOICE.include
          ? `Added ${extra.label.toLowerCase()} to the quote.`
          : choice === EXTRA_CHOICE.notAsked
            ? "Removed. Nothing about it goes in the reply."
            : `Left out. The reply tells them ${extra.label.toLowerCase()} is not included.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that. Try again.");
    } finally {
      setSaving(null);
    }
  };

  const price = typeof extra.amountMinor === "number" ? formatMinorAud(extra.amountMinor) : null;
  return (
    <div className="mt-3">
      {extra.span ? (
        <p className="text-sm leading-relaxed text-ink">From their message: “{extra.span}”.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {extra.kind === "check" ? (
          <Button
            className="min-h-11"
            disabled={saving !== null}
            onClick={() => void choose(EXTRA_CHOICE.include)}
          >
            {saving === EXTRA_CHOICE.include
              ? "Adding…"
              : price
                ? `Add it - ${price}`
                : "Add it to the quote"}
          </Button>
        ) : null}
        <Button
          className="min-h-11"
          variant="secondary"
          disabled={saving !== null}
          onClick={() => void choose(EXTRA_CHOICE.leaveOut)}
        >
          {saving === EXTRA_CHOICE.leaveOut ? "Saving…" : "Leave it out and tell them"}
        </Button>
        <Button
          className="min-h-11"
          variant="ghost"
          disabled={saving !== null}
          onClick={() => void choose(EXTRA_CHOICE.notAsked)}
        >
          {saving === EXTRA_CHOICE.notAsked ? "Saving…" : "They didn't ask for this"}
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
