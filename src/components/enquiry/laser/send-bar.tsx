import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Enquiry } from "@/domain/types";
import type { LaserNext } from "@/domain/laser";
import { replyChannel } from "@/domain/channel";
import { warningsKey } from "@/domain/edit-warnings";
import { dollarMatches } from "@/domain/voice-detect";
import {
  SEND_TEXT,
  YES_GUARD_MS,
  clockTime,
  copyText,
  sendLine,
  type SendLine,
} from "@/domain/send-flow";
import { usePrototype } from "@/store/prototype-store";
import { useFirstBetaActions } from "@/lib/workspace/live-mutations";
import type { CheckState } from "./use-send-check";

type Copied = {
  /** The reviewed artefact copied; "" on the client-only practice and demo path. */
  id: string;
  body: string;
  at: string;
  /** "Sent it?" asked again on return, or for an earlier version of the reply. */
  restored: "return" | "earlier" | null;
  /** The warnings key the owner copied over, sent with Yes. */
  ack?: string;
};

type Phase =
  | { kind: "ready" }
  | { kind: "review" }
  | { kind: "copied"; copy: Copied; failed: boolean }
  | { kind: "recording"; copy: Copied }
  | { kind: "stale"; copy: Copied; message: string }
  | { kind: "warnings"; copy: Copied; warnings: string[] }
  | { kind: "network"; copy: Copied }
  | { kind: "refused"; copy: Copied; message: string };

export type Recorded = { messageId: string | null; duplicate: boolean; practice: boolean };

/** The phase a screen opens in: asking "Sent it?" again for a copy left unanswered. */
function initialPhase(enquiry: Enquiry, text: string): Phase {
  const mark = enquiry.copied;
  if (!mark) return { kind: "ready" };
  const same = mark.body.trim() === text.trim();
  return {
    kind: "copied",
    failed: false,
    copy: {
      id: mark.reviewedSendId,
      body: mark.body,
      at: mark.at,
      restored: same ? "return" : "earlier",
    },
  };
}

/**
 * Slot E: the send line and the one action (doc 50 section 7). Copy writes
 * exactly the checked text on screen; only "Yes, I sent it" records, with the
 * artefact the server froze; Yes is never the filled button until the owner
 * has left the page and come back, and is held off for 600ms after it
 * appears so a double tap on Copy can never attest a send.
 */
