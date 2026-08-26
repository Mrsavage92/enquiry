import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { briefing, funnel, waitingAge } from "@/domain/briefing";
import { formatAud } from "@/domain/labels";
import { usePrototype } from "@/store/prototype-store";
import { useNarrow } from "@/lib/use-narrow";

export const Route = createFileRoute("/_app/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const enquiries = usePrototype((s) => s.enquiries);
  const businesses = usePrototype((s) => s.businesses);
  const bookings = usePrototype((s) => s.bookings);
  const filter = usePrototype((s) => s.businessFilter);
  const b = briefing(enquiries, businesses, bookings, filter);
  const funnelRows = funnel(b);
  const maxFunnel = Math.max(...funnelRows.map((r) => r.value), 1);
  const aging = waitingAge(enquiries, filter).slice(0, 5);
  const perBusiness = businesses
    .filter((biz) => filter === "all" || biz.id === filter)
    .map((biz) => {
      const slice = briefing(enquiries, businesses, bookings, biz.id);
      return { biz, slice };
    });
  const phone = useNarrow(860) !== false;

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader
        title="Insights"
        description={phone ? undefined : "What is open, what is waiting, and what booked. Not vanity email counts."}
      />

      <section className="mt-8">
        <p className="eyebrow">This morning</p>
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line md:grid-cols-4">
          <Stat label="Needs you" value={`${b.needsYou}`} to="/enquiries" />
          <Stat label="Follow-up" value={`${b.followUp}`} to="/enquiries" />
          <Stat label="Learning" value={`${b.learning}`} to="/business" />
          <Stat label="Calendar down" value={`${b.calendarDown}`} to="/trust/access" />
        </dl>
      </section>

      {b.openExact > 0 ? (
      <section className="mt-10">
        <p className="eyebrow">Exact prices still open</p>
        <p className="mt-2 font-serif text-4xl tabular-nums tracking-tight commercial-exact">
          {formatAud(b.openExactValue)}
        </p>
        <p className="mt-2 text-sm text-stone">
          {b.openExact} priced {b.openExact === 1 ? "enquiry" : "enquiries"} · estimates and unready
          prices are not in this total.
        </p>
      </section>
      ) : null}

      <section className="mt-10">
        <p className="eyebrow">Composition</p>
        <ul className="mt-4 space-y-3">
          {funnelRows.map((row) => (
            <li key={row.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{row.label}</span>
                <span className="font-serif tabular-nums">{row.value}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-2">
                <div
                  className="h-full bg-ink"
                  style={{ width: `${Math.max(4, (row.value / maxFunnel) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        {phone ? null : (
        <p className="mt-3 text-xs text-stone">
          Quoted includes waiting sheets. Booked is confirmed work, not a conversion rate.
        </p>
        )}
      </section>

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
                    <span className="mt-0.5 block text-xs text-stone">{enquiry.serviceLabel}</span>
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
                <span className="font-serif tabular-nums">
                  {slice.openExact > 0 ? formatAud(slice.openExactValue) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: string; to: string }) {
  return (
    <Link to={to} className="bg-raised px-4 py-4">
      <dt className="text-2xs uppercase tracking-wider text-stone">{label}</dt>
      <dd className="mt-1 font-serif text-2xl tabular-nums tracking-tight">{value}</dd>
    </Link>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-t border-line py-4">
      <div>
        <dt className="text-sm font-medium">{label}</dt>
        <p className="mt-0.5 text-xs leading-relaxed text-stone">{hint}</p>
      </div>
      <dd className="font-serif text-xl tabular-nums tracking-tight">{value}</dd>
    </div>
  );
}