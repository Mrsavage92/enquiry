import type { Enquiry } from "./types.ts";
import { previewFor } from "./send-preview.ts";
import { isSettledShown } from "./asked-view.ts";
import { formatMinorAud } from "./money-format.ts";
import { CLOSE_UNCONFIRMED_DAY } from "./compose-reply.ts";

/**
 * The Copy -> "Sent it?" flow, as plain functions (doc 50 section 7, doc 51
 * decisions 3 and 4). The bar component holds the state; everything it says
 * and every rule it applies is here, so it can be tested without a browser.
 */

/** Doc 50 7.6: the only wording for these lines. */
export const SEND_TEXT = {
  idleHint: "Copy, send it yourself, then tap Yes.",
  copied: "Copied. Nothing is sent or recorded yet. Sent it?",
  copiedOnReturn: (time: string) => `You copied this at ${time}. Sent it?`,
  copiedEarlier: (time: string) => `You copied an earlier version at ${time}. Sent it?`,
  failed:
    "Couldn't reach your clipboard. The reply is selected - copy it by hand. Nothing is sent or recorded.",
  recorded: "Recorded as sent by you.",
  allDone: "All done for now.",
  noPrice: "No price in this reply.",
  offline:
    "You're offline. Every reply is checked before you copy it, so Copy is off until you're back.",
  practiceEnd: "Practice - nothing recorded.",
  checkFailed: "Couldn't check this reply.",
  alreadyRecorded: "This exact reply is already recorded as sent.",
  networkOnRecord: "Couldn't reach the server. Nothing recorded yet.",
} as const;

/** At most one pre-check starts every two seconds per enquiry (task rule; doc 50 7.1). */
export const CHECK_INTERVAL_MS = 2000;
/** Wait this long after the last keystroke before checking an edit. */
export const CHECK_IDLE_MS = 1000;
/** A check that has not answered by now is a failed check, never a spinner left running. */
export const CHECK_TIMEOUT_MS = 5000;
/** Yes is visibly disabled this long after it appears (doc 50 7.2). */
export const YES_GUARD_MS = 600;
/** The idle hint shows for the owner's first few recorded sends only. */
export const IDLE_HINT_SENDS = 3;

/** How long to wait before the next check may start, given when the last one did. */
export function checkDelay(lastStart: number | null, now: number): number {
  if (lastStart === null) return 0;
  return Math.max(0, CHECK_INTERVAL_MS - (now - lastStart));
}

/**
 * Put the reply on the clipboard. `writeText` is the first statement with no
 * await before it, so Safari's user-gesture rule holds (doc 51 decision 4).
 * Resolves only when the clipboard took the text.
 */
export function copyText(text: string): Promise<void> {
  let write: Promise<void>;
  try {
    write = navigator.clipboard.writeText(text);
  } catch (err) {
    write = Promise.reject(err);
  }
  return write;
}

/** Australian mobile or landline as WhatsApp and international SMS want it: 61412345678. */
export function auDigits(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^\+61\d{9}$/.test(digits)) return digits.slice(1);
  if (/^61\d{9}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `61${digits.slice(1)}`;
  return null;
}

/** iOS takes `&body=`, Android `?body=` (doc 51 section 3a). */
export function smsHref(phone: string, body: string, userAgent: string): string | null {
  const digits = auDigits(phone);
  if (!digits) return null;
  const sep = /iPhone|iPad|iPod/i.test(userAgent) ? "&" : "?";
  return `sms:+${digits}${sep}body=${encodeURIComponent(body)}`;
}

