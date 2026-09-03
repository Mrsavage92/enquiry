import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useNarrow } from "@/lib/use-narrow";
import { usePrototype } from "@/store/prototype-store";
import { Button } from "@/components/ui/button";
import { Conversation } from "./conversation";
import { Intelligence } from "./intelligence";
import { Queue, filteredEnquiries } from "./queue";
import { TeachDialog } from "./teach-dialog";
import { PhoneDesk } from "./phone-desk";
import { EmptyState } from "@/components/ui/empty-state";
import { briefing } from "@/domain/briefing";
import { isFramed } from "@/lib/embed";
import { mayPlayDemoArrival } from "@/domain/live-demo-isolation";
import { resolveSendKey } from "@/domain/send-keys";

export function EnquiryWorkspace({ enquiryId }: { enquiryId?: string }) {
  const narrow = useNarrow(1100);
  const mobile = useNarrow(860);
  const enquiries = usePrototype((s) => s.enquiries);
  const businessFilter = usePrototype((s) => s.businessFilter);
  const queueFilter = usePrototype((s) => s.queueFilter);
  const lastMerge = usePrototype((s) => s.lastMerge);
  const onboarded = usePrototype((s) => s.onboarded);
  const demoMode = usePrototype((s) => s.demoMode);
  const arrivalPlayed = usePrototype((s) => s.arrivalPlayed);
  const lastArrivalId = usePrototype((s) => s.lastArrivalId);
  const arriveEnquiry = usePrototype((s) => s.arriveEnquiry);
  const markArrivalSeen = usePrototype((s) => s.markArrivalSeen);
  const navigate = useNavigate();
  const visible = filteredEnquiries(enquiries, businessFilter, queueFilter, enquiryId);
  const enquiry = enquiryId ? enquiries.find((e) => e.id === enquiryId) : undefined;

  useEffect(() => {
    // The rule lives in the domain and is exhaustively tested, so what runs here
    // is what the tests assert. It previously fired on `onboarded` alone, which
    // handed a real business a hard-coded Instagram enquiry 4.8 seconds after
    // setup as though a customer had contacted them.
    if (!mayPlayDemoArrival({ demoMode, onboarded, arrivalPlayed, framed: isFramed() })) return;
    const t = window.setTimeout(() => {
      if (usePrototype.getState().arrivalPlayed) return;
      arriveEnquiry();
    }, 4800);
    return () => window.clearTimeout(t);
  }, [demoMode, onboarded, arrivalPlayed, arriveEnquiry]);

  useEffect(() => {
    if (enquiryId && enquiryId === lastArrivalId) markArrivalSeen();
  }, [enquiryId, lastArrivalId, markArrivalSeen]);

  const approve = usePrototype((s) => s.approve);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const inDialog = Boolean(target?.closest("[role='dialog']"));

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        // The decision - which keystrokes may ever fire this shortcut - is
        // `resolveSendKey` (domain/send-keys.ts), tested in isolation. Demo
        // only: a real send copies the letter and records it through the
        // same approval preview as the Send button, and a keyboard shortcut
        // that quietly marks something sent without any of that is exactly
        // the theatre this product exists to remove.
        const decision = resolveSendKey(
          { key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey },
          { inDialog },
          demoMode,
        );
        if (decision === "submit" && enquiryId) {
          e.preventDefault();
          approve(enquiryId);
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (typing || inDialog) return;
      if (e.key !== "j" && e.key !== "k") return;
      const ids = visible.map((v) => v.id);
      if (ids.length === 0) return;
      const i = enquiryId ? ids.indexOf(enquiryId) : -1;
      const next =
        e.key === "j"
          ? ids[Math.min((i < 0 ? -1 : i) + 1, ids.length - 1)]
          : ids[Math.max(i < 0 ? 0 : i - 1, 0)];
      if (next && next !== enquiryId) {
        e.preventDefault();
        void navigate({ to: "/enquiries/$enquiryId", params: { enquiryId: next } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approve, demoMode, enquiryId, navigate, visible]);

  useEffect(() => {
    if (mobile !== false) return;
    if (!enquiryId && visible[0]) {
      void navigate({
        to: "/enquiries/$enquiryId",
        params: { enquiryId: visible[0].id },
        replace: true,
      });
    }
  }, [mobile, enquiryId, visible, navigate]);

  useEffect(() => {
    if (!enquiryId || enquiry) return;
    if (lastMerge?.fromId === enquiryId) {
      void navigate({
        to: "/enquiries/$enquiryId",
        params: { enquiryId: lastMerge.toId },
        replace: true,
      });
    }
  }, [enquiryId, enquiry, lastMerge, navigate]);

  if (mobile === null) {
    return (
      <div className="h-full min-h-[50vh] bg-paper px-4 py-6">
        <div className="space-y-3" aria-hidden>
          <div className="skeleton-bar w-24" />
          <div className="skeleton-bar w-40" />
          <div className="mt-6 space-y-3">
            <div className="skeleton-bar h-12 w-full" />
            <div className="skeleton-bar h-12 w-full" />
            <div className="skeleton-bar h-12 w-full" />
          </div>
        </div>
        <p className="sr-only">Loading enquiries</p>
      </div>
    );
  }

  if (mobile && !enquiryId) {
    return (
      <div className="h-full min-h-0 overflow-hidden">
        <Queue phone />
      </div>
    );
  }

  if (enquiryId && !enquiry) {
    const merged = lastMerge?.fromId === enquiryId ? lastMerge : null;
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <p className="text-lg font-semibold tracking-tight">
          {merged ? "Attached to an existing enquiry" : "That enquiry isn’t here"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          {merged
            ? `The resend was added to ${merged.toName}. Enquiry does not keep two cards for the same job.`
            : "It isn’t in the current fixture set - it may have been merged, or this workspace was reset."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {merged ? (
            <Button asChild>
              <Link to="/enquiries/$enquiryId" params={{ enquiryId: merged.toId }}>
                Open {merged.toName}
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link to="/enquiries">Back to queue</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (mobile && enquiry) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <PhoneDesk key={enquiry.id} enquiry={enquiry} />
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-full grid-cols-1 overflow-hidden lg:grid-cols-[18.5rem_1fr] xl:grid-cols-[18.5rem_minmax(0,1fr)_24.5rem]">
      <Queue activeId={enquiry?.id} />
      {enquiry ? (
        <>
          <div
            key={`${enquiry.id}-conversation`}
            className={
              (narrow ? "hidden xl:block min-h-0" : "min-h-0") +
              " animate-[rise-in_200ms_var(--ease-smooth-out)]"
            }
          >
            <Conversation enquiry={enquiry} />
          </div>
          <div
            key={`${enquiry.id}-intelligence`}
            className="min-h-0 animate-[rise-in_200ms_var(--ease-smooth-out)]"
          >
            <Intelligence enquiry={enquiry} />
          </div>
        </>
      ) : (
        <DeskEmpty />
      )}
      <TeachDialog />
    </div>
  );
}

function DeskEmpty() {
  const enquiries = usePrototype((s) => s.enquiries);
  const businesses = usePrototype((s) => s.businesses);
  const bookings = usePrototype((s) => s.bookings);
  const filter = usePrototype((s) => s.businessFilter);
  const b = briefing(enquiries, businesses, bookings, filter);
  return (
    <div className="px-8 py-16">
      <EmptyState
        title="Nothing selected"
        body={
          b.needsYou
            ? `${b.needsYou} need you. Pick one from the queue - Enquiry already has a recommended next action.`
            : "You’re caught up in this filter. Waiting work is on the customer."
        }
      />
    </div>
  );
}
