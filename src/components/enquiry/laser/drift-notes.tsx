import type { Enquiry } from "@/domain/types";
import {
  alignLetterToSheet,
  detectPriceDrift,
  detectSheetLetterMismatch,
} from "@/domain/voice-detect";
import { quoteSheets } from "@/domain/quote-sheets";
import { resolvedHold } from "@/domain/commercial";
import { useDraftSaver } from "@/lib/workspace/owner-sync";

/**
 * The owner's edit says a different figure from the quote on file, or from
 * the quote sheet: said in D, with "Use the sheet" where it applies.
 */
export function DriftNotes({
  enquiry,
  prepared,
  text,
}: {
  enquiry: Enquiry;
  prepared: string;
  text: string;
}) {
  const editDraft = useDraftSaver();
  const price = enquiry.decision.fold?.price ?? enquiry.decision.price;
  const total = price?.kind === "EXACT" ? price.amountMinor / 100 : null;
  const drift = detectPriceDrift(prepared, text, total);
  const sheets = quoteSheets(enquiry);
  const focus =
    [...sheets].reverse().find((q) => q.status === "draft" || q.status === "accepted") ??
    sheets[sheets.length - 1];
  const hold = resolvedHold(focus);
  const figures = { total: focus?.total?.amount, hold: hold?.amount };
  const sheet = detectSheetLetterMismatch(text, figures);
  if (!drift && !sheet) return null;
  return (
    <div className="callout bg-warn-bg text-sm text-warn">
      {drift ? (
        <p>
          {drift.from
            ? `The quote on file is ${drift.from}. This reply now says ${drift.to}.`
            : `This reply now says ${drift.to}, which the prepared reply did not.`}{" "}
          Editing the reply does not change the price.
        </p>
      ) : null}
      {sheet ? (
        <>
          <p>
            The sheet is {sheet.sheet}. This letter says {sheet.letter}.
          </p>
          <button
            type="button"
            className="laser-link"
            onClick={() => editDraft(enquiry.id, alignLetterToSheet(text, figures))}
          >
            Use the sheet
          </button>
        </>
      ) : null}
    </div>
  );
}