export function SendBar({
  enquiry,
  next,
  text,
  check,
  onRetry,
  allSeen,
  practice,
  demo,
  selectReply,
  refusedFix,
  openLink,
  hidden,
  idleHint,
  onRecorded,
}: {
  enquiry: Enquiry;
  next: Extract<LaserNext, { kind: "send" }>;
  text: string;
  check: CheckState;
  onRetry: () => void;
  allSeen: boolean;
  practice: boolean;
  demo: boolean;
  selectReply: () => void;
  refusedFix: ReactNode;
  openLink: { label: string; href: string } | null;
  hidden: boolean;
  idleHint: boolean;
  onRecorded: (recorded: Recorded) => void;
}) {
  const actions = useFirstBetaActions();
  const approve = usePrototype((s) => s.approve);
  const tz = usePrototype((s) => s.prefs.timezone) || undefined;
  const [phase, setPhase] = useState<Phase>(() => initialPhase(enquiry, text));
  const [left, setLeft] = useState(false);
  const [guarded, setGuarded] = useState(false);
  const [unstuck, setUnstuck] = useState(false);
  const [say, setSay] = useState<{ text: string; urgent: boolean } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const askRef = useRef<HTMLParagraphElement>(null);
  const recording = useRef(false);
  const clientOnly = practice || demo;
  const ok = check.status === "ok" && check.text === text ? check.result : null;
  const warnings = ok?.warnings ?? [];
  const copyPhase = phase.kind === "ready" || phase.kind === "review" ? null : phase.copy;

  // Left and came back after the copy: only then is Yes the filled button.
  useEffect(() => {
    if (!copyPhase) return;
    setLeft(false);
    let away = false;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") away = true;
      else if (away) setLeft(true);
    };
    const onBlur = () => {
      away = true;
    };
    const onFocus = () => {
      if (away) setLeft(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [copyPhase?.id, copyPhase?.at]);

  // Yes is visibly disabled for the first 600ms after it appears.
  useEffect(() => {
    if (phase.kind !== "copied") return;
    setGuarded(true);
    const t = window.setTimeout(() => setGuarded(false), YES_GUARD_MS);
    return () => window.clearTimeout(t);
  }, [phase.kind, copyPhase?.at]);

  // A bar taller than a quarter of the screen (200% text) stops sticking, and
  // then the first Copy opens the review panel so the send facts are seen.
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setUnstuck(el.offsetHeight > window.innerHeight * 0.25);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const quote =
    next.fold ||
    enquiry.decision.recommendation.action === "SEND_QUOTE" ||
    enquiry.decision.recommendation.action === "SEND_ESTIMATE";
  const line: SendLine = sendLine(enquiry, clientOnly ? localAmount(enquiry, text) : ok, quote);

  const copied = (copy: Copied, failed: boolean) => {
    setPhase({ kind: "copied", copy, failed });
    setSay({ text: failed ? SEND_TEXT.failed : SEND_TEXT.copied, urgent: failed });
    window.setTimeout(() => askRef.current?.focus(), 0);
  };

  const onCopy = () => {
    // A high-risk send, or a bar too tall to stick: the facts first, then Copy.
    if ((next.review || unstuck) && phase.kind !== "review") {
      setPhase({ kind: "review" });
      return;
    }
    if (!clientOnly && !ok) return;
    const body = text;
    const copy: Copied = {
      id: ok?.reviewedSendId ?? "",
      body,
      at: new Date().toISOString(),
      restored: null,
      ...(warnings.length ? { ack: warningsKey(warnings) } : {}),
    };
    copyText(body).then(
      () => {
        copied(copy, false);
        if (copy.id) void markCopied(enquiry.id, copy.id);
      },
      () => {
        selectReply();
        copied(copy, true);
      },
    );
  };

  const copyAgain = (copy: Copied) => {
    copyText(copy.body).then(
      () => copied({ ...copy, at: copy.at }, false),
      () => {
        selectReply();
        copied(copy, true);
      },
    );
  };

  const notYet = () => {
    setPhase({ kind: "ready" });
    setSay(null);
    if (!clientOnly) void clearCopied(enquiry.id);
  };

  const record = async (copy: Copied, opts: { stale?: boolean; ack?: string } = {}) => {
    if (recording.current) return;
    if (clientOnly) {
      if (demo) approve(enquiry.id);
      onRecorded({ messageId: null, duplicate: false, practice });
      return;
    }
    recording.current = true;
    setPhase({ kind: "recording", copy });
    try {
      let id = copy.id;
      let res = await actions.recordSent(enquiry.id, id, {
        staleAttestation: opts.stale ?? false,
        ...((opts.ack ?? copy.ack) ? { acknowledgedWarnings: opts.ack ?? copy.ack } : {}),
      });
      // Removed by an Undo meanwhile: prepare the copied text again once, then retry.
      if (!res.ok && res.reason === "missing") {
        const again = await actions.prepareReview(enquiry.id, copy.body, replyChannel(enquiry));
        if (again.ok) {
          id = again.reviewedSendId;
          res = await actions.recordSent(enquiry.id, id, {
            staleAttestation: opts.stale ?? false,
            ...(again.warnings.length ? { acknowledgedWarnings: warningsKey(again.warnings) } : {}),
          });
        }
      }
      if (res.ok) {
        setSay({ text: SEND_TEXT.recorded, urgent: false });
        onRecorded({ messageId: res.messageId, duplicate: res.duplicate, practice: false });
        return;
      }
      const at = { ...copy, id };
      if (res.reason === "stale") setPhase({ kind: "stale", copy: at, message: res.message });
      else if (res.reason === "warnings") {
        setPhase({ kind: "warnings", copy: at, warnings: res.warnings ?? [] });
      } else setPhase({ kind: "refused", copy: at, message: res.message });
    } catch {
      setPhase({ kind: "network", copy });
    } finally {
      recording.current = false;
    }
  };

  const markCopied = (enquiryId: string, reviewedSendId: string) =>
    import("@/lib/server/laser-actions")
      .then(({ markReplyCopied }) => markReplyCopied({ data: { enquiryId, reviewedSendId } }))
      .catch(() => undefined);
  const clearCopied = (enquiryId: string) =>
    import("@/lib/server/laser-actions")
      .then(({ clearReplyCopied }) => clearReplyCopied({ data: { enquiryId } }))
      .catch(() => undefined);

  const live = (
    <p className="sr-only" aria-live={say?.urgent ? "assertive" : "polite"}>
      {say?.text ?? ""}
    </p>
  );

  if (copyPhase) {
    const status =
      phase.kind === "copied" && phase.failed
        ? SEND_TEXT.failed
        : copyPhase.restored === "return"
          ? SEND_TEXT.copiedOnReturn(clockTime(copyPhase.at, tz))
          : copyPhase.restored === "earlier"
            ? SEND_TEXT.copiedEarlier(clockTime(copyPhase.at, tz))
            : SEND_TEXT.copied;
    const filledYes = left && phase.kind === "copied" && !phase.failed;
    return (
      <div
        ref={barRef}
        className="laser-bar"
        data-hidden={hidden || undefined}
        data-unstuck={unstuck || undefined}
        role="group"
        aria-labelledby="laser-sent-ask"
      >
        {live}
        {phase.kind === "stale" || phase.kind === "refused" ? (
          <p className="laser-bar-line text-warn" data-count="server">
            {phase.message}
          </p>
        ) : phase.kind === "warnings" ? (
          <p className="laser-bar-line text-warn" data-count="server">
            Before recording: {phase.warnings.join(" ")}
          </p>
        ) : phase.kind === "network" ? (
          <p className="laser-bar-line text-warn">{SEND_TEXT.networkOnRecord}</p>
        ) : (
          <p
            ref={askRef}
            id="laser-sent-ask"
            tabIndex={-1}
            className="laser-bar-line"
            data-tone={phase.kind === "copied" && phase.failed ? "warn" : undefined}
          >
            {status}
            {phase.kind === "copied" ? (
              <button
                type="button"
                className="laser-link laser-copy-again"
                onClick={() => copyAgain(copyPhase)}
              >
                Copy again
              </button>
            ) : null}
          </p>
        )}
        <div className="laser-bar-actions">
          {phase.kind === "stale" ? (
            <Button
              className="laser-bar-button"
              onClick={() => void record(copyPhase, { stale: true })}
            >
              I already sent that older message
            </Button>
          ) : phase.kind === "warnings" ? (
            <Button
              className="laser-bar-button"
              onClick={() => void record(copyPhase, { ack: warningsKey(phase.warnings) })}
            >
              Record it anyway
            </Button>
          ) : phase.kind === "network" ? (
            <Button className="laser-bar-button" onClick={() => void record(copyPhase)}>
              Try again
            </Button>
          ) : phase.kind === "refused" ? null : (
            <Button
              className="laser-bar-button"
              variant={filledYes ? "primary" : "secondary"}
              disabled={guarded || phase.kind === "recording"}
              onClick={() => void record(copyPhase)}
            >
              {phase.kind === "recording" ? "Recording..." : "Yes, I sent it"}
            </Button>
          )}
          <Button className="laser-bar-button" variant="secondary" onClick={notYet}>
            Not yet
          </Button>
        </div>
      </div>
    );
  }

  const checking = !clientOnly && (check.status === "checking" || (check.status === "off" && !ok));
  const refused =
    !clientOnly && check.status === "refused" && check.text === text ? check.result : null;
  const failed = !clientOnly && check.status === "failed";
  const alreadyRecorded = Boolean(ok?.alreadyConfirmed);
  const label = warnings.length ? "Copy anyway" : next.label;
  return (
    <div
      ref={barRef}
      className="laser-bar"
      data-hidden={hidden || undefined}
      data-unstuck={unstuck || undefined}
    >
      {live}
      {refused ? (
        <p className="laser-bar-line text-danger">
          Can't copy: {firstSentence(refused.message)}{" "}
          <a className="laser-link" href="#laser-notices">
            Details
          </a>
        </p>
      ) : failed ? (
        <p className="laser-bar-line text-warn">{SEND_TEXT.checkFailed}</p>
      ) : (
        <SendLineView line={line} checking={checking} />
      )}
      {phase.kind === "review" ? <ReviewPanel enquiry={enquiry} line={line} /> : null}
      {idleHint && !refused && !failed ? <p className="laser-hint">{SEND_TEXT.idleHint}</p> : null}
      <div className="laser-bar-actions">
        {refused ? (
          refusedFix
        ) : failed ? (
          <Button className="laser-bar-button" onClick={onRetry}>
            Try again
          </Button>
        ) : alreadyRecorded ? null : (
          <Button
            className="laser-bar-button"
            disabled={checking || (!clientOnly && !ok) || (warnings.length > 0 && !allSeen)}
            aria-busy={checking || undefined}
            onClick={onCopy}
          >
            {label}
          </Button>
        )}
        {openLink && ok && !alreadyRecorded ? (
          <Button asChild variant="secondary" className="laser-bar-button">
            <a href={openLink.href} onClick={onCopy}>
              {openLink.label}
            </a>
          </Button>
        ) : null}
      </div>
      {warnings.length > 0 && !allSeen ? (
        <a className="laser-link" href="#laser-warnings">
          {warnings.length === 1 ? "1 thing to check" : `${warnings.length} things to check`}
        </a>
      ) : null}
    </div>
  );
}

/** Practice and demo never reach the server check: the amount is read from the text itself. */
function localAmount(enquiry: Enquiry, text: string) {
  const price = enquiry.decision.fold?.price ?? enquiry.decision.price;
  const said = new Set(dollarMatches(text).map((m) => Math.round(m.amount * 100)));
  if (!price) return { namesAmount: false, amountMinor: null, rangeMinor: null };
  if (price.kind === "EXACT") {
    return {
      namesAmount: said.has(price.amountMinor),
      amountMinor: price.amountMinor,
      rangeMinor: null,
    };
  }
  return {
    namesAmount: said.has(price.minMinor) && said.has(price.maxMinor),
    amountMinor: null,
    rangeMinor: { min: price.minMinor, max: price.maxMinor },
  };
}

function firstSentence(text: string): string {
  const m = /^.*?[.!?](?=\s|$)/.exec(text.trim());
  return m ? m[0] : text;
}

function SendLineView({ line, checking }: { line: SendLine; checking: boolean }) {
  return (
    <p className="laser-bar-line laser-send-line">
      {line.recipient ? (
        <span>
          To <span data-count="customer">{line.recipient}</span>
          {line.fromMessage ? " (from their message)" : ""}
        </span>
      ) : (
        <span className="text-warn">No recipient on file - reach them yourself</span>
      )}
      <span aria-hidden> · </span>
      <span>{line.channel}</span>
      {line.amount ? (
        <>
          <span aria-hidden> · </span>
          {line.amount.tone === "checking" || checking ? (
            <span className="laser-checking">
              <Loader2 size={14} className="laser-spin" aria-hidden /> checking
            </span>
          ) : (
            <span data-tone={line.amount.tone} className="laser-amount-text">
              {line.amount.text}
            </span>
          )}
        </>
      ) : null}
    </p>
  );
}

/** Every send fact together before a high-risk copy (doc 50 7.1 risk rule). */
function ReviewPanel({ enquiry, line }: { enquiry: Enquiry; line: SendLine }) {
  return (
    <div className="laser-review" role="region" aria-label="Check before you copy">
      <p>
        <span className="laser-review-key">Channel</span> {line.channel}
      </p>
      <p>
        <span className="laser-review-key">To</span>{" "}
        {line.recipient || "No recipient on file - reach them yourself"}
      </p>
      {line.amount && line.amount.tone !== "checking" ? (
        <p>
          <span className="laser-review-key">Amount</span> {line.amount.text}
        </p>
      ) : null}
      <p data-count="server">{enquiry.decision.recommendation.reason}</p>
      <p className="text-warn">This requires your personal review.</p>
    </div>
  );
}
