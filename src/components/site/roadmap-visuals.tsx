import { cn } from "@/lib/utils";
import type { RoadmapVisual } from "@/lib/launch/roadmap";

export function RoadmapVisual({ type }: { type: RoadmapVisual }) {
  switch (type) {
    case "proof":
      return <ProofVisual />;
    case "brain":
      return <BrainVisual />;
    case "evaluators":
      return <EvaluatorVisual />;
    case "states":
      return <StateVisual />;
    case "connect":
      return <ConnectVisual />;
    case "autopilot":
      return <AutopilotVisual />;
    case "leak":
      return <LeakVisual />;
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

function ProofVisual() {
  const steps = ["Messy enquiry", "Facts · missing", "Next action", "Reply ready"];
  return (
    <ol className="flex flex-wrap items-center gap-y-2" aria-hidden>
      {steps.map((s, i) => (
        <li key={s} className="flex items-center">
          {i > 0 ? <Arrow /> : null}
          <Cell>{s}</Cell>
        </li>
      ))}
    </ol>
  );
}

function BrainVisual() {
  const rows = [
    ["Services", "Prices", "What you never do"],
    ["Required info", "Travel", "Voice"],
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

function EvaluatorVisual() {
  const chips = [
    { t: "Pricing", on: true },
    { t: "Travel", on: true },
    { t: "Qualification", on: true },
    { t: "Availability", on: false },
    { t: "Eligibility", on: false },
    { t: "Capacity", on: false },
  ];
  return (
    <div className="max-w-md" aria-hidden>
      <div className="flex justify-center">
        <span className="rounded-md bg-mark px-4 py-2 text-sm text-mark-fg">This enquiry</span>
      </div>
      <ul className="mt-4 flex flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <li key={c.t}>
            <Cell quiet={!c.on}>{c.t}</Cell>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-xs text-stone">Only the checks that change the decision light up.</p>
    </div>
  );
}

function StateVisual() {
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

function ConnectVisual() {
  const nodes = [
    { t: "Mail", s: "Later" },
    { t: "Calendar", s: "Later" },
    { t: "Forms", s: "Working" },
    { t: "Booking handoff", s: "Later" },
    { t: "SMS", s: "Exploring" },
  ];
  return (
    <ul className="flex flex-wrap gap-2" aria-hidden>
      {nodes.map((n) => (
        <li key={n.t} className="rounded-md bg-raised px-3 py-2 shadow-border">
          <p className="text-sm">{n.t}</p>
          <p className="mt-0.5 text-2xs uppercase tracking-wider text-stone">{n.s}</p>
        </li>
      ))}
    </ul>
  );
}

function AutopilotVisual() {
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

function LeakVisual() {
  const stats = [
    { n: "7", l: "enquiries with no recorded follow-up" },
    { n: "$2,160", l: "open enquiry value on file" },
    { n: "3", l: "bookings after an Enquiry follow-up" },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-3" aria-hidden>
      {stats.map((s) => (
        <li key={s.l} className="rounded-lg bg-raised px-4 py-3 shadow-border">
          <p className="font-serif text-2xl font-semibold tracking-tight">{s.n}</p>
          <p className="mt-1 text-xs leading-snug text-ink-2">{s.l}</p>
        </li>
      ))}
    </ul>
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
