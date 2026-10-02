import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { useNarrow } from "@/lib/use-narrow";
import type { Enquiry } from "@/domain/types";
import { usePrototype } from "@/store/prototype-store";
import { toastUndo } from "@/lib/toast-undo";
import { useEmbedNav } from "@/lib/use-embed-nav";

export function WaitingDesk({ enquiry, onDone }: { enquiry: Enquiry; onDone?: () => void }) {
  const acceptQuote = usePrototype((s) => s.acceptQuote);
  const recordClientQuestion = usePrototype((s) => s.recordClientQuestion);
  const markLost = usePrototype((s) => s.markLost);
  const releaseFollowUp = usePrototype((s) => s.releaseFollowUp);
  const proposeRevision = usePrototype((s) => s.proposeRevision);
  const recordDeposit = usePrototype((s) => s.recordDeposit);
  const booking = usePrototype((s) => s.bookings.find((b) => b.enquiryId === enquiry.id));
  const rec = enquiry.decision.recommendation;
  const asked = rec.action === "REQUEST_INFORMATION" && rec.primaryEnabled;
  const booked = enquiry.state.lifecycle === "BOOKED";
  const [lostOpen, setLostOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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
      {phone ? (
        <>
          {/* What was sent, and when it comes back, is at the top of the
              screen (WaitingSummary); saying it again here was noise. */}
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-sm font-medium text-mark-strong underline-offset-4 hover:underline"
            onClick={() => setMoreOpen(true)}
          >
            Record what happened
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
            They said yes
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
              They said yes
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
            {
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
            }
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
    </div>
  );
}
