import { useEffect, useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { derivedLabel, EVALUATOR_LABELS, formatAud, commercialValue } from "@/domain/labels";
import { CommercialValueMark } from "@/components/ui/commercial-value";
import { statusTone } from "@/domain/status-tone";
import { channelLabel, identityLine, isShortChannel } from "@/domain/format";
import { integrationForChannel, replyChannel } from "@/domain/channel";
import {
  alternativeLabel,
  enquirySituation,
  isSendableAction,
  outboundBlocked,
} from "@/domain/situation";
import type { Enquiry, EnquiryFact, EvaluatorResult } from "@/domain/types";
import { cn } from "@/lib/utils";
import { usePrototype } from "@/store/prototype-store";
import { BUSINESS_BY_ID } from "@/fixtures";
import { resolveBusiness } from "@/lib/workspace/resolve-business";
import { SituationCard } from "./situation-card";
import { QuoteSheets, quoteSheets } from "./quote-sheet";
import { WaitingDesk } from "./waiting-desk";
import { detectPriceDrift, detectSheetLetterMismatch, alignLetterToSheet } from "@/domain/voice-detect";
import { CaseFile } from "./case-file";
import { needsSendConfirm, resolvedHold } from "@/domain/commercial";
import { toastUndo } from "@/lib/toast-undo";
import { toast } from "sonner";
import { HearLetter } from "./hear-letter";

export function Intelligence({
  enquiry,
  compact = false,
  onDone,
}: {
  enquiry: Enquiry;
  compact?: boolean;
  onDone?: () => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [correcting, setCorrecting] = useState<EnquiryFact | null>(null);
  const [draftOpen, setDraftOpen] = useState(!compact);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const approve = usePrototype((s) => s.approve);
  const snooze = usePrototype((s) => s.snooze);
  const declineLetter = usePrototype((s) => s.declineLetter);
  const setNote = usePrototype((s) => s.setNote);
  const drafts = usePrototype((s) => s.drafts);
  const editDraft = usePrototype((s) => s.editDraft);
  const considerVoice = usePrototype((s) => s.considerVoice);
  const decideVoice = usePrototype((s) => s.decideVoice);
  const voiceNotice = usePrototype((s) => s.voiceNotice);
  const lastChange = usePrototype((s) => s.lastChangeAt[enquiry.id]);
  const firstHint = usePrototype((s) => s.firstHint);
  const dismissHint = usePrototype((s) => s.dismissHint);
  const confirmExternal = usePrototype((s) => s.confirmExternalBooking);
  const track = usePrototype((s) => s.track);
  const businesses = usePrototype((s) => s.businesses);
  const demoMode = usePrototype((s) => s.demoMode);
  const offline = usePrototype((s) => s.offline);
  const connect = usePrototype((s) => s.connectIntegration);
  const business = resolveBusiness(businesses, enquiry.businessId, { demoMode, fixtures: BUSINESS_BY_ID });
  const rec = enquiry.decision.recommendation;
  const applicable = enquiry.decision.evaluators.filter((e) => e.status !== "NOT_APPLICABLE");
  const pricing = applicable.find((e) => e.type === "pricing");
  const capacity = applicable.find((e) => e.type === "capacity");
  const commercial = commercialValue(enquiry);
  const grounded = groundedSummary(enquiry);
  const situation = enquirySituation(enquiry, business);
  const evaluating = situation?.kind === "evaluating";
  const draftBody = drafts[enquiry.id] ?? enquiry.decision.draft.body;
  const priceDrift = detectPriceDrift(enquiry.decision.draft.body, draftBody);
  const sheets = quoteSheets(enquiry);
  const focusQuote =
    [...sheets].reverse().find((q) => q.status === "draft" || q.status === "accepted") ?? sheets[sheets.length - 1];
  const hold = resolvedHold(focusQuote);
  const sheetFigures = { total: focusQuote?.total?.amount, hold: hold?.amount };
  const sheetDrift = detectSheetLetterMismatch(draftBody, sheetFigures);

  useEffect(() => {
    const t = window.setTimeout(() => considerVoice(enquiry.id), 700);
    return () => window.clearTimeout(t);
  }, [enquiry.id, draftBody, considerVoice]);
  const blocked = outboundBlocked(business, offline, enquiry);
  const sendable = isSendableAction(rec.action);
  const reply = replyChannel(enquiry);
  const short = isShortChannel(reply);
  const integ = integrationForChannel(business, reply, enquiry);
  const Panel = compact ? SheetContent : DialogContent;

  return (
    <div
      className={cn(
        "flex flex-col bg-raised xl:border-l xl:border-line",
        compact ? "min-h-0 flex-1 overflow-hidden" : "h-full min-h-0 overflow-y-auto",
      )}
    >
      <div className={cn(compact ? "flex min-h-0 flex-1 flex-col overflow-hidden" : undefined)}>
      {!compact ? (
      <header className="border-b border-line px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">
              {business?.name} · {channelLabel(enquiry.source)}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight">
              {enquiry.customerName}
            </h1>
            <p className="mt-1 text-sm text-ink-2">{identityLine(enquiry)}</p>
            <p className="mt-1.5 text-sm text-ink-2">
              {enquiry.serviceLabel}
              {enquiry.dateLabel ? ` · ${enquiry.dateLabel}` : ""}
              {enquiry.locationLabel ? ` · ${enquiry.locationLabel}` : ""}
            </p>
          </div>
          <Badge tone={statusTone(enquiry)}>{derivedLabel(enquiry.state, enquiry)}</Badge>
        </div>
      </header>
      ) : null}

      {firstHint && !compact && (enquiry.fixtureId === "F01" || enquiry.fixtureId === "LIVE") ? (
        <div className="border-b border-line px-5 py-3" role="status">
          <div className="callout bg-paper-2 text-ink">
            <p className="text-sm font-medium">Already decided.</p>
            <p className="mt-1 text-sm text-ink-2">
              Enquiry has already read the request, checked how this business works, and recommended a next step. Open Why? for the evidence. Send only if it looks right.
            </p>
            <button
              type="button"
              className="mt-2 min-h-11 text-sm font-medium underline-offset-4 hover:underline"
              onClick={() => dismissHint()}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      {enquiry.notes ? (
        <div className={cn("border-b border-line px-5", compact ? "py-3" : "py-3")}>
          {compact ? null : <p className="eyebrow">Note</p>}
          <p className={cn("text-sm leading-relaxed text-ink-2", !compact && "mt-1")}>{enquiry.notes}</p>
        </div>
      ) : null}

      {lastChange ? (
        <div className="border-b border-line px-5 py-3" role="status">
          <div className="callout bg-ok-bg text-ok animate-[rise-in_320ms_var(--ease-smooth-out)]">
            <p className="text-sm font-medium">Decision updated.</p>
            {enquiry.decision.changeDiff?.length ? (
              <ul className="mt-1 space-y-0.5 text-ink-2">
                {enquiry.decision.changeDiff.map((d) => (
                  <li key={d.factLabel}>
                    <span className="font-medium text-ink">{d.factLabel}:</span> {d.from} → {d.to}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {situation ? <SituationCard enquiry={enquiry} situation={situation} compact={compact} /> : null}

      {enquiry.followUpDue && enquiry.followUpReason ? (
        <div className={cn("border-b border-line px-5", compact ? "py-3" : "py-4")} role="status">
          <p className="text-sm font-medium">Follow-up ready</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{enquiry.followUpReason}</p>
        </div>
      ) : null}

      {!evaluating ? (
      <>
      {compact ? null : (
      <section className="border-b border-line px-5 py-5" aria-labelledby="rec-heading">
        {situation && !sendable ? (
          <p id="rec-heading" className="text-sm leading-relaxed text-ink-2">
            {rec.reason}
          </p>
        ) : (
          <>
            <p id="rec-heading" className="eyebrow">
              Recommendation
            </p>
            <p className="mt-2 text-xl font-semibold leading-snug tracking-tight">{rec.label}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{rec.reason}</p>
          </>
        )}
        <div className={cn("flex flex-wrap items-center gap-3", situation && !sendable ? "mt-3" : "mt-4")}>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            onClick={() => {
              setWhyOpen(true);
              track(enquiry.fixtureId, "open_why");
            }}
          >
            <CircleHelp className="size-4" aria-hidden />
            Why?
          </button>
          <span className="text-xs text-stone">Confidence {enquiry.decision.confidence}</span>
          {enquiry.decision.risk === "PROHIBITED_AUTO" ? (
            <Badge tone="danger">Autopilot blocked</Badge>
          ) : enquiry.decision.automationEligible ? (
            <Badge tone="ok">Autopilot-ready</Badge>
          ) : null}
        </div>
      </section>
      )}

      {!compact && (enquiry.decision.automationEligible || enquiry.decision.failedGates.length > 0) ? (
        <section className="border-b border-line px-5 py-5">
          <p className="eyebrow">Autopilot</p>
          {enquiry.decision.automationEligible ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              This action class has evidence. Nothing sends on its own until you allow it in Trust. High-risk classes stay blocked.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-ink-2">
              {enquiry.decision.failedGates.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {enquiry.decision.missing.length > 0 && !(compact && (situation || sendable)) ? (
        <section className={cn("border-b border-line px-5", compact ? "py-4" : "py-5")} aria-labelledby="missing-heading">
          <p id="missing-heading" className={compact ? "text-sm font-medium" : "eyebrow"}>
            {compact ? "Still needed" : "Blocking the next decision"}
          </p>
          <ul className="mt-3 space-y-2">
            {enquiry.decision.missing.map((m) => (
              <li key={m.factField} className="callout bg-warn-bg text-warn">
                <p className="text-sm font-medium">{m.label}</p>
                {compact ? null : (
                  <p className="mt-0.5 text-sm text-ink-2">
                    {m.reason} Unlocks: {m.unlocks}.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {quoteSheets(enquiry).length > 0 ? (
        <QuoteSheets enquiry={enquiry} business={business} compact={compact} />
      ) : compact || commercial.kind === "not_applicable" ? null : (
      <section className="border-b border-line px-5 py-5" aria-labelledby="value-heading">
        <p id="value-heading" className="eyebrow">
          Commercial value
        </p>
        <CommercialValueMark className="mt-3" value={commercial} size="lg" />
      </section>
      )}

      {!compact && applicable.length > 0 ? (
      <section className="border-b border-line px-5 py-5" aria-labelledby="evals-heading">
        <p id="evals-heading" className="eyebrow">
          What can be decided now
        </p>
        <dl className="mt-3 space-y-2">
          {pricing ? <EvaluatorRow result={pricing} omitAmount /> : null}
          {capacity ? <EvaluatorRow result={capacity} /> : null}
          {applicable
            .filter((e) => e.type !== "pricing" && e.type !== "capacity")
            .map((e) => (
              <EvaluatorRow key={e.type} result={e} />
            ))}
        </dl>
        {enquiry.fixtureId === "F17" ? (
          <p className="mt-3 text-xs text-stone">
            Compare with F01 (Glow). Same card, different evaluators — price and capacity stay hidden when they are not applicable.
          </p>
        ) : null}
      </section>
      ) : null}

      {!compact ? (
      <section className="border-b border-line px-5 py-5" aria-labelledby="facts-heading">
        <p id="facts-heading" className="eyebrow">
          What Enquiry understood
        </p>
        <FactList
          heading="This enquiry only"
          facts={enquiry.facts.filter((f) => !f.superseded && f.customerSpecific)}
          onCorrect={setCorrecting}
        />
        <FactList
          heading="From the request"
          facts={enquiry.facts.filter((f) => !f.superseded && !f.customerSpecific)}
          onCorrect={setCorrecting}
        />
      </section>
      ) : null}

      {!compact && !evaluating ? <CaseFile enquiry={enquiry} /> : null}

      {compact ? (
      <section className="flex min-h-0 flex-1 flex-col px-5 pb-2 pt-1">
        <button
          type="button"
          className="min-h-32 flex-1 overflow-y-auto rounded-xl bg-raised px-4 py-4 text-left shadow-border active:bg-paper"
          onClick={() => setDraftOpen(true)}
          aria-label="Edit reply"
        >
          <p className="eyebrow">Reply</p>
          <p
            className={cn(
              "letter-body mt-3 whitespace-pre-wrap",
              short ? "font-sans" : "font-serif",
            )}
          >
            {draftBody || "No message prepared."}
          </p>
        </button>
        {priceDrift ? (
          <p className="mt-3 text-sm text-warn">
            The quote on file is still {priceDrift.from}. This letter now says {priceDrift.to}.
          </p>
        ) : null}
        {sheetDrift ? (
          <div className="mt-3">
            <p className="text-sm text-warn">
              The sheet is {sheetDrift.sheet}. This letter says {sheetDrift.letter}.
            </p>
            <button
              type="button"
              className="mt-1 min-h-11 text-sm font-medium underline-offset-4 hover:underline"
              onClick={() => editDraft(enquiry.id, alignLetterToSheet(draftBody, sheetFigures))}
            >
              Use the sheet
            </button>
          </div>
        ) : null}
        {voiceNotice?.enquiryId === enquiry.id ? (
          <div className="callout mt-3 bg-paper-2 text-ink" role="status">
            <p className="text-sm font-medium">{voiceNotice.reason}</p>
            <p className="mt-1 text-sm text-ink-2">
              {voiceNotice.from} → {voiceNotice.to}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Button className="min-h-11 w-full" variant="secondary" onClick={() => decideVoice("enquiry")}>
                This enquiry only
              </Button>
              <Button className="min-h-11 w-full" onClick={() => decideVoice("teach")}>
                Update {business?.name ?? "this business"}’s voice
              </Button>
            </div>
          </div>
        ) : null}
      </section>
      ) : (
      <section className="px-5 py-5" aria-labelledby="draft-heading">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="flex min-h-11 flex-1 items-center justify-between text-left"
            onClick={() => setDraftOpen((v) => !v)}
            aria-expanded={draftOpen}
          >
            <p id="draft-heading" className="eyebrow">
              Prepared {short ? "message" : "reply"}
            </p>
            <ChevronDown
              className={cn(
                "size-4 text-stone transition-transform duration-150 ease-out",
                draftOpen && "rotate-180",
              )}
            />
          </button>
          <HearLetter text={draftBody} />
        </div>
        {draftOpen ? (
          <label className="mt-3 block">
            <span className="sr-only">Draft message</span>
            <textarea
              value={draftBody}
              onChange={(e) => editDraft(enquiry.id, e.target.value)}
              onBlur={() => considerVoice(enquiry.id)}
              rows={short ? 5 : 10}
              className={cn("field leading-relaxed", short ? "font-sans" : "font-serif")}
            />
          </label>
        ) : null}
        {priceDrift ? (
          <p className="mt-3 text-sm text-warn">
            The quote on file is still {priceDrift.from}. This letter now says {priceDrift.to}.
            Editing the reply does not change the price.
          </p>
        ) : null}
        {sheetDrift ? (
          <div className="mt-3">
            <p className="text-sm text-warn">
              The sheet is {sheetDrift.sheet}. This letter says {sheetDrift.letter}.
            </p>
            <button
              type="button"
              className="mt-1 min-h-11 text-sm font-medium underline-offset-4 hover:underline"
              onClick={() => editDraft(enquiry.id, alignLetterToSheet(draftBody, sheetFigures))}
            >
              Use the sheet
            </button>
          </div>
        ) : null}
        {voiceNotice?.enquiryId === enquiry.id ? (
          <div className="callout mt-3 bg-paper-2 text-ink" role="status">
            <p className="text-sm font-medium">{voiceNotice.reason}</p>
            <p className="mt-1 text-sm text-ink-2">
              {voiceNotice.from} → {voiceNotice.to}
            </p>
            <p className="mt-1 text-xs text-stone">
              Teaching updates {business?.name ?? "this business"}’s voice. Other open drafts will follow. Sent messages stay as sent.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => decideVoice("enquiry")}>
                This enquiry only
              </Button>
              <Button size="sm" onClick={() => decideVoice("teach")}>
                Update {business?.name ?? "this business"}’s voice
              </Button>
            </div>
          </div>
        ) : null}
        {grounded ? (
          <p className="mt-2 text-xs text-stone">Grounded in {grounded}.</p>
        ) : null}
      </section>
      )}
      </>
      ) : null}
      </div>

      <div className={cn("shrink-0 border-t border-line bg-raised px-5 py-3", compact && "pb-[max(0.75rem,var(--app-safe-bottom))]")}>
        {evaluating ? (
          <p className="text-sm text-stone">Wait until Enquiry finishes reading.</p>
        ) : enquiry.state.lifecycle === "BOOKED" ||
          (enquiry.state.decision === "WAITING_ON_CLIENT" &&
            (enquiry.state.commercial === "QUOTED" ||
              enquiry.state.commercial === "ESTIMATED" ||
              enquiry.state.commercial === "ACCEPTED")) ? (
          <WaitingDesk enquiry={enquiry} onDone={onDone} />
        ) : (
          <div className="flex flex-col gap-2">
            {compact && sendable ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center text-sm text-stone underline-offset-4 hover:text-ink hover:underline"
                onClick={() => {
                  setWhyOpen(true);
                  track(enquiry.fixtureId, "open_why");
                }}
              >
                Why this?
              </button>
            ) : null}
            {sendable ? (
              <Button
                className={cn("w-full", compact ? "min-h-14 text-base" : "min-h-11")}
                disabled={!rec.primaryEnabled || Boolean(rec.blockedReason) || Boolean(blocked)}
                onClick={() => {
                  if (needsSendConfirm(enquiry)) {
                    setSendConfirm(true);
                    return;
                  }
                  approve(enquiry.id);
                  toastUndo("Sent.");
                  if (!compact) onDone?.();
                }}
              >
                {rec.label}
              </Button>
            ) : situation ? (
              <p className="text-sm text-ink-2">Settle the detail above first.</p>
            ) : (
              <Button className="min-h-11 w-full" disabled>
                {rec.label}
              </Button>
            )}
            {blocked ? (
              <div className="space-y-2">
                <p className="text-sm text-warn">{blocked}</p>
                {integ && integ.status !== "connected" && business ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-11 w-full"
                    onClick={() => {
                      connect(business.id, integ.id);
                      toast(`${integ.provider} connected. Enquiry will keep reading.`);
                    }}
                  >
                    Connect {integ.provider}
                  </Button>
                ) : null}
              </div>
            ) : rec.blockedReason ? (
              <p className="text-sm text-danger">{rec.blockedReason}</p>
            ) : sendable && !compact ? (
              <p className="text-xs text-stone">
                One primary action. Editing the draft does not change
                {commercial.kind === "not_applicable" ? " the decision." : " the price or feasibility."}
              </p>
            ) : null}
            {sendable || enquiry.state.lifecycle === "OPEN" ? (
              compact ? null : (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setNoteOpen(true)}
                >
                  Note
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    snooze(enquiry.id);
                    toastUndo("Snoozed for two days.");
                    onDone?.();
                  }}
                >
                  Snooze
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    declineLetter(enquiry.id);
                    toastUndo("Decline sent.");
                    onDone?.();
                  }}
                >
                  Decline
                </Button>
              </div>
              )
            ) : null}
            {enquiry.id === "f14" ? (
              <Button
                variant="secondary"
                className="min-h-11 w-full"
                onClick={() => {
                  confirmExternal(enquiry.id);
                  onDone?.();
                }}
              >
                Confirm booked externally
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <Dialog open={whyOpen} onOpenChange={setWhyOpen}>
        <Panel title="Why this">
          <ol className="space-y-3 text-sm">
            {enquiry.decision.why.map((w) => (
              <li key={w.id}>
                <p className="font-medium">{w.claim}</p>
                <p className="mt-1 text-ink-2">{w.evidence}</p>
                <p className="mt-1 text-xs text-stone">
                  {w.provenance.label}
                  {w.provenance.detail ? ` · ${w.provenance.detail}` : ""}
                </p>
              </li>
            ))}
          </ol>
          {compact ? (
            <ul className="mt-5 space-y-2 border-t border-line pt-4">
              {enquiry.facts
                .filter((f) => !f.superseded)
                .map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-2 py-1">
                    <div>
                      <p className="text-2xs text-stone">{f.label}</p>
                      <p className="text-sm">{f.displayValue || "—"}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Correct ${f.label}`}
                      onClick={() => {
                        setWhyOpen(false);
                        setCorrecting(f);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-4 text-xs text-stone">
              Decision Engine {enquiry.decision.evaluators.length} evaluators · High/Medium/Low is explanatory, not an automation switch.
            </p>
          )}
        </Panel>
      </Dialog>

      <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <Panel title="Evidence">
          <dl className="space-y-2">
            {pricing ? <EvaluatorRow result={pricing} /> : null}
            {capacity ? <EvaluatorRow result={capacity} /> : null}
            {applicable
              .filter((e) => e.type !== "pricing" && e.type !== "capacity")
              .map((e) => (
                <EvaluatorRow key={e.type} result={e} />
              ))}
          </dl>
          <ul className="mt-4 space-y-2">
            {enquiry.facts
              .filter((f) => !f.superseded)
              .map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-2 border-b border-line py-2 last:border-b-0">
                  <div>
                    <p className="text-2xs text-stone">{f.label}</p>
                    <p className="text-sm">{f.displayValue || "—"}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Correct ${f.label}`}
                    onClick={() => {
                      setEvidenceOpen(false);
                      setCorrecting(f);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </li>
              ))}
          </ul>
        </Panel>
      </Dialog>

      <CorrectDialog
        enquiry={enquiry}
        fact={correcting}
        onClose={() => setCorrecting(null)}
        sheet={compact}
      />

      <Dialog open={sendConfirm} onOpenChange={setSendConfirm}>
        <Panel title="Send this quote?">
          <p className="text-sm leading-relaxed text-ink-2">
            This is a commercial send. The sheet on file becomes the record. Editing the letter later will not change the figure.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              className="min-h-12 w-full"
              onClick={() => {
                approve(enquiry.id);
                setSendConfirm(false);
                toastUndo("Quote sent.");
                if (!compact) onDone?.();
              }}
            >
              {rec.label}
            </Button>
            <Button variant="secondary" className="min-h-11 w-full" onClick={() => setSendConfirm(false)}>
              Keep drafting
            </Button>
          </div>
        </Panel>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <Panel title="Note on this enquiry">
          <p className="text-sm text-ink-2">Stays on the case file. Not sent to the customer.</p>
          <textarea
            className="field mt-3 font-serif"
            rows={4}
            defaultValue={enquiry.notes ?? ""}
            id="enquiry-note"
          />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              className="min-h-11"
              onClick={() => {
                const el = document.getElementById("enquiry-note") as HTMLTextAreaElement | null;
                setNote(enquiry.id, el?.value ?? "");
                setNoteOpen(false);
              }}
            >
              Save note
            </Button>
            <Button variant="secondary" className="min-h-11" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      </Dialog>

      {compact ? (
        <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
          <SheetContent title={short ? "Message" : "Reply"}>
            <textarea
              value={draftBody}
              onChange={(e) => editDraft(enquiry.id, e.target.value)}
              onBlur={() => considerVoice(enquiry.id)}
              rows={short ? 6 : 10}
              className={cn("field min-h-40 leading-relaxed", short ? "font-sans" : "font-serif")}
            />
            {grounded ? <p className="mt-2 text-xs text-stone">Grounded in {grounded}.</p> : null}
            <div className="mt-3 flex justify-end">
              <HearLetter text={draftBody} compact />
            </div>
            <Button className="mt-4 min-h-12 w-full" onClick={() => setDraftOpen(false)}>
              Done
            </Button>
          </SheetContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function groundedSummary(enquiry: Enquiry): string | null {
  const ids = enquiry.decision.draft.groundedFacts;
  if (!ids?.length) return null;
  const parts = ids
    .map((id) => enquiry.facts.find((f) => f.id === id))
    .filter((f): f is EnquiryFact => Boolean(f?.displayValue) && f!.displayValue !== "—" && f!.displayValue !== "Not given")
    .map((f) => f.displayValue);
  return parts.length ? parts.join(" · ") : null;
}

function EvaluatorRow({ result, omitAmount }: { result: EvaluatorResult; omitAmount?: boolean }) {
  const assumed = result.status === "EXACT" && Boolean(result.assumptions?.length);
  const tone =
    assumed
      ? "warn"
      : result.status === "EXACT" || result.status === "FEASIBLE" || result.status === "PASS" || result.status === "VALIDATED"
      ? "ok"
      : result.status === "RANGE" || result.status === "FEASIBLE_WITH_CONDITION" || result.status === "UNKNOWN" || result.status === "UNKNOWN_MISSING_FACTS" || result.status === "UNKNOWN_INTEGRATION" || result.status === "REQUIRES_EXCEPTION"
        ? "warn"
        : result.status === "ERROR" || result.status === "INFEASIBLE" || result.status === "FAIL" || result.status === "NOT_QUOTABLE" || result.status === "BLOCKED"
          ? "danger"
          : "neutral";
  return (
    <div className="surface-md px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-2xs uppercase tracking-wider text-stone">{EVALUATOR_LABELS[result.type]}</dt>
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
        ? `Estimate ${formatAud(result.range.min)}–${formatAud(result.range.max)}`
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
      return "Unknown — missing facts";
    case "UNKNOWN_INTEGRATION":
      return "Unknown — cannot verify";
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

function factStatusLabel(status: EnquiryFact["status"]) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "inferred":
      return "Inferred";
    case "check_this":
      return "Check this";
    case "range":
      return "Range preserved";
    default:
      return "Unknown";
  }
}

function FactList({
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
              <p className="text-2xs text-stone">{f.label}</p>
              <p className={cn("text-sm", f.status === "check_this" && "text-warn")}>
                {f.displayValue || "—"}
              </p>
              <p className="text-2xs text-stone">{factStatusLabel(f.status)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Correct ${f.label}`}
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

function CorrectDialog({
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
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue(fact?.displayValue ?? "");
  }, [fact]);
  if (!fact) return null;
  const alts = fact.alternatives ?? [];
  const Panel = sheet ? SheetContent : DialogContent;
  return (
    <Dialog open={Boolean(fact)} onOpenChange={(o) => !o && onClose()}>
      <Panel title={`Correct ${fact.label}`}>
        {alts.length ? (
          <div className="space-y-2">
            <p className="text-sm text-ink-2">Pick the interpretation Enquiry should use.</p>
            {alts.map((a) => (
              <Button
                key={a}
                variant="secondary"
                className="min-h-11 w-full justify-start"
                onClick={() => {
                  correctFact(enquiry.id, fact.id, a, alternativeLabel(a));
                  onClose();
                }}
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
              correctFact(enquiry.id, fact.id, value, value);
              onClose();
            }}
          >
            <label className="block text-sm">
              <span className="mb-1 block text-stone">{fact.label}</span>
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
            <Button type="submit" className="min-h-11 w-full">
              Update fact
            </Button>
          </form>
        )}
      </Panel>
    </Dialog>
  );
}
