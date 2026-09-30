import { closedReason, type ClosedTimes } from "./compose-reply.ts";
import { sweepDates } from "./date-sweep.ts";

/**
 * What the owner wrote into a reply that the app cannot vouch for: a
 * discount, something free, a booking promise, a licence, a day they don't
 * work. These are the owner's own words, so they are never refused - the
 * send sheet lists them under "Check this before you send", and sending
 * anyway is one tap, recorded in the audit. Money that does not match the
 * quote is not here: that is refused by the send check, never warned about.
 *
 * Only sentences the owner added or changed are read: the app's own prepared
 * reply never warns about itself.
 */

type Check = { re: RegExp; why: string };

const CHECKS: Check[] = [
  {
    re: /\b\d{1,2}(?:\.\d+)?\s?%\s*(?:off|discount)\b|\b(?:discount(?:ed)?|mates?\s+rates?)\b/i,
    why: "a discount the quote does not include",
  },
  {
    re: /\bfor\s+free\b|\bfree\s+of\s+charge\b|\bat\s+no\s+(?:extra\s+)?(?:charge|cost)\b|\bno\s+charge\b|\bthrow(?:n|ing)?\s+(?:it\s+|that\s+|them\s+|(?:the|a|an|your)\s+\w+(?:\s+\w+)?\s+)?in\b|\bon\s+the\s+house\b|\bcomplimentary\b|(?<!feel\s)(?<!be\s)(?<!are\s)\bfree\b(?!\s+(?:to|on|that|this|then|day|days|time|slot|for\s+a))/i,
    why: "something at no charge that the quote does not include",
  },
  {
    re: /\byou(?:'re|\s+are)\s+(?:all\s+)?(?:booked|locked|pencilled|penciled|confirmed)\b|\bI(?:'ve|\s+have)\s+(?:booked|pencilled|penciled|locked)\s+you\b|\bI\s+can\s+(?:come|do\s+(?:it|that|the\s+job|you|this))\b|\bI'?ll\s+(?:be\s+there|see\s+you|fit\s+you\s+in)\b|\bsee\s+you\s+(?:on|then|at)\b|\bno\s+problem\b/i,
    why: "a booking promise - nothing has checked your calendar",
  },
  {
    re: /\b(?:licen[cs]ed|police[- ]check(?:ed)?|certified|accredited|qualified|trade\s+qualified)\b/i,
    why: "a claim Enquiry cannot check",
  },
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9$%]+/g, " ")
    .trim();
}

/** The sentences of a reply: a full stop, "!" or "?" then a space, or a new line. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/\n+|(?<=[!?])\s+|(?<=\.)\s+(?=[A-Z0-9$])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * "Check this before you send" for an owner's edit: each phrase the owner
 * added that makes a promise or a claim, in their words, with why. Days they
 * wrote are read against `now` and the owner's closed days.
 */
export function ownerEditWarnings(
  body: string,
  draft: string,
  opts: { closed?: ClosedTimes; now?: Date } = {},
): string[] {
  const prepared = new Set(sentencesOf(draft).map(norm));
  const added = sentencesOf(body).filter((s) => !prepared.has(norm(s)));
  const out: string[] = [];
  const push = (line: string) => {
    if (!out.includes(line)) out.push(line);
  };
  for (const sentence of added) {
    for (const check of CHECKS) {
      const m = check.re.exec(sentence);
      if (m) push(`"${m[0].trim()}" - ${check.why}.`);
    }
    for (const day of sweepDates(sentence, opts.now ?? new Date()).days) {
      if (day.to || day.context) continue;
      const reason = closedReason(day.iso, opts.closed);
      if (reason) push(`"${day.span}" - ${reason}.`);
    }
  }
  return out;
}
