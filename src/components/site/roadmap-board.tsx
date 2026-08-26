import { useEffect, useRef, useState } from "react";
import {
  ROADMAP_LEGEND,
  ROADMAP_WRITTEN,
  NON_GOALS,
  STAGES,
  type RoadmapStage,
  type RoadmapStatus,
} from "@/lib/launch/roadmap";
import { joinWaitlist, listMyRoadmapNeeds, saveRoadmapFeedback, toggleRoadmapNeed, trackLaunchEvent } from "@/lib/launch/api";
import {
  currentTouch,
  firstTouch,
  launchSessionId,
  storedWaitlistId,
  storeWaitlistId,
} from "@/lib/launch/session";
import { cn } from "@/lib/utils";
import { WaitlistForm } from "@/components/site/waitlist-form";
import { RoadmapVisual } from "@/components/site/roadmap-visuals";
import { Reveal } from "@/components/site/motion";
import { Button } from "@/components/ui/button";

function touchFields() {
  const touch = currentTouch();
  return {
    utm_source: touch.utm_source,
    utm_medium: touch.utm_medium,
    utm_campaign: touch.utm_campaign,
    utm_content: touch.utm_content,
    referrer: touch.referrer,
  };
}

function track(name: string, feature = "") {
  void trackLaunchEvent({
    data: {
      sessionId: launchSessionId(),
      event_name: name,
      feature_id: feature,
      landing_path: "/roadmap",
      ...touchFields(),
    },
  }).catch(() => undefined);
}

