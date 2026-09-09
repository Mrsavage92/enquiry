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
import { SendPreview, type SendPreviewCopyState } from "./send-preview";

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
  const [reviewedSendId, setReviewedSendId] = useState<string | null>(null);
  const [reviewBlocked, setReviewBlocked] = useState<string | null>(null);
  const [reviewStale, setReviewStale] = useState<string | null>(null);
  const followUpBody = enquiry.decision.draft.body;
  const followUpPreview = previewFor({
    enquiry,
    draft: followUpBody,
    decision: enquiry.decision,
  });

  /**
   * The follow-up path uses exactly the same semantics as the main composer,
   * by design: copying is copying, and only the owner's attestation records a
   * send. Both used to copy-and-record in one step, so a follow-up that was
   * never sent still moved the enquiry as though the customer had heard from
   * the business a second time.
   */
  const copyFollowUp = async (): Promise<SendPreviewCopyState> => {
    try {
      if (!navigator.clipboard?.writeText) return "failed";
      await navigator.clipboard.writeText(followUpBody);
      return "copied";
    } catch {
      return "failed";
    }
  };

  const openReview = async () => {
    if (!followUpBody.trim()) {
      toast.error("There is no follow-up prepared.");
      return;
    }
    if (demoMode) {
      setReviewBlocked(null);
      setReviewStale(null);
      setReviewedSendId(null);
      setConfirmOpen(true);
      return;
    }
    setSending(true);
    try {
      const res = await firstBeta.prepareReview(enquiry.id, followUpBody, replyChannel(enquiry));
      if (!res.ok) {
        setReviewBlocked(res.message);
        setReviewedSendId(null);
      } else {
        setReviewBlocked(null);
        setReviewedSendId(res.reviewedSendId);
      }
      setReviewStale(null);
      setConfirmOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not prepare that for review.");
    } finally {
      setSending(false);
    }
  };

  const confirmExternalSend = async (staleAttestation = false) => {
    if (demoMode) {
      approve(enquiry.id);
      toastUndo("Recorded as sent (demo). Nothing left this browser.");
      setConfirmOpen(false);
      onDone?.();
      return;
    }
    if (!reviewedSendId) {
      toast.error("Review the follow-up again before recording it as sent.");
      return;
    }
    setSending(true);
    try {
      const res = await firstBeta.recordSent(enquiry.id, reviewedSendId, { staleAttestation });
      if (!res.ok) {
        if (res.reason === "stale") setReviewStale(res.message);
        else setReviewBlocked(res.message);
        return;
      }
      setConfirmOpen(false);
      toast.success(
        res.duplicate
          ? "Already recorded - this follow-up is on file once."
          : "Recorded as sent by you. The quote stays on file.",
      );
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
              onClick={() => void openReview()}
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
        demoMode={demoMode}
        blockedReason={reviewBlocked}
        staleMessage={reviewStale}
        onCopy={copyFollowUp}
        onConfirm={() => void confirmExternalSend(false)}
        onConfirmStale={() => void confirmExternalSend(true)}
      />
    </div>
  );
}
