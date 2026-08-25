import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wordmark } from "@/components/ui/wordmark";
import { usePrototype } from "@/store/prototype-store";
import { cn } from "@/lib/utils";
import { useNarrow } from "@/lib/use-narrow";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const LAST = 5;

const STAGE = [
  "Who you are",
  "What to learn from",
  "Review",
  "Test",
  "Your voice",
  "Ready",
];

const SOURCES = [
  { id: "website", title: "Use my website", body: "Public pages only. You’ll see what it found before anything is Active." },
  { id: "upload", title: "Upload a price list", body: "PDF or spreadsheet. Provenance stays on every price." },
  { id: "paste", title: "Paste information", body: "Price lists, FAQs, policies. No mailbox required." },
  { id: "tell", title: "Tell Enquiry", body: "Describe how you work in your own words." },
  { id: "manual", title: "Set up manually", body: "Escape hatch. Not the default." },
];

const CITY_TZ: Record<string, string> = {
  Brisbane: "Australia/Brisbane",
  Sydney: "Australia/Sydney",
  Melbourne: "Australia/Melbourne",
  "Gold Coast": "Australia/Brisbane",
  Auckland: "Pacific/Auckland",
  Other: "Australia/Sydney",
};

const CITIES = ["Brisbane", "Sydney", "Melbourne", "Gold Coast", "Auckland", "Other"];

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
  const complete = usePrototype((s) => s.completeOnboarding);
  const setVoice = usePrototype((s) => s.setVoice);
  const connect = usePrototype((s) => s.connectIntegration);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Australia/Brisbane");
  const [city, setCity] = useState("Brisbane");
  const [suburb, setSuburb] = useState("Paddington");
  const [team, setTeam] = useState("solo");
  const [arrival, setArrival] = useState<"private" | "email" | "sms" | "instagram" | "facebook">("private");
  const [warmth, setWarmth] = useState("Warm");
  const [formality, setFormality] = useState("Conversational");
  const [confirmed, setConfirmed] = useState<Record<string, "yes" | "later">>({
    formal: "yes",
    group: "yes",
    min: "yes",
    capacity: "yes",
    lashes: "later",
  });
  const [tests, setTests] = useState<Record<string, "ok" | "change">>({});

  const phone = useNarrow(860) !== false;
  const steps = phone ? [0, 4, 5] : [0, 1, 2, 3, 4, 5];
  const stageLabels = phone ? ["The business", "How it sounds", "Ready"] : STAGE;
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

  const quoteSample =
    warmth === "Warm"
      ? "Hi Priya — four of you in New Farm on 19 Sep is $625, including travel."
      : "Priya, four of you in New Farm on 19 Sep is $625, including travel.";

  const finish = () => {
    setVoice("glow", {
      warmth,
      formality,
      greeting: warmth === "Warm" ? "Hi" : "Hello",
    });
    if (arrival === "email") connect("glow", "email");
    if (arrival === "sms") connect("glow", "sms");
    if (arrival === "instagram") connect("glow", "instagram");
    if (arrival === "facebook") connect("glow", "facebook");
    complete({
      name: name.trim() || "Your studio",
      city,
      timezone,
      suburb,
      team,
    });
    void navigate({ to: "/enquiries" });
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
            <p className="mt-2 text-sm text-ink-2">Name and city. Not a sample.</p>
            <div className="mt-6 space-y-3">
              <Field label="Business name" value={name} onChange={setName} placeholder="Your studio" />
              <SelectField
                label="City"
                value={city}
                onChange={(v) => {
                  setCity(v);
                  setTimezone(CITY_TZ[v] ?? timezone);
                }}
                options={CITIES}
              />
              {city === "Other" || city === "Brisbane" ? (
                <Field
                  label={city === "Brisbane" ? "Suburb / base" : "Base location"}
                  value={suburb}
                  onChange={setSuburb}
                />
              ) : null}
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

        {step === 2 ? (
          <section className="mt-8">
            <h1 className="text-3xl font-semibold tracking-tight">Check this</h1>
            <p className="mt-2 text-sm text-ink-2">
              Sample prices, so you can see a check. Yours replace them in Brain.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="text-sm font-medium underline-offset-4 hover:underline"
                onClick={() =>
                  setConfirmed({
                    formal: "yes",
                    group: "yes",
                    min: "yes",
                    capacity: "yes",
                    lashes: "later",
                  })
                }
              >
                Confirm the safe ones
              </button>
            </div>
            <ReviewCard
              title="Formal makeup"
              meta="$165 per person · mobile"
              source="glowandco.example/pricing"
              value={confirmed.formal}
              onConfirm={() => setConfirmed((c) => ({ ...c, formal: "yes" }))}
              onLater={() => setConfirmed((c) => ({ ...c, formal: "later" }))}
            />
            <ReviewCard
              title="Group mobile makeup"
              meta="$125 per person · minimum 3"
              source="glowandco.example/pricing"
              value={confirmed.group}
              onConfirm={() => setConfirmed((c) => ({ ...c, group: "yes" }))}
              onLater={() => setConfirmed((c) => ({ ...c, group: "later" }))}
            />
            <ReviewCard
              title="Mobile minimum"
              meta="At least 3 makeup services for a mobile booking."
              source="Price list uploaded 24 Aug 2026"
              value={confirmed.min}
              onConfirm={() => setConfirmed((c) => ({ ...c, min: "yes" }))}
              onLater={() => setConfirmed((c) => ({ ...c, min: "later" }))}
            />
            <ReviewCard
              title="Solo capacity"
              meta="45–60 min per person · 15 min buffer · one artist"
              source="Told Enquiry"
              value={confirmed.capacity}
              onConfirm={() => setConfirmed((c) => ({ ...c, capacity: "yes" }))}
              onLater={() => setConfirmed((c) => ({ ...c, capacity: "later" }))}
            />
            <article className="mt-3 rounded-lg bg-warn-bg p-5 text-warn">
              <p className="font-medium">Lash add-on — two prices</p>
              <p className="mt-1 text-sm text-ink">Website $25 · 2026 list $35. Enquiry will not pick one.</p>
              <p className="mt-2 text-xs text-ink-2">Left as Needs review. Lashes stay unquoted until you choose.</p>
            </article>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="mt-8">
            <h1 className="text-3xl font-semibold tracking-tight">Does this look right?</h1>
            <p className="mt-2 text-sm text-ink-2">Three jobs. Mark anything that isn’t how {name} works.</p>
            <ul className="mt-6">
              {[
                { id: "a", title: "Four people, New Farm, ready 2pm", body: "Group mobile · $625 exact · feasible · Send quote" },
                { id: "b", title: "One person, suburb missing", body: "Needs address · Ask one question · Needs you" },
                { id: "c", title: "Toowoomba, 8am ready-by", body: "Travel $232 · 8am not feasible same-morning · Review options" },
              ].map((t) => (
                <li key={t.id} className="border-t border-line py-4 last:border-b">
                  <p className="font-medium">{t.title}</p>
                  <p className="mt-1 text-sm text-ink-2">{t.body}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant={tests[t.id] === "ok" ? "primary" : "secondary"}
                      onClick={() => setTests((x) => ({ ...x, [t.id]: "ok" }))}
                    >
                      Looks right
                    </Button>
                    <Button
                      size="sm"
                      variant={tests[t.id] === "change" ? "warn" : "ghost"}
                      onClick={() => setTests((x) => ({ ...x, [t.id]: "change" }))}
                    >
                      Needs change
                    </Button>
                  </div>
                </li>
              ))}
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
                body="Read first. Send stays off."
                onClick={() => setArrival("email")}
              />
              <Choice
                selected={arrival === "sms"}
                title="Texts"
                body="Reply on the same number."
                onClick={() => setArrival("sms")}
              />
              <Choice
                selected={arrival === "instagram"}
                title="Instagram"
                body="DMs become jobs. Comments are not quotes."
                onClick={() => setArrival("instagram")}
              />
              <Choice
                selected={arrival === "facebook"}
                title="Facebook"
                body="Page DMs become jobs."
                onClick={() => setArrival("facebook")}
              />
            </div>
            <ul className="mt-6">
              {(phone
                ? [
                    name.trim() || "Your studio",
                    "How it sounds is on file",
                    "You’ll still send the first enquiry",
                  ]
                : [
                    name.trim() || "Your studio",
                    "How it sounds is on file",
                    "How work arrives is chosen",
                    "You’ll still send the first enquiry",
                  ]
              ).map((item) => (
                <li key={item} className="border-t border-line py-3 text-sm last:border-b">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-8 border-t border-line bg-paper/95 px-5 py-3 pb-[max(0.75rem,var(--app-safe-bottom))] backdrop-blur-sm sm:-mx-8 sm:px-8">
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
            <Button className="min-h-12 flex-1" onClick={finish}>
              Handle my first enquiry
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

function ReviewCard({
  title,
  meta,
  source,
  value,
  onConfirm,
  onLater,
}: {
  title: string;
  meta: string;
  source: string;
  value?: "yes" | "later";
  onConfirm: () => void;
  onLater: () => void;
}) {
  return (
    <article className="border-t border-line py-4 last:border-b">
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-sm text-ink-2">{meta}</p>
      <p className="mt-1 text-xs text-stone">Source: {source}</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant={value === "yes" ? "primary" : "secondary"} onClick={onConfirm}>
          Confirm
        </Button>
        <Button size="sm" variant={value === "later" ? "warn" : "ghost"} onClick={onLater}>
          Leave for review
        </Button>
      </div>
    </article>
  );
}
