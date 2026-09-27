import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { QUESTION_ANSWER } from "@/domain/service-questions";
import type { Enquiry } from "@/domain/types";

/**
 * "Do you do mould removal?": the owner answers Yes or No, and the reply says
 * so. Read as "No" when the owner saved "We don't do mould removal" - still
 * one tap to confirm. Nothing is "reply ready" while it is unanswered.
 */
export function QuestionAnswer({ enquiry }: { enquiry: Enquiry }) {
  const question = enquiry.decision.questionPending;
  const actions = useFirstBetaActions();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!question) return null;

  const answer = async (value: string) => {
    setSaving(value);
    setError(null);
    try {
      await actions.answerFact(enquiry.id, question.field, value);
      toast.dismiss();
      toast.success(
        value === QUESTION_ANSWER.no
          ? `The reply tells them you don't do ${question.thing}.`
          : `The reply says you can help with ${question.thing} and will come back with a price.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that. Try again.");
    } finally {
      setSaving(null);
    }
  };

  const yes = (
    <Button
      key="yes"
      className="min-h-11"
      variant={question.readAs === "no" ? "secondary" : "primary"}
      disabled={saving !== null}
      onClick={() => void answer(QUESTION_ANSWER.yes)}
    >
      {saving === QUESTION_ANSWER.yes ? "Saving…" : `Yes, I do ${question.thing}`}
    </Button>
  );
  const no = (
    <Button
      key="no"
      className="min-h-11"
      variant={question.readAs === "no" ? "primary" : "secondary"}
      disabled={saving !== null}
      onClick={() => void answer(QUESTION_ANSWER.no)}
    >
      {saving === QUESTION_ANSWER.no ? "Saving…" : `No, I don't do ${question.thing}`}
    </Button>
  );
  return (
    <div className="mt-3" data-testid="question-answer">
      <p className="text-sm leading-relaxed text-ink">
        They asked if you do {question.thing}
        {question.span ? `: “${question.span}”` : "."}
      </p>
      {question.readAs === "no" ? (
        <p className="mt-1 text-sm text-ink-2">
          No -{" "}
          {question.said
            ? question.said.charAt(0).toLowerCase() + question.said.slice(1)
            : `you don't offer ${question.thing}`}{" "}
          (from your business details). Check and confirm.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {question.readAs === "no" ? [no, yes] : [yes, no]}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
