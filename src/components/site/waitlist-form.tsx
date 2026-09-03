import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { joinWaitlist, qualifyWaitlist, trackLaunchEvent } from "@/lib/launch/api";
import {
  captureAttribution,
  currentTouch,
  firstTouch,
  launchSessionId,
  storeQualified,
  storeWaitlistId,
  storeWaitlistSkipped,
  storedQualified,
  storedWaitlistDone,
  storedWaitlistId,
  WAITLIST_EVENT,
} from "@/lib/launch/session";

const VOLUMES = ["<5", "5-20", "21-50", "51-100", "100+"] as const;
const CHANNELS = ["Email", "Website form", "Text", "Instagram", "Facebook", "Phone"] as const;

export function WaitlistForm({
  compact = false,
  ctaVariant = "primary",
}: {
  compact?: boolean;
  /** "primary-strong" is reserved for the landing hero - see button.tsx. */
  ctaVariant?: "primary" | "primary-strong";
}) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [step, setStep] = useState<"email" | "qualify" | "done">("email");
  const [waitlistId, setWaitlistId] = useState<string | null>(null);
  const [already, setAlready] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [businessType, setBusinessType] = useState("");
  const [volume, setVolume] = useState("");
  const [pain, setPain] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [beta, setBeta] = useState("");

  useEffect(() => {
    captureAttribution();
    const sync = () => {
      const existing = storedWaitlistId();
      if (!existing) return;
      setWaitlistId(existing);
      if (storedWaitlistDone() || compact) setStep("done");
      else setStep("qualify");
    };
    sync();
    window.addEventListener(WAITLIST_EVENT, sync);
    return () => window.removeEventListener(WAITLIST_EVENT, sync);
  }, [compact]);

  const path = typeof window === "undefined" ? "/" : window.location.pathname;

  const submitEmail = async () => {
    setError("");
    setBusy(true);
    const latest = currentTouch();
    const first = firstTouch();
    try {
      void trackLaunchEvent({
        data: {
          sessionId: launchSessionId(),
          event_name: "waitlist_form_start",
          landing_path: path,
          utm_source: latest.utm_source,
          utm_medium: latest.utm_medium,
          utm_campaign: latest.utm_campaign,
          utm_content: latest.utm_content,
          referrer: latest.referrer,
          feature_id: "",
        },
      });
      const result = await joinWaitlist({
        data: {
          email,
          website,
          sessionId: launchSessionId(),
          utm_source: first.utm_source || latest.utm_source,
          utm_medium: first.utm_medium || latest.utm_medium,
          utm_campaign: first.utm_campaign || latest.utm_campaign,
          utm_content: first.utm_content || latest.utm_content,
          referrer: first.referrer || latest.referrer,
          linkedin_post_id: first.linkedin_post_id || latest.linkedin_post_id,
          first_touch: JSON.stringify(first.utm_source ? first : latest),
          latest_touch: JSON.stringify(latest),
          landing_path: path,
        },
      });
      if (result.id) {
        storeWaitlistId(result.id);
        setWaitlistId(result.id);
      } else {
        setWaitlistId(storedWaitlistId());
      }
      setAlready(result.already);
      void trackLaunchEvent({
        data: {
          sessionId: launchSessionId(),
          event_name: "qualification_started",
          landing_path: path,
          utm_source: latest.utm_source,
          utm_medium: latest.utm_medium,
          utm_campaign: latest.utm_campaign,
          utm_content: latest.utm_content,
          referrer: latest.referrer,
          feature_id: "",
        },
      });
      if (result.already || compact) {
        storeWaitlistSkipped();
        setStep("done");
      } else {
        setStep("qualify");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join just then.");
    } finally {
      setBusy(false);
    }
  };

  const submitQualify = async () => {
    if (!waitlistId) return;
    setBusy(true);
    setError("");
    try {
      await qualifyWaitlist({
        data: {
          id: waitlistId,
          sessionId: launchSessionId(),
          business_type: businessType,
          enquiry_volume: volume,
          pain_text: pain,
          channels: channels.join(", "),
          beta_interest: beta,
          landing_path: path,
        },
      });
      storeQualified();
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  };

  if (step === "done") {
    return (
      <div className="rounded-xl bg-raised px-5 py-6 shadow-border">
        <p className="text-lg font-semibold tracking-tight">
          {already
            ? "You’re already on the Enquiry early-access list."
            : "You’re on the Enquiry early-access list."}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Enquiry learns how your business works, understands what every customer is asking for, and
          works out what needs to happen next. Access opens gradually so we can work closely with
          the first businesses.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {compact && !storedQualified() ? (
            <Button asChild className="min-h-12">
              <Link to="/early-access">A few optional questions</Link>
            </Button>
          ) : (
            <Button asChild className="min-h-12">
              <Link to="/roadmap">See the roadmap</Link>
            </Button>
          )}
          <Button variant="secondary" asChild className="min-h-12">
            <Link to="/enquiries">Open the app</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (step === "qualify") {
    return (
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submitQualify();
        }}
      >
        <div>
          <p className="text-lg font-semibold tracking-tight">You’re on the list.</p>
          <p className="mt-1 text-sm text-ink-2">
            Optional. What should we know before we invite you?
          </p>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-stone">What kind of business?</span>
          <input
            className="field h-12"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            placeholder="Painting, photography, cleaning, studio…"
          />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm text-stone">Enquiries a month</legend>
          <div className="flex flex-wrap gap-2">
            {VOLUMES.map((v) => (
              <button
                key={v}
                type="button"
                className={
                  volume === v
                    ? "min-h-11 rounded-md bg-ink px-3 text-sm text-paper"
                    : "min-h-11 rounded-md bg-raised px-3 text-sm shadow-border"
                }
                onClick={() => setVolume(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm text-stone">How work arrives</legend>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => {
              const on = channels.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={
                    on
                      ? "min-h-11 rounded-md bg-ink px-3 text-sm text-paper"
                      : "min-h-11 rounded-md bg-raised px-3 text-sm shadow-border"
                  }
                  onClick={() =>
                    setChannels((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))
                  }
                >
                  {c}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="mb-1 block text-stone">Biggest pain handling enquiries</span>
          <textarea
            className="field min-h-24"
            rows={3}
            value={pain}
            onChange={(e) => setPain(e.target.value)}
            placeholder="Reconstructing context. Pricing from memory. Following up."
          />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm text-stone">
            Want to test Enquiry before public release?
          </legend>
          <div className="flex gap-2">
            {["Yes", "Maybe later"].map((v) => (
              <button
                key={v}
                type="button"
                className={
                  beta === v
                    ? "min-h-11 rounded-md bg-ink px-4 text-sm text-paper"
                    : "min-h-11 rounded-md bg-raised px-4 text-sm shadow-border"
                }
                onClick={() => setBeta(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" className="min-h-12" disabled={busy}>
            {busy ? "Saving…" : "Save this"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-12"
            onClick={() => {
              storeWaitlistSkipped();
              setStep("done");
            }}
          >
            Skip for now
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      className={
        compact ? "relative flex flex-col gap-2 sm:flex-row sm:flex-wrap" : "relative space-y-3"
      }
      onSubmit={(e) => {
        e.preventDefault();
        void submitEmail();
      }}
    >
      <label className={compact ? "block flex-1" : "block"}>
        <span className="sr-only">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourstudio.com"
          className="field h-12"
        />
      </label>
      <div
        className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
        aria-hidden
        style={{ clipPath: "inset(50%)" }}
      >
        <label>
          Fax
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            className="h-px w-px p-0"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>
      {error ? <p className="w-full text-sm text-danger">{error}</p> : null}
      <Button type="submit" variant={ctaVariant} className="min-h-12 px-6" disabled={busy}>
        {busy ? "Joining…" : "Join early access"}
      </Button>
      <p className={compact ? "w-full text-xs text-stone" : "text-xs text-stone"}>
        We’ll only email about Enquiry access.{" "}
        <Link to="/privacy" className="underline-offset-4 hover:underline">
          Privacy
        </Link>
        .
      </p>
    </form>
  );
}
