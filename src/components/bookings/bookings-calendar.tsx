import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import {
  activeBookings,
  bookingEnd,
  conflictsFor,
  durationOf,
  gapAfter,
  happeningNow,
  hoursSpan,
  isHoldDue,
  layoutDay,
  monthMatrix,
  sortedOnDay,
  weekDays,
  weekValue,
} from "@/domain/calendar";
import {
  dateFromDayKey,
  dayKeyFromDate,
  dayKeyFromIso,
  formatDayHeading,
  formatDuration,
  formatTime,
  formatTimeRange,
  formatWeekdayMed,
  todayKey as todayKeyInZone,
  wallDate,
  wallNow,
} from "@/domain/format";
import { formatAud } from "@/domain/labels";
import { usePrototype } from "@/store/prototype-store";
import type { Booking } from "@/domain/types";
import { cn } from "@/lib/utils";
import { JobSheet } from "./job-sheet";

type CalView = "day" | "week" | "month";

const PX_PER_HOUR = 56;

export function BookingsCalendar({
  phone,
  initialDay,
  initialJob,
}: {
  phone: boolean;
  initialDay?: string;
  initialJob?: string;
}) {
  const bookings = usePrototype((s) => s.bookings);
  const filter = usePrototype((s) => s.businessFilter);
  const tz = usePrototype((s) => s.prefs.timezone) || "Australia/Brisbane";
  const visible = useMemo(() => {
    const scoped = filter === "all" ? bookings : bookings.filter((b) => b.businessId === filter);
    return activeBookings(scoped);
  }, [bookings, filter]);

  const todayKey = todayKeyInZone(new Date(), tz);
  const [view, setView] = useState<CalView>("day");
  const [cursor, setCursor] = useState(
    initialDay && /^\d{4}-\d{2}-\d{2}$/.test(initialDay) ? initialDay : todayKey,
  );
  const [openId, setOpenId] = useState<string | null>(initialJob ?? null);
  const openBooking = visible.find((b) => b.id === openId) ?? bookings.find((b) => b.id === openId) ?? null;

  useEffect(() => {
    if (!initialJob) return;
    const hit = usePrototype.getState().bookings.find((b) => b.id === initialJob);
    if (hit) setCursor(dayKeyFromIso(hit.when));
  }, [initialJob]);

  const cursorDate = dateFromDayKey(cursor);
  const week = weekDays(cursorDate);
  const weekStart = dayKeyFromDate(week[0]!);
  const weekEnd = dayKeyFromDate(week[6]!);
  const weekSum = weekValue(visible, weekStart, weekEnd);
  const weekCount = visible.filter((b) => {
    const key = dayKeyFromIso(b.when);
    return key >= weekStart && key <= weekEnd;
  }).length;
  const holdDue = visible.filter(isHoldDue).length;
  const dayJobs = sortedOnDay(visible, cursor);
  const wide = view === "week" && !phone ? "max-w-6xl" : view === "month" ? "max-w-3xl" : "max-w-2xl";

  const summary = visible.length === 0
    ? "Nothing handed off yet"
    : [
        `${weekCount} this week`,
        weekSum ? formatAud(weekSum) : null,
        holdDue ? `${holdDue} hold due` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className={cn("mx-auto px-4 py-5 pb-8 sm:py-8", wide)}>
      {phone ? (
        <header className="px-1 pb-1">
          <p className="text-3xl font-semibold leading-tight tracking-tight">Booked</p>
          <p className="mt-1 text-sm text-stone">{summary}</p>
        </header>
      ) : (
        <PageHeader
          title="Bookings"
          description="Committed work from accepted quotes. Enquiry is not a dispatch board."
        >
          <p className="mt-3 text-sm text-stone">{summary}</p>
        </PageHeader>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          body="Enquiry hands work off once a quote is accepted. Open enquiries still sit in Today."
          action={
            <Button size="sm" variant="secondary" asChild>
              <Link to="/enquiries">Open enquiries</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mt-5 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { id: "day", label: "Day" },
                  { id: "week", label: "Week" },
                  { id: "month", label: "Month" },
                ]}
                ariaLabel="Calendar view"
                fullWidth={phone}
              />
            </div>
            {cursor !== todayKey ? (
              <Button size="sm" variant="secondary" onClick={() => setCursor(todayKey)}>
                Today
              </Button>
            ) : null}
          </div>

          {view === "day" ? (
            <WeekStrip bookings={visible} cursor={cursor} todayKey={todayKey} onSelect={setCursor} />
          ) : null}

          {view === "day" ? (
            <DayAgenda dayKey={cursor} jobs={dayJobs} all={visible} onOpen={setOpenId} />
          ) : null}
          {view === "week" && phone ? (
            <PhoneWeek
              days={week}
              bookings={visible}
              cursor={cursor}
              todayKey={todayKey}
              onSelectDay={setCursor}
              onOpen={setOpenId}
            />
          ) : null}
          {view === "week" && !phone ? (
            <WeekGrid
              days={week}
              bookings={visible}
              cursor={cursor}
              todayKey={todayKey}
              onSelectDay={setCursor}
              onOpen={setOpenId}
            />
          ) : null}
          {view === "month" ? (
            <MonthGrid
              cursor={cursor}
              todayKey={todayKey}
              bookings={visible}
              onSelect={(key) => {
                setCursor(key);
                if (phone) setView("day");
              }}
              onOpen={setOpenId}
              showAgenda={!phone}
            />
          ) : null}
        </>
      )}

      <JobSheet booking={openBooking} open={Boolean(openBooking)} onOpenChange={(v) => !v && setOpenId(null)} />
    </div>
  );
}

