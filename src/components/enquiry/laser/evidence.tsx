import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import {
  EVALUATOR_LABELS,
  factStatusLabel,
  factStatusTone,
  fieldLabel,
  formatAud,
} from "@/domain/labels";
import { alternativeLabel } from "@/domain/situation";
import { correctionRoute } from "@/domain/fact-correction";
import type { Enquiry, EnquiryFact, EvaluatorResult } from "@/domain/types";
import { cn } from "@/lib/utils";
import { usePrototype } from "@/store/prototype-store";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";

/**
 * The evidence behind a decision, one tap away from the laser screen (doc 50:
 * "Why this reply" and "Customer details and evidence" live in the menu): each
 * evaluator's result, every fact with its source, and the correction dialog.
 */

export function EvaluatorRow({
  result,
  omitAmount,
}: {
  result: EvaluatorResult;
  omitAmount?: boolean;
}) {
  const assumed = result.status === "EXACT" && Boolean(result.assumptions?.length);
  const tone = assumed
    ? "warn"
    : result.status === "EXACT" ||
        result.status === "FEASIBLE" ||
        result.status === "PASS" ||
        result.status === "VALIDATED"
      ? "ok"
      : result.status === "RANGE" ||
          result.status === "FEASIBLE_WITH_CONDITION" ||
          result.status === "UNKNOWN" ||
          result.status === "UNKNOWN_MISSING_FACTS" ||
          result.status === "UNKNOWN_INTEGRATION" ||
          result.status === "REQUIRES_EXCEPTION"
        ? "warn"
        : result.status === "ERROR" ||
            result.status === "INFEASIBLE" ||
            result.status === "FAIL" ||
            result.status === "NOT_QUOTABLE" ||
            result.status === "BLOCKED"
          ? "danger"
          : "neutral";
  return (
    <div className="surface-md px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-2xs uppercase tracking-wider text-stone">
          {EVALUATOR_LABELS[result.type]}
        </dt>
        <Badge tone={tone}>{labelStatus(result, omitAmount)}</Badge>
      </div>
      <dd className="mt-1.5 text-sm leading-relaxed">{result.summary}</dd>
      {result.lineItems?.length ? (
        <ul className="mt-2 space-y-0.5 text-xs text-ink-2">
          {result.lineItems.map((li) => (
            <li key={li.id} className="flex justify-between gap-3">
              <span>{li.label}</span>
              <span className="tabular-nums">{formatAud(li.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {result.hardConstraints?.length ? (
        <ul className="mt-2 space-y-0.5 text-xs">
          {result.hardConstraints.map((c) => (
            <li key={c.label} className={c.ok ? "text-ok" : "text-danger"}>
              Hard · {c.label} {c.ok ? "met" : "not met"}
            </li>
          ))}
          {result.softPreferences?.map((c) => (
            <li key={c.label} className={c.ok ? "text-ok" : "text-warn"}>
              Preference · {c.label} {c.ok ? "kept" : "would be broken"}
            </li>
          ))}
        </ul>
      ) : null}
      {result.alternatives?.length ? (
        <ul className="mt-2 list-disc pl-4 text-xs text-ink-2">
          {result.alternatives.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function labelStatus(result: EvaluatorResult, omitAmount?: boolean): string {
  switch (result.status) {
    case "EXACT":
      if (result.assumptions?.length) return "Not locked";
      if (omitAmount) return "Exact";
      return result.total ? `Exact ${formatAud(result.total.amount)}` : "Exact";
    case "RANGE":
      if (omitAmount) return "Estimate";
      return result.range
        ? `Estimate ${formatAud(result.range.min)}-${formatAud(result.range.max)}`
        : "Estimate";
    case "NOT_QUOTABLE":
      return "Not quotable";
    case "ERROR":
      return "Needs review";
    case "FEASIBLE":
      return "Feasible";
    case "INFEASIBLE":
      return "Not feasible";
    case "FEASIBLE_WITH_CONDITION":
      return "Feasible with a condition";
    case "UNKNOWN_MISSING_FACTS":
      return "Unknown - missing facts";
    case "UNKNOWN_INTEGRATION":
      return "Unknown - cannot verify";
    case "PASS":
      return "Passes";
    case "FAIL":
      return "Does not pass";
    case "REQUIRES_EXCEPTION":
      return "Boundary";
    case "VALIDATED":
      return "Checked";
    case "BLOCKED":
      return "Blocked";
    case "UNKNOWN":
      return "Unknown";
    default:
      return String(result.status);
  }
}

export function FactList({
  heading,
  facts,
  onCorrect,
}: {
  heading: string;
  facts: EnquiryFact[];
  onCorrect: (fact: EnquiryFact) => void;
}) {
  if (facts.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-2xs font-medium uppercase tracking-wider text-stone">{heading}</p>
      <ul className="mt-1">
        {facts.map((f) => (
          <li
            key={f.id}
            className="flex items-start justify-between gap-2 border-b border-line/80 py-2.5 last:border-b-0"
          >
            <div>
              <p className="text-2xs text-stone">{fieldLabel(f.label)}</p>
              <p className={cn("text-sm", f.status === "check_this" && "text-warn")}>
                {f.displayValue || "-"}
              </p>
              {f.status === "inferred" || f.status === "check_this" ? (
                <Badge tone={factStatusTone(f.status)} className="mt-1">
                  {factStatusLabel(f.status)}
                </Badge>
              ) : (
                <p className="text-2xs text-stone">{factStatusLabel(f.status)}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Correct ${fieldLabel(f.label)}`}
              onClick={() => onCorrect(f)}
            >
              <Pencil className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CorrectDialog({
  enquiry,
  fact,
  onClose,
  sheet,
}: {
  enquiry: Enquiry;
  fact: EnquiryFact | null;
  onClose: () => void;
  sheet?: boolean;
}) {
  const correctFact = usePrototype((s) => s.correctFact);
  const demoMode = usePrototype((s) => s.demoMode);
  const actions = useFirstBetaActions();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setValue(fact?.displayValue ?? "");
  }, [fact]);

  /**
   * Apply a correction where it actually belongs.
   *
   * This used to call the client store in every mode: a success toast, a local
   * audit line, no network request, nothing persisted, no recomputed price, and
   * the whole thing gone on reload. A live correction now goes through the same
   * server path as any other confirmation - tenancy re-derived, the fact
   * superseded and re-inserted inside one transaction, the decision recomputed,
   * the revision bumped, an audit row written - and the store is refreshed FROM
   * that response rather than optimistically ahead of it, so what the desk shows
   * is what the database holds.
   */
  const apply = async (next: string, display: string) => {
    if (!fact) return;
    const route = correctionRoute(fact.field, demoMode);
    if (route.kind === "demo") {
      correctFact(enquiry.id, fact.id, next, display);
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res =
        route.kind === "service"
          ? await actions.setService(enquiry.id, next.trim())
          : await actions.answerFact(enquiry.id, route.field, next.trim());
      onClose();
      toast.success(
        res.action === "SEND_QUOTE" ? "Corrected. The price is updated." : res.explanation,
      );
    } catch (err) {
      // The server refuses a value it cannot price from - a range, alternatives,
      // a negative - exactly as it does for a first answer. Say so and leave the
      // dialog open so the owner can fix it, rather than closing on a failure.
      toast.error(err instanceof Error ? err.message : "Could not save that correction.");
    } finally {
      setSaving(false);
    }
  };

  if (!fact) return null;
  const alts = fact.alternatives ?? [];
  const Panel = sheet ? SheetContent : DialogContent;
  return (
    <Dialog open={Boolean(fact)} onOpenChange={(o) => !o && onClose()}>
      <Panel title={`Correct ${fieldLabel(fact.label)}`}>
        {alts.length ? (
          <div className="space-y-2">
            <p className="text-sm text-ink-2">Pick the interpretation Enquiry should use.</p>
            {alts.map((a) => (
              <Button
                key={a}
                variant="secondary"
                className="min-h-11 w-full justify-start"
                disabled={saving}
                onClick={() => void apply(a, alternativeLabel(a))}
              >
                {alternativeLabel(a)}
              </Button>
            ))}
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void apply(value, value);
            }}
          >
            <label className="block text-sm">
              <span className="mb-1 block text-stone">{fieldLabel(fact.label)}</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="field h-11"
              />
            </label>
            <p className="text-xs text-stone">
              {fact.customerSpecific
                ? "This looks customer-specific. It will stay on this enquiry."
                : "If this is how the business works, Enquiry will ask whether to learn it."}
            </p>
            <Button type="submit" className="min-h-11 w-full" disabled={saving}>
              {saving ? "Saving…" : "Update fact"}
            </Button>
          </form>
        )}
      </Panel>
    </Dialog>
  );
}
