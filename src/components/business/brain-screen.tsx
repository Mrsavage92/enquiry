import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { BUSINESSES } from "@/fixtures";
import { usePrototype } from "@/store/prototype-store";
import { WorkspaceSettingUp } from "@/components/shell/workspace-setting-up";
import { PricingRules } from "@/components/business/pricing-rules";
import { visibleBusinesses } from "@/lib/workspace/resolve-business";
import type { KnowledgeItem } from "@/domain/types";
import { cn } from "@/lib/utils";
import { applyVoiceToDraft } from "@/domain/voice-apply";
import { useNarrow } from "@/lib/use-narrow";

const SECTIONS = [
  { id: "all", label: "Overview" },
  { id: "service", label: "Services" },
  { id: "pricing", label: "Pricing" },
  { id: "required_fact", label: "What I need to know" },
  { id: "operating", label: "How you work" },
  { id: "capacity", label: "Capacity" },
  { id: "policy", label: "Policies" },
  { id: "learning", label: "Learning" },
  { id: "voice", label: "Voice" },
] as const;

const PHONE_SECTIONS = [
  { id: "all", label: "Brain" },
  { id: "learning", label: "Learning" },
  { id: "voice", label: "Voice" },
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
  required_fact: "What I need to know",
  operating: "How you work",
  capacity: "Capacity",
  policy: "Policies",
  alias: "Aliases",
};

