import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { derivedLabel, commercialValue, formatAud, queueSection, queueSummary, queueHeadline } from "@/domain/labels";
import { CommercialValueMark } from "@/components/ui/commercial-value";
import { enquirySituation, queueSituationLabel } from "@/domain/situation";
import { statusTone } from "@/domain/status-tone";
import { formatRelative } from "@/domain/format";
import { channelLabel } from "@/domain/channel";
import type { Enquiry } from "@/domain/types";
import { usePrototype } from "@/store/prototype-store";
import { BUSINESS_BY_ID } from "@/fixtures";
import { AddEnquiry } from "@/components/enquiry/add-enquiry";
import { resolveBusiness } from "@/lib/workspace/resolve-business";
import { QueueBriefing } from "./briefing";
import { Notices } from "@/components/shell/notices";

const FILTERS = [
  { id: "needs_you", label: "Needs you" },
  { id: "waiting", label: "Waiting" },
  { id: "at_risk", label: "At risk" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
] as const;

const PHONE_FILTERS = [
  { id: "needs_you", label: "You" },
  { id: "waiting", label: "Waiting" },
  { id: "at_risk", label: "Risk" },
  { id: "closed", label: "Done" },
] as const;

export function filteredEnquiries(
  enquiries: Enquiry[],
  businessFilter: string,
  queueFilter: string,
  activeId?: string,
) {
  return enquiries.filter((e) => {
    if (businessFilter !== "all" && e.businessId !== businessFilter) return false;
    if (activeId && e.id === activeId) return true;
    if (queueFilter === "all") return true;
    if (queueFilter === "closed") return e.state.lifecycle !== "OPEN";
    return queueSection(e) === queueFilter;
  });
}

function matchesQuery(e: Enquiry, q: string, businessName?: string) {
  const hay = `${e.customerName} ${e.serviceLabel} ${e.locationLabel ?? ""} ${e.fixtureId} ${businessName ?? ""} ${e.customerHandle ?? ""} ${e.customerPhone ?? ""} ${e.source}`.toLowerCase();
  return hay.includes(q);
}

function queueTime(e: Enquiry) {
  if (e.state.decision === "EVALUATING") return "Just now";
  const t = Date.parse(e.receivedAt);
  if (Number.isFinite(t) && Date.now() - t < 90_000) return "Just now";
  return formatRelative(e.receivedAt);
}

function ArrivalStrip() {
  const lastArrivalId = usePrototype((s) => s.lastArrivalId);
  const enquiry = usePrototype((s) => s.enquiries.find((e) => e.id === s.lastArrivalId));
  const businesses = usePrototype((s) => s.businesses);
  const demoMode = usePrototype((s) => s.demoMode);
  const navigate = useNavigate();
  const setFilter = usePrototype((s) => s.setBusinessFilter);
  const setQueueFilter = usePrototype((s) => s.setQueueFilter);
  const businessFilter = usePrototype((s) => s.businessFilter);
  if (!lastArrivalId || !enquiry) return null;
  const business = resolveBusiness(businesses, enquiry.businessId, { demoMode, fixtures: BUSINESS_BY_ID });
  const reading = enquiry.state.decision === "EVALUATING";
  return (
    <div className="border-b border-line px-3 py-2.5">
      <button
        type="button"
        className="arrive-strip w-full rounded-md px-3 py-2.5 text-left"
        onClick={() => {
          if (businessFilter !== "all" && businessFilter !== enquiry.businessId) {
            setFilter(enquiry.businessId);
          }
          setQueueFilter("needs_you");
          void navigate({ to: "/enquiries/$enquiryId", params: { enquiryId: enquiry.id } });
        }}
      >
        <p className="eyebrow">{reading ? "Reading" : "Just arrived"}</p>
        <p className="mt-0.5 text-sm font-medium">{enquiry.customerName}</p>
        <p className="mt-0.5 truncate text-xs text-ink-2">
          {business?.name} · {enquiry.serviceLabel}
        </p>
      </button>
    </div>
  );
}

export function Queue({ activeId, phone = false }: { activeId?: string; phone?: boolean }) {
  const enquiries = usePrototype((s) => s.enquiries);
  const businesses = usePrototype((s) => s.businesses);
  const businessFilter = usePrototype((s) => s.businessFilter);
  const queueFilter = usePrototype((s) => s.queueFilter);
  const queueNavigate = useNavigate();
  const activeBusiness =
    businesses.find((b) => b.id === businessFilter) ?? (businesses.length === 1 ? businesses[0] : undefined);
  const setQueueFilter = usePrototype((s) => s.setQueueFilter);
  const lastArrivalId = usePrototype((s) => s.lastArrivalId);
  const demoMode = usePrototype((s) => s.demoMode);
  const enterSample = usePrototype((s) => s.enterSample);
  const [query, setQuery] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const scoped = enquiries.filter(
    (e) => businessFilter === "all" || e.businessId === businessFilter,
  );
  const q = query.trim().toLowerCase();
  const phoneFilter =
    queueFilter === "all" || !(PHONE_FILTERS as readonly { id: string }[]).some((f) => f.id === queueFilter)
      ? "needs_you"
      : queueFilter;
  const listFilter = phone ? phoneFilter : queueFilter;
  const visible = useMemo(() => {
    if (q) {
      return scoped.filter((e) => {
        const business = resolveBusiness(businesses, e.businessId, { demoMode, fixtures: BUSINESS_BY_ID });
        return matchesQuery(e, q, business?.name);
      });
    }
    const list = filteredEnquiries(enquiries, businessFilter, listFilter, activeId);
    const incoming = lastArrivalId ? enquiries.find((e) => e.id === lastArrivalId) : undefined;
    if (incoming && !list.some((e) => e.id === incoming.id)) {
      return [incoming, ...list];
    }
    return list;
  }, [q, scoped, enquiries, businessFilter, listFilter, activeId, businesses, lastArrivalId, demoMode]);
  const summary = queueSummary(scoped);
  const counts = {
    needs_you: summary.needsYou,
    waiting: summary.waiting,
    at_risk: summary.atRisk,
    closed: scoped.filter((e) => e.state.lifecycle !== "OPEN").length,
    all: scoped.length,
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      if (phone) setFindOpen(true);
      window.setTimeout(() => searchRef.current?.focus(), 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phone]);

  useEffect(() => {
    if (findOpen) searchRef.current?.focus();
  }, [findOpen]);

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-line bg-raised">
      {/*
        Live intake. Demo mode has its scripted arrival; a real business needs a
        way to put a real enquiry in, and until channel integrations genuinely
        exist that way is typing or pasting what the customer said.
      */}
      {!demoMode && activeBusiness ? (
        <div className="border-b border-line px-4 py-3">
          <AddEnquiry business={activeBusiness} onCreated={(id) => void queueNavigate({ to: "/enquiries/$enquiryId", params: { enquiryId: id } })} />
        </div>
      ) : null}
      <div className={cn("border-b border-line px-4", phone ? "pb-3 pt-3" : "pb-3 pt-4")}>
        {phone ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-3xl font-semibold leading-tight tracking-tight">
                {queueHeadline(summary)}
              </p>
              <div className="flex items-center">
                <button
                  type="button"
                  className="inline-flex size-11 items-center justify-center text-ink-2"
                  aria-label={findOpen ? "Close find" : "Find"}
                  aria-expanded={findOpen}
                  onClick={() => {
                    if (findOpen) {
                      setQuery("");
                      setFindOpen(false);
                    } else {
                      setFindOpen(true);
                    }
                  }}
                >
                  {findOpen ? <X className="size-5" aria-hidden /> : <Search className="size-5" aria-hidden />}
                </button>
                <Notices />
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-3xl font-semibold leading-tight tracking-tight">
              {queueHeadline(summary)}
            </p>
            <p className="mt-2 text-sm text-stone">
              {summary.waiting} waiting
              {summary.atRisk ? ` · ${summary.atRisk} at risk` : ""}
              {summary.exactCount > 0
                ? ` · ${summary.exactCount} exact ${formatAud(summary.exactValue)}`
                : ""}
            </p>
            <QueueBriefing />
          </>
        )}
        {!phone || findOpen ? (
          <label className="mt-3 block">
            <span className="sr-only">Find an enquiry</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find"
              className="field h-11"
            />
          </label>
        ) : null}
        {phone ? null : <p className="mt-2 text-2xs text-stone">/ find · J/K move · ⌘K jump</p>}
      </div>
      <ArrivalStrip />
      {q ? (
        <p className="px-4 pt-3 text-xs text-stone">
          {visible.length} match{visible.length === 1 ? "" : "es"}
        </p>
      ) : (
        <div className="px-3 pb-1 pt-2">
          <Segmented
            ariaLabel="Queue filter"
            value={phone ? phoneFilter : queueFilter}
            onChange={setQueueFilter}
            fullWidth={phone}
            options={(phone ? PHONE_FILTERS : FILTERS).map((f) => ({
              id: f.id,
              label: f.label,
              count: counts[f.id],
            }))}
          />
        </div>
      )}
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-6 pt-1 stagger-in">
        {visible.length === 0 ? (
          <li className="px-3 py-12 text-center">
            <p className="text-sm font-medium text-ink">
              {q
                ? "No matching enquiry"
                : queueFilter === "needs_you"
                  ? demoMode === false
                    ? "Waiting for the first enquiry"
                    : "You're caught up"
                  : queueFilter === "waiting"
                    ? "Nobody is waiting"
                    : queueFilter === "at_risk"
                      ? "Nothing at risk"
                      : queueFilter === "closed"
                        ? "Nothing closed yet"
                        : "No enquiries in this workspace"}
            </p>
            <p className="mt-1 text-sm text-stone">
              {q
                ? "Try a name or a service."
                : queueFilter === "needs_you" && demoMode === false
                  ? "When someone writes in, it lands here."
                  : queueFilter === "closed"
                    ? "Accepted and lost work sit here."
                    : queueFilter === "needs_you"
                    ? "Waiting is on the client."
                    : "New work lands here."}
            </p>
            {queueFilter === "needs_you" && demoMode === false && !q ? (
              <button
                type="button"
                className="mt-4 min-h-11 text-sm font-medium underline-offset-4 hover:underline"
                onClick={() => enterSample()}
              >
                Open sample jobs
              </button>
            ) : null}
          </li>
        ) : (
          visible.map((e) => {
            const active = e.id === activeId;
            const business = resolveBusiness(businesses, e.businessId, { demoMode, fixtures: BUSINESS_BY_ID });
            const section = queueSection(e);
            const situation = enquirySituation(e, business);
            const arriving = e.id === lastArrivalId || e.state.decision === "EVALUATING";
            const blocking = situation && situation.kind !== "evaluating";
            const commercial = commercialValue(e);
            const showValue = commercial.kind !== "not_applicable";
            return (
              <li key={e.id} className={arriving ? "arrive-row" : undefined}>
                <Link
                  to="/enquiries/$enquiryId"
                  params={{ enquiryId: e.id }}
                  className={cn(
                    "relative block overflow-hidden rounded-lg px-3.5 py-3 transition-[background-color] duration-150 ease-out hover:bg-paper-2 active:bg-paper-2",
                    phone && "phone-row",
                    active && "bg-paper shadow-border",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-2 left-0 w-0.5 rounded-full",
                      e.state.decision === "EVALUATING"
                        ? "bg-ink arrive-pulse"
                        : active
                          ? "bg-ink"
                          : section === "needs_you"
                            ? "bg-warn"
                            : section === "at_risk"
                              ? "bg-danger"
                              : section === "waiting"
                                ? "bg-line-strong"
                                : "bg-transparent",
                    )}
                  />
                  {phone ? (
                    <>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate font-medium leading-snug">{e.customerName}</p>
                        {situation?.kind === "evaluating" ? (
                          <span className="shrink-0 text-xs text-ink-2">Reading</span>
                        ) : showValue ? (
                          <CommercialValueMark value={commercial} size="sm" className="shrink-0" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-ink-2">
                        {e.serviceLabel}
                        <span className="text-stone">
                          {" · "}
                          {channelLabel(e.source)}
                          {" · "}
                          {queueTime(e)}
                        </span>
                      </p>
                      {blocking ? (
                        <p className="mt-1 text-2xs text-warn">{queueSituationLabel(situation.kind)}</p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate font-medium leading-snug">{e.customerName}</p>
                        <Badge tone={statusTone(e)}>{derivedLabel(e.state, e)}</Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-ink-2">
                        {e.serviceLabel}
                        {e.dateLabel ? ` · ${e.dateLabel}` : ""}
                      </p>
                      <div className="mt-2 flex items-baseline justify-between gap-2 text-xs text-stone">
                        {situation?.kind === "evaluating" ? (
                          <span className="text-ink-2">Reading</span>
                        ) : showValue ? (
                          <CommercialValueMark value={commercial} size="sm" />
                        ) : (
                          <span />
                        )}
                        <span className="shrink-0">{queueTime(e)}</span>
                      </div>
                      {situation && situation.kind !== "evaluating" ? (
                        <p className="mt-1 text-2xs text-warn">{queueSituationLabel(situation.kind)}</p>
                      ) : null}
                      <p className="mt-1 text-2xs text-stone">
                        {businessFilter === "all" && business?.name ? `${business.name} · ` : ""}
                        {channelLabel(e.source)}
                      </p>
                    </>
                  )}
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
