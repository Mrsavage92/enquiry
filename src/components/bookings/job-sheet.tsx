import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useNarrow } from "@/lib/use-narrow";
import { usePrototype } from "@/store/prototype-store";
import { BUSINESS_BY_ID } from "@/fixtures";
import { formatAud } from "@/domain/labels";
import {
  addMinutesToIso,
  dayKeyFromIso,
  formatDayHeading,
  formatDuration,
  formatTime,
  formatTimeRange,
  hmFromIso,
  isoFromDayAndTime,
} from "@/domain/format";
import {
  bookingEnd,
  conflictsFor,
  durationOf,
  isHoldDue,
  happeningNow,
  proposedBooking,
  sameOffset,
} from "@/domain/calendar";
import type { Booking } from "@/domain/types";
import { toastUndo } from "@/lib/toast-undo";
import { cn } from "@/lib/utils";

const DURATIONS = [45, 60, 90, 120, 180, 240, 300, 360];

export function JobSheet({
  booking,
  open,
  onOpenChange,
}: {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const phone = useNarrow(860) ?? true;
  const [mode, setMode] = useState<"detail" | "move" | "drop">("detail");

  useEffect(() => {
    if (open) setMode("detail");
  }, [open, booking?.id]);

  if (!booking) return null;

  const title =
    mode === "move" ? "Move" : mode === "drop" ? "Take off the diary" : booking.customerName;
  const Panel = phone ? SheetContent : DialogContent;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <Panel title={title} className={phone ? undefined : "sm:max-w-md"}>
        {mode === "move" ? (
          <MoveForm booking={booking} onBack={() => setMode("detail")} onDone={() => onOpenChange(false)} />
        ) : mode === "drop" ? (
          <DropConfirm booking={booking} onBack={() => setMode("detail")} onDone={() => onOpenChange(false)} />
        ) : (
          <JobDetail booking={booking} onMove={() => setMode("move")} onDrop={() => setMode("drop")} />
        )}
      </Panel>
    </Sheet>
  );
}

function JobDetail({
  booking,
  onMove,
  onDrop,
}: {
  booking: Booking;
  onMove: () => void;
  onDrop: () => void;
}) {
  const recordDeposit = usePrototype((s) => s.recordDeposit);
  const confirm = usePrototype((s) => s.confirmExternalBooking);
  const enquiries = usePrototype((s) => s.enquiries);
  const all = usePrototype((s) => s.bookings);
  const business = BUSINESS_BY_ID[booking.businessId];
  const enquiry = enquiries.find((e) => e.id === booking.enquiryId);
  const holdDue = isHoldDue(booking);
  const end = bookingEnd(booking);
  const duration = durationOf(booking);
  const clashes = conflictsFor(booking, all);
  const now = happeningNow(booking);

  return (
    <div className="space-y-5">
      <div>
        <p className="font-serif text-2xl tabular-nums tracking-tight commercial-exact">
          {formatTimeRange(booking.when, end)}
        </p>
        <p className="mt-1 text-sm text-ink-2">{formatDayHeading(booking.when)}</p>
        <p className="mt-3 text-sm text-ink-2">
          {booking.serviceLabel}
          <span className="text-stone">
            {" · "}
            {formatDuration(duration)}
            {booking.location ? ` · ${booking.location}` : ""}
          </span>
        </p>
        <p className="mt-1 text-sm text-stone">{business?.name}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {booking.value ? (
            <p className="font-serif text-xl tabular-nums tracking-tight commercial-exact">
              {formatAud(booking.value.amount)}
            </p>
          ) : null}
          <Badge tone={holdDue ? "warn" : booking.status === "external_pending" ? "warn" : now ? "ok" : "neutral"}>
            {now
              ? "Now"
              : holdDue
                ? "Hold due"
                : booking.depositPaid
                  ? "Hold recorded"
                  : booking.status === "external_pending"
                    ? "Handoff pending"
                    : "On the books"}
          </Badge>
        </div>
      </div>

      {clashes.length > 0 ? (
        <p className="text-sm text-warn">
          Overlaps {clashes.map((c) => c.customerName).join(", ")}.
        </p>
      ) : null}

      {booking.handoff ? <p className="text-sm text-ink-2">{booking.handoff}</p> : null}

      <div className="flex flex-col gap-2">
        {holdDue ? (
          <Button
            className="min-h-11 w-full"
            onClick={() => {
              recordDeposit(booking.id);
              toast("Hold recorded. The date is held.");
            }}
          >
            Record the hold
          </Button>
        ) : null}
        {enquiry ? (
          <Button size="md" variant="secondary" className="min-h-11 w-full" asChild>
            <Link to="/enquiries/$enquiryId" params={{ enquiryId: enquiry.id }}>
              Open enquiry
            </Link>
          </Button>
        ) : null}
        {booking.status === "external_pending" ? (
          <>
            <Button size="md" variant="secondary" className="min-h-11 w-full" asChild>
              <Link to="/book/$bookingId" params={{ bookingId: booking.id }}>
                Open customer page
              </Link>
            </Button>
            <Button
              size="md"
              variant="secondary"
              className="min-h-11 w-full"
              onClick={() => {
                confirm(booking.enquiryId);
                toast("Marked booked externally.");
              }}
            >
              Confirm booked externally
            </Button>
          </>
        ) : holdDue ? (
          <Button size="md" variant="ghost" className="min-h-11 w-full" asChild>
            <Link to="/book/$bookingId" params={{ bookingId: booking.id }}>
              Customer page
            </Link>
          </Button>
        ) : null}
        <Button size="md" variant="secondary" className="min-h-11 w-full" onClick={onMove}>
          Move time
        </Button>
        <Button size="md" variant="ghost" className="min-h-11 w-full text-danger" onClick={onDrop}>
          Take off the diary
        </Button>
      </div>
    </div>
  );
}

