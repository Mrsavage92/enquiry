import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wordmark } from "@/components/ui/wordmark";
import { usePrototype } from "@/store/prototype-store";
import { completeOnboarding } from "@/lib/server/workspace";
import { cn } from "@/lib/utils";
import { useNarrow } from "@/lib/use-narrow";
import { RequireAuth } from "@/lib/auth/gates";

// Onboarding configures business/workspace state, so it is an operator surface
// even though it sits outside the /_app layout.
export const Route = createFileRoute("/onboarding")({
  component: GuardedOnboarding,
});

function GuardedOnboarding() {
  return (
    <RequireAuth>
      <Onboarding />
    </RequireAuth>
  );
}

const LAST = 5;

const SOURCES = [
  { id: "website", title: "Use my website", body: "Public pages only. You’ll see what it found before anything is Active." },
  { id: "upload", title: "Upload a price list", body: "PDF or spreadsheet. Provenance stays on every price." },
  { id: "paste", title: "Paste information", body: "Price lists, FAQs, policies. No mailbox required." },
  { id: "tell", title: "Tell Enquiry", body: "Describe how you work in your own words." },
  { id: "manual", title: "Set up manually", body: "Escape hatch. Not the default." },
];

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

function Onboarding() {
  const step = usePrototype((s) => s.onboardingStep);
  const setStep = usePrototype((s) => s.setOnboardingStep);
  const source = usePrototype((s) => s.onboardingSource);
  const setSource = usePrototype((s) => s.setOnboardingSource);
  const markOnboarded = usePrototype((s) => s.markOnboardedLocally);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [industry, setIndustry] = useState("");
  const [timezone, setTimezone] = useState(detectTimezone);
  const [baseLocation, setBaseLocation] = useState("");
  // The live money domain is AUD-only (Money.currency, MoneyRange.currency and
  // Business.currency are all the literal "AUD"), so offering a currency field
  // would let someone pick EUR and have it silently treated as AUD. The database
  // columns stay currency-capable; making the domain multi-currency is a
  // deliberate later change (R2A correction s6).
  const currency = "AUD";
  const [team, setTeam] = useState("solo");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [arrival, setArrival] = useState<"private" | "email" | "sms" | "instagram" | "facebook">("private");
  const [warmth, setWarmth] = useState("Warm");
  const [formality, setFormality] = useState("Conversational");

  const phone = useNarrow(860) !== false;
  /**
   * Steps 2 and 3 were a sample Business Brain: confirm-able rule cards sourced
   * from "glowandco.example/pricing" and a test against a fixture enquiry. In a
   * signed-in tenant those could be confirmed into, or read as, that business's
   * learned truth - which it has none of (R2A correction s6). They are gone from
   * the live path; /demo remains the fixture demonstration surface, and real
   * machine-usable Brain persistence is R2C.
   */
  const steps = phone ? [0, 4, 5] : [0, 1, 4, 5];
  const stageLabels = phone
    ? ["The business", "How it sounds", "Ready"]
    : ["The business", "What to learn from", "Your voice", "Ready"];
  const stepIndex = Math.max(0, steps.indexOf(step));

  const go = (n: number) => setStep(Math.max(0, Math.min(LAST, n)));
  const goNext = () => {
    const next = steps[stepIndex + 1];
    if (next != null) go(next);
  };
  const back = () => {
    if (stepIndex <= 0) {
      void navigate({ to: "/" });
      return;
    }
    go(steps[stepIndex - 1] ?? 0);
  };

  // Illustrative only, and built from what the operator just typed rather than
  // from a fixture customer and price. Nothing here is persisted or claimed as a
  // real quote.
  /**
   * Illustrative wording only. Deliberately asserts NO business fact - no
   * availability, coverage, price or commitment - because this screen persists
   * nothing and the business has taught Enquiry nothing yet. An earlier version
   * said "yes, we can cover X that weekend", which implies availability the
   * product cannot know (R2A correction s5).
   */
  const quoteSample =
    warmth === "Warm"
      ? "Hi — thanks for getting in touch. Here's where things are."
      : "Thanks for getting in touch. Here is where things are.";

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
   * incomplete with a retryable message (R2A correction s1-s5).
   *
   * The selected channel is a stated PREFERENCE, not integration state. Nothing
   * is marked connected without a real handshake, which does not exist yet.
   * Voice and Business Brain rules are deliberately not persisted here - that is
   * R2C - so nothing typed on these screens is presented as learned truth.
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
      // pulls fixture enquiries, Brain, trust and integration state into view as
      // if they were this tenant's (R2A correction s1). The only client state is
      // a transient "this browser finished onboarding" marker; real workspace
      // hydration is R2B.
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
          {stageLabels[stepIndex]} · {stepIndex + 1} of {steps.length}
        </p>
        <div className="mt-2 flex gap-1" role="navigation" aria-label="Setup steps">
          {stageLabels.map((label, i) => {
            const target = steps[i] ?? 0;
            const reachable = target <= step || i <= stepIndex;
            return (
              <button
                key={label}
                type="button"
                disabled={!reachable}
                aria-current={i === stepIndex ? "step" : undefined}
                aria-label={label}
                onClick={() => reachable && go(target)}
                className="min-h-11 flex-1 py-4"
              >
                <span
                  className={cn(
                    "block h-1.5 w-full rounded-full transition-colors duration-150",
                    i === stepIndex ? "bg-ink" : i < stepIndex ? "bg-ink/35" : "bg-line",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div key={step} className="flex-1 animate-[rise-in_280ms_var(--ease-smooth-out)]">
        {step === 0 ? (
          <section className="mt-8">
            <h1 className="text-3xl font-semibold tracking-tight">Your business</h1>
            <p className="mt-2 text-sm text-ink-2">
              Your real business. Nothing here is a sample.
            </p>
            <div className="mt-6 space-y-3">
              <Field
                label="Business name"
                value={name}
                onChange={setName}
                placeholder="e.g. Ridge & Co"
              />
              <Field
                label="Your first name"
                value={ownerFirstName}
                onChange={setOwnerFirstName}
                placeholder="Used when Enquiry signs off"
              />
              <Field
                label="What you do"
                value={industry}
                onChange={setIndustry}
                placeholder="e.g. mobile makeup, painting, photography"
              />
              <Field
                label="Where you work from"
                value={baseLocation}
                onChange={setBaseLocation}
                placeholder="Suburb, city or region"
              />
              <Field
                label="Time zone"
                value={timezone}
                onChange={setTimezone}
                placeholder="Detected from your browser"
              />
              <SelectField
                label="Who does the work"
                value={team}
                onChange={setTeam}
                options={TEAMS.map((t) => t.label)}
                values={TEAMS.map((t) => t.id)}
              />
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="mt-8">
            <h1 className="text-3xl font-semibold tracking-tight">What should it read first?</h1>
            <p className="mt-2 text-sm text-ink-2">Pick one. You can add more later.</p>
            <ul className="mt-6">
              {SOURCES.map((s, i) => {
                const selected = source === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSource(s.id)}
                      className={cn(
                        "flex w-full gap-4 border-t border-line px-0 py-4 text-left last:border-b",
                        selected ? "bg-paper-2/80" : "hover:bg-paper-2/50",
                      )}
                    >
                      <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-stone">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium">{s.title}</span>
                          {selected ? <Badge>Selected</Badge> : null}
                        </span>
                        <span className="mt-1 block text-sm text-ink-2">{s.body}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="mt-8">
            <h1 className="text-3xl font-semibold tracking-tight">How it should sound</h1>
            <p className="mt-2 text-sm text-ink-2">Change a setting. Watch the line.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Warmth"
                value={warmth}
                onChange={setWarmth}
                options={["Warm", "Reserved"]}
              />
              <SelectField
                label="Formality"
                value={formality}
                onChange={setFormality}
                options={["Conversational", "Formal"]}
              />
            </div>
            <div className="mt-6 space-y-5 border-t border-line pt-6">
              <div>
                <p className="eyebrow">Quote</p>
                <p className="letter-body mt-2">{quoteSample}</p>
              </div>
              <div>
                <p className="eyebrow">One question</p>
                <p className="letter-body mt-2">
                  {warmth === "Warm"
                    ? "Hi Chris — I can do the work dinner makeup. What’s the suburb, so I can check travel?"
                    : "Chris, I can do the work dinner makeup. What suburb is it, so travel can be checked?"}
                </p>
              </div>
              <p className="text-xs text-stone">Avoids: Don’t hesitate · Just circling back</p>
            </div>
          </section>
        ) : null}

        {step === 5 ? (
          <section className="mt-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              {name.trim() || "Your studio"} is ready
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              Today will be empty until work arrives. Open sample jobs if you want to feel the desk.
            </p>
            <p className="eyebrow mt-8">How work arrives</p>
            <div className="mt-3 space-y-2">
              <Choice
                selected={arrival === "private"}
                title="Form, forwarding or paste"
                body="No mailbox needed."
                onClick={() => setArrival("private")}
              />
              <Choice
                selected={arrival === "email"}
                title="Email"
                body="Not connected yet. Tells us what to build first."
                onClick={() => setArrival("email")}
              />
              <Choice
                selected={arrival === "sms"}
                title="Texts"
                body="Not connected yet. Tells us what to build first."
                onClick={() => setArrival("sms")}
              />
              <Choice
                selected={arrival === "instagram"}
                title="Instagram"
                body="Not connected yet. Tells us what to build first."
                onClick={() => setArrival("instagram")}
              />
              <Choice
                selected={arrival === "facebook"}
                title="Facebook"
                body="Not connected yet. Tells us what to build first."
                onClick={() => setArrival("facebook")}
              />
            </div>
            <ul className="mt-6">
              {/*
                Only states what is actually persisted. Voice is not saved in
                R2A and the channel choice is a preference, so claiming either
                is "on file" or "chosen" would be false.
              */}
              {[
                name.trim() || "Your business",
                "Saved to your workspace",
                "Nothing is connected yet",
                "You’ll still send every reply",
              ].map((item) => (
                <li key={item} className="border-t border-line py-3 text-sm last:border-b">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-8 border-t border-line bg-paper/95 px-5 py-3 pb-[max(0.75rem,var(--app-safe-bottom))] backdrop-blur-sm sm:-mx-8 sm:px-8">
        {submitError ? (
          <p role="alert" className="mb-3 text-sm text-danger">
            {submitError} Your details are still here — try again.
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button variant="secondary" className="min-h-12 px-4" onClick={back}>
            <ChevronLeft className="size-4" aria-hidden />
            Back
          </Button>
          {step < LAST ? (
            <Button
              className="min-h-12 flex-1"
              disabled={(step === 0 && !name.trim()) || (step === 1 && !source)}
              onClick={goNext}
            >
              Continue
            </Button>
          ) : (
            <Button
              className="min-h-12 flex-1"
              disabled={submitting}
              onClick={() => void finish()}
            >
              {submitting ? "Creating your workspace…" : "Handle my first enquiry"}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-stone">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field h-11"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  values,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  values?: string[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-stone">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field h-11">
        {options.map((opt, i) => (
          <option key={opt} value={values?.[i] ?? opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function Choice({
  selected,
  title,
  body,
  onClick,
}: {
  selected: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start rounded-md px-4 py-3 text-left transition-colors duration-150",
        selected ? "bg-ink text-paper" : "bg-raised text-ink shadow-border hover:shadow-border-hover",
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className={cn("mt-1 text-sm", selected ? "text-paper/75" : "text-ink-2")}>{body}</span>
    </button>
  );
}

