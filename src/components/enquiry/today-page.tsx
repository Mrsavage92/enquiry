import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Inbox, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { activeBookings, sortedOnDay } from "@/domain/calendar";
import { channelLabel } from "@/domain/channel";
import {
  commercialValue,
  derivedLabel,
  formatAud,
  queueHeadline,
  queueSection,
  queueSummary,
} from "@/domain/labels";
import {
  formatDayHeading,
  formatTime,
  todayKey as todayKeyInZone,
} from "@/domain/format";
import { statusTone } from "@/domain/status-tone";
import { usePrototype } from "@/store/prototype-store";

export function TodayPage() {
  const enquiries = usePrototype((s) => s.enquiries);
  const bookings = usePrototype((s) => s.bookings);
  const businesses = usePrototype((s) => s.businesses);
  const filter = usePrototype((s) => s.businessFilter);
  const tz = usePrototype((s) => s.prefs.timezone) || "Australia/Brisbane";
  const visibleEnquiries =
    filter === "all" ? enquiries : enquiries.filter((enquiry) => enquiry.businessId === filter);
  const summary = queueSummary(visibleEnquiries);
  const needsYou = visibleEnquiries
    .filter((enquiry) => queueSection(enquiry) === "needs_you")
    .slice(0, 5);
  const scopedBookings =
    filter === "all" ? bookings : bookings.filter((booking) => booking.businessId === filter);
  const todayKey = todayKeyInZone(new Date(), tz);
  const todayBookings = sortedOnDay(activeBookings(scopedBookings), todayKey).slice(0, 4);
  const businessName =
    filter === "all"
      ? "All workspaces"
      : (businesses.find((business) => business.id === filter)?.name ?? "Workspace");
  const exactOpen = visibleEnquiries.filter((enquiry) => commercialValue(enquiry).kind === "exact");

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-5 pb-10 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-stone">{businessName}</p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">Today</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-2">
              {summary.needsYou > 0
                ? "The next work is ready. Everything else can stay quiet for a moment."
                : "No owner action is waiting right now."}
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/enquiries">
              <Search className="size-4" aria-hidden />
              Search enquiries
            </Link>
          </Button>
        </header>

        <section className="rounded-2xl bg-raised p-5 shadow-border sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-stone">Needs attention</p>
              <h2 className="mt-1 text-3xl font-semibold leading-tight">{queueHeadline(summary)}</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-ink-2">
              <span>{summary.waiting} waiting</span>
              {summary.atRisk ? <span>{summary.atRisk} at risk</span> : null}
              {exactOpen.length ? <span>{formatAud(summary.exactValue)} open quoted value</span> : null}
            </div>
          </div>

          {needsYou.length === 0 ? (
            <div className="mt-8 rounded-xl bg-paper-2 px-4 py-6">
              <p className="font-medium">You are caught up.</p>
              <p className="mt-1 text-sm text-ink-2">
                Waiting enquiries and booked work are still available from the main navigation.
              </p>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-line">
              {needsYou.map((enquiry) => (
                <li key={enquiry.id}>
                  <Link
                    to="/enquiries/$enquiryId"
                    params={{ enquiryId: enquiry.id }}
                    className="group grid min-h-20 gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-lg font-semibold">{enquiry.customerName}</p>
                        <Badge tone={statusTone(enquiry)}>{derivedLabel(enquiry.state, enquiry)}</Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-ink-2">
                        {enquiry.serviceLabel}
                        {enquiry.dateLabel ? ` · ${enquiry.dateLabel}` : ""}
                        <span className="text-stone">
                          {" · "}
                          {channelLabel(enquiry.source)}
                        </span>
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-mark group-hover:text-mark-hover">
                      Open
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-2xl bg-raised p-5 shadow-border sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-stone">Booked today</p>
                <h2 className="mt-1 text-2xl font-semibold">{formatDayHeading(todayKey)}</h2>
              </div>
              <CalendarDays className="size-5 text-mark" aria-hidden />
            </div>
            {todayBookings.length === 0 ? (
              <p className="mt-5 text-sm text-ink-2">No confirmed booking is scheduled today.</p>
            ) : (
              <ul className="mt-5 divide-y divide-line">
                {todayBookings.map((booking) => (
                  <li key={booking.id} className="flex items-baseline justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{booking.customerName}</p>
                      <p className="mt-1 truncate text-sm text-ink-2">{booking.serviceLabel}</p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-stone">
                      {formatTime(booking.when)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="ghost" className="mt-4 px-0">
              <Link to="/bookings">Open booked work</Link>
            </Button>
          </div>

          <div className="rounded-2xl bg-paper-2 p-5 sm:p-6">
            <Inbox className="size-5 text-mark" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">All enquiries stay available.</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Today keeps the next work calm. The full searchable list is still one tap away.
            </p>
            <Button asChild className="mt-5 w-full">
              <Link to="/enquiries">Open enquiries</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
