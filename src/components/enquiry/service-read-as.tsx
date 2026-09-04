import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { factStatusLabel, factStatusTone } from "@/domain/labels";
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
  const fact = enquiry.facts.find(
    (f) =>
      !f.superseded && f.field.trim().toLowerCase() === "service" && f.provenance?.kind === "model",
  );
  const [value, setValue] = useState(fact?.value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(fact?.value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fact?.id]);

  if (!fact) return null;

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
        <Badge tone={factStatusTone(fact.status)}>{factStatusLabel(fact.status)}</Badge>
        <p className="text-sm text-ink-2">
          Enquiry read this as {fact.displayValue || fact.value}.
        </p>
      </div>
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
        <Button className="min-h-11 max-w-full" disabled={saving} onClick={() => void submit()}>
          <span className="min-w-0 truncate">
            {saving ? "Working it out…" : `Confirm service: ${value.trim() || fact.value}`}
          </span>
        </Button>
      </div>
    </section>
  );
}
