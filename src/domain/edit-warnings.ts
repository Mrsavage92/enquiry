import { closedReason, type ClosedTimes } from "./compose-reply.ts";
import { sweepDates } from "./date-sweep.ts";
import { dollarMatches, type DollarMatch } from "./voice-detect.ts";

/**
 * What the owner wrote into a reply that the app cannot vouch for: a
 * discount, something free, a booking promise, a licence, a day they don't
 * work. These are the owner's own words, so they are never refused - the
 * send sheet lists them under "Check this before you send", and sending
 * anyway is one tap, recorded in the audit. Money the owner writes is listed
 * here too, sentence by sentence ("You wrote a price: ..."): the app never
 * guesses which line a figure belongs to. Only a stated total that differs
 * from the quote, a cover figure or a foreign amount is refused outright, by
 * the send check.
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

/**
 * A sentence as compared with the prepared reply: case, spacing, punctuation
 * and a bullet marker aside. Signs, currency and symbols that change a figure
 * ("-$300" against "+$300" or "$300", "$450+", "~$450") and letters in any
 * script are kept, so changing them is an edit.
 */
/** The check for a discount the quote does not include. */
const DISCOUNT_CHECK = CHECKS[0]!;

function norm(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^\s*[-*\u2022]\s+/, "")
    .replace(/[^\p{L}\p{N}$%+\-\u2212~\u00d7]+/gu, " ")
    .replace(/\s+/g, " ")
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
 * The sentences and bullets of `body` that are not in the app's prepared
 * reply as it was written: what the owner added or changed.
 */
export function addedSentences(body: string, draft: string): string[] {
  const prepared = new Set(sentencesOf(draft).map(norm));
  return sentencesOf(body).filter((s) => !prepared.has(norm(s)));
}

/** One sentence or bullet of a reply, where it stands, and who wrote it. */
export type ReplySpan = {
  from: number;
  to: number;
  text: string;
  /** Not in the app's prepared reply as written: the owner added or changed it. */
  added: boolean;
  /** The owner's own saved answer, word for word and figure for figure. */
  answer: boolean;
};

/** Every sentence and bullet of `body`, in order, with where it stands. */
export function replySpans(
  body: string,
  draft: string,
  answers: readonly string[] = [],
): ReplySpan[] {
  const added = new Set(addedSentences(body, draft));
  const spans: ReplySpan[] = [];
  let cursor = 0;
  for (const text of sentencesOf(body)) {
    const at = body.indexOf(text, cursor);
    if (at === -1) continue;
    spans.push({
      from: at,
      to: at + text.length,
      text,
      added: added.has(text),
      answer: isAnswer(text, answers),
    });
    cursor = at + text.length;
  }
  return spans;
}

/**
 * Whether `sentence` is one of the owner's answer sentences, whole: the same
 * words and the same figures. A piece of one ("are $8" of "Callouts after 5pm
 * are $80.") is the owner's own new figure, never their answer.
 */
function isAnswer(sentence: string, answers: readonly string[]): boolean {
  const figures = (s: string) =>
    dollarMatches(s)
      .map((m) => `${m.foreign ? "x" : ""}${m.amount}`)
      .join(" ");
  return answers
    .flatMap(sentencesOf)
    .some((a) => norm(a) === norm(sentence) && figures(a) === figures(sentence));
}

/** A figure in a reply, with the sentences it stands in and the words around it. */
export type ReplyMoney = {
  match: DollarMatch;
  /** Every sentence or bullet the figure and its cue overlap. */
  spans: ReplySpan[];
  /** Any of them the owner added or changed. */
  added: boolean;
  /**
   * The words before the figure, from the start of its first sentence, or of
   * the line above when the figure starts its line ("Total:\n$900").
   */
  before: string;
  /** The words after the figure, to the end of its last sentence. */
  after: string;
  /** The text from `before` to `after`, one line. */
  text: string;
};

/**
 * Every figure the reply names, read once over the whole body (so a figure
 * whose cue is on the line above, "Call it\n400.", is read), and mapped onto
 * every sentence it overlaps. A figure at the very start of its line takes the
 * line above as its words too ("Total:\n$900" is a stated total).
 */
export function replyMoney(
  body: string,
  draft: string,
  answers: readonly string[] = [],
): ReplyMoney[] {
  const spans = replySpans(body, draft, answers);
  return dollarMatches(body).map((match) => {
    const end = match.index + match.raw.length;
    let over = spans.filter((s) => match.index < s.to && end > s.from);
    if (over.length === 0) {
      const next = spans.findIndex((s) => s.from >= end);
      over = spans.slice(Math.max(0, (next === -1 ? spans.length : next) - 1)).slice(0, 1);
    }
    const first = over[0];
    const at = first ? spans.indexOf(first) : -1;
    const lead = first ? body.slice(first.from, match.index) : "";
    // At the very start of its line, the line above is its words too.
    const from =
      first && at > 0 && !/[A-Za-z0-9]/.test(lead) ? spans[at - 1]!.from : (first?.from ?? 0);
    const to = Math.max(end, over.at(-1)?.to ?? end);
    return {
      match,
      spans: over,
      added: over.length === 0 || over.some((s) => s.added && !s.answer),
      before: body.slice(from, match.index).replace(/\s+/g, " "),
      after: body.slice(end, to).replace(/\s+/g, " "),
      text: body.slice(from, to).replace(/\s+/g, " ").trim(),
    };
  });
}

