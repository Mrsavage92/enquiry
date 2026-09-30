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

const LONG_MESSAGE_CHARS = 1200;
const LONG_MESSAGE_LINES = 22;

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
  warnings = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: SendPreviewData;
  /** Puts the text on the clipboard. Resolves with what actually happened. */
  onCopy: () => Promise<SendPreviewCopyState>;
  /**
   * The owner attesting they sent it themselves. The ONLY thing that records.
   * `acknowledgedWarnings` is the owner's "Send anyway" over what to check.
   */
  onConfirm: (opts?: { acknowledgedWarnings?: boolean }) => void;
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
  /**
   * What the owner wrote that the app cannot vouch for: a discount, a
   * booking promise, a day they don't work. Never a refusal - one tap sends
   * anyway, and that is recorded.
   */
  warnings?: string[];
}) {
  const [checked, setChecked] = useState(false);
  const toCheck = !blockedReason && warnings.length > 0 && !checked;
  const [addingLine, setAddingLine] = useState(false);
  const [copyState, setCopyState] = useState<SendPreviewCopyState>("idle");
  const [showAll, setShowAll] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const refusedRef = useRef<HTMLDivElement>(null);
  const warnRef = useRef<HTMLDivElement>(null);
  // The message grows to fit so the sign-off is never hidden in an inner
  // scroll; only a really long one is cut short, with "Show all" under it.
  const long =
    preview.body.length > LONG_MESSAGE_CHARS ||
    preview.body.split("\n").length > LONG_MESSAGE_LINES;
  // Copy is step one, so it is the loud button until it has happened; then
  // "I've sent this externally" is.
  const copied = copyState !== "idle";

  useEffect(() => {
    if (open) {
      setCopyState("idle");
      setShowAll(false);
      setChecked(false);
    }
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

  const actionBar = (
    <div className="flex flex-col gap-2" data-testid="send-actions">
      {toCheck ? (
        // The list is at the top of the sheet; here, the one tap that says the
        // owner has read it. A tall footer would push the buttons off a phone.
        <div className="flex items-center justify-between gap-3 text-sm text-warn">
          <span className="font-medium">
            {warnings.length === 1
              ? "1 thing to check above"
              : `${warnings.length} things to check above`}
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="min-h-11 shrink-0"
            disabled={pending}
            onClick={() => setChecked(true)}
          >
            Send anyway
          </Button>
        </div>
      ) : null}
      {/* Step one. Copying is copying: it writes nothing, records nothing,
          and reports truthfully whether the clipboard actually took it. A
          reply the send check refused is never the loud button. */}
      <Button
        variant={copied || blockedReason || toCheck ? "secondary" : "primary"}
        className="reply-copy-button h-auto min-h-12 w-full whitespace-normal py-2"
        data-copy-state={copyState}
        disabled={pending || !preview.body || Boolean(blockedReason) || toCheck}
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

      {/* Step two, and the only thing that records anything. */}
      {staleMessage && onConfirmStale ? (
        <Button
          variant="secondary"
          className="h-auto min-h-12 w-full whitespace-normal py-2"
          disabled={pending}
          onClick={onConfirmStale}
        >
          {pending ? "Recording…" : "I already sent that older message"}
        </Button>
      ) : (
        <Button
          variant={copied ? "primary" : "secondary"}
          className="h-auto min-h-12 w-full whitespace-normal py-2"
          disabled={pending || Boolean(blockedReason) || toCheck}
          onClick={() => onConfirm(checked ? { acknowledgedWarnings: true } : undefined)}
        >
          <ClipboardCheck size={18} aria-hidden />
          {pending
            ? "Recording…"
            : demoMode
              ? "I've sent this externally (demo)"
              : "I've sent this externally"}
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <Panel
        title="Send this?"
        footer={actionBar}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          // A refused reply opens on why, never scrolled past it to the text.
          (blockedReason
            ? refusedRef.current
            : warnings.length
              ? warnRef.current
              : bodyRef.current
          )?.focus();
        }}
      >
        <div className="space-y-4">
          {/* What the owner wrote that the app cannot vouch for: theirs to send. */}
          {toCheck ? (
            <div
              ref={warnRef}
              tabIndex={-1}
              className="callout bg-warn-bg text-warn"
              role="status"
              data-testid="send-warnings"
            >
              <p className="text-sm font-medium">Check this before you send</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* Why it can't go, first: never under a message that looks ready. */}
          {blockedReason ? (
            <div
              ref={refusedRef}
              tabIndex={-1}
              className="callout bg-danger-bg text-danger"
              role="alert"
              data-testid="send-refused"
            >
              <p className="text-sm font-medium">This reply can't be sent as it is</p>
              <p className="mt-1 text-sm text-ink">{blockedReason}</p>
            </div>
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
              className={cn(
                "field mt-1 whitespace-pre-wrap py-3 text-sm leading-relaxed",
                long && !showAll && "max-h-[24rem] overflow-hidden",
              )}
            >
              {preview.body || "No message prepared."}
            </div>
            {long && !showAll ? (
              <button
                type="button"
                className="ui-text-link"
                onClick={() => {
                  setShowAll(true);
                  bodyRef.current?.focus();
                }}
              >
                Show all
              </button>
            ) : null}
          </div>
          {/* What copying did, in the body so the pinned bar holds only the
              two buttons and never crowds out the message. */}
          <p
            className={cn(
              "reply-copy-feedback text-xs",
              copyState === "failed" ? "text-warn" : "text-stone",
            )}
            role="status"
            aria-live="polite"
          >
            {blockedReason
              ? "Fix the reply first. Nothing has been sent or recorded."
              : copyState === "copied"
                ? "Copied to your clipboard. Nothing has been sent or recorded yet."
                : copyState === "failed"
                  ? "Enquiry could not reach your clipboard. The message above is selected - copy it by hand. Nothing has been sent or recorded."
                  : "Copy the message, then send it from your own inbox or phone."}
          </p>
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
          {staleMessage ? (
            <p className="text-sm text-warn" role="alert">
              {staleMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2">
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