export function BrainScreen() {
  const businesses = usePrototype((s) => s.businesses);
  const demoMode = usePrototype((s) => s.demoMode);
  const filter = usePrototype((s) => s.businessFilter);
  const setFilter = usePrototype((s) => s.setBusinessFilter);
  const tab = usePrototype((s) => s.brainTab) as (typeof SECTIONS)[number]["id"];
  const setTab = usePrototype((s) => s.setBrainTab) as (
    id: (typeof SECTIONS)[number]["id"],
  ) => void;
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
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
  // Undefined-safe rather than guarded here: the early return has to sit below
  // every hook, so nothing between this line and the render may assume a
  // business exists.
  // Memoised because `?? []` would otherwise mint a new array every render and
  // invalidate the useMemo below it on each pass.
  const items = useMemo(() => business?.knowledge ?? [], [business?.knowledge]);
  const needsReview = items.filter((k) => k.state === "Needs review");
  const active = items.filter((k) => k.state === "Active");
  const pendingLearn = (business?.learningSuggestions ?? []).filter((l) => l.status === "pending");
  const phone = useNarrow(860) !== false;
  const tabs = phone ? PHONE_SECTIONS : SECTIONS;
  const tabValue = tabs.some((s) => s.id === tab) ? tab : "all";

  useEffect(() => {
    if (!focusComposer) return;
    tellRef.current?.focus();
    setFocusComposer(false);
  }, [focusComposer, setFocusComposer]);

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
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {phone ? null : <p className="eyebrow">Business Brain</p>}
          <h1
            className={cn("text-2xl font-semibold tracking-tight sm:text-3xl", !phone && "mt-1.5")}
          >
            {business.name}
          </h1>
          {phone ? null : (
            <>
              <span className="page-rule" aria-hidden />
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
                {business.industry} · {business.baseLocation}. Customer-specific facts stay on the
                enquiry.
              </p>
            </>
          )}
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

      <p className="mt-6 text-sm text-ink-2">
        <span className="font-serif tabular-nums text-ink">{business.services.length}</span>
        <span className="text-stone"> services</span>
        <span className="mx-2 text-line-strong">·</span>
        <span className="font-serif tabular-nums text-ink">{active.length}</span>
        <span className="text-stone"> confirmed</span>
        <span className="mx-2 text-line-strong">·</span>
        <span className="font-serif tabular-nums text-ink">{needsReview.length}</span>
        <span className="text-stone"> need review</span>
        <span className="mx-2 text-line-strong">·</span>
        <span className="font-serif tabular-nums text-ink">{pendingLearn.length}</span>
        <span className="text-stone"> learning</span>
      </p>

      <PricingRules business={business} />

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          tell(business.id, input);
        }}
      >
        <label className="block" htmlFor="tell">
          <span className="eyebrow">Tell Enquiry</span>
          <textarea
            id="tell"
            ref={tellRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={
              business.id === "northlight"
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
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          {phone ? null : (
            <p className="text-xs text-stone">
              Compiled into a preview. High-impact prices never activate silently.
            </p>
          )}
          <Button type="submit" size="sm" className={phone ? "min-h-11 w-full" : undefined}>
            Preview change
          </Button>
        </div>
      </form>

      <div className="mt-8 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Segmented
          ariaLabel="Knowledge sections"
          value={tabValue}
          onChange={setTab}
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

      {tabValue !== "voice" && tabValue !== "learning" && !phone ? (
        <label className="mt-4 block">
          <span className="sr-only">Find in Business Brain</span>
          <input
            name="brain-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a price, policy or source"
            className="field h-11"
          />
        </label>
      ) : null}

      {tabValue === "voice" ? (
        <VoiceCard key={business.id} businessId={business.id} />
      ) : tabValue === "learning" ? (
        <div className="mt-2">
          {pendingLearn.length === 0 ? (
            <p className="border-t border-line py-10 text-sm text-stone">
              No pending learning. Correct a reusable interpretation on an enquiry to propose one.
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
                        Add to Business Brain
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
            <p className="border-t border-line py-10 text-sm text-stone">
              {query.trim() ? "Nothing in this brain matches." : "Nothing in this section yet."}
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.title ?? tab}>
                {group.title ? <p className="eyebrow mb-1">{group.title}</p> : null}
                <ul className="ledger stagger-in">
                  {group.items.map((k) => (
                    <KnowledgeRow
                      key={k.id}
                      item={k}
                      all={items}
                      onResolve={(keep, drop) => {
                        resolveConflict(business.id, keep, drop);
                        toast("Lash add-on confirmed. No open enquiry currently includes lashes.");
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && cancel()}>
        <DialogContent title="Proposed Business Brain change">
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
                    const hit = preview.affected.find((row) => row.applies && row.from !== row.to);
                    confirm();
                    setInput("");
                    if (hit) {
                      toast(`Quote updated for ${hit.customerName}`);
                      void navigate({
                        to: "/enquiries/$enquiryId",
                        params: { enquiryId: hit.enquiryId },
                      });
                    } else {
                      toast("Business Brain updated. No open quote used this rule.");
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
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KnowledgeRow({
  item,
  all,
  onResolve,
}: {
  item: KnowledgeItem;
  all: KnowledgeItem[];
  onResolve: (keep: string, drop: string) => void;
}) {
  const [srcOpen, setSrcOpen] = useState(false);
  const tone =
    item.state === "Needs review"
      ? "warn"
      : item.state === "Active"
        ? "ok"
        : item.state === "Superseded"
          ? "neutral"
          : "info";
  const other = item.conflictWith ? all.find((k) => k.id === item.conflictWith) : undefined;
  return (
    <li className="relative pl-3">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-3 left-0 w-0.5 rounded-full",
          item.state === "Needs review"
            ? "bg-warn"
            : item.state === "Active"
              ? "bg-ok"
              : "bg-transparent",
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-medium leading-snug">{item.title}</h2>
        <Badge tone={tone}>{item.state}</Badge>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">{item.body}</p>
      <p className="mt-1.5 text-xs text-stone">
        {item.source.label}
        {item.effectiveFrom ? ` · from ${item.effectiveFrom}` : ""}
        {item.stale ? " · last confirmed a while ago" : ""}
      </p>
      <button
        type="button"
        className="mt-1.5 text-xs font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        onClick={() => setSrcOpen(true)}
      >
        Provenance
      </button>
      {item.state === "Needs review" && other ? (
        <div className="mt-3">
          <Button size="sm" onClick={() => onResolve(item.id, other.id)}>
            Use this version
          </Button>
        </div>
      ) : item.conflictWith && item.state === "Needs review" ? (
        <p className="mt-2 text-sm text-warn">{item.conflictWith}</p>
      ) : null}
      <Dialog open={srcOpen} onOpenChange={setSrcOpen}>
        <DialogContent title="Provenance">
          <p className="text-sm">
            {item.source.label}
            {item.source.at ? ` · ${item.source.at}` : ""}
          </p>
          {item.source.detail ? (
            <p className="mt-2 text-sm text-ink-2">{item.source.detail}</p>
          ) : null}
          <p className="mt-3 text-xs text-stone">
            {item.class} · {item.version}
          </p>
        </DialogContent>
      </Dialog>
    </li>
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
      <h2 className="text-lg font-semibold tracking-tight">Your Voice</h2>
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
            className="field mt-1.5 font-serif leading-relaxed"
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
        className="field mt-3 font-serif leading-relaxed"
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
