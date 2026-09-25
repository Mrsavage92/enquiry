import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import type { SendPreviewData } from "@/domain/send-preview";
import { cn } from "@/lib/utils";
import { Check, Copy, ClipboardCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";

/**
 * The approval preview every commercial send goes through, shared by the main
 * composer and the waiting-desk follow-up so the two paths cannot drift.
 *
 * Copying and sending are two different events here, because they are two
 * different events in the world. The previous version offered one button,
 * "Copy and record as sent", which put the text on the clipboard, swallowed
 * any clipboard failure, and recorded an outbound message with a real
 * `sent_at` regardless - so copying without sending, abandoning the send, or
 * failing to copy at all told the business it had already replied, and moved
 * responsibility to a customer who had heard nothing.
 *
 * So: copy is copy, and it reports honestly whether it worked. The send is
 * recorded only when the owner says they sent it, from their own inbox, which
 * is the only thing that makes it true. Enquiry does not deliver anything, and
 * this dialog says so rather than implying otherwise.
 *
 * Confirmation happens only through the primary button below - there is no
 * form here and no Enter-to-submit binding, so a stray Enter keystroke
 * anywhere else on the page (the draft textarea included) can never reach
 * this dialog's confirm action. Radix's Dialog moves focus in on open and
 * returns it to the trigger on close.
 */
export type SendPreviewCopyState = "idle" | "copied" | "failed";

export function SendPreview({
  open,
  onOpenChange,
  preview,
  onCopy,
  onConfirm,
  pending,
  compact,
  demoMode,
  blockedReason,
  staleMessage,
  onConfirmStale,
  mismatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: SendPreviewData;
  /** Puts the text on the clipboard. Resolves with what actually happened. */
  onCopy: () => Promise<SendPreviewCopyState>;
  /** The owner attesting they sent it themselves. The ONLY thing that records. */
  onConfirm: () => void;
  pending: boolean;
  compact?: boolean;
  /** Demo attestations are simulated, and are labelled as such. */
  demoMode?: boolean;
  /** The server refused to prepare this review; nothing can be confirmed. */
  blockedReason?: string | null;
  /** The review was prepared against an older decision. */
  staleMessage?: string | null;
  /** Record the older approved message the owner says they already sent. */
  onConfirmStale?: () => void;
  /**
   * The reply names a different amount to the quote. Never a dead end: put
   * the prepared total back, or add the line the difference is for.
   */
  mismatch?: {
    onUsePrepared: () => void;
    lines: { label: string; onAdd: () => void }[];
  } | null;
}) {
  const [addingLine, setAddingLine] = useState(false);
  const [copyState, setCopyState] = useState<SendPreviewCopyState>("idle");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setCopyState("idle");
  }, [open]);

  const Panel = compact ? SheetContent : DialogContent;

  /**
   * Select the message so the owner can copy it by hand. The fallback for a
   * denied clipboard permission or an insecure context - and the reason a
   * clipboard failure is not a dead end.
   */
  const selectBody = () => {
    const node = bodyRef.current;
    if (!node || typeof window === "undefined") return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <Panel
        title="Send this?"
        className={compact ? undefined : "max-h-[85vh] overflow-y-auto"}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          bodyRef.current?.focus();
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
            ) : preview.recipientRead ? (
              <p className="mt-1 text-sm">
                {preview.recipientRead}
                <span className="block text-ink-2">
                  From their message. Check it before you use it.
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-warn">
                No recipient on file - you will need to reach them yourself.
              </p>
            )}
          </div>
          <div>
            <p className="eyebrow">Message</p>
            <div
              ref={bodyRef}
              tabIndex={-1}
              aria-label="Message to review"
              className="field mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed"
            >
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
          {blockedReason ? (
            <p className="text-sm text-danger" role="alert">
              {blockedReason}
            </p>
          ) : null}
          {blockedReason && mismatch ? (
            <div className="flex flex-col gap-2">
              <Button
                className="min-h-11 w-full"
                disabled={pending}
                onClick={mismatch.onUsePrepared}
              >
                Use the prepared total
              </Button>
              <Button
                variant="secondary"
                className="min-h-11 w-full"
                disabled={pending}
                aria-expanded={addingLine}
                onClick={() => setAddingLine((v) => !v)}
              >
                Add a line
              </Button>
              {addingLine ? (
                <div className="space-y-2">
                  {mismatch.lines.map((l) => (
                    <Button
                      key={l.label}
                      variant="ghost"
                      className="min-h-11 w-full justify-start"
                      disabled={pending}
                      onClick={l.onAdd}
                    >
                      {l.label}
                    </Button>
                  ))}
                  <p className="text-sm text-ink-2">
                    Not in your prices?{" "}
                    <Link className="ui-text-link" to="/business" search={{ section: "pricing" }}>
                      Add a price
                    </Link>{" "}
                    and this enquiry updates.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          {staleMessage ? (
            <p className="text-sm text-warn" role="alert">
              {staleMessage}
            </p>
          ) : null}
        </div>

        <div className={cn("mt-5 flex flex-col gap-2", compact && "pb-[var(--app-safe-bottom)]")}>
          {/* Step one. Copying is copying: it writes nothing, records nothing,
              and reports truthfully whether the clipboard actually took it. */}
          <Button
            variant="secondary"
            className="reply-copy-button min-h-11 w-full"
            data-copy-state={copyState}
            disabled={pending || !preview.body}
            onClick={() => {
              void onCopy().then((state) => {
                setCopyState(state);
                if (state === "failed") selectBody();
              });
            }}
          >
            <span className="reply-copy-icon" aria-hidden>
              {copyState === "copied" ? (
                <Check key="copied" size={18} />
              ) : (
                <Copy key="copy" size={18} />
              )}
            </span>
            {copyState === "copied" ? "Copied" : "Copy the message"}
          </Button>
          <p
            className={cn(
              "reply-copy-feedback text-xs",
              copyState === "failed" ? "text-warn" : "text-stone",
            )}
            role="status"
            aria-live="polite"
          >
            {copyState === "copied"
              ? "Copied to your clipboard. Nothing has been sent or recorded yet."
              : copyState === "failed"
                ? "Enquiry could not reach your clipboard. The message above is selected - copy it by hand. Nothing has been sent or recorded."
                : "Copy the message, then send it from your own inbox or phone."}
          </p>

          {/* Step two, and the only thing that records anything. */}
          {staleMessage && onConfirmStale ? (
            <Button
              variant="secondary"
              className="min-h-12 w-full"
              disabled={pending}
              onClick={onConfirmStale}
            >
              {pending ? "Recording…" : "I already sent that older message"}
            </Button>
          ) : (
            <Button
              className="min-h-12 w-full"
              disabled={pending || Boolean(blockedReason)}
              onClick={onConfirm}
            >
              <ClipboardCheck size={18} aria-hidden />
              {pending
                ? "Recording…"
                : demoMode
                  ? "I've sent this externally (demo)"
                  : "I've sent this externally"}
            </Button>
          )}
          <p className="text-xs text-stone">
            {demoMode
              ? "Demonstration only - no message leaves this browser. In the real product Enquiry does not send either: you send it, then record it here."
              : "Enquiry does not send this for you. Send it from your own inbox or phone first, then confirm - that is what gets recorded."}
          </p>
          <Button
            variant="ghost"
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
