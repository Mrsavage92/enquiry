import { cn } from "@/lib/utils";
import type { RoadmapVisual } from "@/lib/launch/roadmap";

export function RoadmapVisual({ type }: { type: RoadmapVisual }) {
  switch (type) {
    case "understand":
      return <UnderstandVisual />;
    case "brain":
      return <BrainVisual />;
    case "continuity":
      return <ContinuityVisual />;
    case "moving":
      return <MovingVisual />;
    case "trust":
      return <TrustVisual />;
    case "endgame":
      return <EndgameVisual />;
  }
}

function Cell({
  children,
  quiet,
  className,
}: {
  children: string;
  quiet?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-3 py-1.5 text-xs leading-snug",
        quiet ? "text-stone" : "bg-raised shadow-border text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Arrow() {
  return (
    <span className="px-1 font-mono text-xs text-stone" aria-hidden>
      →
    </span>
  );
}

function UnderstandVisual() {
  const steps = ["Messy enquiry", "Understood", "Next action"];
  return (
    <div aria-hidden>
      <ol className="flex flex-wrap items-center gap-y-2">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center">
            {i > 0 ? <Arrow /> : null}
            <Cell>{s}</Cell>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-stone">Known, missing, ambiguous. Then the next action.</p>
    </div>
  );
}

function BrainVisual() {
  const rows = [
    ["Services", "Rules", "What you never do"],
    ["Prices where they apply", "Required info", "Voice"],
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-hidden>
      {rows.map((row) => (
        <ul key={row[0]} className="rounded-lg bg-raised px-4 py-3 shadow-border">
          {row.map((item) => (
            <li key={item} className="border-t border-line py-1.5 text-sm first:border-t-0 first:pt-0">
              {item}
            </li>
          ))}
        </ul>
      ))}
      <p className="sm:col-span-2 text-xs text-stone">Just this enquiry · or teach Enquiry.</p>
    </div>
  );
}

function ContinuityVisual() {
  const steps = [
    { t: "Website form", s: "Starts the enquiry" },
    { t: "Text message", s: "Same person, later" },
    { t: "Fact changes", s: "Deadline, scope" },
    { t: "Decision updates", s: "Next action current" },
  ];
  return (
    <ol className="grid gap-2 sm:grid-cols-2" aria-hidden>
      {steps.map((step, i) => (
        <li key={step.t} className="rounded-lg bg-raised px-4 py-3 shadow-border">
          <p className="font-mono text-2xs tabular-nums text-stone">{String(i + 1).padStart(2, "0")}</p>
          <p className="mt-1 text-sm font-medium">{step.t}</p>
          <p className="mt-0.5 text-xs text-stone">{step.s}</p>
        </li>
      ))}
    </ol>
  );
}

function MovingVisual() {
  const steps = ["Waiting on them", "They replied", "Needs you", "Ready to book"];
  return (
    <ol className="flex flex-wrap items-center gap-y-2" aria-hidden>
      {steps.map((s, i) => (
        <li key={s} className="flex items-center">
          {i > 0 ? <Arrow /> : null}
          <Cell quiet={i === 0}>{s}</Cell>
        </li>
      ))}
    </ol>
  );
}

function TrustVisual() {
  return (
    <div aria-hidden>
      <div className="flex flex-wrap items-center gap-y-2">
        <Cell>Observe</Cell>
        <Arrow />
        <Cell>Assist</Cell>
        <Arrow />
        <Cell>Selected actions</Cell>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {["Acknowledge", "Ask one missing fact", "Approved follow-up"].map((t) => (
          <li key={t}>
            <Cell quiet>{t}</Cell>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-stone">No master switch. Permission is per class of action.</p>
    </div>
  );
}

function EndgameVisual() {
  const flow = [
    "Customer enquiry",
    "Enquiry understands",
    "Business-specific decision",
    "Communication / authorised action",
    "Booked or lost",
    "Downstream system",
  ];
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
      <ol>
        {flow.map((step, i) => (
          <li key={step} className="flex items-baseline gap-4 border-t border-line py-3 last:border-b">
            <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-stone">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-serif text-xl font-medium tracking-tight sm:text-2xl">{step}</span>
          </li>
        ))}
      </ol>
      <aside>
        <p className="eyebrow">The owner stays for</p>
        <ul className="mt-3">
          {["Exceptions", "Judgement", "Relationships", "Unusual commercial calls"].map((item) => (
            <li key={item} className="border-t border-line py-2 text-sm last:border-b">
              {item}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
