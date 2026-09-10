import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useNarrow } from "@/lib/use-narrow";
import { Segmented } from "@/components/ui/segmented";
import { MoreSheet } from "@/components/shell/more-sheet";
import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Inbox,
  Menu,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { activeBookings, sortedOnDay, weekDays as calendarWeekDays } from "@/domain/calendar";
import { derivedLabel, queueSection, queueSummary } from "@/domain/labels";
import {
  addCalendarDays,
  dateFromDayKey,
  dayKeyFromDate,
  formatDayHeading,
  formatRelative,
  formatTime,
  formatWeekdayMed,
  todayKey as todayKeyInZone,
  wallNow,
} from "@/domain/format";
import { statusTone } from "@/domain/status-tone";
import { usePrototype } from "@/store/prototype-store";

export function TodayPage() {
  const phone = useNarrow(860) !== false;
  const [view, setView] = useState("needs_you");
  const [moreOpen, setMoreOpen] = useState(false);
  const enquiries = usePrototype((s) => s.enquiries);
  const bookings = usePrototype((s) => s.bookings);
  const businesses = usePrototype((s) => s.businesses);
  const filter = usePrototype((s) => s.businessFilter);
  const setQueueFilter = usePrototype((s) => s.setQueueFilter);
  const tz = usePrototype((s) => s.prefs.timezone) || "Australia/Brisbane";
  const visible = enquiries.filter((e) => filter === "all" || e.businessId === filter);
  const summary = queueSummary(visible);
  const needsYou = visible
    .filter((e) => queueSection(e) === (phone && view === "waiting" ? "waiting" : "needs_you"))
    .slice(0, phone ? 5 : 3);
  const todayKey = todayKeyInZone(new Date(), tz);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const day = selectedDay ?? todayKey;
  const scopedBookings = activeBookings(
    bookings.filter((b) => filter === "all" || b.businessId === filter),
  );
  const todayBookings = sortedOnDay(scopedBookings, todayKey);
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
            <button
              type="button"
              className="today-menu"
              aria-label="More destinations"
              title="More destinations"
              onClick={() => setMoreOpen(true)}
            >
              <Menu size={19} />
            </button>
          ) : null}
          <div>
            <h1>
              {phone
                ? "Today"
                : `${greeting}${business?.ownerFirstName ? `, ${business.ownerFirstName}` : ""}`}
            </h1>
            <p className="ui-page-description">
              {summary.needsYou
                ? `${summary.needsYou} ${summary.needsYou === 1 ? "enquiry needs" : "enquiries need"} your attention.`
                : summary.atRisk
                  ? "An enquiry needs a closer look."
                  : "You're all caught up."}
            </p>
          </div>
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
        </header>

        {phone ? (
          <div className="today-phone-tabs">
            <Segmented
              ariaLabel="Today view"
              value={view}
              onChange={setView}
              options={[
                { id: "needs_you", label: "Needs you", count: summary.needsYou },
                { id: "waiting", label: "Awaiting", count: summary.waiting },
                { id: "booked", label: "Booked", count: todayBookings.length },
              ]}
            />
          </div>
        ) : (
          <div className="today-summary" aria-label="Today's summary">
            <Link
              to="/enquiries"
              onClick={() => setQueueFilter("needs_you")}
              className="today-stat"
            >
              <span className="ui-icon-tile tone-violet">
                <Inbox size={19} />
              </span>
              <span>
                <strong>{summary.needsYou}</strong>
                <span>Need your attention</span>
              </span>
              <ChevronRight size={16} className="text-stone" />
            </Link>
            <Link to="/enquiries" onClick={() => setQueueFilter("waiting")} className="today-stat">
              <span className="ui-icon-tile tone-amber">
                <Clock3 size={19} />
              </span>
              <span>
                <strong>{summary.waiting}</strong>
                <span>Waiting on a reply</span>
              </span>
              <ChevronRight size={16} className="text-stone" />
            </Link>
            <Link to="/bookings" search={{ on: todayKey }} className="today-stat">
              <span className="ui-icon-tile tone-green">
                <CalendarDays size={19} />
              </span>
              <span>
                <strong>{todayBookings.length}</strong>
                <span>Booked today</span>
              </span>
              <ChevronRight size={16} className="text-stone" />
            </Link>
          </div>
        )}

        <div className="today-work-grid">
          {phone && view === "needs_you" && summary.atRisk > 0 ? (
            <Link
              to="/enquiries"
              onClick={() => setQueueFilter("at_risk")}
              className="today-risk-link"
            >
              <Clock3 size={16} aria-hidden />
              <span>
                {summary.atRisk} {summary.atRisk === 1 ? "enquiry needs" : "enquiries need"} a
                closer look
              </span>
              <ChevronRight size={16} aria-hidden />
            </Link>
          ) : null}
          {phone && view === "booked" ? null : (
            <section className="today-attention" aria-labelledby="attention-title">
              <div className="ui-section-heading">
                <h2 id="attention-title">Needs your attention</h2>
                <span className="ui-count">{summary.needsYou}</span>
              </div>
              {needsYou.length ? (
                <ul className="today-enquiries">
                  {needsYou.map((enquiry) => {
                    const lastMessage = enquiry.conversation
                      .filter((m) => m.direction === "inbound")
                      .at(-1);
                    return (
                      <li key={enquiry.id}>
                        <Link
                          to="/enquiries/$enquiryId"
                          params={{ enquiryId: enquiry.id }}
                          className="today-enquiry-row"
                        >
                          <span className="customer-avatar" aria-hidden>
                            {enquiry.customerName
                              .split(/\s+/)
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <span className="today-row-content">
                            <span className="today-row-title">
                              <strong>{enquiry.customerName}</strong>
                              <Badge tone={statusTone(enquiry)}>
                                {derivedLabel(enquiry.state, enquiry)}
                              </Badge>
                            </span>
                            <span className="today-row-meta">{enquiry.serviceLabel}</span>
                            {lastMessage ? (
                              <span className="today-row-preview">{lastMessage.body}</span>
                            ) : null}
                          </span>
                          <span className="today-row-update">
                            <time dateTime={enquiry.updatedAt} title={enquiry.updatedAt}>
                              {formatRelative(enquiry.updatedAt)}
                            </time>
                            <ChevronRight size={16} aria-hidden />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="ui-empty">
                  <CheckCheck size={28} className="text-ok" aria-hidden />
                  <h3>
                    {view === "waiting" ? "No replies pending" : "Nothing needs you right now"}
                  </h3>
                  <p>
                    {view === "waiting"
                      ? "Enquiries awaiting a customer reply will appear here."
                      : "New enquiries will appear here."}
                  </p>
                </div>
              )}
              <Link to="/enquiries" onClick={() => setQueueFilter("all")} className="ui-text-link">
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
                  onClick={() => setSelectedDay(dayKeyFromDate(addCalendarDays(weekAnchor, -7)))}
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
                        className={sortedOnDay(scopedBookings, key).length ? "has-bookings" : ""}
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
                        {booking.status === "pending" ? <Badge tone="warn">On hold</Badge> : null}
                        {booking.status === "external_pending" ? (
                          <Badge tone="warn">Awaiting confirmation</Badge>
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
                    {summary.atRisk} {summary.atRisk === 1 ? "enquiry needs" : "enquiries need"} a
                    closer look.
                    <Link to="/enquiries" onClick={() => setQueueFilter("at_risk")}>
                      Review enquiries <ArrowRight size={14} aria-hidden />
                    </Link>
                  </p>
                </div>
              ) : null}
            </aside>
          )}
        </div>
      </div>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </div>
  );
}
