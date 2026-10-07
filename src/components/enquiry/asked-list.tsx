import { useState } from "react";
import { useDone } from "./done-notice";
import { Check, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { activeRules } from "@/domain/decide";
import { lineChoicesFor } from "@/domain/line-choices";
import { describeRule } from "@/domain/business-rule";
import type { AskedItem } from "@/domain/asked";
import type { Business, Enquiry } from "@/domain/types";
import { cn } from "@/lib/utils";
import { ASKED_CHIP, CLOSED_CHIP, SHOWN_CHIP, openAskedItems } from "./card-cues";
import { askedShown, isSettledShown } from "@/domain/asked-view";
import { PROMISE_WORDS, preparedBody, promiseVerdict } from "@/domain/labels";
import { ownerError } from "@/lib/owner-error";
import { choicesFor, itemWords, type Choice } from "./asked-choices";

/** Rows shown before "Show all": enough for a normal enquiry, short enough to scan. */
const VISIBLE_ROWS = 6;

/**
 * "Everything they asked": one line per thing they asked for or about, with
 * where it stands (answered, left out, come back, to settle). Tap a line to
 * change it where the server accepts a change. Read from the decision
 * snapshot's `asked` ledger; the server refuses "That's everything" while any
 * item is still to settle, and so does the button beside this list.
 */
export function AskedList({
  enquiry,
  business,
}: {
  enquiry: Enquiry;
  business: Business | undefined;
}) {
  const actions = useFirstBetaActions();
  const say = useDone();
  const [openId, setOpenId] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What still needs the owner comes first, so "To settle above" is always
  // on screen; the ledger's own order otherwise.
  const ledger = enquiry.decision.asked ?? [];
  const items = [
    ...ledger.filter((i) => i.status === "open"),
    ...ledger.filter((i) => i.status !== "open"),
  ];
  // The job alone is not a list: it only helps once there is something beside it.
  if (items.filter((i) => i.kind !== "service").length === 0) return null;

  const priceLines =
    enquiry.decision.price?.kind === "EXACT"
      ? (enquiry.decision.price.lines ?? []).map((l) => l.label)
      : (enquiry.decision.coverage?.lines ?? []).map((l) => l.label);
  const saved = lineChoicesFor(
    activeRules(business ?? {}),
    enquiry.facts,
    enquiry.serviceLabel,
    priceLines,
  );
  const open = openAskedItems(items).length;
  // More open items than rows: every one is shown, never hidden behind "Show all".
  const shown = all ? items : items.slice(0, Math.max(VISIBLE_ROWS, open));
  // "All settled" only when it is true of the reply too: never beside a "Not yet".
  const body = preparedBody(enquiry);
  const allSettled =
    promiseVerdict(enquiry).word !== PROMISE_WORDS.notYet &&
    items.every((i) => i.kind === "service" || isSettledShown(i, body) || i.closed);

  const choose = async (item: AskedItem, choice: Choice) => {
    const key = `${item.id}:${choice.value}`;
    setSaving(key);
    setError(null);
    try {
      await actions.answerFact(enquiry.id, item.id, choice.value);
      setOpenId(null);
      say(choice.done);
    } catch (err) {
      setError(ownerError(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mt-3" data-testid="asked-list">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink">Everything they asked</p>
        <p className="text-sm text-ink-2">
          {open > 0 ? `${open} to settle` : allSettled ? "All settled" : ""}
        </p>
      </div>
      <ul className="mt-2 divide-y divide-line rounded-md border border-line-strong">
        {shown.map((item) => {
          // A day they wrote that the owner doesn't work is never "Answered".
          const shownAs = askedShown(item, body);
          const chip = item.closed
            ? CLOSED_CHIP
            : shownAs === "asking" || shownAs === "will_confirm"
              ? SHOWN_CHIP[shownAs]
              : ASKED_CHIP[shownAs];
          const priced = saved.find((c) => c.field === item.id);
          const choices = choicesFor(
            item,
            priced ? describeRule(priced.rule).replace(/^[^:]*:\s*/, "") : null,
          );
          const current = enquiry.facts.find(
            (f) => !f.superseded && f.field === item.id && f.status === "confirmed",
          )?.value;
          const expanded = openId === item.id;
          const words = itemWords(item, enquiry);
          const row = (
            <>
              <span className="min-w-0 flex-1 truncate text-ink" title={words}>
                {words}
              </span>
              <Badge tone={chip.tone}>{chip.word}</Badge>
              {choices.length ? (
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-ink-2 transition-transform duration-150 ease-out",
                    expanded && "rotate-180",
                  )}
                  aria-hidden
                />
              ) : null}
            </>
          );
          return (
            <li key={item.id}>
              {choices.length ? (
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm"
                  aria-expanded={expanded}
                  aria-label={`${words}: ${chip.word}. Change`}
                  onClick={() => setOpenId(expanded ? null : item.id)}
                >
                  {row}
                </button>
              ) : (
                <div className="flex min-h-9 items-center gap-2 px-3 py-1.5 text-sm">{row}</div>
              )}
              {expanded ? (
                <div className="flex flex-wrap gap-2 px-3 pb-3">
                  {choices.map((c) => {
                    const isNow = String(current ?? "") === c.value;
                    const key = `${item.id}:${c.value}`;
                    return (
                      <Button
                        key={c.value}
                        size="sm"
                        variant="secondary"
                        className="min-h-11"
                        aria-pressed={isNow}
                        disabled={saving !== null || isNow}
                        onClick={() => void choose(item, c)}
                      >
                        {isNow ? <Check className="size-4" aria-hidden /> : null}
                        {saving === key ? "Saving…" : c.label}
                      </Button>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {items.length > Math.max(VISIBLE_ROWS, open) ? (
        <button
          type="button"
          className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-mark-strong underline-offset-4 hover:underline"
          aria-expanded={all}
          onClick={() => setAll((v) => !v)}
        >
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
