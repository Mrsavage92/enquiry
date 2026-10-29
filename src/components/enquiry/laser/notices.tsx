import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Business, Enquiry } from "@/domain/types";
import { integrationForChannel, replyChannel } from "@/domain/channel";
import { usePrototype } from "@/store/prototype-store";
import { keptEditNotice } from "../card-cues";
import { riskLines } from "@/domain/laser-view";

export type CoverageNote = { editKept?: string[]; recheck?: boolean };

/**
 * Slot D, directly under the reply: "Why this reply", then only what bears on
 * the next tap - a refusal, what to check, a risk, a drift or a kept edit
 * (doc 50 section 3). Server text is shown word for word.
 */
export function Notices({
  enquiry,
  business,
  onWhy,
  refused,
  refusedFix,
  warnings,
  warningRef,
  onWarningsFocus,
  blocked,
  alreadyRecorded,
  checkFailed,
  coverage,
  drift,
}: {
  enquiry: Enquiry;
  business: Business | undefined;
  onWhy: () => void;
  refused: string | null;
  refusedFix: ReactNode;
  warnings: readonly string[];
  warningRef: (index: number) => (el: HTMLElement | null) => void;
  onWarningsFocus: () => void;
  blocked: string | null;
  alreadyRecorded: boolean;
  checkFailed: boolean;
  coverage: CoverageNote | null;
  drift: ReactNode;
}) {
  const connect = usePrototype((s) => s.connectIntegration);
  const risks = riskLines(enquiry);
  const integ = integrationForChannel(business, replyChannel(enquiry), enquiry);
  const kept = coverage?.editKept?.length ? keptEditNotice(coverage.editKept) : null;
  return (
    <section className="laser-notices" aria-label="Before you copy" id="laser-notices">
      <button type="button" className="laser-link" onClick={onWhy}>
        Why this reply
      </button>
      {refused ? (
        <div className="callout bg-danger-bg text-danger" role="alert" data-testid="send-refused">
          <p className="text-sm font-medium">This reply can't be copied as it is</p>
          <p className="mt-1 text-sm text-ink" data-count="server">
            {refused}
          </p>
          {refusedFix}
        </div>
      ) : null}
      {checkFailed ? (
        <p className="callout bg-warn-bg text-sm text-warn" role="status">
          Couldn't check this reply.
        </p>
      ) : null}
      {alreadyRecorded ? (
        <p className="callout bg-paper-2 text-sm text-ink" role="status" data-count="server">
          This exact reply is already recorded as sent. To send the same words again, change one
          word.
        </p>
      ) : null}
      {warnings.length ? (
        <div
          className="callout bg-warn-bg text-warn"
          role="status"
          tabIndex={-1}
          onFocus={onWarningsFocus}
          data-testid="send-warnings"
          id="laser-warnings"
        >
          <p className="text-sm font-medium">Check this before you send</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink" data-count="server">
            {warnings.map((w, i) => (
              <li key={w} ref={warningRef(i)}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {risks.length ? (
        <ul className="callout space-y-1 bg-warn-bg text-sm text-warn">
          {risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
      {blocked ? (
        <div className="callout bg-warn-bg text-warn">
          <p className="text-sm" data-count="server">
            {blocked}
          </p>
          {integ && integ.status !== "connected" && business ? (
            <Button
              variant="secondary"
              className="mt-2 min-h-11"
              onClick={() => connect(business.id, integ.id)}
            >
              Connect {integ.provider}
            </Button>
          ) : null}
        </div>
      ) : null}
      {coverage?.recheck ? (
        <p className="callout bg-warn-bg text-sm font-medium text-warn" role="status">
          Something changed - take another look.
        </p>
      ) : null}
      {kept ? (
        <div className="callout bg-paper-2 text-sm text-ink" role="status">
          <p className="font-medium">Your words kept.</p>
          {kept.figures.length ? <p>Changed: {kept.figures.join(", ")}.</p> : null}
          {kept.missing.length ? <p>Not in your edit: {kept.missing.join(" ")}</p> : null}
        </div>
      ) : null}
      {drift}
    </section>
  );
}
