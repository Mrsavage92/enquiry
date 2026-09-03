import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";

/**
 * The confirm step every Decline goes through, whichever screen it is
 * reached from (the desktop workspace, the phone desk).
 *
 * Declining is not a customer-facing send - nothing is sent to anyone here -
 * so it does not go through `SendPreview`. It still closes a customer's
 * request, so it gets a confirm step of its own: a real dialog (Escape
 * cancels, Tab reaches every control, the confirm button is a full 44px
 * target), not a single undifferentiated click on a ghost button.
 */
export function DeclineConfirm({
  open,
  onOpenChange,
  pending,
  compact,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  compact?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const Panel = compact ? SheetContent : DialogContent;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
        if (!next) setReason("");
      }}
    >
      <Panel title="Decline this enquiry?">
        <p className="text-sm leading-relaxed text-ink-2">
          This closes the enquiry. Nothing is sent to the customer - Enquiry never contacts them for
          you.
        </p>
        <label className="mt-4 block">
          <span className="eyebrow">Reason (optional)</span>
          <textarea
            className="field mt-1"
            rows={3}
            maxLength={400}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Stays on the case file. Not sent to the customer."
          />
        </label>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="danger"
            className="min-h-11"
            disabled={pending}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? "Declining…" : "Decline this enquiry"}
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Keep it open
          </Button>
        </div>
      </Panel>
    </Dialog>
  );
}
