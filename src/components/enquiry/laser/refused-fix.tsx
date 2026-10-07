import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { Business, Enquiry } from "@/domain/types";
import { activeRules } from "@/domain/decide";
import { describeRule } from "@/domain/business-rule";
import { EXTRA_CHOICE } from "@/domain/extras";
import { lineChoicesFor } from "@/domain/line-choices";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import type { CheckRefused } from "./use-send-check";
import { ownerError } from "@/lib/owner-error";

/**
 * The way forward from a refused reply, in the bar (doc 50 7.4): a total that
 * differs is put back, or the line it was for is added; a reply that dropped
 * what the price covers goes back to the prepared one. The check then runs
 * again by itself and Copy returns.
 */
export function RefusedFix({
  enquiry,
  business,
  refused,
  onUsePrepared,
  onBackToPrepared,
}: {
  enquiry: Enquiry;
  business: Business | undefined;
  refused: CheckRefused;
  onUsePrepared: (named: number[], expectedMinor: number | null) => void;
  onBackToPrepared: () => void;
}) {
  const actions = useFirstBetaActions();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (refused.reason === "scope_removed") {
    return (
      <Button className="laser-bar-button" onClick={onBackToPrepared}>
        Back to the prepared reply
      </Button>
    );
  }
  if (refused.reason !== "amount_mismatch") return null;
  const price = enquiry.decision.fold?.price ?? enquiry.decision.price;
  const choices = lineChoicesFor(
    activeRules(business ?? {}),
    enquiry.facts,
    enquiry.serviceLabel,
    price?.kind === "EXACT" ? (price.lines ?? []).map((l) => l.label) : [],
  );
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="laser-bar-actions">
        <Button
          className="laser-bar-button"
          onClick={() =>
            onUsePrepared(refused.amounts?.named ?? [], refused.amounts?.expectedMinor ?? null)
          }
        >
          Use the prepared total
        </Button>
        <Button
          variant="secondary"
          className="laser-bar-button"
          aria-expanded={adding}
          onClick={() => setAdding((v) => !v)}
        >
          Add a line
        </Button>
      </div>
      {adding ? (
        <div className="space-y-2">
          {choices.map(({ rule, field }) => (
            <Button
              key={field}
              variant="secondary"
              className="min-h-11 w-full justify-start whitespace-normal"
              onClick={() => {
                setError(null);
                void actions
                  .answerFact(enquiry.id, field, EXTRA_CHOICE.include)
                  .catch((err: unknown) => setError(ownerError(err)));
              }}
            >
              Add {rule.service.toLowerCase()} ({describeRule(rule).split(": ")[1] ?? ""})
            </Button>
          ))}
          <p className="text-sm text-ink-2">
            Not in your prices?{" "}
            <Link className="laser-link" to="/business" search={{ section: "pricing" }}>
              Add a price
            </Link>{" "}
            and this enquiry updates.
          </p>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
