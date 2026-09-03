import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import type { SendPreviewData } from "@/domain/send-preview";
import { cn } from "@/lib/utils";

/**
 * The approval preview every commercial send goes through, shared by the main
 * composer and the waiting-desk follow-up so the two paths cannot drift.
 *
 * Confirmation happens only through the primary button below - there is no
 * form here and no Enter-to-submit binding, so a stray Enter keystroke
 * anywhere else on the page (the draft textarea included) can never reach
 * this dialog's confirm action. Radix's Dialog moves focus in on open and
 * returns it to the trigger on close.
 *
 * Radix's own default open-focus lands on the content panel itself, not on
 * any control inside it - fine for a form, wrong here, where the one thing
 * an owner should be able to do immediately is confirm the send. Escape
 * still closes and returns focus to the trigger; that is Radix's own
 * behaviour and this override does not touch it.
 */
export function SendPreview({
  open,
  onOpenChange,
  preview,
  onConfirm,
  pending,
  compact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: SendPreviewData;
  /** Called with a fresh idempotency key generated once per dialog open. */
  onConfirm: (clientRequestId: string) => void;
  pending: boolean;
  compact?: boolean;
}) {
  const [clientRequestId, setClientRequestId] = useState<string>(() => crypto.randomUUID());
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setClientRequestId(crypto.randomUUID());
  }, [open]);

  const Panel = compact ? SheetContent : DialogContent;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <Panel
        title="Send this?"
        className={compact ? undefined : "max-h-[85vh] overflow-y-auto"}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          confirmButtonRef.current?.focus();
        }}
      >
        <div className="space-y-4">
          <div>
            <p className="eyebrow">Channel</p>
            <p className="mt-1 text-sm">{preview.channelLabel}</p>
          </div>
          <div>
            <p className="eyebrow">Recipient</p>
            {preview.recipient ? (
              <p className="mt-1 text-sm">{preview.recipient}</p>
            ) : (
              <p className="mt-1 text-sm text-warn">
                No email or phone on file - you will need to reach them yourself.
              </p>
            )}
          </div>
          <div>
            <p className="eyebrow">Message</p>
            <div className="field mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
              {preview.body || "No message prepared."}
            </div>
          </div>
          {preview.amountLabel ? (
            <div>
              <p className="eyebrow">Amount</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{preview.amountLabel}</p>
            </div>
          ) : null}
          <div>
            <p className="eyebrow">Why</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{preview.reason}</p>
          </div>
          {preview.edited ? (
            <p className="text-xs text-warn">
              Edited from the reply Enquiry prepared. The edited text is what gets recorded.
            </p>
          ) : null}
        </div>
        <div className={cn("mt-5 flex flex-col gap-2", compact && "pb-[var(--app-safe-bottom)]")}>
          <Button
            ref={confirmButtonRef}
            className="min-h-12 w-full"
            disabled={pending}
            onClick={() => onConfirm(clientRequestId)}
          >
            {pending ? "Recording…" : "Copy and record as sent"}
          </Button>
          <Button
            variant="secondary"
            className="min-h-11 w-full"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Back
          </Button>
        </div>
      </Panel>
    </Dialog>
  );
}
