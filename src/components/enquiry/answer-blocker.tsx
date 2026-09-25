import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { factStatusLabel, factStatusTone } from "@/domain/labels";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import type { Enquiry, EnquiryFact } from "@/domain/types";
import { blockerInput } from "@/domain/blocker-input";
import { decidingPhrase } from "@/domain/price-compiler";
import { quantityPhrase } from "@/domain/compose-reply";
import { formatMinorAud } from "@/domain/money-format";

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

export function AnswerBlocker({
  enquiry,
  folded = false,
  summary,
}: {
  enquiry: Enquiry;
  /**
   * On the phone the detail lives inside the next-step card, behind one tap,
   * so the screen holds one decision: ask the customer (the main button), or
   * type the answer if you already have it (this).
   */
  folded?: boolean;
  /** The folded control's own words, e.g. "Tom answered? Enter the bedrooms". */
  summary?: string;
}) {
  const actions = useFirstBetaActions();
  const missing = enquiry.decision?.missing?.find((m) => m.blocking);
  const inferred = missing ? findInferredFact(enquiry, missing.factField) : undefined;
  const [value, setValue] = useState(inferred?.value ?? "");
  const [saving, setSaving] = useState(false);
  // "Edit" on a reading opens the plain field, pre-filled with it.
  const [editing, setEditing] = useState(false);
  // What the last answer did, kept on screen: a toast disappears before an
  // interrupted owner looks back, and "did that save?" should not need memory.
  const [result, setResult] = useState<string | null>(null);
  // A wrong answer is explained beside the field it belongs to, not in a
  // toast that vanishes before an interrupted owner looks back.
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  useEffect(() => {
    setValue(inferred?.value ?? "");
    setEditing(false);
    // Re-sync only when the underlying inferred fact itself changes (a new
    // read, or the owner confirming and a fresh blocker appearing) - not on
    // every keystroke, which would fight the owner's own typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inferred?.id, missing?.factField]);

  if (!missing) {
    // Answered: what it did stays on the card, the priced total included.
    return result ? (
      <section className="border-b border-line px-5 py-4" role="status">
        <p className="text-sm text-ink-2">{result}</p>
      </section>
    ) : null;
  }
  const input = blockerInput(missing.factField, missing.label);

  const submit = async (answer = value) => {
    if (!answer.trim()) {
      setError(`Enter the ${missing.label.toLowerCase()}, for example ${input.placeholder || "4"}.`);
      setEditing(true);
      return;
    }
    setSaving(true);
    try {
      const answered = answer.trim();
      const res = await actions.answerFact(enquiry.id, missing.factField, answered);
      const priced =
        res.action === "SEND_QUOTE" && typeof res.amountMinor === "number"
          ? `Priced: ${formatMinorAud(res.amountMinor)}.`
          : null;
      const outcome = priced ? `${priced} The reply is ready to check.` : res.explanation;
      setError(null);
      // Any earlier error toast is about an answer that is now settled.
      toast.dismiss();
      setResult(`Saved ${missing.label.toLowerCase()}: ${answered}. ${outcome}`);
      toast.success(outcome);
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that. Try again.");
      setEditing(true);
    } finally {
      setSaving(false);
    }
  };

  // A reading the decision itself accepts as one usable count (never a range).
  const reading = missing.inferred;
  if (reading && !editing) {
    // They already said it. One tap confirms their own words; the price
    // compiler will not use the reading until this happens.
    const said = reading.display || reading.value;
    const phrase = quantityPhrase(reading.value, missing.label);
    const check = (
      <div className={folded ? "mt-3" : "mt-2"}>
        <p className="text-sm leading-relaxed text-ink">From their message: “{said}”. Correct?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="min-h-11" disabled={saving} onClick={() => void submit(reading.value)}>
            {saving ? "Working it out…" : `Yes, ${phrase}`}
          </Button>
          <Button
            className="min-h-11"
            variant="secondary"
            disabled={saving}
            onClick={() => {
              setValue(reading.value);
              setEditing(true);
            }}
          >
            Edit
          </Button>
        </div>
        {result ? (
          <p className="mt-2 text-sm text-ink-2" role="status">
            {result}
          </p>
        ) : null}
      </div>
    );
    return folded ? check : <section className="border-b border-line px-5 py-5">{check}</section>;
  }

  const field = (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="min-w-40 flex-1 text-sm">
        <span className="mb-1.5 block text-stone">{missing.label}</span>
        <input
          className="field w-full"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder={input.placeholder}
          inputMode={input.inputMode}
        />
      </label>
      <Button
        className="min-h-11"
        variant={folded ? "secondary" : "primary"}
        disabled={saving}
        onClick={() => void submit()}
      >
        {saving
          ? "Working it out…"
          : inferred && value.trim()
            ? `Confirm ${missing.label}: ${value.trim()}`
            : "Confirm"}
      </Button>
      {error ? (
        <p id={errorId} className="w-full text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );

  if (folded) {
    return (
      <div className="blocker-fold mt-3">
        {result ? (
          <p className="text-sm text-ink-2" role="status">
            {result}
          </p>
        ) : null}
        {/* Opened by "Edit" on a reading: the field is what they asked for. */}
        <details open={editing || undefined}>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-mark-strong">
            {summary ?? `Already know ${decidingPhrase(missing.label)}? Enter it here`}
          </summary>
          {inferred ? (
            <p className="mt-1 text-sm text-ink-2">
              Enquiry read this as {inferred.displayValue || inferred.value}.
            </p>
          ) : null}
          {field}
        </details>
      </div>
    );
  }

  return (
    <section className="border-b border-line px-5 py-5">
      <p className="eyebrow">Needed to price this</p>
      {result ? (
        <p className="mt-2 text-sm text-ink-2" role="status">
          {result}
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{missing.reason}</p>
      {inferred ? (
        <div className="mt-2 flex items-center gap-2">
          <Badge tone={factStatusTone(inferred.status)}>{factStatusLabel(inferred.status)}</Badge>
          <p className="text-sm text-ink-2">
            Enquiry read this as {inferred.displayValue || inferred.value}.
          </p>
        </div>
      ) : null}
      {field}
    </section>
  );
}