function StatusPills({ status }: { status: RoadmapStatus[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {status.map((id) => {
        const meta = ROADMAP_LEGEND.find((s) => s.id === id);
        if (!meta) return null;
        return (
          <li
            key={id}
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-stone"
          >
            <span aria-hidden className="font-mono text-[0.7rem] text-ink">
              {meta.mark}
            </span>
            {meta.label}
          </li>
        );
      })}
    </ul>
  );
}

function Feedback({
  id,
  needed,
  busy,
  onNeed,
}: {
  id: string;
  needed: boolean;
  busy: boolean;
  onNeed: (id: string, waitlistId?: string) => Promise<boolean>;
}) {
  const known = Boolean(storedWaitlistId());
  const [open, setOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [whySaved, setWhySaved] = useState(false);
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const saveWhy = async (waitlistId?: string) => {
    const text = problem.trim();
    if (!text) return false;
    const result = await saveRoadmapFeedback({
      data: {
        feature_id: id,
        sessionId: launchSessionId(),
        waitlist_id: waitlistId || storedWaitlistId() || "",
        problem_text: text,
        ...touchFields(),
      },
    });
    return result.saved;
  };

  if (needed) {
    return (
      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onNeed(id)}
            className="min-h-11 text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            I’m interested
          </button>
          {whySaved ? (
            <p className="text-sm text-stone">Thanks — that helps us decide what to build next.</p>
          ) : (
            <button
              type="button"
              onClick={() => {
                track("roadmap_feedback_click", id);
                setWhyOpen((v) => !v);
              }}
              className="min-h-11 text-sm text-stone underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline"
            >
              Tell us why
            </button>
          )}
        </div>
        {whyOpen && !whySaved ? (
          <form
            className="max-w-sm space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              void saveWhy()
                .then((saved) => {
                  if (saved) {
                    setWhySaved(true);
                    setWhyOpen(false);
                    setProblem("");
                  } else {
                    setWhyOpen(false);
                  }
                })
                .catch((err) => {
                  setError(err instanceof Error ? err.message : "Could not save that.");
                });
            }}
          >
            <label className="block text-sm">
              <span className="mb-1 block text-stone">What problem would this solve for your business?</span>
              <textarea
                className="field min-h-20"
                rows={2}
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="Optional."
              />
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" className="min-h-11">
                Send
              </Button>
              <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={() => setWhyOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    );
  }

  const submit = async () => {
    setError("");
    setJoining(true);
    try {
      const touch = currentTouch();
      const first = firstTouch();
      const result = await joinWaitlist({
        data: {
          email,
          sessionId: launchSessionId(),
          utm_source: first.utm_source || touch.utm_source,
          utm_medium: first.utm_medium || touch.utm_medium,
          utm_campaign: first.utm_campaign || touch.utm_campaign,
          utm_content: first.utm_content || touch.utm_content,
          referrer: first.referrer || touch.referrer,
          linkedin_post_id: first.linkedin_post_id || touch.linkedin_post_id,
          first_touch: JSON.stringify(first.utm_source ? first : touch),
          latest_touch: JSON.stringify(touch),
          landing_path: "/roadmap",
        },
      });
      storeWaitlistId(result.id);
      track("roadmap_waitlist_signup", id);
      await onNeed(id, result.id);
      if (problem.trim()) {
        const saved = await saveWhy(result.id);
        if (saved) setWhySaved(true);
      }
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={busy || joining}
        onClick={() => {
          if (known) onNeed(id);
          else {
            track("roadmap_feedback_click", id);
            setOpen(true);
          }
        }}
        className="min-h-11 text-sm text-stone underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline"
      >
        I need this
      </button>
      {open ? (
        <form
          className="mt-4 max-w-sm space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block text-stone">Email</span>
            <input
              className="field h-12"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone">What problem would this solve for your business?</span>
            <textarea
              className="field min-h-20"
              rows={2}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Optional."
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={joining} className="min-h-11">
              {joining ? "Saving…" : "Add my interest"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-11"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function StageBlock({
  stage,
  needed,
  busy,
  onNeed,
}: {
  stage: RoadmapStage;
  needed: Set<string>;
  busy: string | null;
  onNeed: (id: string, waitlistId?: string) => Promise<boolean>;
}) {
  const endgame = stage.visual === "endgame";
  const later = !stage.current && stage.status.every((s) => s === "later");
  return (
    <article
      id={`stage-${stage.id}`}
      data-stage={stage.id}
      data-horizon={later ? "later" : stage.current ? "now" : "next"}
      className={cn("roadmap-stage relative", endgame && "roadmap-endgame")}
    >
      <div className="roadmap-marker" aria-hidden>
        <span className={cn("roadmap-dot", stage.current && "is-now")}>{stage.number}</span>
      </div>
      <div
        className={cn(
          endgame
            ? "max-w-3xl lg:max-w-none"
            : "max-w-xl lg:grid lg:max-w-none lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start lg:gap-12",
        )}
      >
        <div>
          <Reveal>
            {stage.current ? <p className="eyebrow mb-3">Where we are</p> : null}
            <StatusPills status={stage.status} />
            <h2
              className={cn(
                "text-halo mt-3 font-serif font-semibold tracking-tight",
                endgame
                  ? "max-w-xl text-5xl sm:text-6xl md:text-7xl"
                  : "text-4xl sm:text-5xl md:text-[3.25rem]",
              )}
            >
              {stage.title}
            </h2>
            <p
              className={cn(
                "text-halo mt-5 max-w-lg font-serif leading-snug text-ink",
                endgame ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
              )}
            >
              {stage.goal}
            </p>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-2">{stage.narrative}</p>
          </Reveal>

          {stage.outcomes.map((group) => (
            <Reveal key={group.id} delay={40}>
              <div className="mt-8">
                <h3 className="text-sm font-medium">{group.title}</h3>
                <ul className="mt-3">
                  {group.items.map((item) => (
                    <li key={item} className="border-t border-line py-3 text-sm leading-relaxed text-ink-2 last:border-b">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}

          {stage.notClaiming ? (
            <Reveal delay={60}>
              <aside className="mt-8 rounded-lg border border-line bg-raised px-5 py-5">
                <p className="text-xs uppercase tracking-wider text-stone">We’re not claiming this yet</p>
                <ul className="mt-3">
                  {stage.notClaiming.map((item) => (
                    <li key={item} className="border-t border-line py-2 text-sm text-ink-2 first:border-t-0 first:pt-0">
                      {item}
                    </li>
                  ))}
                </ul>
              </aside>
            </Reveal>
          ) : null}

          {stage.promise ? (
            <Reveal delay={80}>
              <p className="mt-8 max-w-lg font-serif text-lg leading-snug">{stage.promise}</p>
            </Reveal>
          ) : null}

          {stage.caveat ? <p className="mt-3 max-w-lg text-sm text-stone">{stage.caveat}</p> : null}

          {endgame ? (
            <Reveal delay={100}>
              <div className="mt-10">
                <RoadmapVisual type={stage.visual} />
              </div>
            </Reveal>
          ) : null}
        </div>

        {endgame ? null : (
          <Reveal delay={120} className="mt-8 lg:mt-12">
            <RoadmapVisual type={stage.visual} />
          </Reveal>
        )}
      </div>

      {stage.feedbackEnabled ? (
        <Feedback
          id={stage.id}
          needed={needed.has(stage.id)}
          busy={busy === stage.id}
          onNeed={onNeed}
        />
      ) : null}
    </article>
  );
}

export function RoadmapBoard() {
  const [needed, setNeeded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [active, setActive] = useState(STAGES[0]?.id ?? "understand");
  const [fill, setFill] = useState(0);
  const rail = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    track("roadmap_view");
    void listMyRoadmapNeeds({ data: { sessionId: launchSessionId() } })
      .then((r) => setNeeded(new Set(r.ids)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const nodes = STAGES.map((s) => document.getElementById(`stage-${s.id}`)).filter(
      (n): n is HTMLElement => Boolean(n),
    );
    if (nodes.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.getAttribute("data-stage");
        if (id) {
          setActive(id);
          if (!seen.current.has(id)) {
            seen.current.add(id);
            track(id === "endgame" ? "roadmap_endgame_view" : "roadmap_stage_view", id);
          }
        }
      },
      { rootMargin: "-28% 0px -50% 0px", threshold: [0.15, 0.35, 0.6] },
    );
    for (const n of nodes) io.observe(n);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const start = rect.top + window.scrollY - window.innerHeight * 0.35;
      const span = Math.max(1, el.offsetHeight - window.innerHeight * 0.3);
      const p = (window.scrollY - start) / span;
      setFill(Math.min(1, Math.max(0, p)));
    };
    onScroll();
    if (reduce) {
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
    let frame = 0;
    const tick = () => {
      onScroll();
      frame = 0;
    };
    const onRaf = () => {
      if (frame) return;
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", onRaf, { passive: true });
    window.addEventListener("resize", onRaf);
    return () => {
      window.removeEventListener("scroll", onRaf);
      window.removeEventListener("resize", onRaf);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const onNeed = async (id: string, waitlistId?: string) => {
    setBusy(id);
    track("roadmap_feedback_click", id);
    try {
      const result = await toggleRoadmapNeed({
        data: {
          feature_id: id,
          sessionId: launchSessionId(),
          waitlist_id: waitlistId || storedWaitlistId() || "",
          ...touchFields(),
        },
      });
      setNeeded((prev) => {
        const next = new Set(prev);
        if (result.needed) next.add(id);
        else next.delete(id);
        return next;
      });
      return result.needed;
    } finally {
      setBusy(null);
    }
  };

  const jump = (id: string) => {
    const el = document.getElementById(`stage-${id}`);
    if (!el) return;
    const header = document.querySelector("header");
    const nav = document.querySelector('[aria-label="Roadmap stages"]');
    const offset =
      (header instanceof HTMLElement ? header.getBoundingClientRect().height : 56) +
      (nav instanceof HTMLElement ? nav.getBoundingClientRect().height : 48) +
      12;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  };

  return (
    <div>
      <section className="mx-auto max-w-3xl px-5 pb-10">
        <p className="eyebrow">Statuses</p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
          {ROADMAP_LEGEND.map((s) => (
            <li key={s.id} className="max-w-[14rem]">
              <p className="text-sm">
                <span className="mr-1.5 font-mono text-xs text-ink" aria-hidden>
                  {s.mark}
                </span>
                {s.label}
              </p>
              <p className="mt-0.5 pl-5 text-xs leading-snug text-stone">{s.hint}</p>
            </li>
          ))}
        </ul>
      </section>

      <nav
        className="sticky top-0 z-20 border-y border-line bg-paper/90 backdrop-blur-sm md:top-[4.25rem]"
        aria-label="Roadmap stages"
      >
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(s.id)}
              aria-current={active === s.id ? "true" : undefined}
              className={cn(
                "min-h-12 shrink-0 px-2.5 text-sm transition-colors duration-150",
                active === s.id ? "font-medium text-ink" : "text-stone",
              )}
            >
              <span className="mr-1.5 font-mono text-2xs tabular-nums">{s.number}</span>
              <span className={cn("border-b-2 py-1", active === s.id ? "border-ink" : "border-transparent")}>
                {s.short}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <div ref={rail} className="roadmap-rail mx-auto max-w-5xl px-5 py-16 sm:py-24">
        <div className="roadmap-spine" aria-hidden>
          <div className="roadmap-spine-fill" style={{ transform: `scaleY(${fill})` }} />
        </div>
        <div className="flex flex-col gap-24 sm:gap-32">
          {STAGES.map((stage) => (
            <StageBlock
              key={stage.id}
              stage={stage}
              needed={needed}
              busy={busy}
              onNeed={onNeed}
            />
          ))}
        </div>
      </div>

      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
          <Reveal>
            <p className="eyebrow">Restraint</p>
            <h2 className="text-halo mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
              What we’re not building.
            </h2>
            <ul className="mt-8">
              {NON_GOALS.map((item) => (
                <li key={item} className="border-t border-line py-4 text-base last:border-b">
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-8 max-w-lg font-serif text-xl leading-snug">
              The boundary stays powerful because it stays clear: first enquiry → booked or lost.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
          <Reveal>
            <p className="eyebrow">Evidence</p>
            <h2 className="text-halo mt-3 font-serif text-4xl font-semibold tracking-tight">Shipped</h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-2">
              Nothing to manufacture here yet. When something genuinely ships, this is where we’ll put it — with the date and proof.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line bg-raised">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
          <Reveal>
            <h2 className="text-halo font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
              Roadmaps change.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-2">
              This is our direction, not a contract with the future.
            </p>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-2">
              Customer evidence can change the order, the implementation, or occasionally whether something gets built at all. If that happens, we’ll update this page rather than quietly leave an old promise here.
            </p>
            <p className="mt-4 max-w-lg text-sm text-stone">
              We would rather change our mind publicly than ship the wrong thing privately.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-md px-5 py-16 text-left sm:py-20">
          <h2 className="text-halo font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Want to help shape what gets built?
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-2">
            Join early access. We’ll invite businesses gradually as Enquiry is ready for real-world use.
          </p>
          <div className="mt-8">
            <WaitlistForm compact />
          </div>
          <p className="mt-4 text-xs text-stone">
            We’ll email when there’s something worth showing you.
          </p>
        </div>
      </section>

      <p className="mx-auto max-w-3xl px-5 pb-6 text-xs text-stone">Last written {ROADMAP_WRITTEN}.</p>
    </div>
  );
}
