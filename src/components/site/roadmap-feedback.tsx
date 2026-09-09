import { useState } from "react";
import { joinWaitlist, saveRoadmapFeedback } from "@/lib/launch/api";
import {
  currentTouch,
  firstTouch,
  launchSessionId,
  storedWaitlistId,
  storeWaitlistId,
} from "@/lib/launch/session";

/*
  The per-stage feedback control. Behaviour is unchanged from the previous
  roadmap board - toggleRoadmapNeed through onNeed, saveRoadmapFeedback for the
  free-text reason, joinWaitlist for a visitor we do not know yet, and the same
  roadmap_feedback_click / roadmap_waitlist_signup events.

  Only the surface is mirrored: the reference's inverted and 5%-white pills
  (.mk-btn), its 15px form field on #0f1011 with a 1px #23252a and radius 8px
  (.field), and its inline-link treatment for the secondary action - #f7f8f8,
  underlined, which is what an <a> inside changelog prose computes to (17px/400,
  text-decoration underline), taken here at the 14px .mk-small tier.
*/

export function RoadmapFeedback({
  id,
  needed,
  busy,
  onNeed,
  onTrack,
}: {
  id: string;
  needed: boolean;
  busy: boolean;
  onNeed: (id: string, waitlistId?: string) => Promise<boolean>;
  onTrack: (name: string, feature?: string) => void;
}) {
  const known = Boolean(storedWaitlistId());
  const [open, setOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [whySaved, setWhySaved] = useState(false);
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const touchFields = () => {
    const touch = currentTouch();
    return {
      utm_source: touch.utm_source,
      utm_medium: touch.utm_medium,
      utm_campaign: touch.utm_campaign,
      utm_content: touch.utm_content,
      referrer: touch.referrer,
    };
  };

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
      onTrack("roadmap_waitlist_signup", id);
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

  if (needed) {
    return (
      <div className="mt-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onNeed(id)}
            className="mk-btn mk-btn-secondary"
          >
            I’m interested
          </button>
          {whySaved ? (
            <p className="mk-small">Thanks - that helps us decide what to build next.</p>
          ) : (
            <button
              type="button"
              onClick={() => {
                onTrack("roadmap_feedback_click", id);
                setWhyOpen((v) => !v);
              }}
              className="mk-small min-h-11 underline underline-offset-4"
              style={{ color: "var(--mk-fg)" }}
            >
              Tell us why
            </button>
          )}
        </div>
        {whyOpen && !whySaved ? (
          <form
            className="mt-5 max-w-sm"
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
            <label className="block">
              <span className="mk-small mb-2 block">
                What problem would this solve for your business?
              </span>
              <textarea
                className="field min-h-20"
                rows={2}
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="Optional."
              />
            </label>
            {error ? (
              <p className="mk-small mt-3" style={{ color: "var(--color-danger)" }}>
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="submit" className="mk-btn mk-btn-primary">
                Send
              </button>
              <button
                type="button"
                className="mk-btn mk-btn-secondary"
                onClick={() => setWhyOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        disabled={busy || joining}
        onClick={() => {
          if (known) void onNeed(id);
          else {
            onTrack("roadmap_feedback_click", id);
            setOpen(true);
          }
        }}
        className="mk-btn mk-btn-secondary"
      >
        I need this
      </button>
      {open ? (
        <form
          className="mt-5 max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="block">
            <span className="mk-small mb-2 block">Email</span>
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
          <label className="mt-4 block">
            <span className="mk-small mb-2 block">
              What problem would this solve for your business?
            </span>
            <textarea
              className="field min-h-20"
              rows={2}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Optional."
            />
          </label>
          {error ? (
            <p className="mk-small mt-3" style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" disabled={joining} className="mk-btn mk-btn-primary">
              {joining ? "Saving…" : "Add my interest"}
            </button>
            <button
              type="button"
              className="mk-btn mk-btn-secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
