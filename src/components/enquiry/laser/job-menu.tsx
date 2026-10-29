import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { STATUS } from "@/domain/labels";
import { channelLabel, identityLine } from "@/domain/format";
import { isInternalFact } from "@/domain/coverage";
import { parkedUntil } from "@/domain/time-cues";
import { quoteSheets } from "@/domain/quote-sheets";
import type { Business, Enquiry, EnquiryFact } from "@/domain/types";
import { usePrototype } from "@/store/prototype-store";
import { useLiveEnquiryMutations } from "@/lib/workspace/live-mutations";
import { useDeletePractice } from "@/lib/workspace/use-delete-practice";
import { toastUndo } from "@/lib/toast-undo";
import { HearLetter } from "../hear-letter";
import { DeclineConfirm } from "../decline-confirm";
import { LaterChoices } from "../later-choices";
import { QuoteSheets } from "../quote-sheet";
import { CaseFile } from "../case-file";
import { CorrectDialog, EvaluatorRow, FactList } from "./evidence";

/** Which of the menu's panels is open. */
export type MenuPanel = "menu" | "why" | "details" | "note" | "later" | "decline" | null;

/**
 * Everything that is not the next tap, one tap away (doc 50 section 3): Why
 * this reply, Hear it, Customer details and evidence, Note, Later, Decline,
 * and Delete it for practice. The phone opens it as a sheet, the desktop as
 * a dialog, from the header's "..." button.
 */
export function JobMenu({
  enquiry,
  business,
  compact,
  panel,
  onPanel,
  replyText,
  onDone,
}: {
  enquiry: Enquiry;
  business: Business | undefined;
  compact: boolean;
  panel: MenuPanel;
  onPanel: (panel: MenuPanel) => void;
  replyText: string;
  onDone?: () => void;
}) {
  const enq = useLiveEnquiryMutations();
  const demoMode = usePrototype((s) => s.demoMode);
  const [correcting, setCorrecting] = useState<EnquiryFact | null>(null);
  const [declining, setDeclining] = useState(false);
  const { remove, deleting } = useDeletePractice();
  const Panel = compact ? SheetContent : DialogContent;
  const close = () => onPanel(null);
  const open = enquiry.state.lifecycle === "OPEN";
  const facts = enquiry.facts.filter((f) => !f.superseded && !isInternalFact(f.field));

  return (
    <>
      <Dialog open={panel === "menu"} onOpenChange={(o) => onPanel(o ? "menu" : null)}>
        <Panel title="This job">
          <div className="grid gap-2">
            <MenuButton onClick={() => onPanel("why")}>Why this reply</MenuButton>
            <div className="flex min-h-12 items-center justify-center">
              <HearLetter text={replyText} compact />
            </div>
            <MenuButton onClick={() => onPanel("details")}>
              Customer details and evidence
            </MenuButton>
            <MenuButton onClick={() => onPanel("note")}>Note</MenuButton>
            {open ? <MenuButton onClick={() => onPanel("later")}>{STATUS.later}</MenuButton> : null}
            {open ? <MenuButton onClick={() => onPanel("decline")}>Decline</MenuButton> : null}
            {enquiry.practice ? (
              <MenuButton disabled={deleting} onClick={() => void remove(enquiry.id)}>
                {deleting ? "Deleting..." : "Delete it"}
              </MenuButton>
            ) : null}
          </div>
        </Panel>
      </Dialog>

      <Dialog open={panel === "why"} onOpenChange={(o) => !o && close()}>
        <Panel title="Why this reply">
          <p className="text-sm leading-relaxed text-ink">
            {enquiry.decision.recommendation.reason}
          </p>
          <ol className="mt-4 space-y-3 text-sm">
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
          {enquiry.decision.confidence === "Low" ? (
            <p className="mt-4 text-sm font-semibold text-warn">Check this one before you reply</p>
          ) : null}
        </Panel>
      </Dialog>

      <Dialog open={panel === "details"} onOpenChange={(o) => !o && close()}>
        <Panel
          title="Customer details and evidence"
          className={compact ? undefined : "enquiry-details-drawer"}
        >
          <p className="mb-4 text-sm text-ink-2">
            {identityLine(enquiry)} · {channelLabel(enquiry.source)}
          </p>
          {quoteSheets(enquiry).length > 0 ? (
            <QuoteSheets enquiry={enquiry} business={business} />
          ) : null}
          {enquiry.decision.failedGates.length > 0 ? (
            <details className="my-5 text-sm">
              <summary className="min-h-11 cursor-pointer py-3 font-medium">
                Action safeguards
              </summary>
              <ul className="space-y-2 text-ink-2">
                {enquiry.decision.failedGates.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <dl className="space-y-2">
            {enquiry.decision.evaluators
              .filter((e) => e.status !== "NOT_APPLICABLE")
              .map((e) => (
                <EvaluatorRow key={e.type} result={e} />
              ))}
          </dl>
          <FactList
            heading="What Enquiry understood"
            facts={facts}
            onCorrect={(f) => {
              close();
              setCorrecting(f);
            }}
          />
          <CaseFile enquiry={enquiry} />
        </Panel>
      </Dialog>

      <CorrectDialog
        enquiry={enquiry}
        fact={correcting}
        onClose={() => setCorrecting(null)}
        sheet={compact}
      />

      <Dialog open={panel === "note"} onOpenChange={(o) => !o && close()}>
        <Panel title="Note on this enquiry">
          <p className="text-sm text-ink-2">Stays on the case file. Not sent to the customer.</p>
          <textarea
            className="field mt-3"
            rows={4}
            defaultValue={enquiry.notes ?? ""}
            id={`note-${enquiry.id}`}
            aria-label="Private enquiry note"
          />
          <Button
            className="mt-4 min-h-12 w-full"
            onClick={() => {
              const el = document.getElementById(
                `note-${enquiry.id}`,
              ) as HTMLTextAreaElement | null;
              void enq.setNote(enquiry.id, el?.value ?? "", (m) => toast.error(m));
              close();
            }}
          >
            Save note
          </Button>
        </Panel>
      </Dialog>

      <DeclineConfirm
        open={panel === "decline"}
        onOpenChange={(o) => onPanel(o ? "decline" : null)}
        pending={declining}
        compact={compact}
        onConfirm={(reason) => {
          setDeclining(true);
          void enq
            .decline(enquiry.id, reason, (m) => toast.error(m))
            .then((ok) => {
              setDeclining(false);
              // A failed write already said why; the enquiry stays as it was.
              if (!ok) return;
              close();
              if (demoMode) toastUndo("Declined - nothing sent to the customer.");
              else toast.success("Declined.");
              onDone?.();
            });
        }}
      />

      <LaterChoices
        open={panel === "later"}
        onOpenChange={(o) => onPanel(o ? "later" : null)}
        compact={compact}
        onChoose={(until) => {
          void enq.snooze(enquiry.id, (m) => toast.error(m), until);
          close();
          const tz = usePrototype.getState().prefs.timezone || undefined;
          toast(`${parkedUntil(until, new Date(), tz)}. It comes back to Needs you then.`, {
            action: {
              label: "Undo",
              onClick: () => void enq.unsnooze(enquiry.id, (m) => toast.error(m)),
            },
          });
          onDone?.();
        }}
      />
    </>
  );
}

function MenuButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="secondary" className="min-h-12 w-full" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}
