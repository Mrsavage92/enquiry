import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, MoreVertical } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { nextNeedsYou } from "@/domain/labels";
import { threadLabel } from "@/domain/channel";
import type { Enquiry } from "@/domain/types";
import { usePrototype } from "@/store/prototype-store";
import { toastUndo } from "@/lib/toast-undo";
import { Conversation } from "./conversation";
import { Intelligence } from "./intelligence";
import { TeachDialog } from "./teach-dialog";
import { WaitingDesk } from "./waiting-desk";
import { useEmbedNav } from "@/components/site/embed-nav";

export function PhoneDesk({ enquiry }: { enquiry: Enquiry }) {
  const [thread, setThread] = useState(false);
  const [more, setMore] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const navigate = useNavigate();
  const embedNav = useEmbedNav();
  const snooze = usePrototype((s) => s.snooze);
  const declineLetter = usePrototype((s) => s.declineLetter);
  const setNote = usePrototype((s) => s.setNote);
  const inChat =
    enquiry.state.lifecycle === "BOOKED" ||
    (enquiry.state.decision === "WAITING_ON_CLIENT" &&
      (enquiry.state.commercial === "QUOTED" || enquiry.state.commercial === "ESTIMATED"));

  const advance = () => {
    const { enquiries, businessFilter } = usePrototype.getState();
    const next = nextNeedsYou(enquiries, businessFilter, enquiry.id);
    if (embedNav) {
      if (next) embedNav.open(next);
      else embedNav.today();
      return;
    }
    if (next) {
      void navigate({ to: "/enquiries/$enquiryId", params: { enquiryId: next } });
    } else {
      void navigate({ to: "/enquiries" });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-raised">
      <header className="flex shrink-0 items-center gap-1 border-b border-line px-1 pb-1.5 pt-[max(0.375rem,var(--app-safe-top))]">
        {embedNav ? (
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-ink-2"
            aria-label="Back to today"
            onClick={() => embedNav.today()}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        ) : (
          <Link
            to="/enquiries"
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-ink-2"
            aria-label="Back to today"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight">{enquiry.customerName}</p>
          <p className="truncate text-2xs text-stone">
            {enquiry.state.lifecycle === "BOOKED"
              ? "Booked"
              : inChat
                ? "Sent"
                : [enquiry.serviceLabel, enquiry.dateLabel].filter(Boolean).join(" · ")}
          </p>
        </div>
        {inChat ? null : (
          <button
            type="button"
            className="min-h-11 px-3 text-sm font-medium text-ink-2"
            onClick={() => setThread(true)}
          >
            Thread
          </button>
        )}
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-ink-2"
          aria-label="More"
          onClick={() => setMore(true)}
        >
          <MoreVertical className="size-5" aria-hidden />
        </button>
      </header>
      {inChat ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Conversation enquiry={enquiry} compact />
          </div>
          <div className="relative z-10 shrink-0 border-t border-line bg-raised px-4 py-3 pb-[max(0.75rem,var(--app-safe-bottom))]">
            <WaitingDesk enquiry={enquiry} onDone={advance} />
          </div>
        </>
      ) : (
        <Intelligence enquiry={enquiry} compact onDone={advance} />
      )}
      <Dialog open={thread} onOpenChange={setThread}>
        <SheetContent title={threadLabel(enquiry.source)} flush className="h-[min(92dvh,44rem)]">
          <div className="h-full min-h-0">
            <Conversation enquiry={enquiry} compact />
          </div>
        </SheetContent>
      </Dialog>
      <Dialog open={more} onOpenChange={setMore}>
        <SheetContent title="This job">
          <div className="grid gap-2">
            <Button
              variant="secondary"
              className="min-h-12 w-full"
              onClick={() => {
                setMore(false);
                setNoteOpen(true);
              }}
            >
              Note
            </Button>
            <Button
              variant="secondary"
              className="min-h-12 w-full"
              onClick={() => {
                snooze(enquiry.id);
                setMore(false);
                toastUndo("Later. Two days.");
                advance();
              }}
            >
              Later
            </Button>
            <Button
              variant="ghost"
              className="min-h-12 w-full"
              onClick={() => {
                declineLetter(enquiry.id);
                setMore(false);
                toastUndo("Decline sent.");
                advance();
              }}
            >
              Decline
            </Button>
          </div>
        </SheetContent>
      </Dialog>
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <SheetContent title="Note">
          <p className="text-sm text-ink-2">Stays on the case. Not sent.</p>
          <textarea
            className="field mt-3"
            rows={4}
            defaultValue={enquiry.notes ?? ""}
            id="phone-enquiry-note"
          />
          <Button
            className="mt-4 min-h-12 w-full"
            onClick={() => {
              const el = document.getElementById("phone-enquiry-note") as HTMLTextAreaElement | null;
              setNote(enquiry.id, el?.value ?? "");
              setNoteOpen(false);
            }}
          >
            Save
          </Button>
        </SheetContent>
      </Dialog>
      <TeachDialog />
    </div>
  );
}
