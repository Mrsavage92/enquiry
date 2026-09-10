import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { channelLabel } from "@/domain/channel";
import {
  commercialValue,
  derivedLabel,
  filteredEnquiries,
  queueSummary,
  queueSection,
} from "@/domain/labels";
import { statusTone } from "@/domain/status-tone";
import { usePrototype, type QueueFilter } from "@/store/prototype-store";

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_you", label: "Needs you" },
  { id: "waiting", label: "Waiting" },
  { id: "at_risk", label: "At risk" },
  { id: "closed", label: "Closed" },
];

export function EnquiriesListPage() {
  const enquiries = usePrototype((s) => s.enquiries);
  const businesses = usePrototype((s) => s.businesses);
  const businessFilter = usePrototype((s) => s.businessFilter);
  const queueFilter = usePrototype((s) => s.queueFilter);
  const setQueueFilter = usePrototype((s) => s.setQueueFilter);
  const [query, setQuery] = useState("");
  const scoped = enquiries.filter(
    (enquiry) => businessFilter === "all" || enquiry.businessId === businessFilter,
  );
  const q = query.trim().toLowerCase();
  const listed = q
    ? scoped.filter((enquiry) =>
        [
          enquiry.customerName,
          enquiry.serviceLabel,
          enquiry.dateLabel,
          enquiry.locationLabel,
          channelLabel(enquiry.source),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : filteredEnquiries(enquiries, businessFilter, queueFilter);
  const summary = queueSummary(scoped);
  const counts = {
    all: scoped.length,
    needs_you: summary.needsYou,
    waiting: summary.waiting,
    at_risk: summary.atRisk,
    closed: scoped.filter((enquiry) => enquiry.state.lifecycle !== "OPEN").length,
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 pb-10 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold leading-tight">Enquiries</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-2">
              The complete list, kept searchable. Open one when you need the conversation,
              reply or evidence.
            </p>
          </div>
          <label className="relative block lg:w-80">
            <span className="sr-only">Search enquiries</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, service or place"
              className="field h-11 pl-9"
            />
          </label>
        </header>

        <div className="mt-6 overflow-x-auto">
          <Segmented
            ariaLabel="Enquiry filter"
            value={queueFilter}
            onChange={setQueueFilter}
            options={FILTERS.map((filter) => ({
              ...filter,
              count: counts[filter.id],
            }))}
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl bg-raised shadow-border">
          {listed.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-medium">No enquiries match.</p>
              <p className="mt-1 text-sm text-ink-2">Try a customer name, service or channel.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {listed.map((enquiry) => {
                const business = businesses.find((b) => b.id === enquiry.businessId);
                const value = commercialValue(enquiry);
                return (
                  <li key={enquiry.id}>
                    <Link
                      to="/enquiries/$enquiryId"
                      params={{ enquiryId: enquiry.id }}
                      className="grid gap-3 px-4 py-4 transition-colors hover:bg-paper-2 sm:grid-cols-[minmax(0,1fr)_13rem_8rem] sm:items-center sm:px-5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-semibold">{enquiry.customerName}</p>
                          <Badge tone={statusTone(enquiry)}>{derivedLabel(enquiry.state, enquiry)}</Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-ink-2">
                          {enquiry.serviceLabel}
                          {enquiry.dateLabel ? ` · ${enquiry.dateLabel}` : ""}
                        </p>
                      </div>
                      <p className="min-w-0 truncate text-sm text-ink-2">
                        {businessFilter === "all" && business?.name ? `${business.name} · ` : ""}
                        {channelLabel(enquiry.source)}
                      </p>
                      <p className="text-sm text-stone sm:text-right">
                        {value.kind === "not_applicable" ? queueSection(enquiry).replace("_", " ") : value.amountLabel}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
