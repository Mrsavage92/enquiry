import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { factStatusLabel, factStatusTone, formatAud } from "@/domain/labels";
import { serviceAuthority } from "@/domain/service-authority";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import type { Enquiry } from "@/domain/types";

/**
 * "Enquiry read this as X" - only shown when `service_label` was set by a
 * model reading the message (`createManualEnquiry`'s best-effort
 * interpretation step), never for a service the operator typed themselves.
 *
 * Detected by the live `field: "service"` fact this product writes
 * specifically when that happens (`provenance.kind === "model"`), which stays
 * `check_this` until the owner acts here - one click to keep it, or an edit
 * and click to correct it. Either way goes through `setEnquiryService`, which
 * writes a real `confirmed` fact and re-decides, exactly like any other
 * correction in this product.
 */
export function ServiceReadAs({ enquiry }: { enquiry: Enquiry }) {
  const actions = useFirstBetaActions();
  const authority = serviceAuthority(enquiry);
  const fact = authority.state === "proposed" ? authority.fact : undefined;
  // The value to confirm: what the model read, or the label the enquiry already
  // carries with nothing behind it.
  const current =
    authority.state === "proposed"
      ? authority.fact.value
      : authority.state === "unattributed"
        ? authority.label
        : "";
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);

  // Re-sync when the thing being confirmed changes - a new model read, or the
  // owner correcting it - not on every keystroke, which would fight their typing.
  useEffect(() => {
    setValue(current);
  }, [fact?.id, current]);

  // Only when there is something to confirm. A confirmed service needs no
  // prompt, and an enquiry with no service named at all needs a service, not a
  // confirmation.
  if (authority.state !== "proposed" && authority.state !== "unattributed") return null;

  const provisional = enquiry.decision?.provisionalPrice;

  const submit = async () => {
    if (!value.trim()) return toast.error("Enter what they're asking for.");
    setSaving(true);
    try {
      await actions.setService(enquiry.id, value.trim());
      toast.success("Service confirmed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-b border-line px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        {fact ? (
          <>
            <Badge tone={factStatusTone(fact.status)}>{factStatusLabel(fact.status)}</Badge>
            <p className="text-sm text-ink-2">
              Enquiry read this as {fact.displayValue || fact.value}.
            </p>
          </>
        ) : (
          <>
            {/* A label with no record of who decided it - an enquiry from
                before Enquiry recorded that, or one brought in from elsewhere.
                Saying so plainly is better than implying a confirmation that
                never happened. */}
            <Badge tone="warn">Not confirmed</Badge>
            <p className="text-sm text-ink-2">
              This is down as {current}, but nothing records you confirming it.
            </p>
          </>
        )}
      </div>
      {provisional ? (
        // Shown so confirming is an informed decision, and labelled so it can
        // never read as a decided quote. The figure lives in
        // `provisionalPrice`, which no send path reads - until the owner
        // confirms below, there is no authorised amount at all.
        <p className="mt-2 text-sm text-ink-2">
          If that is right, this prices at{" "}
          <span className="font-semibold tabular-nums">
            {formatAud(provisional.amountMinor / 100)}
          </span>
          . Not quoted yet - confirm the service first.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1 text-sm">
          <span className="mb-1.5 block text-stone">What are they asking for?</span>
          <input
            className="field w-full"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
        </label>
        <Button
          className="min-h-11 max-w-full"
          disabled={saving}
          onClick={() => void submit()}
          title={saving ? "Working it out…" : `Confirm service: ${value.trim() || current}`}
        >
          <span className="min-w-0 truncate">
            {saving ? "Working it out…" : `Confirm service: ${value.trim() || current}`}
          </span>
        </Button>
      </div>
    </section>
  );
}
