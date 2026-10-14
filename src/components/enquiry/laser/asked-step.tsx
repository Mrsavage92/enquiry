import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Business, Enquiry } from "@/domain/types";
import { holdingItems } from "@/domain/asked";
import { savedPriceFor } from "@/domain/asked-view";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { ownerError } from "@/lib/owner-error";
import { choicesFor, itemWords } from "../asked-choices";
import { useDone } from "../done-notice";

/**
 * The next thing they asked that is still to settle, as the one question on
 * screen with its choices (go-live review B2): never a collapsed "To settle"
 * row behind the settled line while Copy is offered.
 */
export function AskedStep({
  enquiry,
  business,
}: {
  enquiry: Enquiry;
  business: Business | undefined;
}) {
  const actions = useFirstBetaActions();
  const say = useDone();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const item = holdingItems(enquiry.decision.asked ?? [])[0];
  if (!item) return null;
  const priced = savedPriceFor(item, enquiry, business);
  const choices = choicesFor(item, priced);
  return (
    <div className="mt-2" data-testid="asked-step">
      <p className="text-sm text-ink">They also asked: {itemWords(item, enquiry)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {choices.map((c, i) => (
          <Button
            key={c.value}
            className="min-h-11"
            variant={priced && i === 0 ? "primary" : "secondary"}
            disabled={saving !== null}
            onClick={() => {
              setSaving(c.value);
              setError(null);
              void actions
                .answerFact(enquiry.id, item.id, c.value)
                .then(() => say(c.done))
                .catch((err: unknown) => setError(ownerError(err)))
                .finally(() => setSaving(null));
            }}
          >
            {saving === c.value ? "Saving..." : c.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
