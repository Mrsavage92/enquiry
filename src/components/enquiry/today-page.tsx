import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useNarrow } from "@/lib/use-narrow";
import { Segmented } from "@/components/ui/segmented";
import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock3,
  Inbox,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { activeBookings, sortedOnDay } from "@/domain/calendar";
import { derivedLabel, queueSection, queueSummary } from "@/domain/labels";
import { formatDayHeading, formatTime, todayKey as todayKeyInZone } from "@/domain/format";
import { statusTone } from "@/domain/status-tone";
import { usePrototype } from "@/store/prototype-store";

export function TodayPage() {
  const phone = useNarrow(860) !== false;
  const [view, setView] = useState("needs_you");
  const enquiries = usePrototype((s) => s.enquiries);
  const bookings = usePrototype((s) => s.bookings);
  const filter = usePrototype((s) => s.businessFilter);
  const setQueueFilter = usePrototype((s) => s.setQueueFilter);
  const tz = usePrototype((s) => s.prefs.timezone) || "Australia/Brisbane";
  const visible = enquiries.filter((e) => filter === "all" || e.businessId === filter);
  const summary = queueSummary(visible);
  const needsYou = visible
    .filter((e) => queueSection(e) === (phone && view === "waiting" ? "waiting" : "needs_you"))
    .slice(0, phone ? 20 : 5);
  const todayKey = todayKeyInZone(new Date(), tz);
  const todayBookings = sortedOnDay(
    activeBookings(bookings.filter((b) => filter === "all" || b.businessId === filter)),
    todayKey,
  );

  return (
    <div className="ui-page-scroll">
      <div className={`ui-page today-page ${phone ? "today-phone" : ""}`}>
        <header className="ui-page-header">
          <div>
            <p className="ui-date">{formatDayHeading(todayKey)}</p>
            <h1>Today</h1>
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
                            <span className="today-row-meta">
                              {enquiry.serviceLabel}
                              {enquiry.dateLabel ? ` · ${enquiry.dateLabel}` : ""}
                            </span>
                            {lastMessage ? (
                              <span className="today-row-preview">{lastMessage.body}</span>
                            ) : null}
                          </span>
                          <ChevronRight size={17} className="text-stone" aria-hidden />
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
                <h2 id="schedule-title">Your day</h2>
                <Link to="/bookings" aria-label="View booked calendar" title="View calendar">
                  <CalendarDays size={19} />
                </Link>
              </div>
              <p className="text-sm text-stone">{formatDayHeading(todayKey)}</p>
              {todayBookings.length ? (
                <ul className="today-bookings">
                  {todayBookings.map((booking) => (
                    <li key={booking.id}>
                      <span className="today-time">{formatTime(booking.when)}</span>
                      <span>
                        <strong>{booking.customerName}</strong>
                        <span>{booking.serviceLabel}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="schedule-empty">
                  <CalendarDays size={30} strokeWidth={1.4} aria-hidden />
                  <h3>A little breathing room</h3>
                  <p>No bookings today.</p>
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
    </div>
  );
}
