import type { AskedItem, AskedStatus } from "./asked.ts";
import type { Business, Enquiry } from "./types.ts";
import { activeRules } from "./decide.ts";
import { lineChoicesFor } from "./line-choices.ts";
import { describeRule } from "./business-rule.ts";

/**
 * Where one thing they asked stands, as the screen says it: the ledger's own
 * status, except that nothing reads "Answered" while the reply still asks
 * them about it or only promises to confirm it (go-live review B2).
 *
 *  - `asking`: the reply asks them a detail before it can price this
 *    ("Before I can give you a price for the ceilings, ...").
 *  - `will_confirm`: a day the reply says the owner will confirm.
 */
export type ShownStatus = AskedStatus | "asking" | "will_confirm";

const WILL_CONFIRM = /I'll confirm (?:whether|which day|the day)|confirm the day/i;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function askedShown(item: AskedItem, body: string): ShownStatus {
  if (item.status !== "answered" || item.closed || item.declined) return item.status;
  if (item.kind === "date" && WILL_CONFIRM.test(body)) return "will_confirm";
  if (item.kind === "extra" || item.kind === "service") {
    const thing = escapeRe(item.text.trim().toLowerCase());
    const asks = new RegExp(`price for (?:the )?${thing}\\b[^.?]*\\?`, "i");
    if (thing && asks.test(body)) return "asking";
  }
  return item.status;
}

/** Settled for the owner: decided, and not something the reply still asks or defers. */
export function isSettledShown(item: AskedItem, body: string): boolean {
  if (item.kind === "service") return false;
  const shown = askedShown(item, body);
  return shown !== "open" && shown !== "asking" && shown !== "will_confirm";
}

/**
 * "$380" for an extra one of the owner's saved prices covers, as the "Add it"
 * choice names it; null when nothing they price covers it.
 */
export function savedPriceFor(
  item: AskedItem,
  enquiry: Pick<Enquiry, "decision" | "facts" | "serviceLabel">,
  business: { knowledge?: Business["knowledge"] } | undefined,
): string | null {
  if (item.kind !== "extra") return null;
  const priceLines =
    enquiry.decision.price?.kind === "EXACT"
      ? (enquiry.decision.price.lines ?? []).map((l) => l.label)
      : (enquiry.decision.coverage?.lines ?? []).map((l) => l.label);
  const saved = lineChoicesFor(
    activeRules(business ?? {}),
    enquiry.facts,
    enquiry.serviceLabel,
    priceLines,
  ).find((c) => c.field === item.id);
  return saved ? describeRule(saved.rule).replace(/^[^:]*:\s*/, "") : null;
}
