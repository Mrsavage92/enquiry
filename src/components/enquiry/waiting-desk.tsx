import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { useNarrow } from "@/lib/use-narrow";
import type { Enquiry } from "@/domain/types";
import { isSendableAction } from "@/domain/situation";
import { channelLabel, isShortChannel, replyChannel } from "@/domain/channel";
import { usePrototype } from "@/store/prototype-store";
import { toastUndo } from "@/lib/toast-undo";
import { useEmbedNav } from "@/lib/use-embed-nav";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { previewFor } from "@/domain/send-preview";
import { SendPreview } from "./send-preview";

export function WaitingDesk({ enquiry, onDone }: { enquiry: Enquiry; onDone?: () => void }) {
  const acceptQuote = usePrototype((s) => s.acceptQuote);
  const recordClientQuestion = usePrototype((s) => s.recordClientQuestion);
  const markLost = usePrototype((s) => s.markLost);
  const approve = usePrototype((s) => s.approve);
  const releaseFollowUp = usePrototype((s) => s.releaseFollowUp);
  const proposeRevision = usePrototype((s) => s.proposeRevision);
  const recordDeposit = usePrototype((s) => s.recordDeposit);
  const booking = usePrototype((s) => s.bookings.find((b) => b.enquiryId === enquiry.id));
  const rec = enquiry.decision.recommendation;
  const followUpReady =
    rec.action === "FOLLOW_UP" && rec.primaryEnabled && isSendableAction(rec.action);
  const asked = rec.action === "REQUEST_INFORMATION" && rec.primaryEnabled;
  const booked = enquiry.state.lifecycle === "BOOKED";
  const demoMode = usePrototype((s) => s.demoMode);
  const firstBeta = useFirstBetaActions();
  const [sending, setSending] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const followUpBody = enquiry.decision.draft.body;
  const followUpPreview = previewFor({
    enquiry,
    draft: followUpBody,
    decision: enquiry.decision,
  });

  /** Same rule as the main send: outside the demo, nothing is "sent" until the
   *  owner sends it and Enquiry records that it happened. */
  const sendFollowUp = async (clientRequestId?: string, edited?: boolean) => {
    const body = followUpBody;
    if (demoMode) {
      approve(enquiry.id);
      toastUndo("Follow-up sent. The quote stays on file.");
      onDone?.();
      return;
    }
    if (!body.trim()) {
      toast.error("There is no follow-up prepared.");
      return;
    }
    setSending(true);
    try {
      try {
        await navigator.clipboard?.writeText(body);
      } catch {
        /* clipboard unavailable - the text is still on screen to copy */
      }
      await firstBeta.recordSent(enquiry.id, body, replyChannel(enquiry), {
        clientRequestId: clientRequestId ?? crypto.randomUUID(),
        edited,
      });
      toast.success("Copied. Send it yourself - the quote stays on file.");
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record that follow-up.");
    } finally {
      setSending(false);
    }
  };
  const [moreOpen, setMoreOpen] = useState(false);
  const ch = replyChannel(enquiry);
  const phone = useNarrow(860);
  const Panel = phone ? SheetContent : DialogContent;
  const embedNav = useEmbedNav();

  if (booked) {
    const holdDue = booking && !booking.depositPaid;
    return (
      <div className="space-y-2">
        <p className="text-sm text-ok">Booked. Handed off.</p>
        {holdDue && booking ? (
          <Button
            className="min-h-11 w-full"
            variant="secondary"
            onClick={() => {
              recordDeposit(booking.id);
              toast("Hold recorded. The date is held.");
            }}
          >
            Record the hold
          </Button>
        ) : null}
        {embedNav ? (
          <Button className="min-h-11 w-full" variant="secondary" onClick={() => embedNav.today()}>
            Back to today
          </Button>
        ) : (
          <Button asChild className="min-h-11 w-full" variant="secondary">
            <Link to="/bookings">Open bookings</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {phone ? null : (
        <p className="text-sm text-ink-2">
          {isShortChannel(ch)
            ? `Sent on ${channelLabel(ch)}. Silence is not a decline.`
            : "Sent. The quote is with them. Silence is not a decline."}
        </p>
      )}
      {phone ? (
        <>
          <p className="text-sm text-ink-2">
            Sent. Waiting on {enquiry.customerName.split(" ")[0]}.
          </p>
          <button
            type="button"
            className="min-h-11 w-full text-sm text-stone"
            onClick={() => setMoreOpen(true)}
          >
            More
          </button>
        </>
      ) : (
        <>
          {asked ? (
            <Button
              variant="secondary"
              className="min-h-11 w-full"
              onClick={() => {
                proposeRevision(enquiry.id);
                toast("Version 2 proposed. Version 1 stays on file.");
              }}
            >
              Propose a new quote version
            </Button>
          ) : null}
          {followUpReady ? (
            <Button
              variant="secondary"
              className="min-h-11 w-full"
              onClick={() => setConfirmOpen(true)}
              disabled={sending}
            >
              {sending ? "Recording…" : rec.label}
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="min-h-11 w-full"
              onClick={() => {
                releaseFollowUp(enquiry.id);
                toast("Follow-up is due. Silence is not a decline.");
              }}
            >
              They’ve gone quiet
            </Button>
          )}
          <Button variant="ghost" className="min-h-11 w-full" onClick={() => setLostOpen(true)}>
            Mark lost
          </Button>
          <Button
            variant="ghost"
            className="min-h-11 w-full"
            onClick={() => {
              acceptQuote(enquiry.id);
              toastUndo("Booked. Handed off to bookings.");
              onDone?.();
            }}
          >
            They accepted off-channel
          </Button>
          {embedNav ? null : (
            <Button asChild variant="ghost" className="min-h-9 w-full">
              <Link to="/q/$enquiryId" params={{ enquiryId: enquiry.id }}>
                Open customer quote
              </Link>
            </Button>
          )}
        </>
      )}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <Panel title="This job">
          <div className="grid gap-2">
            <Button
              variant="secondary"
              className="min-h-12 w-full"
              onClick={() => {
                recordClientQuestion(enquiry.id);
                setMoreOpen(false);
                toast("They asked a question. The sent sheet stays on file.");
              }}
            >
              They asked a question
            </Button>
            <Button
              variant="secondary"
              className="min-h-12 w-full"
              onClick={() => {
                acceptQuote(enquiry.id);
                setMoreOpen(false);
                toastUndo("Booked. Handed off to bookings.");
                onDone?.();
              }}
            >
              They accepted off-channel
            </Button>
            {asked ? (
              <Button
                variant="secondary"
                className="min-h-12 w-full"
                onClick={() => {
                  proposeRevision(enquiry.id);
                  setMoreOpen(false);
                  toast("Version 2 proposed. Version 1 stays on file.");
                }}
              >
                Propose a new version
              </Button>
            ) : null}
            {followUpReady ? null : (
              <Button
                variant="secondary"
                className="min-h-12 w-full"
                onClick={() => {
                  releaseFollowUp(enquiry.id);
                  setMoreOpen(false);
                  toast("Follow-up is due. Silence is not a decline.");
                }}
              >
                They’ve gone quiet
              </Button>
            )}
            {embedNav ? null : (
              <Button asChild variant="secondary" className="min-h-12 w-full">
                <Link
                  to="/q/$enquiryId"
                  params={{ enquiryId: enquiry.id }}
                  onClick={() => setMoreOpen(false)}
                >
                  Customer quote
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              className="min-h-12 w-full"
              onClick={() => {
                setMoreOpen(false);
                setLostOpen(true);
              }}
            >
              Mark lost
            </Button>
          </div>
        </Panel>
      </Dialog>
      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <Panel title="Mark this lost?">
          <p className="text-sm leading-relaxed text-ink-2">
            Silence is not a decline. Only mark lost if you know they walked away.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              variant="danger"
              onClick={() => {
                markLost(enquiry.id);
                setLostOpen(false);
                toastUndo("Marked lost");
                onDone?.();
              }}
            >
              Mark lost
            </Button>
            <Button variant="secondary" className="min-h-11" onClick={() => setLostOpen(false)}>
              Keep waiting
            </Button>
          </div>
        </Panel>
      </Dialog>
      <SendPreview
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        preview={followUpPreview}
        pending={sending}
        compact={Boolean(phone)}
        onConfirm={(clientRequestId) => {
          void sendFollowUp(clientRequestId, followUpPreview.edited ?? false).then(() => {
            setConfirmOpen(false);
          });
        }}
      />
    </div>
  );
}
