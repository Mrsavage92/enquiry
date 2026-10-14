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

/** "I'm free", "we're definitely available": the owner's own availability. */
const SELF_FREE = String.raw`(?:I'?m|I\s+am|we'?re|we\s+are)\s+(?:\w+ly\s+)?`;
/** "I'm free", "we're not free": about the owner, never a price. */
const SELF_NOT_PRICE = String.raw`(?:I'?m|I\s+am|we'?re|we\s+are)\s+(?:\w+ly\s+|not\s+)?`;

const CHECKS: Check[] = [
  {
    re: /\b\d{1,2}(?:\.\d+)?\s?%\s*(?:off|discount)\b|\b(?:discount(?:ed)?|mates?\s+rates?)\b|\bhalf\s+(?:price|off)\b|\bwaiv(?:e|ed|ing)\b/i,
    why: "a discount the quote does not include",
  },
  {
    re: new RegExp(
      String.raw`\bfor\s+free\b|\bfree\s+of\s+charge\b|\b(?:at\s+)?no\s+(?:extra\s+|additional\s+)?(?:charge|cost)\b|\bthrow(?:n|ing)?\s+(?:it\s+|that\s+|them\s+|(?:the|a|an|your)\s+\w+(?:\s+\w+)?\s+)?in\b|\bon\s+the\s+house\b|\bcomplimentary\b|(?<!feel\s)(?<!be\s)(?<!${SELF_NOT_PRICE})\bfree\b(?!\s+(?:to\b|on\b|that\b|this\b|then\b|day|days|time|slot|for\s+a|quotes?\b|estimates?\b|measure\b|inspection\b|parking\b))`,
      "i",
    ),
    why: "something at no charge that the quote does not include",
  },
  {
    re: new RegExp(
      [
        String.raw`\byou(?:'re|\s+are)\s+(?:all\s+)?(?:booked|locked|pencilled|penciled|confirmed)\b`,
        String.raw`\b(?:I|we)(?:'ve|\s+have)\s+(?:booked|pencilled|penciled|locked)\s+(?:you|it|that|this)\b`,
        String.raw`\b(?:I|we)\s+can\s+(?:also\s+|definitely\s+|easily\s+)?(?:come|do)\b(?!\s+(?:\d+(?:\.\d+)?\s?%|\$|it\s+for\b|that\s+for\b|a\s+(?:discount|deal|better\s+price)))`,
        String.raw`\bhappy\s+to\s+(?:do|come|fit|book)\b`,
        String.raw`\b(?:I|we)(?:'ll|\s+will)\s+(?:be\s+there|see\s+you|fit\s+you\s+in)\b`,
        String.raw`\bsee\s+you\s+(?:on|then|at|there|soon|\w+day)\b`,
        String.raw`\bno\s+problem\b`,
        String.raw`\b(?:that'?s|it'?s|that\s+is|it\s+is|all)\s+(?:locked|booked|confirmed)\b`,
        String.raw`\block(?:ed)?\s+(?:it|that|you|this)\s+in\b|\blocked\s+in\b`,
        String.raw`^\s*(?:booked|confirmed)\b`,
        String.raw`\bconfirmed\s+for\b`,
        String.raw`\bguarantee[ds]?\b`,
        String.raw`\b${SELF_FREE}(?:free|available)\b(?!\s+to\b)`,
        String.raw`\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\s+(?:works|is\s+(?:fine|good|great|perfect)|suits)\b`,
        String.raw`\b(?:that|the)\s+(?:day|date|time)\s+(?:works|suits|is\s+(?:fine|good|great|perfect))\b`,
      ].join("|"),
      "i",
    ),
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

/**
 * The key of a warnings list as the owner saw it: the server records a send
 * over warnings only when the owner's "Send anyway" carries the key of the
 * list it works out itself. A list that grew after it was shown is refused.
 */
export function warningsKey(warnings: readonly string[]): string {
  // FNV-1a over the list, so the browser and the server agree with no crypto.
  let hash = 0x811c9dc5;
  const text = JSON.stringify(warnings);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${warnings.length}:${hash.toString(16).padStart(8, "0")}`;
}

/** App-authored promises of availability: never in a composed reply. */
export const FORBIDDEN_PROMISES: readonly RegExp[] = [
  /work around/i,
  /you(?:'re| are) (?:all )?booked/i,
  /fit (?:you|it|us) in/i,
  /no problem/i,
  /\bI can (?:come|do (?:it|that|the job))\b/i,
  /see you (?:on|then)/i,
  /lock(?:ed)? (?:it|you) in/i,
  /hold the date/i,
  /I'll be there/i,
];
