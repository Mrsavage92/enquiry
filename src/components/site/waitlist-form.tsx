import { useEffect, useRef, useState } from "react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site/contact";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  getMyWaitlistAnswers,
  joinWaitlist,
  leaveWaitlist,
  qualifyWaitlist,
  trackLaunchEvent,
} from "@/lib/launch/api";
import { OFFER, OFFER_FAQ } from "@/lib/site/offer";
import {
  captureAttribution,
  clearWaitlist,
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
const CHANNELS = ["Email", "Website form", "Text", "Phone"] as const;
const MORE_CHANNELS = ["Instagram", "Facebook"] as const;
const BUSINESS_CHIPS = [
  "Painting",
  "Cleaning",
  "Mobile beauty",
  "Photography",
  "Trades",
  "Events",
] as const;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A fetch that never reached the server throws a TypeError; anything the
 * server rejected arrives as an Error with a message written for the owner.
 * The two need different advice.
 */
/** Messages the server writes for the owner; anything else is not shown verbatim. */
const OWNER_SAFE_MESSAGES = new Set(["Enter a valid email.", "Try again in a moment."]);

function describeFailure(e: unknown, fallback: string): string {
  if (e instanceof TypeError)
    return "We could not reach the server. Check your connection and try again.";
  if (e instanceof Error && OWNER_SAFE_MESSAGES.has(e.message)) return e.message;
  return fallback;
}

function FailureNote({ message }: { message: string }) {
  return (
    <>
      {message} If it keeps happening, email{" "}
      <a href={SUPPORT_MAILTO} className="underline underline-offset-2">
        {SUPPORT_EMAIL}
      </a>
      .
    </>
  );
}

export function WaitlistForm({
  compact = false,
  ctaVariant = "primary",
  ctaLabel = "Join early access",
  appearance = "default",
}: {
  compact?: boolean;
  /** "primary-strong" is reserved for the landing hero - see button.tsx. */
  ctaVariant?: "primary" | "primary-strong";
  /** Same action everywhere - label can differ so two different-weight CTAs never read as identical asks. */
  ctaLabel?: string;
  appearance?: "default" | "entry";
}) {
  const entry = appearance === "entry";
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const mountedAt = useRef(Date.now());
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [step, setStep] = useState<"email" | "qualify" | "done">("email");
  const [waitlistId, setWaitlistId] = useState<string | null>(null);
  const [already, setAlready] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  const [businessType, setBusinessType] = useState("");
  const [volume, setVolume] = useState("");
  const [pain, setPain] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [beta, setBeta] = useState("");

  useEffect(() => {
    if (step !== "email") headingRef.current?.focus();
  }, [step]);

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
    if (inFlight.current) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setHint("Enter your email to join.");
      return;
    }
    if (!EMAIL_SHAPE.test(trimmed)) {
      setHint("That does not look like an email address.");
      return;
    }
    inFlight.current = true;
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
      }).catch(() => undefined);
      const result = await joinWaitlist({
        data: {
          email,
          existingId: storedWaitlistId() || "",
          website,
          elapsed_ms: Date.now() - mountedAt.current,
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
      }).catch(() => undefined);
      if (result.already || compact) {
        storeWaitlistSkipped();
        setStep("done");
      } else {
        setStep("qualify");
      }
    } catch (e) {
      setError(describeFailure(e, "Could not join just then."));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const submitQualify = async () => {
    if (!waitlistId || inFlight.current) return;
    inFlight.current = true;
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
      setError(describeFailure(e, "Could not save that."));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const editAnswers = async () => {
    if (!waitlistId || inFlight.current) return;
    inFlight.current = true;
    setLoadingAnswers(true);
    setError("");
    try {
      const { answers } = await getMyWaitlistAnswers({ data: { id: waitlistId } });
      if (answers) {
        setBusinessType(answers.business_type);
        setVolume(answers.enquiry_volume);
        setPain(answers.pain_text);
        setChannels(answers.channels ? answers.channels.split(", ").filter(Boolean) : []);
        setBeta(answers.beta_interest);
      }
      setStep("qualify");
    } catch (e) {
      setError(describeFailure(e, "Could not load your answers just then."));
    } finally {
      inFlight.current = false;
      setLoadingAnswers(false);
    }
  };

  const leave = async () => {
    if (!waitlistId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await leaveWaitlist({ data: { id: waitlistId, sessionId: launchSessionId() } });
      clearWaitlist();
      setWaitlistId(null);
      setAlready(false);
      setEmail("");
      setNotice("You have been removed from the list. Nothing else is kept.");
      setConfirmLeave(false);
      setStep("email");
    } catch (e) {
      setError(describeFailure(e, "Could not remove you just then."));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (step === "done") {
    return (
      <div className={entry ? "entry-waitlist" : "rounded-xl bg-raised px-5 py-6 shadow-border"}>
        {entry ? (
          <>
            <div className="auth-state-icon auth-state-icon--success">
              <CheckCircle2 size={24} aria-hidden="true" />
            </div>
            <h1 className="auth-title" ref={headingRef} tabIndex={-1}>
              {already ? "You're already on the list" : "You're on the list"}
            </h1>
          </>
        ) : (
          <p className="text-lg font-semibold tracking-tight">
            {already
              ? "You’re already on the Enquiry early-access list."
              : "You’re on the Enquiry early-access list."}
          </p>
        )}
        <p className={entry ? "auth-description" : "mt-2 text-sm leading-relaxed text-ink-2"}>
          We'll email you when we're ready to invite your business. Joining the list does not create
          an account or start a subscription.
        </p>
        <p className={entry ? "auth-description" : "mt-2 text-sm leading-relaxed text-ink-2"}>
          {OFFER_FAQ.joining}
        </p>
        <div className={entry ? "auth-actions" : "mt-5 flex flex-col gap-2 sm:flex-row"}>
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
            <Link to="/demo">See demo</Link>
          </Button>
        </div>
        {!compact ? (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {storedQualified() && waitlistId ? (
              <button
                type="button"
                className="text-ink-2 underline underline-offset-2"
                disabled={loadingAnswers}
                onClick={() => void editAnswers()}
              >
                {loadingAnswers ? "Loading…" : "Edit your answers"}
              </button>
            ) : null}
            {!waitlistId ? (
              <span className="text-ink-2">
                To be removed, email{" "}
                <a href={SUPPORT_MAILTO} className="underline underline-offset-2">
                  {SUPPORT_EMAIL}
                </a>{" "}
                from the address you joined with.
              </span>
            ) : confirmLeave ? (
              <span
                className="flex flex-wrap items-center gap-x-3 gap-y-1"
                role="group"
                aria-label="Confirm removal"
              >
                <span className="text-ink-2">Remove you from the list?</span>
                <button
                  type="button"
                  className="font-medium text-danger underline underline-offset-2"
                  disabled={busy}
                  onClick={() => void leave()}
                >
                  {busy ? "Removing…" : "Yes, remove me"}
                </button>
                <button
                  type="button"
                  className="text-ink-2 underline underline-offset-2"
                  disabled={busy}
                  onClick={() => setConfirmLeave(false)}
                >
                  Keep me on it
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="text-ink-2 underline underline-offset-2"
                disabled={busy}
                onClick={() => setConfirmLeave(true)}
              >
                Remove me from the list
              </button>
            )}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className={entry ? "auth-error" : "mt-3 text-sm text-danger"}>
            <FailureNote message={error} />
          </p>
        ) : null}
      </div>
    );
  }

  if (step === "qualify") {
    return (
      <form
        className={entry ? "entry-waitlist" : "space-y-5"}
        aria-busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          void submitQualify();
        }}
      >
        <div>
          <p
            className={
              entry ? "auth-step" : "text-xs font-medium uppercase tracking-wide text-ink-2"
            }
          >
            Step 2 of 2 · optional
          </p>
          {entry ? (
            <h1 className="auth-title" ref={headingRef} tabIndex={-1}>
              A little about your business
            </h1>
          ) : (
            <p className="text-lg font-semibold tracking-tight">You’re on the list.</p>
          )}
          <p className={entry ? "auth-description" : "mt-1 text-sm text-ink-2"}>
            You're on the list. These questions are optional and help us understand what you need.
          </p>
          <button
            type="button"
            className="mt-2 text-sm text-ink-2 underline underline-offset-2"
            onClick={() => {
              setError("");
              setStep("email");
            }}
          >
            Wrong email? Go back and change it
          </button>
        </div>
        <div className="waitlist-group">
          <p className="waitlist-group-title">Your business</p>
          <div className="text-sm">
            <span className="mb-1 block text-stone">What kind of business?</span>
            <div className="waitlist-chips" role="group" aria-label="Common business types">
              {BUSINESS_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  aria-pressed={businessType === chip}
                  onClick={() => setBusinessType(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="sr-only">Or describe it</span>
              <input
                id="waitlist-business-type"
                name="business_type"
                className="field h-12"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="Or describe it: studio, mobile trade, events…"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-2 block text-stone">Enquiries a month</span>
            <select
              id="waitlist-volume"
              name="volume"
              className="field h-12"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            >
              <option value="">Select a range</option>
              {VOLUMES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="waitlist-group">
          <p className="waitlist-group-title">Your enquiries</p>
          <fieldset>
            <legend className="mb-2 text-sm text-stone">How work arrives</legend>
            <div className="waitlist-choices">
              {CHANNELS.map((c) => {
                const on = channels.includes(c);
                return (
                  <label key={c} className="waitlist-choice">
                    <input
                      type="checkbox"
                      name="channels"
                      value={c}
                      checked={on}
                      onChange={() =>
                        setChannels((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))
                      }
                    />
                    {c}
                  </label>
                );
              })}
            </div>
            <details className="waitlist-more">
              <summary>More channels</summary>
              <div className="waitlist-choices">
                {MORE_CHANNELS.map((c) => {
                  const on = channels.includes(c);
                  return (
                    <label key={c} className="waitlist-choice">
                      <input
                        type="checkbox"
                        name="channels"
                        value={c}
                        checked={on}
                        onChange={() =>
                          setChannels((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))
                        }
                      />
                      {c}
                    </label>
                  );
                })}
              </div>
            </details>
          </fieldset>
          <label className="block text-sm">
            <span className="mb-1 block text-stone">Biggest pain handling enquiries</span>
            <textarea
              id="waitlist-pain"
              name="pain"
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
            <div className="waitlist-choices">
              {["Yes", "Maybe later"].map((v) => (
                <label key={v} className="waitlist-choice">
                  <input
                    type="radio"
                    name="beta-interest"
                    value={v}
                    checked={beta === v}
                    onChange={() => setBeta(v)}
                  />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {error ? (
          <p role="alert" className="auth-error">
            <FailureNote message={error} />
          </p>
        ) : null}
        <div className={entry ? "auth-actions" : "flex flex-col gap-2 sm:flex-row"}>
          <Button type="submit" className="min-h-12" disabled={busy}>
            {busy ? "Saving…" : "Save details"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-12"
            disabled={busy}
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
        entry
          ? "relative entry-waitlist"
          : compact
            ? "relative flex flex-col gap-2 sm:flex-row sm:flex-wrap"
            : "relative space-y-3"
      }
      aria-busy={busy}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submitEmail();
      }}
    >
      {notice ? (
        <p role="status" className={entry ? "auth-notice" : "w-full text-sm text-ink-2"}>
          {notice}
        </p>
      ) : null}
      {entry ? (
        <div className="auth-form-heading">
          <h1 className="auth-title">{OFFER.entryHeadline}</h1>
          <p className="auth-adhd">
            Built for owners with ADHD: one enquiry at a time, one next step, nothing sends until
            you say so.
          </p>
          <p className="auth-description">{OFFER.entrySub}</p>
        </div>
      ) : null}
      <label className={compact ? "block flex-1" : "block"}>
        <span className={entry ? "auth-label" : "sr-only"}>Email address</span>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (hint) setHint("");
          }}
          onBlur={(e) => {
            const value = e.currentTarget.value.trim();
            setHint(
              value && !EMAIL_SHAPE.test(value) ? "That does not look like an email address." : "",
            );
          }}
          aria-describedby={hint ? "waitlist-email-hint" : undefined}
          aria-invalid={hint ? true : undefined}
          placeholder="you@yourbusiness.com"
          className="field h-12"
        />
      </label>
      <div
        className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
        aria-hidden
        style={{ clipPath: "inset(50%)" }}
      >
        <label>
          Leave this field empty
          <input
            id="waitlist-hp"
            name="hp_field"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            className="h-px w-px p-0"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>
      {hint ? (
        <p id="waitlist-email-hint" className="w-full text-sm text-danger" aria-live="polite">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="w-full text-sm text-danger">
          <FailureNote message={error} />
        </p>
      ) : null}
      <Button
        type="submit"
        variant={ctaVariant}
        className={entry ? "auth-submit" : "min-h-12 px-6"}
        disabled={busy}
      >
        {busy ? "Joining…" : ctaLabel}
        {entry ? (
          busy ? (
            <LoaderCircle size={17} className="auth-spinner" aria-hidden="true" />
          ) : (
            <ArrowRight size={17} aria-hidden="true" />
          )
        ) : null}
      </Button>
      <p
        className={
          entry ? "auth-privacy" : compact ? "w-full text-xs text-stone" : "text-xs text-stone"
        }
      >
        We’ll only email about Enquiry access.{" "}
        <Link to="/privacy" className="underline underline-offset-[3px]">
          Privacy
        </Link>
        .
      </p>
    </form>
  );
}
