import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import type { Enquiry } from "@/domain/types";

/**
 * Answer the one thing standing between this enquiry and a price.
 *
 * Enquiry is deliberately willing to say "I need the guest count" rather than
 * guess it - but that is only useful if the owner can then supply it. Without
 * this the honest refusal became a dead end, and a blocked enquiry stayed
 * blocked no matter what the customer wrote back.
 *
 * One field, because the decision named exactly one. Asking for five things
 * when one decides the price is how a business loses a customer to whoever
 * replied first.
 */
export function AnswerBlocker({ enquiry }: { enquiry: Enquiry }) {
  const actions = useFirstBetaActions();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const missing = enquiry.decision?.missing?.find((m) => m.blocking);
  if (!missing) return null;

  const submit = async () => {
    if (!value.trim()) return toast.error(`Enter the ${missing.factField}.`);
    setSaving(true);
    try {
      const res = await actions.answerFact(enquiry.id, missing.factField, value.trim());
      toast.success(
        res.action === "SEND_QUOTE" ? "Priced. The reply is ready." : res.explanation,
      );
      setValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-b border-line px-5 py-5">
      <p className="eyebrow">Needed to price this</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{missing.reason}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1 text-sm">
          <span className="mb-1.5 block text-stone">{missing.label}</span>
          <input
            className="field w-full"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="4"
          />
        </label>
        <Button className="min-h-11" disabled={saving} onClick={() => void submit()}>
          {saving ? "Working it out…" : "Confirm"}
        </Button>
      </div>
    </section>
  );
}
