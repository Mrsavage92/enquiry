import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { KnowledgeItem } from "@/domain/types";
import { concreteWhen } from "@/domain/time-cues";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import {
  factEffect,
  factPayload,
  factSaid,
  factStateWord,
  factSourceWords,
} from "@/domain/fact-words";
import { readBusinessDetails, type BusinessDetailsRead } from "@/domain/business-details-read";
import { describeRule } from "@/domain/business-rule";
import { describeDetail, noteFor, type AnswerDetail } from "@/domain/business-detail";
import { bodyWithoutTitle } from "@/components/enquiry/card-cues";

type Row = KnowledgeItem & { rulePayload?: unknown };

/**
 * One saved fact on the Business screen, in the owner's words: what they
 * wrote, how Enquiry reads it, and what it does. Every rule, detail and price
 * the owner saved can be changed or removed here - a misread "You don't work
 * Saturdays" must never keep telling customers something untrue.
 */
export function FactRow({
  item,
  all,
  live,
  services,
  onResolve,
}: {
  item: Row;
  all: KnowledgeItem[];
  /** A real business (not the sample): its facts can be changed and removed. */
  live: boolean;
  services: string[];
  onResolve: (keep: string, drop: string) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const actions = useFirstBetaActions();
  const tone =
    item.state === "Needs review"
      ? "warn"
      : item.state === "Active"
        ? "ok"
        : item.state === "Superseded"
          ? "neutral"
          : "info";
  const other = item.conflictWith ? all.find((k) => k.id === item.conflictWith) : undefined;
  const said = factSaid(item);
  const payload = factPayload(item.rulePayload);
  const changeable = live && item.state === "Active" && payload !== null;
  const since = item.effectiveFrom
    ? /^\d{4}-\d{2}-\d{2}T/.test(item.effectiveFrom)
      ? concreteWhen(item.effectiveFrom)
      : item.effectiveFrom
    : undefined;

  const remove = async () => {
    setBusy(true);
    try {
      const res = await actions.retireFact(item.businessId, item.id);
      setRemoveOpen(false);
      const undo = payload
        ? () =>
            void actions
              .saveRules(
                item.businessId,
                payload.kind === "rule" ? [payload.value] : [],
                payload.kind === "detail" ? [payload.value] : [],
                said
                  ? payload.kind === "rule"
                    ? { rules: [said] }
                    : { details: [said] }
                  : undefined,
              )
              .then(() => toast.success("Put back."))
              .catch((err: unknown) =>
                toast.error(err instanceof Error ? err.message : "Could not put it back."),
              )
        : undefined;
      toast.success(
        res.updatedEnquiries > 0
          ? `Removed. ${res.updatedEnquiries} open ${res.updatedEnquiries === 1 ? "enquiry was" : "enquiries were"} worked out again without it.`
          : "Removed. No open enquiry used it.",
        undo ? { action: { label: "Undo", onClick: undo } } : undefined,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li data-testid="fact-row">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-medium leading-snug">{item.title}</h2>
        <Badge tone={tone}>{factStateWord(item.state)}</Badge>
      </div>
      {/* The heading already names the service: "$35 per metre", not
          "Fence painting: $35 per metre" under "Fence painting". */}
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        {bodyWithoutTitle(item.title, item.body)}
      </p>
      <p className="mt-1.5 text-xs text-stone">
        {factSourceWords(item.source.label)}
        {/* A concrete day, never "a while ago": the owner can tell how old it is. */}
        {item.stale
          ? since
            ? ` · not checked since ${since}`
            : " · due for a check"
          : since
            ? ` · ${since}`
            : ""}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-4">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          onClick={() => setDetailOpen(true)}
        >
          Details
        </button>
        {changeable ? (
          <>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-medium text-mark-strong underline-offset-4 hover:underline"
              onClick={() => setEditOpen(true)}
            >
              Edit
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-medium text-danger underline-offset-4 hover:underline"
              onClick={() => setRemoveOpen(true)}
            >
              Remove
            </button>
          </>
        ) : null}
      </div>
      {item.state === "Needs review" && other ? (
        <div className="mt-3">
          <Button size="sm" onClick={() => onResolve(item.id, other.id)}>
            Use this version
          </Button>
        </div>
      ) : item.conflictWith && item.state === "Needs review" ? (
        <p className="mt-2 text-sm text-warn">{item.conflictWith}</p>
      ) : null}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent title="How Enquiry reads this">
          <dl className="space-y-3 text-sm">
            {said ? (
              <div>
                <dt className="text-ink-2">You wrote</dt>
                <dd className="mt-0.5 text-ink">“{said}”</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-ink-2">Enquiry reads it as</dt>
              <dd className="mt-0.5 font-medium text-ink">{item.body}</dd>
            </div>
            {payload ? (
              <div>
                <dt className="text-ink-2">What it does</dt>
                <dd className="mt-0.5 text-ink">{factEffect(payload)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-ink-2">Where it came from</dt>
              <dd className="mt-0.5 text-ink">
                {factSourceWords(item.source.label)}
                {since ? `, ${since}` : ""}
              </dd>
            </div>
          </dl>
          {changeable ? (
            <p className="mt-4 text-sm text-ink-2">
              Not right? Edit it or remove it - open enquiries are worked out again straight away.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={(o) => !busy && setRemoveOpen(o)}>
        <DialogContent title="Remove this?">
          <p className="text-sm text-ink">{item.body}</p>
          <p className="mt-2 text-sm text-ink-2">
            Enquiry stops using it. Open enquiries are worked out again without it; replies you
            already sent are not changed.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={busy} onClick={() => void remove()}>
              {busy ? "Removing…" : "Remove it"}
            </Button>
            <Button
              className="min-h-11"
              variant="secondary"
              disabled={busy}
              onClick={() => setRemoveOpen(false)}
            >
              Keep it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editOpen && payload?.kind === "detail" && payload.value.kind === "answer" ? (
        <EditAnswer item={item} answer={payload.value} onClose={() => setEditOpen(false)} />
      ) : editOpen ? (
        <EditFact
          item={item}
          said={said ?? item.body}
          services={services}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
    </li>
  );
}

/**
 * Change a fact by rewriting it: the owner's own words come back in the box,
 * are read again exactly as a new detail is, and the preview says what it now
 * means before anything changes.
 */
function EditFact({
  item,
  said,
  services,
  onClose,
}: {
  item: Row;
  said: string;
  services: string[];
  onClose: () => void;
}) {
  const actions = useFirstBetaActions();
  const [text, setText] = useState(said);
  const [read, setRead] = useState<BusinessDetailsRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refused = read?.unread.filter((u) => !u.note) ?? [];
  const notes = read?.unread.filter((u) => u.note) ?? [];
  const count = (read?.prices.length ?? 0) + (read?.details.length ?? 0) + notes.length;

  const preview = () => {
    setError(null);
    if (!text.trim()) {
      setError("Write what it should say, or remove it instead.");
      return;
    }
    setRead(readBusinessDetails(text));
  };

  const save = async () => {
    if (!read) return;
    setBusy(true);
    try {
      const noteDetails = notes.map((u) => noteFor(u.line, services));
      const res = await actions.replaceFact(
        item.businessId,
        item.id,
        read.prices.map((p) => p.rule),
        [...read.details.map((d) => d.detail), ...noteDetails],
        {
          rules: read.prices.map((p) => p.line),
          details: [...read.details.map((d) => d.line), ...notes.map((u) => u.line)],
        },
      );
      onClose();
      toast.success(
        res.updatedEnquiries > 0
          ? `Changed. ${res.updatedEnquiries} open ${res.updatedEnquiries === 1 ? "enquiry was" : "enquiries were"} worked out again.`
          : "Changed. No open enquiry used it.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that change.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent title="Change this">
        <p className="text-sm text-ink-2">Now: {item.body}</p>
        <label className="mt-3 block text-sm" htmlFor={`edit-${item.id}`}>
          <span className="font-medium text-ink">Write it the way it should be</span>
        </label>
        <textarea
          id={`edit-${item.id}`}
          className="field mt-1.5 leading-relaxed"
          rows={3}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRead(null);
          }}
        />
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {read ? (
          <div className="mt-3 space-y-2 text-sm" data-testid="edit-fact-preview">
            <p className="font-medium text-ink">Enquiry will read it as:</p>
            <ul className="space-y-1 text-ink">
              {read.prices.map((p) => (
                <li key={`p-${p.line}`}>{describeRule(p.rule)}</li>
              ))}
              {read.details.map((d) => (
                <li key={`d-${d.line}`}>{describeDetail(d.detail)}</li>
              ))}
              {notes.map((u) => (
                <li key={`n-${u.line}`}>A note (never added to a price): {u.line}</li>
              ))}
            </ul>
            {refused.length ? (
              <div className="callout bg-warn-bg text-warn">
                <p className="font-medium">Not saved - Enquiry could not read:</p>
                <ul className="mt-1 space-y-1 text-ink-2">
                  {refused.map((u) => (
                    <li key={u.line}>{`"${u.line}" - ${u.reason}`}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {read && count > 0 && refused.length === 0 ? (
            <Button className="min-h-11" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save the change"}
            </Button>
          ) : (
            <Button className="min-h-11" disabled={busy} onClick={preview}>
              Preview
            </Button>
          )}
          <Button className="min-h-11" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A saved answer to a customer question is changed as an answer: the owner
 * rewrites the sentence, and it stays the answer to that question - never
 * re-read as a price or a note.
 */
function EditAnswer({
  item,
  answer,
  onClose,
}: {
  item: Row;
  answer: AnswerDetail;
  onClose: () => void;
}) {
  const actions = useFirstBetaActions();
  const [text, setText] = useState(answer.text);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const words = text.trim();
    if (words.length < 2) {
      setError("Write the answer in a sentence, or remove it instead.");
      return;
    }
    setBusy(true);
    try {
      await actions.replaceFact(item.businessId, item.id, [], [{ ...answer, text: words }], {
        details: [words],
      });
      onClose();
      toast.success("Changed. It's offered the next time a customer asks.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that change.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent title="Change your answer">
        <p className="text-sm text-ink-2">When asked: “{answer.question}”</p>
        <label className="mt-3 block text-sm" htmlFor={`answer-${item.id}`}>
          <span className="font-medium text-ink">Your answer</span>
        </label>
        <textarea
          id={`answer-${item.id}`}
          className="field mt-1.5 leading-relaxed"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="min-h-11" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save the change"}
          </Button>
          <Button className="min-h-11" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
