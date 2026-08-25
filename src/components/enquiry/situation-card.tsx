import { AlertTriangle, CalendarOff, Copy, HelpCircle, Loader, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { alternativeLabel, type Situation } from "@/domain/situation";
import { formatAud } from "@/domain/labels";
import type { Enquiry } from "@/domain/types";
import { cn } from "@/lib/utils";
import { usePrototype } from "@/store/prototype-store";

export function SituationCard({
  enquiry,
  situation,
  compact = false,
}: {
  enquiry: Enquiry;
  situation: Situation;
  compact?: boolean;
}) {
  const reconnect = usePrototype((s) => s.reconnect);
  const continueWithout = usePrototype((s) => s.continueWithoutAvailability);
  const resolvePrice = usePrototype((s) => s.resolvePrice);
  const resolveDuplicate = usePrototype((s) => s.resolveDuplicate);
  const correctFact = usePrototype((s) => s.correctFact);
  const inviteToDm = usePrototype((s) => s.inviteToDm);
  const markLost = usePrototype((s) => s.markLost);

  if (situation.kind === "evaluating") {
    return <ReadingState title={situation.title} body={situation.body} compact={compact} />;
  }

  const Icon =
    situation.kind === "calendar_down"
      ? CalendarOff
      : situation.kind === "duplicate"
        ? Copy
        : situation.kind === "check_this"
          ? HelpCircle
          : situation.kind === "public_comment"
            ? MessageCircle
            : AlertTriangle;

  return (
    <section
      className={cn(
        "border-b border-line animate-[rise-in_220ms_var(--ease-smooth-out)]",
        compact ? "px-5 py-3" : "px-5 py-5",
      )}
      aria-labelledby="situation-heading"
    >
      <div
        className={cn(
          "callout",
          situation.tone === "danger" ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn",
        )}
      >
        <p id="situation-heading" className="flex items-start gap-2 text-sm font-medium">
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {situation.title}
        </p>
        {compact ? null : <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{situation.body}</p>}
      </div>

      {situation.kind === "check_this" && situation.fact?.alternatives?.length ? (
        <div className="mt-3 grid gap-2">
          {situation.fact.alternatives.map((a) => (
            <Button
              key={a}
              variant="secondary"
              className="h-auto min-h-12 w-full justify-start py-2.5 text-left"
              onClick={() =>
                correctFact(enquiry.id, situation.fact!.id, a, alternativeLabel(a))
              }
            >
              {alternativeLabel(a)}
            </Button>
          ))}
        </div>
      ) : null}

      {situation.kind === "conflict" && situation.conflictChoices?.length ? (
        <div className="mt-3 grid gap-2">
          {situation.conflictChoices.map((c) => (
            <button
              key={c.knowledgeId}
              type="button"
              className="surface-md px-3.5 py-3 text-left transition-[box-shadow] duration-150 hover:shadow-border-hover"
              onClick={() => resolvePrice(enquiry.id, c.amount)}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{c.title}</p>
                <p className="font-serif text-sm tabular-nums">{formatAud(c.amount)}</p>
              </div>
              <p className="mt-1 text-xs text-stone">{c.source}</p>
            </button>
          ))}
        </div>
      ) : null}

      {situation.kind === "duplicate" ? (
        <div className="mt-3 grid gap-2">
          <Button className="min-h-12 w-full" onClick={() => resolveDuplicate(enquiry.id, "merge")}>
            Add to existing enquiry
          </Button>
          <Button className="min-h-12 w-full" variant="secondary" onClick={() => resolveDuplicate(enquiry.id, "separate")}>
            Separate enquiry
          </Button>
        </div>
      ) : null}

      {situation.kind === "calendar_down" ? (
        <div className="mt-3 grid gap-2">
          <Button className="min-h-12 w-full" onClick={() => reconnect(enquiry.id)}>
            Reconnect calendar
          </Button>
          <Button className="min-h-12 w-full" variant="secondary" onClick={() => continueWithout(enquiry.id)}>
            Continue without availability
          </Button>
        </div>
      ) : null}

      {situation.kind === "public_comment" ? (
        <div className="mt-3 grid gap-2">
          <Button className="min-h-12 w-full" onClick={() => inviteToDm(enquiry.id)}>
            Invite them to message
          </Button>
          <Button className="min-h-12 w-full" variant="secondary" onClick={() => markLost(enquiry.id)}>
            Not an enquiry
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function ReadingState({
  title,
  body,
  compact = false,
}: {
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <section className={cn("border-b border-line px-5", compact ? "py-5" : "py-6")} aria-live="polite" aria-busy="true">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Loader className="size-4 animate-spin-slow text-stone" aria-hidden />
        {title}
      </p>
      {compact ? null : <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>}
      <ul className="mt-4 space-y-2" aria-hidden>
        {["Price", "Capacity", "Availability"].map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            <span className="w-20 text-2xs uppercase tracking-wider text-stone">{label}</span>
            <span
              className="skeleton-bar flex-1"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
