import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { formatMinorAud } from "@/domain/money-format";
import { describeRule } from "@/domain/business-rule";
import { EXTRA_CHOICE, extraField } from "@/domain/extras";
import { activeRules } from "@/domain/decide";
import { lineChoicesFor } from "@/domain/line-choices";
import type { Business, Enquiry } from "@/domain/types";

/**
 * "What this price covers": every line (service x count = amount), anything
 * Enquiry noticed that is not on it, and one question - did they ask for
 * anything else? Only "That's everything" lets the reply name the total, and
 * the server holds the owner to exactly the lines on this screen (the coverage
 * key and decision revision travel with the confirmation).
 */
export function CoverageCheck({
  enquiry,
  business,
}: {
  enquiry: Enquiry;
  business: Business | undefined;
}) {
  const coverage = enquiry.decision.coverage;
  const actions = useFirstBetaActions();
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [other, setOther] = useState("");
  if (!coverage || coverage.confirmed) return null;

  const firstVisit = coverage.lines.filter((l) => l.firstVisit);
  const perJob = coverage.lines.filter((l) => !l.firstVisit);
  const total = perJob.reduce((sum, l) => sum + l.amountMinor, 0);
  const choices = lineChoicesFor(
    activeRules(business ?? {}),
    enquiry.facts,
    enquiry.serviceLabel,
    coverage.lines.map((l) => l.label),
  );

  const run = async (key: string, job: () => Promise<unknown>, done: string) => {
    setSaving(key);
    setError(null);
    try {
      await job();
      toast.dismiss();
      toast.success(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that. Try again.");
    } finally {
      setSaving(null);
    }
  };

  const confirm = () =>
    run(
      "all",
      async () => {
        const res = await actions.confirmCoverage(
          enquiry.id,
          coverage.key,
          enquiry.decisionRevision ?? -1,
        );
        if (!res.ok) throw new Error(res.message);
      },
      "Confirmed. The reply now says exactly what the price covers.",
    );

  const comeBack = () => {
    const thing = other.trim();
    if (!thing) return setError("Write what else they asked for.");
    void run(
      "other",
      () => actions.answerFact(enquiry.id, extraField(thing.toLowerCase()), EXTRA_CHOICE.comeBack),
      `The reply says you'll come back to them on the ${thing.toLowerCase()}.`,
    );
  };

  return (
    <div className="mt-3" data-testid="coverage-check">
      <p className="text-sm font-medium text-ink">What this price covers</p>
      <ul className="mt-2 divide-y divide-line rounded-md border border-line-strong">
        {perJob.map((l) => (
          <li key={l.label} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-ink">
              {l.label}
              {l.quantity ? <span className="text-ink-2"> x {l.quantity}</span> : null}
            </span>
            <span className="tabular-nums text-ink">{formatMinorAud(l.amountMinor)}</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm font-semibold">
          <span className="text-ink">{coverage.recurring ? "Per visit" : "Total"}</span>
          <span className="tabular-nums text-ink">{formatMinorAud(total)}</span>
        </li>
        {firstVisit.map((l) => (
          <li key={l.label} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-ink">First visit adds: {l.label}</span>
            <span className="tabular-nums text-ink">{formatMinorAud(l.amountMinor)}</span>
          </li>
        ))}
      </ul>
      {coverage.flagged.length > 0 ? (
        <div className="callout mt-3 bg-warn-bg text-warn">
          <p className="text-sm font-medium">Not on this price - check these</p>
          <ul className="mt-1 space-y-1 text-sm text-ink">
            {coverage.flagged.map((f) => (
              <li key={f.text}>{f.text}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-3 text-sm font-medium text-ink">Did they ask for anything else?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button className="min-h-11" disabled={saving !== null} onClick={() => void confirm()}>
          {saving === "all" ? "Saving…" : "That's everything"}
        </Button>
        <Button
          className="min-h-11"
          variant="secondary"
          aria-expanded={more}
          disabled={saving !== null}
          onClick={() => setMore((open) => !open)}
        >
          They asked for more
        </Button>
      </div>
      {more ? (
        <div className="mt-3 space-y-3 rounded-md border border-line-strong p-3">
          {choices.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-ink">Your saved prices</p>
              <ul className="mt-2 space-y-2">
                {choices.map((c) => (
                  <li key={c.field} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 text-ink">{describeRule(c.rule)}</span>
                    <Button
                      size="sm"
                      className="min-h-11"
                      disabled={saving !== null}
                      onClick={() =>
                        void run(
                          c.field,
                          () => actions.answerFact(enquiry.id, c.field, EXTRA_CHOICE.include),
                          `Added ${c.rule.service.toLowerCase()} to the quote.`,
                        )
                      }
                    >
                      Add a line
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-11"
                      disabled={saving !== null}
                      onClick={() =>
                        void run(
                          `${c.field}:out`,
                          () => actions.answerFact(enquiry.id, c.field, EXTRA_CHOICE.leaveOut),
                          `Left out. The reply tells them ${c.rule.service.toLowerCase()} is not included.`,
                        )
                      }
                    >
                      Leave out, tell them
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-ink">Something you don't price yet</span>
            <input
              className="field w-full"
              value={other}
              placeholder="e.g. deck staining"
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") comeBack();
              }}
            />
          </label>
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={saving !== null}
            onClick={comeBack}
          >
            {saving === "other" ? "Saving…" : "Tell them I'll come back on it"}
          </Button>
          <p className="text-sm text-ink-2">
            The reply never names a price for it: it says you'll come back to them.
          </p>
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
