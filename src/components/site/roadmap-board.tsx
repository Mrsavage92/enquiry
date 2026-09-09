import { useEffect, useState } from "react";
import {
  ROADMAP_WRITTEN,
  NON_GOALS,
  STAGES,
  statusLabel,
  type RoadmapStage,
} from "@/lib/launch/roadmap";
import { listMyRoadmapNeeds, toggleRoadmapNeed, trackLaunchEvent } from "@/lib/launch/api";
import { currentTouch, launchSessionId, storedWaitlistId } from "@/lib/launch/session";
import { WaitlistForm } from "@/components/site/waitlist-form";
import { RoadmapVisual } from "@/components/site/roadmap-visuals";
import { RoadmapEraNav } from "@/components/site/roadmap-nav";
import { RoadmapFeedback } from "@/components/site/roadmap-feedback";
import {
  EntryFigure,
  EntryGroup,
  EntryList,
  EntryProse,
  EntryTitle,
  RoadmapEntry,
} from "@/components/site/roadmap-entry";

/*
  /roadmap on the marketing mirror. The page is the reference's changelog:
  a page header, then one entry per stage in a rail whose label column carries
  the status, then the closing entries, then the system's prefooter CTA.

  What the reference's own end-of-page does: the last entry is followed by a
  single 1px #18191a divider (margin 32px top, 16px bottom) and then the site
  footer. There is no closing block of its own, so "not building", "shipped" and
  "roadmaps change" stay in the entry stream rather than becoming sections with
  their own surfaces - and the divider closes the stream exactly as it does
  there. The CTA after it is Enquiry's, not the reference's, and uses the
  system's own prefooter + WaitlistForm.
*/

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

function StageEntry({
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
  const later = !stage.current && stage.status.every((s) => s === "later");
  return (
    <RoadmapEntry
      id={`stage-${stage.id}`}
      data-stage={stage.id}
      data-horizon={later ? "later" : stage.current ? "now" : "next"}
      label={statusLabel(stage.status[0])}
      meta={stage.number}
      marker={stage.current}
    >
      <EntryTitle>{stage.title}</EntryTitle>
      <EntryProse first tone="strong">
        {stage.goal}
      </EntryProse>
      <EntryProse>{stage.narrative}</EntryProse>

      {/* The reference puts an entry's media after its opening paragraphs. */}
      <EntryFigure>
        <RoadmapVisual type={stage.visual} />
      </EntryFigure>

      {stage.outcomes.map((group) => (
        <EntryGroup key={group.id} title={group.title} items={group.items} />
      ))}

      {stage.notClaiming ? (
        <EntryGroup title="We’re not claiming this yet" items={stage.notClaiming} />
      ) : null}

      {stage.promise ? <EntryProse tone="strong">{stage.promise}</EntryProse> : null}
      {stage.caveat ? <EntryProse tone="quiet">{stage.caveat}</EntryProse> : null}

      {stage.feedbackEnabled ? (
        <RoadmapFeedback
          id={stage.id}
          needed={needed.has(stage.id)}
          busy={busy === stage.id}
          onNeed={onNeed}
          onTrack={track}
        />
      ) : null}
    </RoadmapEntry>
  );
}

export function RoadmapBoard() {
  const [needed, setNeeded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [active, setActive] = useState(STAGES[0]?.id ?? "understand");

  useEffect(() => {
    track("roadmap_view");
    void listMyRoadmapNeeds({ data: { sessionId: launchSessionId() } })
      .then((r) => setNeeded(new Set(r.ids)))
      .catch(() => undefined);
  }, []);

  /* Drives the tab row's current state and the per-stage view events. */
  useEffect(() => {
    const seen = new Set<string>();
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
          if (!seen.has(id)) {
            seen.add(id);
            track(id === "endgame" ? "roadmap_endgame_view" : "roadmap_stage_view", id);
          }
        }
      },
      { rootMargin: "-28% 0px -50% 0px", threshold: [0.15, 0.35, 0.6] },
    );
    for (const n of nodes) io.observe(n);
    return () => io.disconnect();
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

  /*
    The reference's sticky rail label parks at top: 96px, so a jumped-to entry
    is put on that same line rather than under the fixed nav.
  */
  const jump = (id: string) => {
    const el = document.getElementById(`stage-${id}`);
    if (!el) return;
    const header = document.querySelector("header");
    const navHeight = header instanceof HTMLElement ? header.getBoundingClientRect().height : 73;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - (navHeight + 23),
      behavior: "smooth",
    });
  };

  return (
    <>
      <RoadmapEraNav active={active} onJump={jump} />

      <div className="mk-container">
        {STAGES.map((stage) => (
          <StageEntry key={stage.id} stage={stage} needed={needed} busy={busy} onNeed={onNeed} />
        ))}

        <RoadmapEntry label="Restraint">
          <EntryTitle>What we’re not building.</EntryTitle>
          <EntryList items={NON_GOALS} />
          <EntryProse tone="strong">
            The boundary stays powerful because it stays clear: first enquiry → booked or lost.
          </EntryProse>
        </RoadmapEntry>

        <RoadmapEntry label="Evidence">
          <EntryTitle>Shipped</EntryTitle>
          <EntryProse first>
            Nothing to manufacture here yet. When something genuinely ships, this is where we’ll put
            it - with the date and proof.
          </EntryProse>
        </RoadmapEntry>

        {/*
          The reference's rail label is always the group's date. This block had
          no eyebrow on the previous page and inventing one would be new copy,
          so the rail runs on unlabelled through it.
        */}
        <RoadmapEntry>
          <EntryTitle>Roadmaps change.</EntryTitle>
          <EntryProse first tone="strong">
            This is our direction, not a contract with the future.
          </EntryProse>
          <EntryProse>
            Customer evidence can change the order, the implementation, or occasionally whether
            something gets built at all. If that happens, we’ll update this page rather than quietly
            leave an old promise here.
          </EntryProse>
          <EntryProse tone="quiet">
            We would rather change our mind publicly than ship the wrong thing privately.
          </EntryProse>
        </RoadmapEntry>

        {/* The reference closes its stream with this divider, then the footer. */}
        <div className="mk-divider mt-8 mb-4" data-divider="close" />
        {/*
          One text node, not "Last written " + date + ".". Split, the trailing
          period is a 3px-wide node of its own and the rendered-pixel sweep
          cannot resolve a 13px "." in a 3px box - it graded the same node at
          4.88:1 on / and 1.38:1 here purely on sub-pixel placement.
        */}
        <p className="mk-mini">{`Last written ${ROADMAP_WRITTEN}.`}</p>
      </div>

      <section className="mk-prefooter">
        <div className="mk-container">
          <h2 className="mk-h2 max-w-[20ch]">Want to help shape what gets built?</h2>
          <p className="mk-lede mt-5 max-w-xl">
            Join early access. We’ll invite businesses gradually as Enquiry is ready for real-world
            use.
          </p>
          <div className="mt-10 max-w-xl">
            <WaitlistForm compact ctaLabel="Request early access" />
          </div>
          <p className="mk-mini mt-5">We’ll email when there’s something worth showing you.</p>
        </div>
      </section>
    </>
  );
}
