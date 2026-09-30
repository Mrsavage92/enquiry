import { useEffect, useMemo, useRef, useState } from "react";
import { tradeExamples } from "@/domain/trade-examples";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  ListChecks,
  MessageSquareText,
  Plus,
  Plug,
  ShieldCheck,
  Store,
} from "lucide-react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { pricedTheJob } from "@/domain/next-action";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, ResponsiveDialogContent } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { BUSINESSES } from "@/fixtures";
import { usePrototype } from "@/store/prototype-store";
import { FactRow } from "@/components/business/fact-row";
import { factStateWord } from "@/domain/fact-words";
import { WorkspaceSettingUp } from "@/components/shell/workspace-setting-up";
import { PricingRules } from "@/components/business/pricing-rules";
import {
  businessSectionPreview,
  visibleBusinessServices,
} from "@/components/business/section-preview";
import { visibleBusinesses } from "@/lib/workspace/resolve-business";
import type { KnowledgeItem } from "@/domain/types";
import { cn } from "@/lib/utils";
import { applyVoiceToDraft } from "@/domain/voice-apply";
import { useNarrow } from "@/lib/use-narrow";
import { PRICE_EXAMPLE } from "@/domain/price-sentence";
import { describeRule } from "@/domain/business-rule";
import { replacementsFor } from "@/domain/price-replacement";
import { readBusinessDetails, type BusinessDetailsRead } from "@/domain/business-details-read";
import {
  activeDetails,
  describeDetail,
  detailEffect,
  minimumClash,
  noteFor,
} from "@/domain/business-detail";
import { activeRules } from "@/domain/decide";
import { workingHoursChange } from "@/domain/workspace-prefs";
import { decidingPhrase } from "@/domain/price-compiler";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";

const SECTIONS = [
  { id: "all", label: "Overview" },
  { id: "service", label: "Services" },
  { id: "pricing", label: "Pricing" },
  { id: "required_fact", label: "Details needed" },
  { id: "capacity", label: "Availability" },
  { id: "policy", label: "Policies" },
  { id: "operating", label: "How you work" },
  { id: "voice", label: "Voice & tone" },
  { id: "learning", label: "Suggested updates" },
] as const;

const SECTION_ORDER = [
  "pricing",
  "service",
  "required_fact",
  "operating",
  "capacity",
  "policy",
  "alias",
] as const;

const SECTION_TITLE: Record<string, string> = {
  pricing: "Pricing",
  service: "Services",
  required_fact: "Details needed",
  operating: "How you work",
  capacity: "Availability",
  policy: "Policies",
  alias: "Aliases",
};

