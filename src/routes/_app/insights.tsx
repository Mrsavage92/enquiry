import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { briefing, funnel, waitingAge } from "@/domain/briefing";
import { formatAud } from "@/domain/labels";
import { usePrototype } from "@/store/prototype-store";
import { useNarrow } from "@/lib/use-narrow";
import { channelLabel } from "@/domain/channel";
import { CalendarCheck2, Clock3, FileCheck2, Inbox, type LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_app/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const enquiries = usePrototype((s) => s.enquiries);
  const businesses = usePrototype((s) => s.businesses);
  const bookings = usePrototype((s) => s.bookings);
  const filter = usePrototype((s) => s.businessFilter);
  const scoped = enquiries.filter((e) => filter === "all" || e.businessId === filter);
  const channels = Array.from(new Set(scoped.map((e) => e.source)))
    .map((source) => ({ source, count: scoped.filter((e) => e.source === source).length }))
    .sort((a, b) => b.count - a.count);
  const b = briefing(enquiries, businesses, bookings, filter);
  const funnelRows = funnel(b);
  const largestTotal = Math.max(1, ...funnelRows.map((row) => row.value));
  const aging = waitingAge(enquiries, filter).slice(0, 5);
  const perBusiness = businesses
    .filter((biz) => filter === "all" || biz.id === filter)
    .map((biz) => {
      const slice = briefing(enquiries, businesses, bookings, biz.id);
      return { biz, slice };
    });
  const phone = useNarrow(860) !== false;

  return (
    <div className="ui-page-scroll">
      <div className="ui-page insights-page">
        <PageHeader title="Insights" description="A clear view of your current enquiries." />

        <section className="mt-8">
          <dl className="insights-summary">
            <Stat
              icon={Clock3}
              label="Need your reply"
              value={`${b.needsYou}`}
              tone="amber"
              priority
            />
            <Stat icon={Inbox} label="Total enquiries" value={`${scoped.length}`} tone="violet" />
            <Stat icon={FileCheck2} label="Quoted" value={`${b.quoted}`} tone="neutral" />
            <Stat icon={CalendarCheck2} label="Booked" value={`${b.bookedCount}`} tone="green" />
          </dl>
        </section>

        <div className="insights-charts">
          <section>
            <h2 className="text-lg font-semibold">Enquiries by channel</h2>
            <p className="insights-caption">Where the enquiries in this workspace came from.</p>
            <ul className="mt-6 space-y-5">
              {channels.map(({ source, count }, index) => (
                <li key={source} className="insights-channel" data-channel-tone={index % 4}>
                  <div className="flex justify-between text-sm">
                    <span>{channelLabel(source)}</span>
                    <span className="insights-channel-value">
                      <strong>{count}</strong>
                      <small>{Math.round((count / Math.max(scoped.length, 1)) * 100)}%</small>
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-paper-2">
                    <div
                      className="insights-channel-bar h-full rounded-full"
                      style={{ width: `${(count / Math.max(scoped.length, 1)) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {channels.length === 0 ? (
              <p className="mt-5 text-sm text-stone">No enquiries yet.</p>
            ) : null}
          </section>
          <section>
            <h2 className="text-lg font-semibold">Current totals</h2>
            <p className="insights-caption">Separate counts, not stages of a conversion funnel.</p>
            <ul className="insights-current-totals">
              {funnelRows.map((row) => (
                <li key={row.id}>
                  <div className="flex justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="text-stone">{row.value}</span>
                  </div>
                  <div className="insights-total-track" aria-hidden="true">
                    <div style={{ width: `${(row.value / largestTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <details className="mt-10">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
            More detail
          </summary>
          {b.openExact > 0 ? (
            <section className="mt-5">
              <p className="eyebrow">Exact prices still open</p>
              <p className="mt-2 text-4xl font-semibold tabular-nums commercial-exact">
                {formatAud(b.openExactValue)}
              </p>
              <p className="mt-2 text-sm text-stone">
                {b.openExact} priced {b.openExact === 1 ? "enquiry" : "enquiries"} · estimates and
                unready prices are not in this total.
              </p>
            </section>
          ) : null}

          {phone ? null : (
            <dl className="mt-10">
              <Row
                label="Quoted this set"
                value={`${b.quoted}`}
                hint={`${b.quotedWaiting} still with the customer`}
              />
              <Row
                label="Booked"
                value={formatAud(b.bookedValue)}
                hint={`${b.bookedCount} confirmed. Enquiry is not a revenue dashboard.`}
              />
              <Row
                label="Closed without a booking"
                value={`${b.closedLost}`}
                hint="Lost or declined. Silence is not counted here."
              />
            </dl>
          )}

          {aging.length > 0 ? (
            <section className="mt-10">
              <p className="eyebrow">Waiting longest</p>
              <ul className="ledger mt-3">
                {aging.map(({ enquiry, days }) => (
                  <li key={enquiry.id}>
                    <Link
                      to="/enquiries/$enquiryId"
                      params={{ enquiryId: enquiry.id }}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span>
                        <span className="font-medium">{enquiry.customerName}</span>
                        <span className="mt-0.5 block text-xs text-stone">
                          {enquiry.serviceLabel}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums text-ink-2">
                        {days === 0 ? "Today" : `${days}d`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {filter === "all" ? (
            <section className="mt-10">
              <p className="eyebrow">By workspace</p>
              <ul className="ledger mt-3">
                {perBusiness.map(({ biz, slice }) => (
                  <li key={biz.id} className="flex items-baseline justify-between gap-3">
                    <span>
                      <span className="font-medium">{biz.name}</span>
                      <span className="mt-0.5 block text-xs text-stone">
                        {slice.needsYou} need you · {slice.quotedWaiting} waiting
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {slice.openExact > 0 ? formatAud(slice.openExactValue) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </details>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
  priority = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
  priority?: boolean;
}) {
  return (
    <div className="insights-stat" data-tone={tone} data-priority={priority || undefined}>
      <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
      <dt className="text-xs text-stone">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-line py-4">
      <div>
        <dt className="text-sm font-medium">{label}</dt>
        <p className="mt-0.5 text-xs leading-relaxed text-stone">{hint}</p>
      </div>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
