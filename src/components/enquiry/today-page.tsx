import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useNarrow } from "@/lib/use-narrow";
import { Segmented } from "@/components/ui/segmented";
import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Menu,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { activeBookings, sortedOnDay, weekDays as calendarWeekDays } from "@/domain/calendar";
import {
  derivedLabel,
  needsYouSentence,
  nextStepLabel,
  QUEUE_NAMES,
  queueSection,
  queueSummary,
  STATUS,
} from "@/domain/labels";
import {
  addCalendarDays,
  dateFromDayKey,
  dayKeyFromDate,
  formatDayHeading,
  formatTime,
  formatWeekdayMed,
  todayKey as todayKeyInZone,
  wallNow,
} from "@/domain/format";
import { catchUpSince, rowTimeCue } from "@/domain/time-cues";
import { statusTone } from "@/domain/status-tone";
import type { Enquiry, WorkspacePrefs } from "@/domain/types";
import { usePrototype } from "@/store/prototype-store";
import { AddEnquiry } from "./add-enquiry";

/** Oldest wait first: the person who has waited longest is the one to start with. */
function waitingSince(e: Enquiry): number {
  const lastIn = [...e.conversation].reverse().find((m) => m.direction === "inbound");
  return Date.parse(lastIn?.at ?? e.receivedAt) || 0;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

function EnquiryRow({ enquiry, prefs }: { enquiry: Enquiry; prefs: WorkspacePrefs }) {
  return (
    <li>
      <Link
        to="/enquiries/$enquiryId"
        params={{ enquiryId: enquiry.id }}
        className="today-enquiry-row"
      >
        <span className="customer-avatar" aria-hidden>
          {initials(enquiry.customerName)}
        </span>
        <span className="today-row-content">
          <span className="today-row-title">
            <strong>{enquiry.customerName}</strong>
            <Badge tone={statusTone(enquiry)}>{derivedLabel(enquiry.state, enquiry)}</Badge>
          </span>
          {/* The owner's next step leads, not the customer's message. */}
          <span className="today-row-next">{nextStepLabel(enquiry)}</span>
          <span className="today-row-meta">
            {[enquiry.serviceLabel, enquiry.dateLabel ? `Job ${enquiry.dateLabel}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="today-row-cue">{rowTimeCue(enquiry, prefs)}</span>
        </span>
        <ChevronRight size={16} aria-hidden />
      </Link>
    </li>
  );
}

function StartHere({ enquiry, prefs }: { enquiry: Enquiry; prefs: WorkspacePrefs }) {
  return (
    <section className="today-start" aria-labelledby="start-here-title">
      <p className="today-start-kicker">Start here</p>
      <h2 id="start-here-title">{enquiry.customerName}</h2>
      <p className="today-start-meta">
        {[enquiry.serviceLabel, rowTimeCue(enquiry, prefs)].filter(Boolean).join(" · ")}
      </p>
      <p className="today-start-next">{nextStepLabel(enquiry)}</p>
      <Button asChild className="mt-4 min-h-12 w-full sm:w-auto">
        <Link to="/enquiries/$enquiryId" params={{ enquiryId: enquiry.id }}>
          Open this enquiry <ArrowRight size={16} aria-hidden />
        </Link>
      </Button>
    </section>
  );
}

function CatchUpLine({ enquiries }: { enquiries: Enquiry[] }) {
  const lastSeen = usePrototype((s) => s.lastSeenPrevious);
  const catchUp = catchUpSince(enquiries, lastSeen);
  if (!catchUp) return null;
  const parts = [
    catchUp.arrived
      ? `${catchUp.arrived} new ${catchUp.arrived === 1 ? "enquiry" : "enquiries"}`
      : "",
    catchUp.answered
      ? `${catchUp.answered} ${catchUp.answered === 1 ? "answer" : "answers"} from customers`
      : "",
    catchUp.due ? `${catchUp.due} back to you` : "",
  ].filter(Boolean);
  return (
    <p className="today-catchup" role="status">
      <strong>Since you were last here:</strong> {parts.join(", ")}.
    </p>
  );
}

/**
 * The first thing a new owner sees after onboarding: one next step, nothing to
 * decode. No stats, no calendar, no empty tabs.
 */
function FirstRun() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const businesses = usePrototype((s) => s.businesses);
  const filter = usePrototype((s) => s.businessFilter);
  const business = businesses.find((b) => b.id === filter) ?? businesses[0];
  return (
    <section className="today-start" aria-labelledby="first-run-title">
      <p className="today-start-kicker">Your first step</p>
      <h2 id="first-run-title">Add your first enquiry</h2>
      <p className="today-start-meta">
        Paste what a customer sent you. Enquiry works out what you can safely promise and prepares a
        reply for you to check. Nothing is sent.
      </p>
      <Button
        className="mt-4 min-h-12 w-full sm:w-auto"
        onClick={() => setOpen(true)}
        disabled={!business}
      >
        Add your first enquiry
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Add an enquiry" className="max-h-[90dvh] overflow-y-auto">
          {business ? (
            <AddEnquiry
              initiallyOpen
              business={business}
              onCancel={() => setOpen(false)}
              onCreated={(id) => {
                setOpen(false);
                void navigate({ to: "/enquiries/$enquiryId", params: { enquiryId: id } });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function TodayPage() {
  const phone = useNarrow(860) !== false;
  const [view, setView] = useState("needs_you");
  const enquiries = usePrototype((s) => s.enquiries);
  const bookings = usePrototype((s) => s.bookings);
  const businesses = usePrototype((s) => s.businesses);
  const filter = usePrototype((s) => s.businessFilter);
  const demoMode = usePrototype((s) => s.demoMode);
  const prefs = usePrototype((s) => s.prefs);
  const setQueueFilter = usePrototype((s) => s.setQueueFilter);
  const tz = prefs.timezone || "Australia/Brisbane";
  const visible = enquiries.filter((e) => filter === "all" || e.businessId === filter);
  const summary = queueSummary(visible);
  const firstRun = !demoMode && visible.length === 0;
  const needsYou = visible
    .filter((e) => queueSection(e) === "needs_you")
    .sort((a, b) => waitingSince(a) - waitingSince(b));
  const waiting = visible.filter((e) => queueSection(e) === "waiting");
  const start = needsYou[0];
  const showingWaiting = phone && view === "waiting";
  const listed = (showingWaiting ? waiting : needsYou.slice(1)).slice(0, phone ? 5 : 4);
  const todayKey = todayKeyInZone(new Date(), tz);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const day = selectedDay ?? todayKey;
  const scopedBookings = activeBookings(
    bookings.filter((b) => filter === "all" || b.businessId === filter),
  );
  const dayBookings = sortedOnDay(scopedBookings, day);
  const weekAnchor = dateFromDayKey(day);
  const weekDays = calendarWeekDays(weekAnchor);
  const business =
    businesses.find((b) => b.id === filter) ??
    (businesses.length === 1 ? businesses[0] : undefined);
  const hour = wallNow(new Date(), tz).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="ui-page-scroll">
      <div className={`ui-page today-page ${phone ? "today-phone" : ""}`}>
        <header className="ui-page-header">
          {phone ? (
            <Link
              to="/more"
              className="today-menu"
              aria-label="More destinations"
              title="More destinations"
            >
              <Menu size={19} />
            </Link>
          ) : null}
          <div>
            <h1>
              {phone
                ? "Today"
                : `${greeting}${business?.ownerFirstName ? `, ${business.ownerFirstName}` : ""}`}
            </h1>
            <p className="ui-page-description">
              {firstRun ? "Your workspace is ready." : needsYouSentence(summary.needsYou)}
            </p>
          </div>
          {firstRun ? null : (
            <Link
              to="/enquiries"
              onClick={() => setQueueFilter("all")}
              className="ui-search-link"
              aria-label="Search enquiries"
            >
              <Search size={17} aria-hidden />
              <span>Search enquiries</span>
              <ArrowRight size={16} aria-hidden />
            </Link>
          )}
        </header>

        {firstRun ? (
          <FirstRun />
        ) : (
          <>
            {demoMode ? null : <CatchUpLine enquiries={visible} />}

            {phone ? (
              <div className="today-phone-tabs">
                <Segmented
                  ariaLabel="Today view"
                  value={view}
                  onChange={setView}
                  options={[
                    { id: "needs_you", label: QUEUE_NAMES.needs_you },
                    { id: "waiting", label: QUEUE_NAMES.waiting },
                    { id: "booked", label: STATUS.booked },
                  ]}
                />
              </div>
            ) : null}

            <div className="today-work-grid">
              {phone && view === "booked" ? null : (
                <section
                  key={phone ? view : "attention"}
                  className="today-attention"
                  aria-labelledby="attention-title"
                >
                  {!showingWaiting && start ? <StartHere enquiry={start} prefs={prefs} /> : null}
                  {listed.length ? (
                    <>
                      <div className="ui-section-heading">
                        <h2 id="attention-title">
                          {showingWaiting ? "Waiting on customers" : "After that"}
                        </h2>
                      </div>
                      <ul className="today-enquiries">
                        {listed.map((enquiry) => (
                          <EnquiryRow key={enquiry.id} enquiry={enquiry} prefs={prefs} />
                        ))}
                      </ul>
                    </>
                  ) : start && !showingWaiting ? (
                    <h2 id="attention-title" className="sr-only">
                      {QUEUE_NAMES.needs_you}
                    </h2>
                  ) : (
                    <div className="ui-empty">
                      <CheckCheck size={28} className="text-ok" aria-hidden />
                      <h2 id="attention-title" className="today-empty-title">
                        {showingWaiting ? "Nobody is waiting" : "Nothing needs you right now"}
                      </h2>
                      <p>
                        {showingWaiting
                          ? "When you send a reply, the customer shows here until they answer."
                          : "New enquiries and anything that comes back to you will show here."}
                      </p>
                    </div>
                  )}
                  {phone && !showingWaiting && summary.atRisk > 0 ? (
                    <Link
                      to="/enquiries"
                      onClick={() => setQueueFilter("at_risk")}
                      className="today-risk-link"
                    >
                      <Clock3 size={16} aria-hidden />
                      <span>
                        {summary.atRisk === 1
                          ? "One enquiry needs a look"
                          : "A few enquiries need a look"}
                      </span>
                      <ChevronRight size={16} aria-hidden />
                    </Link>
                  ) : null}
                  <Link
                    to="/enquiries"
                    onClick={() => setQueueFilter("all")}
                    className="ui-text-link"
                  >
                    View all enquiries <ArrowRight size={16} aria-hidden />
                  </Link>
                </section>
              )}

              {phone && view !== "booked" ? null : (
                <aside className="today-schedule" aria-labelledby="schedule-title">
                  <div className="ui-section-heading">
                    <h2 id="schedule-title">{formatDayHeading(day)}</h2>
                    <Link to="/bookings" aria-label="View booked calendar" title="View calendar">
                      <CalendarDays size={19} />
                    </Link>
                  </div>
                  <div className="today-week-controls">
                    <button
                      type="button"
                      aria-label="Previous week"
                      title="Previous week"
                      onClick={() =>
                        setSelectedDay(dayKeyFromDate(addCalendarDays(weekAnchor, -7)))
                      }
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      className="today-reset-date"
                      onClick={() => setSelectedDay(null)}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      aria-label="Next week"
                      title="Next week"
                      onClick={() => setSelectedDay(dayKeyFromDate(addCalendarDays(weekAnchor, 7)))}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="today-week" role="group" aria-label="Booking day">
                    {weekDays.map((date) => {
                      const key = dayKeyFromDate(date);
                      return (
                        <button
                          type="button"
                          key={key}
                          aria-label={formatDayHeading(key)}
                          aria-pressed={key === day}
                          aria-current={key === todayKey ? "date" : undefined}
                          onClick={() => setSelectedDay(key)}
                        >
                          <span>{formatWeekdayMed(date)}</span>
                          <strong>{date.getDate()}</strong>
                          <i
                            className={
                              sortedOnDay(scopedBookings, key).length ? "has-bookings" : ""
                            }
                            aria-hidden
                          />
                        </button>
                      );
                    })}
                  </div>
                  {dayBookings.length ? (
                    <ul className="today-bookings">
                      {dayBookings.map((booking) => (
                        <li key={booking.id}>
                          <span className="today-time">{formatTime(booking.when)}</span>
                          <span>
                            <strong>{booking.customerName}</strong>
                            <span>{booking.serviceLabel}</span>
                            {booking.status === "pending" ? (
                              <Badge tone="warn">On hold</Badge>
                            ) : null}
                            {booking.status === "external_pending" ? (
                              <Badge tone="warn">{STATUS.bookingToConfirm}</Badge>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="schedule-empty">
                      <CalendarDays size={30} strokeWidth={1.4} aria-hidden />
                      <h3>A little breathing room</h3>
                      <p>{day === todayKey ? "No bookings today." : "No bookings on this day."}</p>
                      <Link to="/bookings" className="ui-text-link">
                        View upcoming <ArrowRight size={15} aria-hidden />
                      </Link>
                    </div>
                  )}
                  {summary.atRisk > 0 ? (
                    <div className="today-risk">
                      <Clock3 size={17} aria-hidden />
                      <p>
                        {summary.atRisk === 1
                          ? "One enquiry needs a look."
                          : "A few enquiries need a look."}
                        <Link to="/enquiries" onClick={() => setQueueFilter("at_risk")}>
                          Look at them <ArrowRight size={14} aria-hidden />
                        </Link>
                      </p>
                    </div>
                  ) : null}
                </aside>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
