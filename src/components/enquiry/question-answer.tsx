import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { QUESTION_ANSWER } from "@/domain/service-questions";
import { ASK_CHOICE } from "@/domain/customer-asks";
import type { QuestionPending } from "@/domain/decide";
import type { Enquiry } from "@/domain/types";

/**
 * A question they asked, answered before any reply is ready: "Do you do mould
 * removal?" (Yes / No, read as No when the owner said they don't offer it),
 * "r u free this sat or sun?" (Yes / No / come back to them) and anything else
 * ("do you have insurance?"), answered once in the owner's own words - kept
 * for the next customer who asks. Nothing is "reply ready" while one is open.
 */
export function QuestionAnswer({ enquiry }: { enquiry: Enquiry }) {
  const question = enquiry.decision.questionPending;
  const actions = useFirstBetaActions();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!question) return null;

  const answer = async (value: string, done: string) => {
    setSaving(value);
    setError(null);
    try {
      await actions.answerFact(enquiry.id, question.field, value);
      toast.dismiss();
      toast.success(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that. Try again.");
    } finally {
      setSaving(null);
    }
  };
  const props = { question, saving, answer };
  return (
    <div className="mt-3" data-testid="question-answer">
      {question.kind === "availability" ? (
        <AvailabilityAnswer {...props} />
      ) : question.kind === "ask" ? (
        <AskAnswer key={question.field} {...props} />
      ) : (
        <ServiceAnswer {...props} />
      )}
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Props = {
  question: QuestionPending;
  saving: string | null;
  answer: (value: string, done: string) => Promise<void>;
};

function Choice({
  value,
  label,
  primary,
  props,
  done,
}: {
  value: string;
  label: string;
  primary: boolean;
  props: Props;
  done: string;
}) {
  return (
    <Button
      className="min-h-11"
      variant={primary ? "primary" : "secondary"}
      disabled={props.saving !== null}
      onClick={() => void props.answer(value, done)}
    >
      {props.saving === value ? "Saving…" : label}
    </Button>
  );
}

function ServiceAnswer(props: Props) {
  const { question } = props;
  const readNo = question.readAs === "no";
  const yes = (
    <Choice
      key="yes"
      value={QUESTION_ANSWER.yes}
      label={`Yes, I do ${question.thing}`}
      primary={!readNo}
      props={props}
      done={`The reply says you can help with ${question.thing} and will come back with a price.`}
    />
  );
  const no = (
    <Choice
      key="no"
      value={QUESTION_ANSWER.no}
      label={`No, I don't do ${question.thing}`}
      primary={readNo}
      props={props}
      done={`The reply tells them you don't do ${question.thing}.`}
    />
  );
  return (
    <>
      <p className="text-sm leading-relaxed text-ink">
        They asked if you do {question.thing}
        {question.span ? `: “${question.span}”` : "."}
      </p>
      {readNo ? (
        <p className="mt-1 text-sm text-ink-2">
          No -{" "}
          {question.said
            ? question.said.charAt(0).toLowerCase() + question.said.slice(1)
            : `you don't offer ${question.thing}`}{" "}
          (from your business details). Check and confirm.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">{readNo ? [no, yes] : [yes, no]}</div>
    </>
  );
}

function AvailabilityAnswer(props: Props) {
  const { question } = props;
  const when = question.when ? ` ${question.when}` : "";
  const readNo = question.readAs === "no";
  return (
    <>
      <p className="text-sm leading-relaxed text-ink">
        They asked if you&apos;re free{when}
        {question.span ? `: “${question.span}”` : "."}
      </p>
      {readNo && question.said ? (
        <p className="mt-1 text-sm text-ink-2">
          No - {question.said.charAt(0).toLowerCase() + question.said.slice(1)} (from your business
          details). Check and confirm.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Choice
          value={ASK_CHOICE.yes}
          label="Yes, I'm free"
          primary={!readNo}
          props={props}
          done="The reply tells them you're available."
        />
        <Choice
          value={ASK_CHOICE.no}
          label="No"
          primary={readNo}
          props={props}
          done="The reply tells them you're not available then."
        />
        <Choice
          value={ASK_CHOICE.later}
          label="Come back to them"
          primary={false}
          props={props}
          done="The reply says you'll check and come back to them."
        />
      </div>
    </>
  );
}

function AskAnswer(props: Props) {
  const { question } = props;
  const id = useId();
  const [text, setText] = useState(question.saved ?? "");
  const typed = text.trim();
  return (
    <>
      <p className="text-sm leading-relaxed text-ink">
        They asked: {question.span ? `“${question.span}”` : question.thing}
      </p>
      {question.saved ? (
        <div className="mt-3">
          <p className="text-sm text-ink-2">Your saved answer: “{question.saved}”</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice
              value={question.saved}
              label="Use this answer"
              primary
              props={props}
              done="The reply carries your answer."
            />
          </div>
        </div>
      ) : null}
      <label className="mt-3 block text-sm" htmlFor={id}>
        <span className="text-ink-2">
          {question.saved ? "Or write a new answer" : "Your answer, in a sentence"} - kept for the
          next customer who asks
        </span>
      </label>
      <textarea
        id={id}
        className="field mt-1.5 leading-relaxed"
        rows={2}
        value={text}
        placeholder="e.g. Yes, I'm fully insured."
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {typed && typed !== question.saved ? (
          <Choice
            value={typed}
            label="Use my answer"
            primary={!question.saved}
            props={props}
            done="The reply carries your answer. It's saved for next time."
          />
        ) : null}
        <Choice
          value={ASK_CHOICE.later}
          label="Come back to them"
          primary={false}
          props={props}
          done="The reply says you'll come back to them on it."
        />
        <Choice
          value={ASK_CHOICE.ignore}
          label="Leave it out"
          primary={false}
          props={props}
          done="Nothing about it goes in the reply."
        />
      </div>
    </>
  );
}
