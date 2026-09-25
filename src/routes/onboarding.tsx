import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Building2, ChevronLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/auth-layout";
import { usePrototype } from "@/store/prototype-store";
import { completeOnboarding, NOT_A_FOUNDING_MEMBER } from "@/lib/server/workspace";
import { FOUNDING_PAYMENT_LINK, paymentsOpen } from "@/lib/site/offer";
import { cn } from "@/lib/utils";
import { RequireAuth } from "@/lib/auth/gates";
import { WorkspaceGate } from "@/components/shell/workspace-boundary";

// Onboarding configures business/workspace state, so it is an operator surface
// even though it sits outside the /_app layout.
export const Route = createFileRoute("/onboarding")({
  component: GuardedOnboarding,
});

function GuardedOnboarding() {
  return (
    <RequireAuth>
      {/*
        Identity is not enough here either, in the other direction: someone who
        already has a workspace must not be able to run initial setup again and
        create a second one. The gate resolves the real workspace and sends them
        back to the app.
      */}
      <WorkspaceGate isOnboardingRoute>
        <Onboarding />
      </WorkspaceGate>
    </RequireAuth>
  );
}

/**
 * The browser's own IANA zone, confirmable by the operator.
 *
 * This replaced a hard-coded Australia/NZ city map. Enquiry is not a
 * single-market product, and a city list as the architectural source of truth
 * silently excludes every business outside it (R2A correction s7). The server
 * validates whatever arrives with Intl and falls back to UTC.
 */
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const TEAMS = [
  { id: "solo", label: "Just me" },
  { id: "small", label: "Small team (2–5)" },
  { id: "studio", label: "Studio (6+)" },
];

/**
 * Typed values survive a reload or an accidental back-swipe, in this browser
 * only. The workspace itself is still created in one server transaction on
 * review, so this is a draft, not a save, and the review screen keeps saying
 * so. Cleared the moment the workspace exists.
 */
const DRAFT_KEY = "enquiry-onboarding-draft";
type Draft = {
  name: string;
  ownerFirstName: string;
  industry: string;
  baseLocation: string;
  team: string;
  timezone: string;
};

function readDraft(): Partial<Draft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Partial<Draft>) : {};
  } catch {
    return {};
  }
}

function writeDraft(draft: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable (private mode, quota). Losing the draft on
    // reload is the pre-existing behaviour, not a failure to report.
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Same reasoning as writeDraft.
  }
}

/**
 * At most two stages (R2A Slice 5).
 *
 * The six-step flow this replaced had two steps whose state - a "what should
 * it read first" preference and a warmth/formality voice slider - was never
 * sent to `completeOnboarding` at all. They looked like settings and were
 * discarded on submit, and the mobile path silently skipped one of them,
 * which meant the product asked a different set of questions depending on
 * viewport. Neither exists here: the only Stage 1 inputs are the ones the
 * server actually persists, and Business Brain / voice grow later, from
 * confirmed information and reviewed work, not a slider on day one.
 */
