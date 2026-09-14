import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, LoaderCircle, MessageSquare, ThumbsUp } from "lucide-react";
import {
  ROADMAP_LEGEND,
  ROADMAP_WRITTEN,
  NON_GOALS,
  STAGES,
  type RoadmapStage,
  type RoadmapStatus,
} from "@/lib/launch/roadmap";
import {
  listMyRoadmapNeeds,
  saveRoadmapFeedback,
  toggleRoadmapNeed,
  trackLaunchEvent,
} from "@/lib/launch/api";
import { currentTouch, launchSessionId, storedWaitlistId } from "@/lib/launch/session";
import { PocketConcept, RoadmapIcon } from "@/components/site/roadmap-visuals";

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

function Feedback({
  stage,
  needed,
  busy,
  onNeed,
}: {
  stage: RoadmapStage;
  needed: boolean;
  busy: boolean;
  onNeed: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function save() {
    if (!problem.trim() || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await saveRoadmapFeedback({
        data: {
          feature_id: stage.id,
          sessionId: launchSessionId(),
          waitlist_id: storedWaitlistId() || "",
          problem_text: problem.trim(),
          ...touchFields(),
        },
      });
      if (!result.saved) throw new Error("Your feedback was not saved. Please try again.");
      setSaved(true);
      setProblem("");
      setOpen(false);
    } catch {
      setError("Your feedback was not saved. Please try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="roadmap-feedback">
      <div className="roadmap-feedback-actions">
        <button
          type="button"
          className="roadmap-interest"
          aria-pressed={needed}
          disabled={busy}
          onClick={() => void onNeed(stage.id)}
        >
          <ThumbsUp size={15} aria-hidden="true" /> {needed ? "Interest saved" : "I need this"}
        </button>
        {!saved && (
          <button
            type="button"
            className="roadmap-text-action"
            aria-expanded={open}
            aria-controls={`feedback-${stage.id}`}
            onClick={() => {
              setOpen(!open);
              track("roadmap_feedback_click", stage.id);
            }}
          >
            <MessageSquare size={15} aria-hidden="true" /> Tell us why
          </button>
        )}
      </div>
      {saved && <p role="status">Thanks. Your feedback has been saved.</p>}
      <form
        id={`feedback-${stage.id}`}
        hidden={!open}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label htmlFor={`problem-${stage.id}`}>What would this change for your business?</label>
        <textarea
          id={`problem-${stage.id}`}
          rows={3}
          required
          maxLength={800}
          value={problem}
          onChange={(event) => setProblem(event.target.value)}
        />
        {error && (
          <p role="alert" className="roadmap-error">
            {error}
          </p>
        )}
        <div className="roadmap-feedback-actions">
          <button className="roadmap-send" disabled={saving || !problem.trim()} type="submit">
            {saving ? (
              <LoaderCircle size={15} aria-hidden="true" />
            ) : (
              <ArrowRight size={15} aria-hidden="true" />
            )}
            {saving ? "Saving..." : "Send feedback"}
          </button>
          <button
            className="roadmap-text-action"
            type="button"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function StageBlock({
  stage,
  needed,
  busy,
  onNeed,
  error,
}: {
  stage: RoadmapStage;
  needed: boolean;
  busy: boolean;
  onNeed: (id: string) => Promise<void>;
  error: string;
}) {
  return (
    <article className="roadmap-item" id={`stage-${stage.id}`} data-stage={stage.id}>
      <details
        // Native open state can be restored or toggled before hydration.
        suppressHydrationWarning
        onToggle={(event) => {
          if (event.currentTarget.open) track("roadmap_stage_engaged", stage.id);
        }}
      >
        <summary>
          <span className="roadmap-feature-icon">
            <RoadmapIcon id={stage.id} />
          </span>
          <span className="roadmap-item-heading">
            <h3>{stage.title}</h3>
            <span className="roadmap-summary">{stage.summary}</span>
            <span className="roadmap-detail-label">
              <span className="roadmap-show-label">View details</span>
              <span className="roadmap-hide-label">Close details</span>
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </span>
        </summary>
        <div className="roadmap-detail">
          {stage.details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
          <p className="roadmap-boundary">{stage.boundary}</p>
          {stage.status === "now" ? (
            <Link to="/demo" className="roadmap-text-action">
              See the sample demo <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ) : (
            <Feedback stage={stage} needed={needed} busy={busy} onNeed={onNeed} />
          )}
          {error && (
            <p className="roadmap-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </details>
      {stage.id === "native-apps" && <PocketConcept />}
    </article>
  );
}

export function RoadmapBoard() {
  const [needed, setNeeded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<RoadmapStatus>("now");
  const voting = useRef(false);

  async function loadInterest() {
    setLoading(true);
    setLoadFailed(false);
    try {
      const result = await listMyRoadmapNeeds({ data: { sessionId: launchSessionId() } });
      setNeeded(new Set(result.ids));
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    track("roadmap_view");
    void loadInterest();
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const stageId = entry.target.getAttribute("data-stage");
          if (stageId && !seen.has(stageId)) {
            seen.add(stageId);
            track(stageId === "endgame" ? "roadmap_endgame_view" : "roadmap_stage_view", stageId);
          }
        }
        const firstVisible = Array.from(
          document.querySelectorAll<HTMLElement>(".customer-roadmap [data-horizon]"),
        ).find((node) => node.getBoundingClientRect().bottom > 71);
        if (firstVisible) setActive(firstVisible.dataset.horizon as RoadmapStatus);
      },
      { rootMargin: "-70px 0px -65% 0px", threshold: 0 },
    );
    document
      .querySelectorAll(".customer-roadmap [data-stage], .customer-roadmap [data-horizon]")
      .forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  async function onNeed(id: string) {
    if (voting.current || loading || loadFailed) return;
    voting.current = true;
    setBusy(id);
    setError(null);
    try {
      const result = await toggleRoadmapNeed({
        data: {
          feature_id: id,
          sessionId: launchSessionId(),
          waitlist_id: storedWaitlistId() || "",
          ...touchFields(),
        },
      });
      setNeeded((previous) => {
        const next = new Set(previous);
        if (result.needed) next.add(id);
        else next.delete(id);
        return next;
      });
    } catch {
      setError({ id, text: "Your interest was not saved. Please try again." });
    } finally {
      voting.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="customer-roadmap">
      <nav className="roadmap-horizon-nav" aria-label="Roadmap horizons">
        <div className="public-container">
          {ROADMAP_LEGEND.map((horizon) => (
            <a
              key={horizon.id}
              href={`#horizon-${horizon.id}`}
              data-tone={horizon.id}
              aria-current={active === horizon.id ? "location" : undefined}
            >
              <span aria-hidden="true" />
              {horizon.label}
            </a>
          ))}
          <span className="roadmap-updated">Updated {ROADMAP_WRITTEN}</span>
        </div>
      </nav>
      {loadFailed && (
        <div className="public-container roadmap-load-error" role="alert">
          We could not load your saved interests.{" "}
          <button type="button" onClick={() => void loadInterest()}>
            Try again
          </button>
        </div>
      )}
      {ROADMAP_LEGEND.map((horizon) => (
        <section
          key={horizon.id}
          id={`horizon-${horizon.id}`}
          className="roadmap-horizon"
          data-horizon={horizon.id}
          data-tone={horizon.id}
          aria-labelledby={`title-${horizon.id}`}
        >
          <div className="public-container roadmap-horizon-inner">
            <header className="roadmap-horizon-heading">
              <span className="roadmap-horizon-icon">
                <RoadmapIcon id={horizon.id} />
              </span>
              <div>
                <h2 id={`title-${horizon.id}`}>{horizon.label}</h2>
                <p className="roadmap-hint">{horizon.hint}</p>
                <p className="roadmap-purpose">{horizon.purpose}</p>
              </div>
            </header>
            <div className="roadmap-outcomes">
              {STAGES.filter((stage) => stage.status === horizon.id).map((stage) => (
                <StageBlock
                  key={stage.id}
                  stage={stage}
                  needed={needed.has(stage.id)}
                  busy={busy !== null || loading || loadFailed}
                  onNeed={onNeed}
                  error={error?.id === stage.id ? error.text : ""}
                />
              ))}
            </div>
          </div>
        </section>
      ))}
      <section
        className="public-container roadmap-direction"
        aria-labelledby="roadmap-direction-title"
      >
        <div>
          <h2 id="roadmap-direction-title">More capable. Still Enquiry.</h2>
          <p>
            From first enquiry to booked or lost. The ambition is less admin around that journey,
            not another system to manage.
          </p>
        </div>
        <details suppressHydrationWarning>
          <summary>
            What stays out of scope <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <ul>
            {NON_GOALS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </section>
      <section className="roadmap-invite">
        <div className="public-container">
          <div>
            <h2>Help shape what comes next.</h2>
            <p>Join early access. Tell us what would make a difference to your day.</p>
          </div>
          <Link
            to="/early-access"
            className="public-button"
            onClick={() => track("roadmap_waitlist_click")}
          >
            Join early access <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <p className="public-container roadmap-footnote">
        Future items are direction, not delivery promises. Priorities may change as we learn from
        customer feedback. No dates are committed.
      </p>
    </div>
  );
}
