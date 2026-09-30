import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import { EXTRA_CHOICE } from "@/domain/extras";
import { QUESTION_ANSWER, questionThing } from "@/domain/service-questions";
import { ASK_CHOICE, askTopic } from "@/domain/customer-asks";
import { activeRules } from "@/domain/decide";
import { lineChoicesFor } from "@/domain/line-choices";
import { describeRule } from "@/domain/business-rule";
import type { AskedItem } from "@/domain/asked";
import type { Business, Enquiry } from "@/domain/types";
import { cn } from "@/lib/utils";
import { ASKED_CHIP, leadDateCue, openAskedItems } from "./card-cues";

/** Rows shown before "Show all": enough for a normal enquiry, short enough to scan. */
const VISIBLE_ROWS = 6;

type Choice = { value: string; label: string; done: string };

/**
 * The owner's ways to change one item, only in values the server accepts for
 * it (answer-fact-core.ts): an extra takes include / covered / leave out /
 * come back, a "do you do X?" takes yes / no / later, a question in their
 * words takes later / ignore (a new answer is written on the question card).
 * The job itself, the days they wrote and "are you free?" are read-only here.
 */
function choicesFor(item: AskedItem, priced: string | null): Choice[] {
  const thing = item.text.toLowerCase();
  if (item.kind === "extra") {
    return [
      ...(priced
        ? [{ value: EXTRA_CHOICE.include, label: `Add it - ${priced}`, done: `Added ${thing}.` }]
        : []),
      {
        value: EXTRA_CHOICE.covered,
        label: "Part of the price",
        done: `Noted: ${thing} is part of this price.`,
      },
      {
        value: EXTRA_CHOICE.leaveOut,
        label: "Leave out",
        done: `The reply says ${thing} is not included.`,
      },
      {
        value: EXTRA_CHOICE.comeBack,
        label: "Come back to them",
        done: `The reply says you'll come back to them on ${thing}.`,
      },
    ];
  }
  if (item.kind === "question") {
    return [
      { value: QUESTION_ANSWER.yes, label: "Yes, I do it", done: "The reply says you do it." },
      { value: QUESTION_ANSWER.no, label: "No, I don't", done: "The reply says you don't do it." },
      {
        value: QUESTION_ANSWER.later,
        label: "Come back to them",
        done: "The reply says you'll come back to them on it.",
      },
    ];
  }
  if (item.kind === "ask" && askTopic(item.id) !== "availability") {
    return [
      {
        value: ASK_CHOICE.later,
        label: "Come back to them",
        done: "The reply says you'll come back to them on it.",
      },
      { value: ASK_CHOICE.ignore, label: "Leave out", done: "Nothing about it goes in the reply." },
    ];
  }
  return [];
}

/** A line's words: the job's day by what it is for ("Wedding Sun 8 Nov"), the rest capitalised. */
function itemWords(item: AskedItem, enquiry: Enquiry): string {
  // A "do you do X?" is named by what they asked, never by the answer the
  // ledger may carry as its display ("No - you don't do this").
  const text =
    item.id === "date"
      ? leadDateCue(enquiry) || item.text
      : item.kind === "question"
        ? `Do you do ${questionThing(item.id)}?`
        : item.text;
  return text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text;
}

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

  const choose = async (item: AskedItem, choice: Choice) => {
    const key = `${item.id}:${choice.value}`;
    setSaving(key);
    setError(null);
    try {
      await actions.answerFact(enquiry.id, item.id, choice.value);
      setOpenId(null);
      toast.dismiss();
      toast.success(choice.done);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that. Try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mt-3" data-testid="asked-list">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink">Everything they asked</p>
        <p className="text-sm text-ink-2">{open === 0 ? "All settled" : `${open} to settle`}</p>
      </div>
      <ul className="mt-2 divide-y divide-line rounded-md border border-line-strong">
        {shown.map((item) => {
          const chip = ASKED_CHIP[item.status];
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
