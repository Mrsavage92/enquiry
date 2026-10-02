import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Business, Enquiry } from "@/domain/types";
import type { LaserNext } from "@/domain/laser";
import { enquirySituation } from "@/domain/situation";
import { pricingLinkSearch } from "@/domain/next-action";
import { settledLine } from "@/domain/send-flow";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { SituationCard } from "../situation-card";
import { ServiceReadAs } from "../service-read-as";
import { QuestionAnswer } from "../question-answer";
import { ExtraDecision } from "../extra-decision";
import { CoverageCheck } from "../coverage-check";
import { AnswerBlocker } from "../answer-blocker";
import { AskedList } from "../asked-list";
import { DateNotes } from "../date-notes";
import { checkStep, otherDateCues } from "../card-cues";
import { useDone } from "../done-notice";

/**
 * Slot B: the single unsettled thing, as one question with its buttons, or,
 * once nothing is unsettled, the settled line (doc 50 sections 3, 6 and 6.5).
 * Every control here is the existing one; this only chooses which one is the
 * owner's next tap.
 */
export function NeedsYou({
  enquiry,
  business,
  next,
  body,
  staleEdit,
}: {
  enquiry: Enquiry;
  business: Business | undefined;
  next: LaserNext;
  body: string;
  /** The stale-edit choice, rendered by the screen that owns both versions. */
  staleEdit: ReactNode;
}) {
  if (next.kind === "reading") {
    return <p className="laser-quiet">This takes a few seconds.</p>;
  }
  if (next.kind === "your_call") {
    return (
      <p className="laser-quiet">
        This one is your call. Reply to them yourself, or use Later in the menu.
      </p>
    );
  }
  if (next.kind === "prices")
    return <PricesStep enquiry={enquiry} practice={next.practice} label={next.label} />;
  if (next.kind === "send" || next.kind === "blocked") {
    return <SettledStep enquiry={enquiry} business={business} body={body} />;
  }
  if (next.kind !== "decide") return null;
  const coverage = ["rule", "flag", "asked", "coverage"].includes(next.decision);
  // The coverage card carries its own title and counter; said once.
  const step = coverage ? null : checkStep(enquiry.decision.checks, enquiry.id);
  const situation = next.decision === "situation" ? enquirySituation(enquiry, business) : null;
  return (
    <section className="laser-step" aria-labelledby="laser-step-heading">
      <h2
        id="laser-step-heading"
        tabIndex={-1}
        className={coverage ? "sr-only" : "laser-step-heading"}
      >
        {step ?? headingFor(next.decision)}
      </h2>
      {next.decision === "stale_edit" ? staleEdit : null}
      {situation ? <SituationCard enquiry={enquiry} situation={situation} compact /> : null}
      {next.decision === "choose_service" ? (
        <ServiceReadAs enquiry={enquiry} business={business} bare />
      ) : null}
      {next.decision === "confirm_service" ? (
        <ServiceReadAs enquiry={enquiry} business={business} />
      ) : null}
      {next.decision.startsWith("question_") ? <QuestionAnswer enquiry={enquiry} /> : null}
      {next.decision === "extra" ? <ExtraStep enquiry={enquiry} /> : null}
      {coverage ? <CoverageCheck enquiry={enquiry} business={business} /> : null}
      {next.decision === "reading" ? <AnswerBlocker enquiry={enquiry} folded /> : null}
      {next.decision === "estimate" ? <AnswerBlocker enquiry={enquiry} folded asQuestion /> : null}
    </section>
  );
}

function headingFor(decision: string): string {
  if (decision === "stale_edit") return "Details changed since your edit";
  if (decision === "choose_service" || decision === "confirm_service")
    return "Which service is this?";
  if (
    decision === "coverage" ||
    decision === "rule" ||
    decision === "flag" ||
    decision === "asked"
  ) {
    return "Anything else they asked for?";
  }
  if (decision === "reading") return "Check one detail they gave";
  if (decision === "estimate") return "Your estimate";
  return "One thing to settle";
}

function ExtraStep({ enquiry }: { enquiry: Enquiry }) {
  const extra = enquiry.decision.extraPending!;
  return (
    <>
      <p className="text-sm text-ink">They also asked for {extra.label.toLowerCase()}.</p>
      <ExtraDecision enquiry={enquiry} />
      {extra.kind === "no_price" ? (
        <Link to="/business" search={pricingLinkSearch(enquiry)} className="laser-link">
          Add a price for {extra.label.toLowerCase()}
        </Link>
      ) : null}
    </>
  );
}

function PricesStep({
  enquiry,
  practice,
  label,
}: {
  enquiry: Enquiry;
  practice: boolean;
  label: string;
}) {
  const actions = useFirstBetaActions();
  const say = useDone();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const service = enquiry.serviceLabel.trim().toLowerCase();
  return (
    <section className="laser-step" aria-labelledby="laser-step-heading">
      <h2 id="laser-step-heading" tabIndex={-1} className="laser-step-heading">
        {service
          ? `Add a price for ${service} and this reply fills in.`
          : "Add your prices and this reply fills in."}
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        <Button asChild className="min-h-12 w-full">
          <Link to="/business" search={pricingLinkSearch(enquiry)}>
            {label}
          </Link>
        </Button>
        {practice ? (
          <Button
            variant="secondary"
            className="min-h-12 w-full"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              setError(null);
              void actions
                .applyPracticeSample(enquiry.id)
                .then((res) => {
                  if (!res.ok) setError(res.message);
                  else say("Priced with a sample price, for practice only.");
                })
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Could not do that."),
                )
                .finally(() => setSaving(false));
            }}
          >
            Use a sample price for practice
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

const SETTLED_PARTS = 3;

/** "6 settled · back on ceilings · not Sat 14 Nov", opening in place to the ledger. */
function SettledStep({
  enquiry,
  business,
  body,
}: {
  enquiry: Enquiry;
  business: Business | undefined;
  body: string;
}) {
  const [open, setOpen] = useState(false);
  const { count, parts } = settledLine(enquiry, body);
  const others = otherDateCues(enquiry);
  const blocking = enquiry.decision.missing.find((m) => m.blocking && !m.inferred);
  const shown = parts.slice(0, SETTLED_PARTS);
  const more = parts.length - shown.length;
  const hasLedger = count > 0 || parts.length > 0 || others.length > 0;
  return (
    <section className="laser-settled" aria-label="Settled">
      {hasLedger ? (
        <button
          type="button"
          className="laser-settled-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span>
            {[count > 0 ? `${count} settled` : null, ...shown, more > 0 ? `+${more} more` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <ChevronDown
            size={18}
            aria-hidden
            className="laser-chevron"
            data-open={open || undefined}
          />
        </button>
      ) : null}
      {open ? (
        <div className="laser-settled-detail">
          <AskedList enquiry={enquiry} business={business} />
          <DateNotes enquiry={enquiry} />
          {others.length ? <p className="text-sm text-ink-2">{others.join(" · ")}</p> : null}
        </div>
      ) : null}
      {blocking ? (
        <AnswerBlocker enquiry={enquiry} folded startClosed summary="Already know it? Enter it" />
      ) : null}
    </section>
  );
}
