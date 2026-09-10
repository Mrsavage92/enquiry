import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Plus, Search } from "lucide-react";
import { AddEnquiry } from "./add-enquiry";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { channelLabel } from "@/domain/channel";
import { derivedLabel, filteredEnquiries, queueSummary } from "@/domain/labels";
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
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const demoMode = usePrototype((s) => s.demoMode);
  const enquiries = usePrototype((s) => s.enquiries);
  const businesses = usePrototype((s) => s.businesses);
  const businessFilter = usePrototype((s) => s.businessFilter);
  const activeBusiness =
    businesses.find((b) => b.id === businessFilter) ??
    (businesses.length === 1 ? businesses[0] : undefined);
  const queueFilter = usePrototype((s) => s.queueFilter);
  const setQueueFilter = usePrototype((s) => s.setQueueFilter);
  const [query, setQuery] = useState("");
  const scoped = enquiries.filter(
    (enquiry) => businessFilter === "all" || enquiry.businessId === businessFilter,
  );
  const q = query.trim().toLowerCase();
  const filtered = filteredEnquiries(enquiries, businessFilter, queueFilter);
  const listed = q
    ? filtered.filter((enquiry) =>
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
    : filtered;
  const summary = queueSummary(scoped);
  const counts = {
    all: scoped.length,
    needs_you: summary.needsYou,
    waiting: summary.waiting,
    at_risk: summary.atRisk,
    closed: scoped.filter((enquiry) => enquiry.state.lifecycle !== "OPEN").length,
  };

  return (
    <div className="ui-page-scroll">
      <div className="ui-page enquiry-list-page">
        <header className="ui-page-header">
          <div>
            <h1>Enquiries</h1>
            <p className="ui-page-description">
              {scoped.length} {scoped.length === 1 ? "enquiry" : "enquiries"}
            </p>
          </div>
          {!demoMode && activeBusiness ? (
            <Button
              size="icon"
              aria-label="Add an enquiry"
              title="Add an enquiry"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={19} />
            </Button>
          ) : null}
        </header>
        <div className="enquiries-toolbar">
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
        </div>

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

        <div className="mt-5">
          <div className="enquiries-column-head" aria-hidden>
            <span>Customer & service</span>
            <span>Channel</span>
            <span>Status</span>
            <span />
          </div>
          {listed.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-medium">No enquiries match.</p>
              <p className="mt-1 text-sm text-ink-2">Try a customer name, service or channel.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {listed.map((enquiry) => {
                const business = businesses.find((b) => b.id === enquiry.businessId);
                return (
                  <li key={enquiry.id}>
                    <Link
                      to="/enquiries/$enquiryId"
                      params={{ enquiryId: enquiry.id }}
                      className="enquiries-list-row"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="customer-avatar" aria-hidden>
                          {enquiry.customerName
                            .split(/\s+/)
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-semibold">
                              {enquiry.customerName}
                            </p>
                          </div>
                          <p className="mt-1 truncate text-sm text-ink-2">
                            {enquiry.serviceLabel}
                            {enquiry.dateLabel ? ` · ${enquiry.dateLabel}` : ""}
                          </p>
                        </div>
                      </div>
                      <p className="min-w-0 truncate text-sm text-ink-2">
                        {businessFilter === "all" && business?.name ? `${business.name} · ` : ""}
                        {channelLabel(enquiry.source)}
                      </p>
                      <Badge tone={statusTone(enquiry)}>
                        {derivedLabel(enquiry.state, enquiry)}
                      </Badge>
                      <ChevronRight size={16} className="text-stone" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="Add an enquiry" className="max-h-[90dvh] overflow-y-auto">
          {activeBusiness && !demoMode ? (
            <AddEnquiry
              initiallyOpen
              business={activeBusiness}
              onCancel={() => setCreateOpen(false)}
              onCreated={(id) => {
                setCreateOpen(false);
                void navigate({ to: "/enquiries/$enquiryId", params: { enquiryId: id } });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