/** The warning for money the owner wrote, in their sentence. */
export function priceWarning(sentence: string): string {
  return `You wrote a price: "${sentence}". Check it before you send.`;
}

/** The warning for words that change what a prepared figure means. */
export function priceDetailWarning(text: string): string {
  return `You changed the price details: "${text}". Check it before you send.`;
}

/** Words that change what a figure means: "Plus GST.", "per hour", "each", "extra", "deposit". */
const QUALIFIES_MONEY =
  /\b(?:gst|per|plus|extras?|each|deposit|excl(?:uding|udes|\.)?|incl(?:uding|udes|\.)?|not\s+included|not\s+in\s+the\s+total|an?\s+hour|hourly|surcharge|on\s+top|optional)\b/i;

/**
 * Prepared money whose meaning the owner changed without touching its words:
 * text added in the same line as a prepared figure ("- Whole house. Oven
 * clean: $250"), an added line right above or below one ("$250\n  per hour"),
 * an added sentence that qualifies money ("Plus GST."), and a prepared money
 * line said more times than the prepared reply says it.
 */
function priceDetailEdits(body: string, draft: string, spans: readonly ReplySpan[]): string[] {
  const out: string[] = [];
  const money = (s: ReplySpan) => dollarMatches(s.text).length > 0;
  const lines: { from: number; to: number; text: string }[] = [];
  let at = 0;
  for (const text of body.split("\n")) {
    lines.push({ from: at, to: at + text.length, text: text.trim() });
    at += text.length + 1;
  }
  const inLine = lines.map((l) => spans.filter((s) => s.from >= l.from && s.to <= l.to));
  const preparedMoney = inLine.map((ss) => ss.some((s) => !s.added && money(s)));
  lines.forEach((line, i) => {
    const ss = inLine[i]!;
    if (ss.length === 0) return;
    if (preparedMoney[i] && ss.some((s) => s.added && !s.answer)) out.push(line.text);
    const owners = ss.every((s) => s.added && !s.answer) && !ss.some(money);
    if (owners && (preparedMoney[i - 1] || preparedMoney[i + 1])) out.push(line.text);
  });
  for (const s of spans) {
    if (s.added && !s.answer && !money(s) && QUALIFIES_MONEY.test(s.text)) out.push(s.text);
  }
  const count = (texts: readonly string[], text: string) =>
    texts.filter((t) => norm(t) === norm(text)).length;
  const drafted = sentencesOf(draft);
  const said = spans.map((s) => s.text);
  for (const s of spans) {
    if (!s.added && money(s) && count(said, s.text) > count(drafted, s.text)) out.push(s.text);
  }
  return out;
}

/**
 * "Check this before you send" for an owner's edit: each phrase the owner
 * added that makes a promise or a claim, in their words, with why, and every
 * sentence of theirs that names money. Days they wrote are read against `now`
 * and the owner's closed days. `answers` are the owner's own saved answer
 * sentences: inserted word for word, their figures are the owner's and are
 * not listed.
 */
export function ownerEditWarnings(
  body: string,
  draft: string,
  opts: {
    closed?: ClosedTimes;
    now?: Date;
    answers?: readonly string[];
    /** The quote takes something off: "discount" in the owner's words is not news. */
    hasDiscount?: boolean;
  } = {},
): string[] {
  const answers = (opts.answers ?? []).map((a) => a.trim()).filter(Boolean);
  const out: string[] = [];
  const push = (line: string) => {
    if (!out.includes(line)) out.push(line);
  };
  const money = replyMoney(body, draft, answers);
  const priced = new Set<string>();
  for (const m of money) {
    if (!m.added) continue;
    // The sentences the figure stands in, as the owner wrote them.
    const words = m.spans.map((s) => s.text).join(" ");
    push(priceWarning(words || m.match.raw));
    for (const span of m.spans) priced.add(span.text);
  }
  const spans = replySpans(body, draft, answers);
  for (const text of priceDetailEdits(body, draft, spans)) push(priceDetailWarning(text));
  for (const span of spans) {
    if (!span.added) continue;
    const sentence = span.text;
    for (const check of CHECKS) {
      // A discount the quote has, or one in a sentence already listed as a
      // price, is never "a discount the quote does not include".
      if (check === DISCOUNT_CHECK && (opts.hasDiscount || priced.has(sentence))) continue;
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