export function waHref(phone: string, body: string): string | null {
  const digits = auDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

/** Where "Open in Messages" or "Open in WhatsApp" goes, only for an enquiry that came in that way. */
export function openLink(
  enquiry: Pick<Enquiry, "source" | "customerPhone">,
  body: string,
  userAgent: string,
): { label: string; href: string } | null {
  const phone = enquiry.customerPhone ?? "";
  if (!phone) return null;
  // No enquiry arrives on WhatsApp yet (no such channel); `waHref` is ready
  // for when one does, and the phone test page checks it today.
  if (enquiry.source !== "sms") return null;
  const href = smsHref(phone, body, userAgent);
  return href ? { label: "Open in Messages", href } : null;
}

/** The flag that keeps the Open buttons off until the founder's phone test passes. */
export const OPEN_LINKS_FLAG = "enquiry.openLinks";

export function openLinksEnabled(storage: Pick<Storage, "getItem"> | null): boolean {
  try {
    return storage?.getItem(OPEN_LINKS_FLAG) === "on";
  } catch {
    return false;
  }
}

/** The send line: who, how, how much (doc 50 section 3, invariant 11). */
export type SendLine = {
  recipient: string;
  /** The recipient was read from their message, not on file. */
  fromMessage: boolean;
  channel: string;
  /** "$2,040", "$1,800-$2,200", "checking", or the no-price line. */
  amount: { text: string; tone: "plain" | "strong" | "warn" | "checking" } | null;
};

const STRONG_FROM_MINOR = 200_000;

export function sendLine(
  enquiry: Enquiry,
  check: {
    namesAmount: boolean;
    amountMinor: number | null;
    rangeMinor: { min: number; max: number } | null;
  } | null,
  quote: boolean,
): SendLine {
  // The same recipient rule as the server's (`previewFor` mirrors `resolveToAddr`).
  const facts = previewFor({ enquiry, draft: "", decision: enquiry.decision });
  const amount = !quote
    ? null
    : !check
      ? { text: "checking", tone: "checking" as const }
      : !check.namesAmount
        ? { text: SEND_TEXT.noPrice, tone: "warn" as const }
        : check.rangeMinor
          ? {
              text: `${formatMinorAud(check.rangeMinor.min)}-${formatMinorAud(check.rangeMinor.max)}`,
              tone: "plain" as const,
            }
          : check.amountMinor !== null
            ? {
                text: formatMinorAud(check.amountMinor),
                tone:
                  check.amountMinor >= STRONG_FROM_MINOR ? ("strong" as const) : ("plain" as const),
              }
            : null;
  return {
    recipient: facts.recipient || facts.recipientRead || "",
    fromMessage: !facts.recipient && Boolean(facts.recipientRead),
    channel: facts.channelLabel,
    amount,
  };
}

/**
 * "6 settled · back on ceilings · not Sat 14 Nov" (doc 50 6.5): the count, then
 * every item whose wording commits the owner to something later or turns
 * something down, so a promise is never folded away.
 */
export function settledLine(
  enquiry: Pick<Enquiry, "decision">,
  body: string,
): {
  count: number;
  parts: string[];
} {
  const items = enquiry.decision.asked ?? [];
  // The job itself is not a decision the owner settled, and nothing the reply
  // still asks them about or will confirm counts as settled.
  const settled = items.filter((i) => isSettledShown(i, body) || i.closed || i.declined);
  const parts: string[] = [];
  for (const item of settled) {
    const text = item.text.trim();
    const lower = text.charAt(0).toLowerCase() + text.slice(1);
    if (item.closed) parts.push(`not ${text}`);
    else if (item.status === "come_back") parts.push(`back on ${lower}`);
    else if (item.status === "left_out" || item.declined) parts.push(`no ${lower}`);
  }
  if (body.includes(CLOSE_UNCONFIRMED_DAY) || /I'll confirm (?:whether|which day)/.test(body)) {
    parts.push("day to confirm");
  }
  return { count: settled.length, parts };
}

/** Clock time for "You copied this at 2:14 pm". */
export function clockTime(iso: string, timeZone?: string): string {
  try {
    return new Date(iso)
      .toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        ...(timeZone ? { timeZone } : {}),
      })
      .toLowerCase()
      .replace(/\s+/g, " ");
  } catch {
    return "";
  }
}
