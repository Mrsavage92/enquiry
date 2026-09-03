import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { factStatusLabel, factStatusTone } from "@/domain/labels";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import type { Enquiry, EnquiryFact } from "@/domain/types";

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
 *
 * When Enquiry already read a plausible value for this exact field out of the
 * message (`status: "inferred"`/`"check_this"`), the input is pre-filled and
 * the button reads "Confirm {label}: {value}" - one click promotes it. It is
 * never pre-CONFIRMED: the value only becomes `confirmed`, and only unlocks a
 * price, once the owner actually presses this button - `price-compiler.ts`'s
 * `quantityFrom()` refuses anything else regardless of what this control shows.
 */
function findInferredFact(enquiry: Enquiry, field: string): EnquiryFact | undefined {
  const want = field.trim().toLowerCase();
  return enquiry.facts.find(
    (f) =>
      !f.superseded &&
      f.field.trim().toLowerCase() === want &&
      (f.status === "inferred" || f.status === "check_this"),
  );
}

export function AnswerBlocker({ enquiry }: { enquiry: Enquiry }) {
  const actions = useFirstBetaActions();
  const missing = enquiry.decision?.missing?.find((m) => m.blocking);
  const inferred = missing ? findInferredFact(enquiry, missing.factField) : undefined;
  const [value, setValue] = useState(inferred?.value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(inferred?.value ?? "");
    // Re-sync only when the underlying inferred fact itself changes (a new
    // read, or the owner confirming and a fresh blocker appearing) - not on
    // every keystroke, which would fight the owner's own typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inferred?.id, missing?.factField]);

  if (!missing) return null;

  const submit = async () => {
    if (!value.trim()) return toast.error(`Enter the ${missing.factField}.`);
    setSaving(true);
    try {
      const res = await actions.answerFact(enquiry.id, missing.factField, value.trim());
      toast.success(res.action === "SEND_QUOTE" ? "Priced. The reply is ready." : res.explanation);
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
      {inferred ? (
        <div className="mt-2 flex items-center gap-2">
          <Badge tone={factStatusTone(inferred.status)}>{factStatusLabel(inferred.status)}</Badge>
          <p className="text-sm text-ink-2">
            Enquiry read this as {inferred.displayValue || inferred.value}.
          </p>
        </div>
      ) : null}
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
          {saving
            ? "Working it out…"
            : inferred && value.trim()
              ? `Confirm ${missing.label}: ${value.trim()}`
              : "Confirm"}
        </Button>
      </div>
    </section>
  );
}