function WeekStrip({
  bookings,
  cursor,
  todayKey,
  onSelect,
}: {
  bookings: Booking[];
  cursor: string;
  todayKey: string;
  onSelect: (key: string) => void;
}) {
  const days = weekDays(dateFromDayKey(cursor));
  const shift = (delta: number) => {
    const d = dateFromDayKey(cursor);
    d.setDate(d.getDate() + delta);
    onSelect(dayKeyFromDate(d));
  };

  return (
    <div className="mt-4 flex items-center gap-0.5">
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center text-ink-2"
        aria-label="Previous week"
        onClick={() => shift(-7)}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1">
        {days.map((d) => {
          const key = dayKeyFromDate(d);
          const selectedDay = key === cursor;
          const isToday = key === todayKey;
          const past = key < todayKey;
          const jobs = sortedOnDay(bookings, key);
          return (
            <button
              key={key}
              type="button"
              data-day={key}
              onClick={() => onSelect(key)}
              aria-current={selectedDay ? "date" : undefined}
              aria-label={`${formatDayHeading(key)}${jobs.length ? `, ${jobs.length} job${jobs.length === 1 ? "" : "s"}` : ""}`}
              className={cn(
                "flex h-16 min-w-0 flex-1 flex-col items-center justify-center rounded-md pt-1",
                selectedDay && "bg-ink text-paper",
                !selectedDay && isToday && "text-ink",
                !selectedDay && past && "text-stone",
                !selectedDay && !past && !isToday && "text-ink-2",
              )}
            >
              <span className="text-2xs font-medium">{formatWeekdayMed(d)}</span>
              <span className="text-lg font-semibold tabular-nums leading-none">{d.getDate()}</span>
              <span className="mt-1 flex h-1.5 items-center gap-0.5">
                {jobs.slice(0, 3).map((job) => (
                  <span
                    key={job.id}
                    className={cn(
                      "size-1 rounded-full",
                      selectedDay ? "bg-paper/80" : isHoldDue(job) ? "bg-warn" : "bg-ink/55",
                    )}
                  />
                ))}
                {jobs.length === 0 && isToday ? (
                  <span className={cn("block h-0.5 w-3 rounded-full", selectedDay ? "bg-paper/80" : "bg-ink")} />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center text-ink-2"
        aria-label="Next week"
        onClick={() => shift(7)}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function DayAgenda({
  dayKey,
  jobs,
  all,
  onOpen,
}: {
  dayKey: string;
  jobs: Booking[];
  all: Booking[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="mt-6">
      <p className="text-sm font-medium tracking-tight text-ink">{formatDayHeading(dayKey)}</p>
      {jobs.length === 0 ? (
        <div className="mt-6 border-t border-line pt-6">
          <p className="font-medium">Clear</p>
          <p className="mt-1 text-sm text-stone">Open enquiries still sit in Today.</p>
          <Button size="sm" variant="secondary" className="mt-4" asChild>
            <Link to="/enquiries">Open enquiries</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-4">
          {jobs.map((job, i) => {
            const prev = jobs[i - 1];
            const gap = prev ? gapAfter(prev, job) : null;
            return (
              <li key={job.id}>
                {gap ? <TravelLine gap={gap} /> : null}
                <AgendaRow job={job} all={all} onOpen={onOpen} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TravelLine({ gap }: { gap: NonNullable<ReturnType<typeof gapAfter>> }) {
  const dest = gap.to || "the next job";
  return (
    <p
      className={cn(
        "flex items-center gap-2 py-2 pl-[3.75rem] text-2xs",
        gap.tight ? "text-warn" : "text-stone",
      )}
    >
      <span className="h-px flex-1 bg-line" aria-hidden />
      {gap.tight
        ? `${gap.minutes} min to ${dest} — tight`
        : `${gap.minutes} min across · ${gap.travel} min travel`}
      <span className="h-px flex-1 bg-line" aria-hidden />
    </p>
  );
}

function AgendaRow({
  job,
  all,
  onOpen,
}: {
  job: Booking;
  all: Booking[];
  onOpen: (id: string) => void;
}) {
  const recordDeposit = usePrototype((s) => s.recordDeposit);
  const end = bookingEnd(job);
  const duration = durationOf(job);
  const holdDue = isHoldDue(job);
  const now = happeningNow(job);
  const clashes = conflictsFor(job, all);
  const long = duration >= 90;

  return (
    <div className="py-1.5">
      <button
        type="button"
        onClick={() => onOpen(job.id)}
        className={cn(
          "flex w-full min-h-11 gap-3 rounded-lg bg-raised px-3 py-3 text-left shadow-border",
          now && "job-now",
          holdDue && "job-hold",
        )}
      >
        <div className="w-14 shrink-0 pt-0.5">
          <p className="text-sm font-medium tabular-nums leading-tight">{formatTime(job.when)}</p>
          {long ? <p className="mt-0.5 text-2xs tabular-nums text-stone">{formatTime(end)}</p> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate font-medium">{job.customerName}</p>
            {job.value ? (
              <p className="shrink-0 font-serif text-sm tabular-nums commercial-exact">
                {formatAud(job.value.amount)}
              </p>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-2">
            {job.serviceLabel}
            <span className="text-stone">
              {" · "}
              {formatDuration(duration)}
              {job.location ? ` · ${job.location}` : ""}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {now ? <Badge tone="ok">Now</Badge> : null}
            {holdDue ? <Badge tone="warn">Hold due</Badge> : null}
            {job.status === "external_pending" ? <Badge tone="warn">Handoff</Badge> : null}
            {clashes.length > 0 ? <Badge tone="danger">Overlaps</Badge> : null}
          </div>
        </div>
      </button>
      {holdDue ? (
        <Button
          className="mt-2 min-h-11 w-full"
          onClick={() => {
            recordDeposit(job.id);
            toast("Hold recorded. The date is held.");
          }}
        >
          Record the hold
        </Button>
      ) : null}
    </div>
  );
}

function PhoneWeek({
  days,
  bookings,
  cursor,
  todayKey,
  onSelectDay,
  onOpen,
}: {
  days: Date[];
  bookings: Booking[];
  cursor: string;
  todayKey: string;
  onSelectDay: (key: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="mt-5">
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center text-ink-2"
          aria-label="Previous week"
          onClick={() => {
            const d = new Date(days[0]!);
            d.setDate(d.getDate() - 7);
            onSelectDay(dayKeyFromDate(d));
          }}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p className="text-sm text-stone">
          {days[0]!.getDate()}–{days[6]!.getDate()}{" "}
          {days[6]!.toLocaleDateString("en-AU", { month: "short" })}
        </p>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center text-ink-2"
          aria-label="Next week"
          onClick={() => {
            const d = new Date(days[0]!);
            d.setDate(d.getDate() + 7);
            onSelectDay(dayKeyFromDate(d));
          }}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      {days.map((d) => {
        const key = dayKeyFromDate(d);
        const jobs = sortedOnDay(bookings, key);
        const isToday = key === todayKey;
        const selected = key === cursor;
        const dayTotal = jobs.reduce((s, j) => s + (j.value?.amount ?? 0), 0);
        return (
          <section key={key} className="border-t border-line">
            <button
              type="button"
              onClick={() => onSelectDay(key)}
              className="flex min-h-11 w-full items-baseline justify-between gap-3 py-2 text-left"
            >
              <p className={cn("text-sm", isToday || selected ? "font-medium text-ink" : "text-stone")}>
                {isToday ? "Today · " : ""}
                {formatWeekdayMed(d)} {d.getDate()}
              </p>
              {jobs.length > 0 && dayTotal > 0 ? (
                <p className="font-serif text-sm tabular-nums text-ink-2">{formatAud(dayTotal)}</p>
              ) : null}
            </button>
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => onOpen(job.id)}
                className="flex min-h-11 w-full items-baseline justify-between gap-3 pb-2.5 text-left"
              >
                <span className="min-w-0 truncate">
                  <span className="tabular-nums text-stone">{formatTime(job.when)}</span>
                  <span className="ml-2 font-medium">{job.customerName}</span>
                  {isHoldDue(job) ? <span className="ml-1.5 text-sm text-warn">Hold due</span> : null}
                  {happeningNow(job) ? <span className="ml-1.5 text-sm text-ok">Now</span> : null}
                </span>
                {job.value && jobs.length > 1 ? (
                  <span className="shrink-0 font-serif text-sm tabular-nums commercial-exact">
                    {formatAud(job.value.amount)}
                  </span>
                ) : null}
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function WeekGrid({
  days,
  bookings,
  cursor,
  todayKey,
  onSelectDay,
  onOpen,
}: {
  days: Date[];
  bookings: Booking[];
  cursor: string;
  todayKey: string;
  onSelectDay: (key: string) => void;
  onOpen: (id: string) => void;
}) {
  const weekJobs = bookings.filter((b) => {
    const key = dayKeyFromIso(b.when);
    return key >= dayKeyFromDate(days[0]!) && key <= dayKeyFromDate(days[6]!);
  });
  const { startHour, endHour } = hoursSpan(weekJobs);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = hours.length * PX_PER_HOUR;
  const now = wallNow();
  const nowKey = dayKeyFromDate(now);
  const nowInWeek = nowKey >= dayKeyFromDate(days[0]!) && nowKey <= dayKeyFromDate(days[6]!);
  const nowTop = nowInWeek ? ((now.getHours() * 60 + now.getMinutes()) / 60 - startHour) * PX_PER_HOUR : null;

  return (
    <div className="mt-5 overflow-x-auto">
      <div className="grid min-w-0" style={{ gridTemplateColumns: "3rem repeat(7, minmax(0, 1fr))" }}>
        <div />
        {days.map((d) => {
          const key = dayKeyFromDate(d);
          const selected = key === cursor;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              className={cn(
                "flex flex-col items-center rounded-md py-2 text-center",
                selected && "bg-ink text-paper",
                !selected && isToday && "text-ink",
                !selected && !isToday && "text-ink-2",
              )}
            >
              <span className="text-2xs font-medium">{formatWeekdayMed(d)}</span>
              <span className="text-base font-semibold tabular-nums leading-none">{d.getDate()}</span>
            </button>
          );
        })}
        <div className="relative" style={{ height }}>
          {hours.map((h, i) => (
            <p
              key={h}
              className="absolute right-1 -translate-y-2 text-2xs tabular-nums text-stone"
              style={{ top: i * PX_PER_HOUR }}
            >
              {h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
            </p>
          ))}
        </div>
        {days.map((d) => {
          const key = dayKeyFromDate(d);
          const jobs = sortedOnDay(bookings, key);
          const lanes = layoutDay(jobs);
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={cn("relative border-l border-line", isToday && "bg-paper-2/40")}
              style={{ height }}
            >
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-line/80"
                  style={{ top: i * PX_PER_HOUR }}
                />
              ))}
              {isToday && nowTop != null && nowTop >= 0 && nowTop <= height ? (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
                  <span className="absolute -left-1 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-ink" />
                  <span className="block h-px bg-ink/80" />
                </div>
              ) : null}
              {jobs.map((job) => {
                const start = wallDate(job.when);
                const minutes = start.getHours() * 60 + start.getMinutes();
                const top = (minutes / 60 - startHour) * PX_PER_HOUR;
                const h = Math.max((durationOf(job) / 60) * PX_PER_HOUR, 22);
                const lane = lanes.get(job.id) ?? { lane: 0, lanes: 1 };
                const width = 100 / lane.lanes;
                const holdDue = isHoldDue(job);
                const nowJob = happeningNow(job, now);
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => onOpen(job.id)}
                    title={`${job.customerName} · ${formatTimeRange(job.when, bookingEnd(job))}`}
                    className={cn(
                      "absolute overflow-hidden rounded-sm bg-raised px-1.5 py-1 text-left shadow-border",
                      nowJob && "job-now",
                      holdDue && "job-hold",
                    )}
                    style={{
                      top,
                      height: h,
                      left: `calc(${lane.lane * width}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                    }}
                  >
                    <p className="truncate text-2xs font-medium leading-tight">{job.customerName}</p>
                    {h >= 36 ? (
                      <p className="truncate text-2xs text-stone">{formatTime(job.when)}</p>
                    ) : null}
                    {h >= 52 ? (
                      <p className="truncate text-2xs text-stone">{job.location ?? job.serviceLabel}</p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({
  cursor,
  todayKey,
  bookings,
  onSelect,
  onOpen,
  showAgenda,
}: {
  cursor: string;
  todayKey: string;
  bookings: Booking[];
  onSelect: (key: string) => void;
  onOpen: (id: string) => void;
  showAgenda: boolean;
}) {
  const cursorDate = dateFromDayKey(cursor);
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();
  const cells = useMemo(() => monthMatrix(year, month), [year, month]);
  const label = cursorDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    const nextKey = dayKeyFromDate(d);
    onSelect(todayKey.startsWith(nextKey.slice(0, 7)) ? todayKey : nextKey);
  };
  const dayJobs = sortedOnDay(bookings, cursor);

  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center text-ink-2"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p className="text-sm font-medium">{label}</p>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center text-ink-2"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <p key={d} className="py-1 text-center text-2xs font-medium text-stone">
            {d}
          </p>
        ))}
        {cells.map((d) => {
          const key = dayKeyFromDate(d);
          const inMonth = d.getMonth() === month;
          const selected = key === cursor;
          const isToday = key === todayKey;
          const jobs = inMonth ? sortedOnDay(bookings, key) : [];
          return (
            <button
              key={key + String(inMonth)}
              type="button"
              disabled={!inMonth}
              onClick={() => inMonth && onSelect(key)}
              className={cn(
                "flex flex-col items-center gap-1 py-1.5",
                !inMonth && "text-stone/40",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-full text-sm tabular-nums",
                  selected && "bg-ink font-medium text-paper",
                  !selected && isToday && "font-semibold text-ink",
                  !selected && !isToday && inMonth && "text-ink",
                )}
              >
                {d.getDate()}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {jobs.slice(0, 3).map((job) => (
                  <span
                    key={job.id}
                    className={cn("size-1 rounded-full", isHoldDue(job) ? "bg-warn" : "bg-ink/55")}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {showAgenda ? (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-sm font-medium">{formatDayHeading(cursor)}</p>
          {dayJobs.length === 0 ? (
            <p className="mt-2 text-sm text-stone">Clear</p>
          ) : (
            <ul className="mt-3">
              {dayJobs.map((job) => (
                <li key={job.id}>
                  <AgendaRow job={job} all={bookings} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
