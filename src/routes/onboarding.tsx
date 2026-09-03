import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { usePrototype } from "@/store/prototype-store";
import { completeOnboarding } from "@/lib/server/workspace";
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
  const [name, setName] = useState("");
  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [industry, setIndustry] = useState("");
  const [timezone, setTimezone] = useState(detectTimezone);
  const [editingTimezone, setEditingTimezone] = useState(false);
  const [baseLocation, setBaseLocation] = useState("");
  // The live money domain is AUD-only (Money.currency, MoneyRange.currency and
  // Business.currency are all the literal "AUD"), so offering a currency field
  // would let someone pick EUR and have it silently treated as AUD. The
  // database columns stay currency-capable; making the domain multi-currency
  // is a deliberate later change (R2A correction s6). Nothing to confirm yet
  // is the honest state, so no field is shown for it.
  const currency = "AUD";
  const [team, setTeam] = useState("solo");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const canContinue = name.trim().length > 0;

  const back = () => {
    if (stage === 1) {
      void navigate({ to: "/" });
      return;
    }
    setStage(1);
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
      // Server is the authority. Deliberately does NOT call the prototype
      // store's completeOnboarding, which selects fixture business "glow" and
      // pulls fixture enquiries, Brain, trust and integration state into view
      // as if they were this tenant's (R2A correction s1). The only client
      // state is a transient "this browser finished onboarding" marker; the
      // destination route's own WorkspaceGate refetches the real workspace
      // the moment it mounts, before rendering anything that reads it.
      markOnboarded();
      await navigate({ to: "/enquiries" });
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
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col bg-paper px-5 pt-[max(2.5rem,var(--app-safe-top))] sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" aria-label="Back to start">
          <Wordmark />
        </Link>
        <p className="text-xs text-stone">Setup</p>
      </div>

      <div className="mt-6">
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

      <div key={stage} className="flex-1 animate-[rise-in_280ms_var(--ease-smooth-out)]">
        {stage === 1 ? (
          <section className="mt-8">
            <h1 className="site-display">Your business</h1>
            <p className="mt-2 text-sm text-ink-2">Your real business. Nothing here is a sample.</p>
            <div className="mt-6 space-y-3">
              <Field
                label="Business name"
                name="business-name"
                value={name}
                onChange={setName}
                placeholder="e.g. Ridge & Co"
                autoComplete="organization"
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
          </section>
        ) : (
          <section className="mt-8">
            <h1 className="site-display">Review, then create your workspace</h1>
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
              ].map((line) => (
                <li
                  key={line}
                  className="border-t border-line py-3 text-sm text-ink-2 last:border-b"
                >
                  {line}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-8 border-t border-line bg-paper/95 px-5 py-3 pb-[max(0.75rem,var(--app-safe-bottom))] backdrop-blur-sm sm:-mx-8 sm:px-8">
        {submitError ? (
          <p role="alert" className="mb-3 text-sm text-danger">
            {submitError} Your details are still here - try again.
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button variant="secondary" className="min-h-12 px-4" onClick={back}>
            <ChevronLeft className="size-4" aria-hidden />
            Back
          </Button>
          {stage === 1 ? (
            <Button className="min-h-12 flex-1" disabled={!canContinue} onClick={() => setStage(2)}>
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
    </main>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-stone">{label}</span>
      <input
        name={name}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
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
