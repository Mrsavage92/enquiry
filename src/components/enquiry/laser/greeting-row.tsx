import { useState } from "react";
import type { Enquiry } from "@/domain/types";
import {
  GREETING_CHOICE,
  GREETING_FIELD,
  greetedFirst,
  greetingLine,
  nameSignals,
  signalWords,
} from "@/domain/greeting";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";

/**
 * Who the reply greets, on its own row above the reply so a tap meant for
 * editing never lands on it (doc 50 6.4, doc 51 decision 2). Greeted by a read
 * name: "Greeting: Tom (from sign-off and email) · Use Hi there". Not greeted
 * by it: "Greet as Tom?". Both are fact writes; the reply is composed again.
 */
export function GreetingRow({ enquiry, text }: { enquiry: Enquiry; text: string }) {
  const actions = useFirstBetaActions();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const read = enquiry.facts.find(
    (f) => !f.superseded && f.field.trim().toLowerCase() === "name" && f.status !== "confirmed",
  );
  const name = String(read?.value ?? "").trim();
  const first = greetedFirst(name);
  if (!read || !first) return null;
  const greeted = text.trimStart().startsWith(greetingLine(first));
  const choose = (value: string) => {
    setSaving(true);
    setError(null);
    void actions
      .answerFact(enquiry.id, GREETING_FIELD, value)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not change the greeting."),
      )
      .finally(() => setSaving(false));
  };
  const message = enquiry.conversation
    .filter((m) => m.direction === "inbound")
    .map((m) => m.body)
    .join("\n");
  const emails = enquiry.facts
    .filter((f) => !f.superseded && f.field.trim().toLowerCase() === "email")
    .map((f) => String(f.value ?? ""));
  const signals = nameSignals(name, { emails: [...emails, enquiry.customerEmail], message });
  return (
    <div className="laser-greeting" data-testid="greeting-row">
      {greeted ? (
        <>
          <span>
            Greeting: {first} (from {signalWords(signals)})
          </span>
          <span aria-hidden>·</span>
          <button
            type="button"
            className="laser-link"
            disabled={saving}
            onClick={() => choose(GREETING_CHOICE.there)}
          >
            Use Hi there
          </button>
        </>
      ) : (
        <button
          type="button"
          className="laser-link"
          disabled={saving}
          onClick={() => choose(GREETING_CHOICE.name)}
        >
          Greet as {first}?
        </button>
      )}
      {error ? (
        <span className="w-full text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
