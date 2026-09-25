import { Link, useNavigate } from "@tanstack/react-router";
import { initialsOf } from "@/domain/customer-name";
import { ChevronRight, Plus, Search } from "lucide-react";
import { AddEnquiry } from "./add-enquiry";
import { PracticeBadge } from "./practice-note";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { channelLabel } from "@/domain/channel";
import { rowTimeCue } from "@/domain/time-cues";
import {
  derivedLabel,
  emptyTabMessage,
  filteredEnquiries,
  nextStepLabel,
  queueSection,
  QUEUE_NAMES,
} from "@/domain/labels";
import { statusTone } from "@/domain/status-tone";
import { usePrototype, type QueueFilter } from "@/store/prototype-store";

const FILTERS: { id: QueueFilter; label: string }[] = [
  { id: "all", label: QUEUE_NAMES.all },
  { id: "needs_you", label: QUEUE_NAMES.needs_you },
  { id: "waiting", label: QUEUE_NAMES.waiting },
  { id: "at_risk", label: QUEUE_NAMES.at_risk },
  { id: "closed", label: QUEUE_NAMES.closed },
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
  const prefs = usePrototype((s) => s.prefs);

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
          <div className="enquiries-header-actions">
            <label className="relative block">
              <span className="sr-only">Search enquiries</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search enquiries"
                className="field h-11 pl-9"
              />
            </label>
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
          </div>
        </header>

        <div className="mt-6 overflow-x-auto">
          <Segmented
            ariaLabel="Enquiry filter"
            value={queueFilter}
            onChange={setQueueFilter}
            options={FILTERS}
          />
        </div>

        <div className="mt-5">
          <div className="enquiries-column-head" aria-hidden>
            <span>Customer</span>
            <span>Service</span>
            <span>Job date</span>
            <span>Status</span>
            <span className="enquiries-updated">When</span>
            <span />
          </div>
          {scoped.length === 0 ? (
            <EmptyState
              title="No enquiries yet"
              body="Add your first enquiry and it will show up here, ready to work."
              action={
                !demoMode && activeBusiness ? (
                  <Button onClick={() => setCreateOpen(true)}>Add your first enquiry</Button>
                ) : undefined
              }
            />
          ) : listed.length === 0 && q ? (
            <div className="px-5 py-12 text-center">
              <p className="font-medium">No enquiries match.</p>
              <p className="mt-1 text-sm text-ink-2">Try a customer name, service or channel.</p>
            </div>
          ) : listed.length === 0 ? (
            <div className="px-5 py-12 text-center" role="status">
              <p className="font-medium">{emptyTabMessage(queueFilter)}</p>
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
                          {initialsOf(enquiry)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-semibold">
                              {enquiry.customerName}
                            </p>
                            <PracticeBadge enquiry={enquiry} />
                          </div>
                          <p className="enquiries-customer-service mt-1 truncate text-sm text-ink-2">
                            {enquiry.serviceLabel}
                          </p>
                          {queueSection(enquiry) === "waiting" && !enquiry.snoozedUntil ? (
                            // Who it waits on and for what, so nothing relies
                            // on remembering what was asked.
                            <p className="mt-1 text-sm text-ink-2">{nextStepLabel(enquiry)}</p>
                          ) : null}
                          {businessFilter === "all" && business?.name ? (
                            <p className="enquiries-customer-business mt-1 truncate text-xs text-stone">
                              {business.name}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <p
                        className="enquiries-service min-w-0 truncate text-sm text-ink-2"
                        title={enquiry.serviceLabel}
                      >
                        {enquiry.serviceLabel}
                      </p>
                      <p className="enquiries-date min-w-0 text-sm text-ink-2">
                        {/* Labelled, because a bare date or "Not set" said
                            nothing about which date it was. */}
                        {enquiry.dateLabel ? `Job ${enquiry.dateLabel}` : "Job date not given"}
                        <span className="mt-1 block text-xs text-stone">
                          {channelLabel(enquiry.source)}
                        </span>
                      </p>
                      <Badge tone={statusTone(enquiry)}>
                        {derivedLabel(enquiry.state, enquiry)}
                      </Badge>
                      <span className="enquiries-updated text-xs text-stone">
                        {rowTimeCue(enquiry, prefs)}
                      </span>
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