export function BrainScreen() {
  const businesses = usePrototype((s) => s.businesses);
  const demoMode = usePrototype((s) => s.demoMode);
  const filter = usePrototype((s) => s.businessFilter);
  const setFilter = usePrototype((s) => s.setBusinessFilter);
  const tab = usePrototype((s) => s.brainTab);
  const setTab = usePrototype((s) => s.setBrainTab) as (
    id: (typeof SECTIONS)[number]["id"],
  ) => void;
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  // What "Preview" could not use, said beside the box - never a silent no-op.
  const [tellError, setTellError] = useState<string | null>(null);
  const [livePrices, setLivePrices] = useState<BusinessDetailsRead | null>(null);
  // Conditional prices and other lines the owner chose to keep as notes.
  const [notesChosen, setNotesChosen] = useState<Set<string>>(new Set());
  const [savingPrices, setSavingPrices] = useState(false);
  // Why the last save was refused ("Save up to 20 details at a time."), said
  // inside the preview beside the button, never in a toast that vanishes.
  const [saveError, setSaveError] = useState<string | null>(null);
  const prefs = usePrototype((s) => s.prefs);
  // After a save changed Settings hours: the change, with an Undo that stays
  // until the owner dismisses it (a toast is gone before an owner looks up).
  const [hoursSaved, setHoursSaved] = useState<string | null>(null);
  const [undoingHours, setUndoingHours] = useState(false);
  const firstBeta = useFirstBetaActions();
  const search = useSearch({ strict: false }) as {
    section?: string;
    service?: string;
    back?: string;
  };
  const pricingRef = useRef<HTMLDivElement>(null);
  const tellRef = useRef<HTMLTextAreaElement>(null);
  const focusComposer = usePrototype((s) => s.brainFocusComposer);
  const setFocusComposer = usePrototype((s) => s.setBrainFocusComposer);
  const navigate = useNavigate();
  const tell = usePrototype((s) => s.tellEnquiry);
  const preview = usePrototype((s) => s.brainPreview);
  const confirm = usePrototype((s) => s.confirmBrainChange);
  const cancel = usePrototype((s) => s.cancelBrainChange);
  const confirmLearning = usePrototype((s) => s.confirmLearning);
  const dismissLearning = usePrototype((s) => s.dismissLearning);
  const resolveConflict = usePrototype((s) => s.resolveConflict);
  // No business means a real tenant whose workspace has not been hydrated yet
  // (R2B). Falling back to businesses[0] here used to resolve to the fixture
  // "glow" studio and render its Brain/trust state as this tenant's own.
  const id = filter === "all" ? businesses[0]?.id : filter;
  const business = businesses.find((b) => b.id === id) ?? businesses[0];
  const trade = tradeExamples(business?.industry);
  const serviceCatalogue = visibleBusinessServices(business, query);
  // Undefined-safe rather than guarded here: the early return has to sit below
  // every hook, so nothing between this line and the render may assume a
  // business exists.
  // Memoised because `?? []` would otherwise mint a new array every render and
  // invalidate the useMemo below it on each pass.
  // A removed fact is retired, not deleted: it stays on file for the replies
  // already sent on it, and is never listed as something Enquiry uses.
  const items = useMemo(
    () => (business?.knowledge ?? []).filter((k) => k.state !== "Disabled"),
    [business?.knowledge],
  );
  const needsReview = items.filter((k) => k.state === "Needs review");
  const pendingLearn = (business?.learningSuggestions ?? []).filter((l) => l.status === "pending");
  const phone = useNarrow(860) !== false;
  const tabs = SECTIONS;
  const tabValue = tabs.find((s) => s.id === tab)?.id ?? "all";

  useEffect(() => {
    if (!focusComposer) return;
    setTab("all");
    setDetailOpen(true);
    setComposerOpen(true);
    setFocusComposer(false);
  }, [focusComposer, setFocusComposer, setTab]);

  // "Add your prices" on an enquiry lands here with ?section=pricing: open the
  // pricing section and bring it into view, rather than a menu to find it in.
  const deepLinkPricing = search.section === "pricing";
  // "?section=availability" opens Availability, not whatever tab was last open.
  const deepLinkSection = sectionFromSearch(search.section);
  useEffect(() => {
    if (!deepLinkSection || deepLinkSection === "pricing") return;
    setTab(deepLinkSection);
    setDetailOpen(true);
  }, [deepLinkSection, setTab]);
  useEffect(() => {
    if (!deepLinkPricing) return;
    setTab("pricing");
    setDetailOpen(true);
    // A real business lands on the sentence box, open and focused: writing
    // "Interior painting $30 per square metre" is the quickest way in.
    setComposerOpen(!demoMode);
    // "Add a price for oven cleaning": the box starts with its name.
    const named = search.service?.trim();
    if (named && !demoMode) {
      setInput((current) =>
        current.trim() ? current : `${named.charAt(0).toUpperCase()}${named.slice(1)} $`,
      );
    }
  }, [deepLinkPricing, setTab, demoMode, search.service]);
  useEffect(() => {
    if (!deepLinkPricing || tab !== "pricing" || !detailOpen || !demoMode) return;
    pricingRef.current?.scrollIntoView({ block: "start" });
  }, [deepLinkPricing, tab, detailOpen, demoMode]);

  useEffect(() => {
    if (tab !== "home") return;
    setDetailOpen(false);
    setComposerOpen(false);
    setQuery("");
  }, [tab]);

  useEffect(() => {
    if (composerOpen) tellRef.current?.focus();
  }, [composerOpen]);

  const visible = useMemo(() => {
    const base =
      tabValue === "all" || tabValue === "learning" || tabValue === "voice"
        ? items
        : items.filter((k) => k.section === tabValue);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (k) =>
        k.title.toLowerCase().includes(q) ||
        k.body.toLowerCase().includes(q) ||
        k.source.label.toLowerCase().includes(q),
    );
  }, [items, tabValue, query]);

  const groups = useMemo(() => {
    if (tabValue !== "all") {
      return visible.length ? [{ title: null as string | null, items: visible }] : [];
    }
    const review = visible.filter((k) => k.state === "Needs review");
    const rest = visible.filter((k) => k.state !== "Needs review");
    const grouped: { title: string | null; items: KnowledgeItem[] }[] = [];
    if (review.length) grouped.push({ title: "Needs review", items: review });
    for (const section of SECTION_ORDER) {
      const slice = rest.filter((k) => k.section === section);
      if (slice.length) grouped.push({ title: SECTION_TITLE[section] ?? section, items: slice });
    }
    return grouped;
  }, [tabValue, visible]);

  // Every hook above has run. A real tenant with no hydrated workspace (R2B)
  // gets a truthful empty state instead of the fixture studio's Brain.
  if (!business) return <WorkspaceSettingUp />;
  if (tab === "home" || (!detailOpen && tabValue === "all")) {
    const destinations = [
      {
        id: "service",
        label: "Services",
        description: "What you offer",
        icon: BriefcaseBusiness,
        tone: "tone-violet",
      },
      {
        id: "pricing",
        label: "Pricing",
        description: "Your prices and packages",
        icon: CircleDollarSign,
        tone: "tone-neutral",
      },
      {
        id: "capacity",
        label: "Availability",
        description: "Capacity and scheduling",
        icon: CalendarDays,
        tone: "tone-violet",
      },
      {
        id: "policy",
        label: "Policies",
        description: "Deposits, cancellations and other conditions",
        icon: FileCheck2,
        tone: "tone-amber",
      },
      {
        id: "operating",
        label: "How you work",
        description: "What your customers can expect",
        icon: ClipboardList,
        tone: "tone-rose",
      },
      {
        id: "voice",
        label: "Voice & tone",
        description: "How your replies sound",
        icon: MessageSquareText,
        tone: "tone-violet",
      },
    ] as const;
    return (
      <div className="ui-page-scroll">
        <div className="ui-page business-overview">
          <header className="ui-page-header business-heading">
            <h1>Business</h1>
            <Button
              onClick={() => {
                setTab("all");
                setDetailOpen(true);
                setComposerOpen(true);
              }}
            >
              <Plus size={17} aria-hidden /> Add a detail
            </Button>
          </header>
          <div className="business-identity">
            <span className="business-identity-icon">
              <Store size={22} aria-hidden />
            </span>
            <div>
              <div className="business-picker">
                <select
                  aria-label="Business to manage"
                  value={business.id}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  {visibleBusinesses(businesses, { demoMode, fixtures: BUSINESSES }).map(
                    (entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ),
                  )}
                </select>
                <ChevronDown size={15} aria-hidden />
              </div>
              <p>{business.baseLocation}</p>
            </div>
          </div>
          {needsReview.length + pendingLearn.length > 0 ? (
            <button
              className="business-review"
              onClick={() => {
                setDetailOpen(true);
                setTab(needsReview.length ? "all" : "learning");
              }}
            >
              <ShieldCheck size={19} aria-hidden />
              <span>
                {needsReview.length + pendingLearn.length} business{" "}
                {needsReview.length + pendingLearn.length === 1 ? "detail needs" : "details need"}{" "}
                your review
              </span>
              <ChevronRight size={17} aria-hidden />
            </button>
          ) : null}
          <div className="business-groups">
            <section className="business-group" aria-labelledby="business-directory-heading">
              <h2 className="sr-only" id="business-directory-heading">
                Business details
              </h2>
              <div className="business-destinations">
                {destinations.map(({ id: section, label, icon: Icon, tone }) => {
                  const summary =
                    section === "voice"
                      ? {
                          preview:
                            [business.voice.warmth, business.voice.formality]
                              .filter(Boolean)
                              .join(" · ") || "No tone saved",
                          needsReview: 0,
                        }
                      : businessSectionPreview(business, section);
                  return (
                    <button
                      key={section}
                      className="business-destination"
                      onClick={() => {
                        setTab(section);
                        setDetailOpen(true);
                      }}
                    >
                      <span className={`ui-icon-tile ${tone}`}>
                        <Icon size={20} aria-hidden />
                      </span>
                      <span>
                        <strong>{label}</strong>
                        <small>{summary.preview}</small>
                        {summary.needsReview > 0 ? (
                          <span className="business-row-review">
                            {summary.needsReview} need review
                          </span>
                        ) : null}
                      </span>
                      <ChevronRight size={18} className="text-stone" aria-hidden />
                    </button>
                  );
                })}
                <button
                  className="business-destination"
                  onClick={() => void navigate({ to: "/trust/access" })}
                >
                  <span className="ui-icon-tile tone-neutral">
                    <Plug size={20} aria-hidden />
                  </span>
                  <span>
                    <strong>Connections</strong>
                    <small>Channels and reply permissions</small>
                  </span>
                  <ChevronRight size={18} className="text-stone" aria-hidden />
                </button>
              </div>
            </section>
          </div>
          <div className="business-footer">
            <button
              className="ui-text-link"
              onClick={() => {
                setDetailOpen(true);
                setTab("required_fact");
              }}
            >
              <ListChecks size={17} aria-hidden />
              Details you need <ArrowRight size={15} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="ui-page-scroll">
      <div className="ui-page business-detail">
        {/* One way back, to where the owner came from: the enquiry that sent
            them here, or the Business list. */}
        {search.back ? (
          <Link
            to="/enquiries/$enquiryId"
            params={{ enquiryId: search.back }}
            className="ui-text-link mb-5"
          >
            <ArrowLeft size={16} aria-hidden />
            Back to the enquiry
          </Link>
        ) : (
          <button
            className="ui-text-link mb-5"
            onClick={() => {
              setTab("all");
              setDetailOpen(false);
              setComposerOpen(false);
              setQuery("");
            }}
          >
            <ArrowLeft size={16} aria-hidden />
            Business
          </button>
        )}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {phone ? null : <p className="text-sm text-stone">Business</p>}
            <h1 className={cn("text-2xl font-semibold sm:text-3xl", !phone && "mt-1.5")}>
              {SECTIONS.find((s) => s.id === tabValue)?.label === "Overview"
                ? "Business details"
                : SECTIONS.find((s) => s.id === tabValue)?.label}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">{business.name}</p>
          </div>
          {phone ? null : (
            <label className="block text-sm sm:w-56">
              <span className="mb-1.5 block text-stone">Working as</span>
              <select
                name="working-as"
                className="field h-11"
                value={id}
                onChange={(e) => setFilter(e.target.value)}
              >
                {/* Live tenants pick from their own businesses. This selector
                  listed the fixture roster unconditionally, so a real signed-in
                  operator saw other studios' names ("Ridge & Co Painting",
                  "Northlight Photography"...) as their "Working as" options. */}
                {visibleBusinesses(businesses, { demoMode, fixtures: BUSINESSES }).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        {/* Sections sit under the heading and wrap instead of scrolling. On a
            phone the Business list is the section menu, one tap back. */}
        {phone ? null : (
          <div className="mt-6">
            <Segmented
              ariaLabel="Business sections"
              value={tabValue}
              onChange={setTab}
              wrap
              options={tabs.map((s) => ({
                id: s.id,
                label: s.label,
                count:
                  s.id === "all" && needsReview.length
                    ? needsReview.length
                    : s.id === "learning" && pendingLearn.length
                      ? pendingLearn.length
                      : undefined,
              }))}
            />
          </div>
        )}

        {tabValue === "pricing" && demoMode ? (
          <div ref={pricingRef} id="pricing" className="scroll-mt-4">
            <PricingRules business={business} autoOpen={deepLinkPricing} />
          </div>
        ) : null}

        {!composerOpen ? (
          <Button variant="ghost" className="mt-5" onClick={() => setComposerOpen(true)}>
            <Plus size={16} />
            Add a business detail
          </Button>
        ) : (
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              setTellError(null);
              if (!input.trim()) {
                setTellError(`Write a price first, for example: ${trade.sentence}.`);
                return;
              }
              if (demoMode) {
                if (!tell(business.id, input)) {
                  setTellError(
                    `Enquiry could not match that to anything in this sample business. Try a price, for example: ${PRICE_EXAMPLE}.`,
                  );
                }
                return;
              }
              // A real business: read the owner's own words as prices, days
              // they don't work, services they don't offer and notes - each
              // confirmed before it saves - and name every line not read.
              const read = readBusinessDetails(input);
              const noteable = read.unread.filter((u) => u.note);
              if (read.prices.length === 0 && read.details.length === 0 && noteable.length === 0) {
                const why = read.unread[0]?.reason ?? "There is no dollar amount in it.";
                setTellError(
                  `Enquiry could not read that. ${why} Write one detail per line, for example: ${trade.sentence}, or We don't work Sundays.`,
                );
                return;
              }
              setNotesChosen(new Set(noteable.map((u) => u.line)));
              setSaveError(null);
              setLivePrices(read);
            }}
          >
            <label className="block" htmlFor="tell">
              <span className="eyebrow">
                {tabValue === "pricing" && !demoMode
                  ? "Write your prices, one per line"
                  : "Add business detail"}
              </span>
              <textarea
                id="tell"
                ref={tellRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={2}
                aria-describedby={tellError ? "tell-error" : undefined}
                placeholder={
                  !demoMode
                    ? `e.g. ${trade.sentence}. ${trade.flatSentence}.`
                    : business.id === "northlight"
                      ? "Event coverage will be $200 an hour."
                      : business.id === "ridge"
                        ? "Interior bedrooms will be $450."
                        : business.id === "harbour"
                          ? "A 3 bed / 2 bath deep clean is $360."
                          : "Group mobile makeup will be $160 a person."
                }
                className="field mt-2"
              />
            </label>
            {tellError ? (
              <p id="tell-error" role="alert" className="mt-2 text-sm text-danger">
                {tellError}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              {phone ? null : (
                <p className="text-xs text-stone">
                  Previewed before anything changes. High-impact prices never activate silently.
                </p>
              )}
              <Button type="submit" size="sm" className={phone ? "min-h-11 w-full" : undefined}>
                Preview
              </Button>
            </div>
          </form>
        )}

        {hoursSaved ? (
          <div className="callout mt-3 bg-paper-2 text-ink" role="status">
            <p className="text-sm font-medium">{hoursSaved}.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="min-h-11"
                disabled={undoingHours}
                onClick={() => {
                  setUndoingHours(true);
                  void firstBeta
                    .undoWorkingHours(business.id)
                    .then((undo) => {
                      if (!undo.ok) {
                        toast.error(undo.message);
                        return;
                      }
                      setHoursSaved(null);
                      toast.success(`Undone. ${undo.summary}.`);
                    })
                    .catch((err: unknown) =>
                      toast.error(
                        err instanceof Error ? err.message : "Could not undo the hours change.",
                      ),
                    )
                    .finally(() => setUndoingHours(false));
                }}
              >
                {undoingHours ? "Undoing…" : "Undo"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11"
                onClick={() => setHoursSaved(null)}
              >
                Keep it
              </Button>
            </div>
          </div>
        ) : null}

        {tabValue === "pricing" && !demoMode ? (
          // A real business writes its prices as a sentence first (the box
          // above, open when arriving from "Add your prices"); the form is the
          // second way, for anything the sentence reader will not take.
          <div ref={pricingRef} id="pricing" className="scroll-mt-4">
            <PricingRules business={business} secondary />
          </div>
        ) : null}

        {tabValue !== "voice" && tabValue !== "learning" ? (
          <label className="mt-8 block">
            <span className="sr-only">Find in business info</span>
            <input
              name="brain-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tabValue === "service"
                  ? "Find a service or supporting detail"
                  : "Find a price, policy or source"
              }
              className="field h-11"
            />
          </label>
        ) : null}

        {tabValue === "service" && serviceCatalogue.length > 0 ? (
          <section className="business-service-catalog" aria-label="Service catalogue">
            <ul>
              {serviceCatalogue.map((service) => (
                <li key={service.id}>
                  <span className="ui-icon-tile tone-violet">
                    <BriefcaseBusiness size={20} aria-hidden />
                  </span>
                  <div>
                    <h2>{service.customerLabel}</h2>
                    <p>
                      {[
                        service.category,
                        service.durationMinutes ? `${service.durationMinutes} min` : null,
                        ...service.locationModes,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Badge tone={service.state === "Needs review" ? "warn" : "neutral"}>
                    {factStateWord(service.state)}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tabValue === "voice" ? (
          <VoiceCard key={business.id} businessId={business.id} />
        ) : tabValue === "learning" ? (
          <div className="mt-2">
            {pendingLearn.length === 0 ? (
              <p className="border-t border-line py-10 text-sm text-stone">
                No suggested updates. Correct a reusable interpretation on an enquiry to propose
                one.
              </p>
            ) : (
              <ul className="ledger stagger-in">
                {pendingLearn.map((l) => (
                  <li key={l.id}>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-medium">{l.title}</h2>
                      <Badge>{l.class}</Badge>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{l.proposal}</p>
                    {l.highImpact ? (
                      <p className="mt-2 text-sm text-warn">
                        High-impact. Will not become Active from this control.
                      </p>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => confirmLearning(business.id, l.id)}>
                          Add to business info
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => dismissLearning(business.id, l.id)}
                        >
                          Don’t learn this
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="mt-2 space-y-8">
            {groups.length === 0 ? (
              tabValue === "service" && serviceCatalogue.length ? null : (
                <p className="border-t border-line py-10 text-sm text-stone">
                  {query.trim()
                    ? "No business details match your search."
                    : "Nothing in this section yet."}
                </p>
              )
            ) : (
              groups.map((group) => (
                <section key={group.title ?? tab}>
                  {group.title ? <p className="eyebrow mb-1">{group.title}</p> : null}
                  <ul className="ledger stagger-in">
                    {group.items.map((k) => (
                      <FactRow
                        key={k.id}
                        item={k}
                        all={items}
                        live={!demoMode}
                        services={activeRules(business).map((r) => r.service)}
                        onResolve={(keep, drop) => {
                          resolveConflict(business.id, keep, drop);
                          toast(
                            "Lash add-on confirmed. No open enquiry currently includes lashes.",
                          );
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        )}

        <Dialog open={Boolean(livePrices)} onOpenChange={(o) => !o && setLivePrices(null)}>
          <ResponsiveDialogContent title="Business details to save">
            {livePrices ? (
              <div className="space-y-3 text-sm">
                <ul className="space-y-2">
                  {livePrices.prices.map((p, i) => {
                    const change = replacementsFor(
                      activeRules(business ?? {}),
                      livePrices.prices.map((x) => x.rule),
                    )[i]!;
                    return (
                      <li key={p.line}>
                        <p className="font-medium">{describeRule(p.rule)}</p>
                        {change.replaces.length ? (
                          <p className="mt-0.5 font-medium text-warn">
                            Replaces {change.replaces.join(" and ")}
                          </p>
                        ) : null}
                        {change.clashesWith.length ? (
                          <p className="mt-0.5 font-medium text-warn">
                            Also in this list: {change.clashesWith.join(" and ")}. Only one price
                            per service can stand - the last one saved replaces the others.
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-ink-2">
                          {p.rule.kind === "per_unit"
                            ? `When a customer does not say how many, Enquiry asks for ${decidingPhrase(p.rule.quantityField)}.`
                            : "One flat price for this job."}
                        </p>
                      </li>
                    );
                  })}
                  {livePrices.details.map((d) => (
                    <li key={d.line}>
                      {d.detail.kind === "working_hours" ? (
                        // The one detail that changes Settings: said as the
                        // change it makes, so saving is the owner confirming it.
                        <p className="callout bg-paper-2 font-medium text-ink">
                          {workingHoursChange(prefs, d.detail)}
                        </p>
                      ) : null}
                      <p className="font-medium">{describeDetail(d.detail)}</p>
                      <p className="mt-0.5 text-ink-2">{detailEffect(d.detail)}</p>
                      {minimumClash(d.detail, [
                        ...activeDetails(business ?? {}),
                        ...livePrices.details.map((x) => x.detail),
                      ]) ? (
                        <p className="mt-0.5 font-medium text-warn">
                          {minimumClash(d.detail, [
                            ...activeDetails(business ?? {}),
                            ...livePrices.details.map((x) => x.detail),
                          ])}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {livePrices.unread.some((u) => u.note) ? (
                  <fieldset className="space-y-2">
                    <legend className="font-medium">Not a set price - keep as a note?</legend>
                    {livePrices.unread
                      .filter((u) => u.note)
                      .map((u) => (
                        <label key={u.line} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1 size-4 accent-mark"
                            checked={notesChosen.has(u.line)}
                            onChange={(e) => {
                              const next = new Set(notesChosen);
                              if (e.target.checked) next.add(u.line);
                              else next.delete(u.line);
                              setNotesChosen(next);
                            }}
                          />
                          <span>
                            <span className="font-medium">{u.line}</span>
                            <span className="mt-0.5 block text-ink-2">
                              {u.reason} As a note, Enquiry shows it to you on each quote it
                              concerns and never adds it to a price.
                            </span>
                          </span>
                        </label>
                      ))}
                  </fieldset>
                ) : null}
                {livePrices.unread.some((u) => !u.note) ? (
                  <div className="callout bg-warn-bg text-warn">
                    <p className="font-medium">Not saved - Enquiry could not read these:</p>
                    <ul className="mt-1 space-y-1 text-ink-2">
                      {livePrices.unread
                        .filter((u) => !u.note)
                        .map((u) => (
                          <li key={u.line}>{`"${u.line}" - ${u.reason}`}</li>
                        ))}
                    </ul>
                  </div>
                ) : null}
                <p className="text-ink-2">
                  Open enquiries that are waiting on your prices update when you save.
                </p>
                {saveError ? (
                  <p className="text-sm text-danger" role="alert">
                    {saveError}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={savingPrices}
                    onClick={async () => {
                      setSavingPrices(true);
                      setSaveError(null);
                      // The hours Settings held before this save, for the Undo.
                      const hoursChange = livePrices.details.find(
                        (d) => d.detail.kind === "working_hours",
                      );
                      const hoursLine =
                        hoursChange?.detail.kind === "working_hours"
                          ? workingHoursChange(prefs, hoursChange.detail)
                          : null;
                      try {
                        // One call: every price and detail saves, or none does.
                        const services = activeRules(business).map((r) => r.service);
                        const notes = livePrices.unread
                          .filter((u) => u.note && notesChosen.has(u.line))
                          .map((u) => noteFor(u.line, services));
                        const noteLines = livePrices.unread
                          .filter((u) => u.note && notesChosen.has(u.line))
                          .map((u) => u.line);
                        const res = await firstBeta.saveRules(
                          business.id,
                          livePrices.prices.map((p) => p.rule),
                          [...livePrices.details.map((d) => d.detail), ...notes],
                          {
                            rules: livePrices.prices.map((p) => p.line),
                            details: [...livePrices.details.map((d) => d.line), ...noteLines],
                          },
                        );
                        const updated = res.updatedEnquiries > 0;
                        // Only what was saved leaves the box. Lines Enquiry
                        // could not read stay, with the reason beside them.
                        const left = livePrices.unread.filter(
                          (u) => !(u.note && notesChosen.has(u.line)),
                        );
                        setLivePrices(null);
                        // Came from "Add a price for this job": straight back
                        // to that enquiry, now worked out with the new price.
                        // Only when a price for that job actually saved;
                        // otherwise stay here and say what did save.
                        const pricedIt = pricedTheJob(
                          livePrices.prices.map((p) => p.rule),
                          search.service,
                        );
                        if (search.back && left.length === 0 && pricedIt) {
                          toast.success("Saved. Back to the enquiry, worked out with your price.");
                          void navigate({
                            to: "/enquiries/$enquiryId",
                            params: { enquiryId: search.back },
                          });
                          return;
                        }
                        if (left.length > 0) {
                          setInput(left.map((u) => u.line).join("\n"));
                          setTellError(
                            `Not saved yet: ${left.map((u) => `"${u.line}" - ${u.reason}`).join(" ")}`,
                          );
                        } else {
                          setInput("");
                          setComposerOpen(false);
                        }
                        const count = res.saved + res.details;
                        if (hoursLine && !hoursLine.startsWith("Settings hours stay")) {
                          setHoursSaved(hoursLine);
                        }
                        toast.success(
                          search.back && !pricedIt && search.service
                            ? `Saved ${count} ${count === 1 ? "detail" : "details"}. There is still no price for ${search.service.toLowerCase()} - add one to finish that enquiry.`
                            : updated
                              ? "Saved. Open enquiries that were waiting on these prices have been worked out again."
                              : "Saved. Enquiry can price these now.",
                        );
                      } catch (err) {
                        setSaveError(
                          err instanceof Error ? err.message : "Could not save those prices.",
                        );
                      } finally {
                        setSavingPrices(false);
                      }
                    }}
                  >
                    {savingPrices
                      ? "Saving…"
                      : saveLabel(
                          livePrices.prices.length +
                            livePrices.details.length +
                            livePrices.unread.filter((u) => u.note && notesChosen.has(u.line))
                              .length,
                        )}
                  </Button>
                  <Button variant="secondary" onClick={() => setLivePrices(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </ResponsiveDialogContent>
        </Dialog>

        <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && cancel()}>
          <ResponsiveDialogContent title="Proposed business change">
            {preview ? (
              <div className="space-y-3 text-sm">
                <p className="text-ink-2">{preview.input}</p>
                <p>
                  <span className="text-stone">Current · </span>
                  {preview.current}
                </p>
                <p>
                  <span className="text-stone">New · </span>
                  {preview.next}
                </p>
                <p>
                  <span className="text-stone">Applies to · </span>
                  {preview.appliesTo}
                </p>
                <p>
                  <span className="text-stone">Effective · </span>
                  {preview.effectiveFrom}
                </p>
                {preview.highImpact ? (
                  <p className="callout bg-warn-bg text-warn text-sm">
                    This is an authoritative commercial rule. It becomes Active only if you confirm.
                  </p>
                ) : null}
                {preview.affected.length > 0 ? (
                  <ul className="space-y-2">
                    <li className="eyebrow">Open enquiries</li>
                    {preview.affected.map((row) => (
                      <li key={row.enquiryId} className="text-sm">
                        <span className="font-medium">{row.customerName}</span>
                        {row.applies && row.from !== row.to ? (
                          <span>
                            {" "}
                            · {row.from} → {row.to}
                          </span>
                        ) : (
                          <span className="text-stone"> · {row.from} unchanged</span>
                        )}
                        {row.note ? <p className="mt-0.5 text-xs text-stone">{row.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-stone">No open enquiry currently uses this rule.</p>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      const hit = preview.affected.find(
                        (row) => row.applies && row.from !== row.to,
                      );
                      confirm();
                      setInput("");
                      if (hit) {
                        toast(`Quote updated for ${hit.customerName}`);
                        void navigate({
                          to: "/enquiries/$enquiryId",
                          params: { enquiryId: hit.enquiryId },
                        });
                      } else {
                        toast("Business info updated. No open quote used this rule.");
                      }
                    }}
                  >
                    Confirm change
                  </Button>
                  <Button variant="secondary" onClick={cancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </ResponsiveDialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function VoiceCard({ businessId }: { businessId: string }) {
  const business = usePrototype((s) => s.businesses.find((b) => b.id === businessId));
  const setVoice = usePrototype((s) => s.setVoice);
  const openCount = usePrototype(
    (s) =>
      s.enquiries.filter((e) => e.businessId === businessId && e.state.lifecycle === "OPEN").length,
  );
  const [greeting, setGreeting] = useState(business?.voice.greeting ?? "");
  const [signOff, setSignOff] = useState(business?.voice.signOff ?? "");
  if (!business) return null;
  const v = business.voice;
  return (
    <div className="mt-2 border-t border-line pt-6">
      <h2 className="text-lg font-semibold">Voice & tone</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{v.summary}</p>
      <p className="mt-1 text-xs text-stone">
        Greeting and sign-off rewrite open drafts ({openCount}). Sent mail is not touched.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="eyebrow">Greeting</span>
          <input
            className="field mt-1.5 h-11"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            onBlur={() => {
              if (greeting !== v.greeting) setVoice(businessId, { greeting });
            }}
          />
        </label>
        <label className="block text-sm">
          <span className="eyebrow">Warmth</span>
          <select
            className="field mt-1.5 h-11"
            value={v.warmth}
            onChange={(e) => {
              const warmth = e.target.value;
              const nextGreeting = warmth === "Reserved" ? "Hello {name}," : "Hi {name},";
              setGreeting(nextGreeting);
              setVoice(businessId, { warmth, greeting: nextGreeting });
            }}
          >
            <option>Warm</option>
            <option>Friendly</option>
            <option>Reserved</option>
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="eyebrow">Sign-off</span>
          <textarea
            className="field mt-1.5 leading-relaxed"
            rows={3}
            value={signOff}
            onChange={(e) => setSignOff(e.target.value)}
            onBlur={() => {
              if (signOff !== v.signOff) setVoice(businessId, { signOff });
            }}
          />
        </label>
      </div>
      <p className="mt-4 text-xs text-stone">Avoids: {v.avoidedPhrases.join(", ")}</p>
      <VoicePlayground businessId={businessId} />
    </div>
  );
}

function VoicePlayground({ businessId }: { businessId: string }) {
  const business = usePrototype((s) => s.businesses.find((b) => b.id === businessId));
  const [sample, setSample] = useState(
    "Hi Alex,\n\nA group of four is $625 including travel within 15 km.\n\nMina",
  );
  if (!business) return null;
  const rewritten = applyVoiceToDraft(sample, business.voice, "Alex");
  return (
    <section className="mt-8 border-t border-line pt-6">
      <p className="eyebrow">Try a sentence</p>
      <p className="mt-1 text-sm text-ink-2">
        Sent mail is never rewritten. This is only a preview of greeting and sign-off.
      </p>
      <textarea
        className="field mt-3 leading-relaxed"
        rows={4}
        value={sample}
        onChange={(e) => setSample(e.target.value)}
      />
      <div className="mt-3 rounded-lg bg-paper px-4 py-3">
        <p className="letter-body whitespace-pre-wrap text-sm text-ink-2">{rewritten}</p>
      </div>
    </section>
  );
}

const SECTION_ALIASES: Record<string, (typeof SECTIONS)[number]["id"]> = {
  availability: "capacity",
  capacity: "capacity",
  pricing: "pricing",
  prices: "pricing",
  services: "service",
  service: "service",
  policies: "policy",
  policy: "policy",
  details: "required_fact",
  required_fact: "required_fact",
  operating: "operating",
  voice: "voice",
  learning: "learning",
};

/** The Business section a link names, whatever it calls it. */
function sectionFromSearch(section: string | undefined) {
  return section ? SECTION_ALIASES[section.trim().toLowerCase()] : undefined;
}

function saveLabel(count: number): string {
  if (count === 0) return "Nothing to save";
  return count === 1 ? "Save this detail" : `Save these ${count} details`;
}