function MoveForm({
  booking,
  onBack,
  onDone,
}: {
  booking: Booking;
  onBack: () => void;
  onDone: () => void;
}) {
  const all = usePrototype((s) => s.bookings);
  const reschedule = usePrototype((s) => s.rescheduleBooking);
  const [day, setDay] = useState(dayKeyFromIso(booking.when));
  const [time, setTime] = useState(hmFromIso(booking.when));
  const [duration, setDuration] = useState(durationOf(booking));
  const offset = sameOffset(booking.when);
  const when = isoFromDayAndTime(day, time, offset);
  const next = proposedBooking(booking, when, duration);
  const clashes = useMemo(() => conflictsFor(next, all), [all, next]);
  const end = addMinutesToIso(when, duration);

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-2">
        {booking.customerName} · {booking.serviceLabel}
      </p>
      <label className="block text-sm">
        <span className="mb-1 block text-stone">Day</span>
        <input className="field h-11" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone">Start</span>
        <input className="field h-11" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <div>
        <p className="mb-1 text-sm text-stone">How long</p>
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setDuration(mins)}
              className={cn(
                "min-h-11 rounded-md px-3 text-sm font-medium",
                duration === mins ? "bg-ink text-paper" : "bg-paper-2 text-ink-2 hover:text-ink",
              )}
            >
              {formatDuration(mins)}
            </button>
          ))}
        </div>
      </div>
      <p className="font-serif text-xl tabular-nums tracking-tight">
        {formatTime(when)}–{formatTime(end)}
      </p>
      <p className="text-sm text-stone">{formatDuration(duration)}</p>
      {clashes.length > 0 ? (
        <p className="text-sm text-warn">
          Overlaps {clashes.map((c) => `${c.customerName} (${formatTime(c.when)})`).join(", ")}. You can still save.
        </p>
      ) : (
        <p className="text-sm text-stone">No overlap with other jobs for this business.</p>
      )}
      <div className="flex flex-col gap-2">
        <Button
          className="min-h-11 w-full"
          onClick={() => {
            reschedule(booking.id, when, duration);
            toastUndo(`Moved to ${formatTime(when)}.`);
            onDone();
          }}
        >
          Save time
        </Button>
        <Button variant="ghost" className="min-h-11 w-full" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function DropConfirm({
  booking,
  onBack,
  onDone,
}: {
  booking: Booking;
  onBack: () => void;
  onDone: () => void;
}) {
  const cancel = usePrototype((s) => s.cancelBooking);
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink-2">
        {booking.customerName} comes off the diary. The enquiry stays on file. Undo with U.
      </p>
      <div className="flex flex-col gap-2">
        <Button
          variant="danger"
          className="min-h-11 w-full"
          onClick={() => {
            cancel(booking.id);
            toastUndo("Taken off the diary.");
            onDone();
          }}
        >
          Take off
        </Button>
        <Button variant="ghost" className="min-h-11 w-full" onClick={onBack}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