function Onboarding() {
  const markOnboarded = usePrototype((s) => s.markOnboardedLocally);
  const navigate = useNavigate();

  const [stage, setStage] = useState<1 | 2>(1);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    stageHeading.current?.focus();
  }, [stage]);
  const draft = useRef<Partial<Draft>>(readDraft());
  const [name, setName] = useState(draft.current.name ?? "");
  const [ownerFirstName, setOwnerFirstName] = useState(draft.current.ownerFirstName ?? "");
  const [industry, setIndustry] = useState(draft.current.industry ?? "");
  const [timezone, setTimezone] = useState(() => draft.current.timezone || detectTimezone());
  const [editingTimezone, setEditingTimezone] = useState(false);
  const [baseLocation, setBaseLocation] = useState(draft.current.baseLocation ?? "");
  // The live money domain is AUD-only (Money.currency, MoneyRange.currency and
  // Business.currency are all the literal "AUD"), so offering a currency field
  // would let someone pick EUR and have it silently treated as AUD. The
  // database columns stay currency-capable; making the domain multi-currency
  // is a deliberate later change (R2A correction s6). Nothing to confirm yet
  // is the honest state, so no field is shown for it.
  const currency = "AUD";
  const [team, setTeam] = useState(draft.current.team ?? "solo");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Offered once, here, and off unless the owner ticks it.
  const [noticesOn, setNoticesOn] = useState(false);

  useEffect(() => {
    writeDraft({ name, ownerFirstName, industry, baseLocation, team, timezone });
  }, [name, ownerFirstName, industry, baseLocation, team, timezone]);

  const canContinue = name.trim().length > 0;

  const back = () => setStage(1);

  const continueToReview = () => {
    if (!canContinue) return;
    setStage(2);
  };

  /**
   * Persist the real workspace, then continue.
   *
   * Server-authoritative on purpose. This previously wrote voice against the
   * fixture business id "glow", marked whichever channel was selected as a
   * connected integration with no provider handshake, completed onboarding in
   * the local store, and navigated away without waiting for anything - so a
   * failed creation still looked like success and the operator landed in a
   * workspace that did not exist.
   *
   * Now: submit, await, and only then continue. A failure leaves onboarding
   * incomplete with a retryable message, and the entered values stay exactly
   * as typed (R2A correction s1-s5).
   */
  const finish = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await completeOnboarding({
        data: {
          name: name.trim(),
          ownerFirstName: ownerFirstName.trim(),
          industry: industry.trim(),
          baseLocation: baseLocation.trim(),
          timezone,
          soloOrTeam: team === "solo" ? "solo" : "team",
          currency,
        },
      });
      if (!result?.ok) throw new Error("Workspace could not be created.");
      clearDraft();
      if (noticesOn) {
        // Best effort: the workspace exists either way, and the same switch is
        // in Settings. A failure here must not strand the owner on this screen.
        try {
          const { saveWorkspacePrefs } = await import("@/lib/server/owner-state");
          await saveWorkspacePrefs({
            data: {
              businessId: result.businessId,
              prefs: { notifyArrival: true, notifyFollowUp: true },
            },
          });
        } catch (err) {
          console.warn("[onboarding] notice choice not saved", err);
        }
      }
      // Server is the authority. Deliberately does NOT call the prototype
      // store's completeOnboarding, which selects fixture business "glow" and
      // pulls fixture enquiries, Brain, trust and integration state into view
      // as if they were this tenant's (R2A correction s1). The only client
      // state is a transient "this browser finished onboarding" marker; the
      // destination route's own WorkspaceGate refetches the real workspace
      // the moment it mounts, before rendering anything that reads it.
      markOnboarded();
      // Land where the owner will start every day, on the one next step.
      await navigate({ to: "/today" });
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "Could not create your workspace. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout wide>
      <div className="onboarding-progress">
        <p className="text-sm text-stone">
          {stage === 1 ? "Your business" : "Review and create"} · {stage} of 2
        </p>
        <div className="mt-2 flex gap-1" role="navigation" aria-label="Setup steps">
          {[1, 2].map((i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                "block h-1.5 flex-1 rounded-full transition-colors duration-150",
                i === stage ? "bg-ink" : i < stage ? "bg-ink/35" : "bg-line",
              )}
            />
          ))}
        </div>
      </div>

      <div key={stage} className="onboarding-flow" data-stage={stage}>
        {stage === 1 ? (
          <form
            id="onboarding-stage-1"
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault();
              continueToReview();
            }}
          >
            <h1 className="auth-title" ref={stageHeading} tabIndex={-1}>
              Your business
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              Your real business. Nothing here is a sample. Only the name is needed to continue.
            </p>
            <div className="mt-6 space-y-3">
              <Field
                label="Business name"
                name="business-name"
                value={name}
                onChange={setName}
                placeholder="e.g. Ridge & Co"
                autoComplete="organization"
                required
              />
              <Field
                label="Your first name"
                name="owner-first-name"
                value={ownerFirstName}
                onChange={setOwnerFirstName}
                placeholder="Used when Enquiry signs off"
                autoComplete="given-name"
              />
              <Field
                label="What you do"
                name="industry"
                value={industry}
                onChange={setIndustry}
                placeholder="e.g. mobile makeup, painting, photography"
              />
              <Field
                label="Where you work from"
                name="base-location"
                value={baseLocation}
                onChange={setBaseLocation}
                placeholder="Suburb, city or region"
                autoComplete="address-level2"
              />
              <SelectField
                label="Who does the work"
                name="team-size"
                value={team}
                onChange={setTeam}
                options={TEAMS.map((t) => t.label)}
                values={TEAMS.map((t) => t.id)}
              />
              {/*
                Progressive disclosure: a safe default already exists (the
                browser's own zone), so this does not compete for attention
                with the fields above it. Editing it is one click away, not a
                dominant row of equal weight to the business's own name.
              */}
              {editingTimezone ? (
                <div className="animate-[rise-in_150ms_var(--ease-smooth-out)]">
                  <Field
                    label="Time zone"
                    name="timezone"
                    value={timezone}
                    onChange={setTimezone}
                  />
                </div>
              ) : (
                <div className="flex min-h-11 items-center justify-between gap-3 text-sm animate-[rise-in_150ms_var(--ease-smooth-out)]">
                  <p>
                    <span className="text-stone">Time zone </span>
                    <span className="font-medium">{timezone}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingTimezone(true)}
                    className="flex min-h-11 items-center px-1 text-stone underline-offset-4 hover:text-ink hover:underline"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          </form>
        ) : (
          <section className="mt-8">
            <h1 className="auth-title" ref={stageHeading} tabIndex={-1}>
              Review, then create your workspace
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              Check the details, then Enquiry sets up your workspace.
            </p>

            <dl className="mt-6">
              {[
                ["Business", name.trim() || "-"],
                ["Owner", ownerFirstName.trim() || "-"],
                ["What you do", industry.trim() || "-"],
                ["Where you work from", baseLocation.trim() || "-"],
                ["Who does the work", TEAMS.find((t) => t.id === team)?.label ?? "-"],
                ["Time zone", timezone],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4 border-t border-line py-3 text-sm last:border-b"
                >
                  <dt className="text-stone">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            {/*
              The real authority boundary, stated plainly, per the R2A brief -
              not a claim about what has been learned or connected, because
              nothing has been yet. This is the whole product's trust model in
              four sentences: it prepares, it does not decide unsupervised,
              and it starts knowing nothing about this specific business.
            */}
            <ul className="mt-8">
              {[
                "Your workspace starts empty. Nothing is pre-loaded from another business.",
                "Enquiry prepares replies. Nothing sends without your approval.",
                "No mailbox or social account is connected yet.",
                "Enquiry learns your prices and rules from what you confirm, and your voice from replies you approve or edit - not from a quiz.",
                "Tell us your services and prices and we help you set them up, so your first real enquiry has something to price against.",
              ].map((line) => (
                <li
                  key={line}
                  className="border-t border-line py-3 text-sm text-ink-2 last:border-b"
                >
                  {line}
                </li>
              ))}
            </ul>

            <label className="mt-6 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-[var(--color-mark)]"
                checked={noticesOn}
                onChange={(e) => setNoticesOn(e.target.checked)}
              />
              <span>
                <span className="font-medium text-ink">
                  Show me a notice when something needs me
                </span>
                <span className="mt-1 block text-ink-2">
                  Inside Enquiry only. Off unless you tick this; you can change it in Settings.
                </span>
              </span>
            </label>
          </section>
        )}
        {stage === 1 ? (
          <aside className="onboarding-preview" aria-label="Business profile preview">
            <Building2 size={27} strokeWidth={1.5} aria-hidden="true" />
            <p className="onboarding-preview-label">Your business profile</p>
            <h2>{name.trim() || "Your business name"}</h2>
            <p>{industry.trim() || "What you do"}</p>
            {baseLocation.trim() ? (
              <p className="onboarding-preview-location">
                <MapPin size={15} aria-hidden="true" />
                {baseLocation.trim()}
              </p>
            ) : null}
            <div className="onboarding-preview-note">
              Not saved yet. You'll review these details before creating your workspace.
            </div>
          </aside>
        ) : null}
      </div>

      <div className="onboarding-actions">
        {submitError ? (
          <p role="alert" className="mb-3 text-sm text-danger">
            {submitError} Your details are still here - try again.
            {submitError === NOT_A_FOUNDING_MEMBER && paymentsOpen ? (
              <>
                {" "}
                <a href={FOUNDING_PAYMENT_LINK} className="font-semibold underline">
                  Become a founding member
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        <div className="flex gap-2">
          {stage === 2 ? (
            <Button variant="secondary" className="min-h-12 px-4" onClick={back}>
              <ChevronLeft className="size-4" aria-hidden />
              Back
            </Button>
          ) : null}
          {stage === 1 ? (
            <Button
              type="submit"
              form="onboarding-stage-1"
              className="min-h-12 flex-1"
              disabled={!canContinue}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="primary-strong"
              className="min-h-12 flex-1"
              disabled={submitting}
              onClick={() => void finish()}
            >
              {submitting ? "Creating your workspace…" : "Create my workspace"}
            </Button>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-stone">
        {label}
        {required ? <span className="text-ink-2"> (needed)</span> : null}
      </span>
      <input
        name={name}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="field h-11"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  values,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  values?: string[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-stone">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field h-11"
      >
        {options.map((opt, i) => (
          <option key={opt} value={values?.[i] ?? opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
