import { useState } from "react";
import { toast } from "sonner";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import type { Enquiry } from "@/domain/types";

/**
 * A name read from their sign-off is a reading: the reply says "Hi there,"
 * until the owner confirms it with one tap. A suburb or a job title read as a
 * name would otherwise have gone straight into the greeting.
 */
export function NameCheck({ enquiry }: { enquiry: Enquiry }) {
  const actions = useFirstBetaActions();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const read = enquiry.facts.find(
    (f) => !f.superseded && f.field.trim().toLowerCase() === "name" && f.status !== "confirmed",
  );
  if (!read || !String(read.value ?? "").trim()) return null;
  const name = String(read.value).trim();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-ink-2">
      <span>Name from their message: {name}.</span>
      <button
        type="button"
        className="inline-flex min-h-11 items-center font-medium text-mark-strong underline-offset-4 hover:underline"
        disabled={saving}
        onClick={() => {
          setSaving(true);
          setError(null);
          void actions
            .answerFact(enquiry.id, "name", name)
            .then(() => {
              toast.dismiss();
              toast.success(`The reply now greets ${name.split(/\s+/)[0]}.`);
            })
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : "Could not save that. Try again."),
            )
            .finally(() => setSaving(false));
        }}
      >
        {saving ? "Saving…" : "Use this name"}
      </button>
      {error ? (
        <span className="w-full text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
