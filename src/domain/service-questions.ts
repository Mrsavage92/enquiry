import type { BusinessDetail } from "./business-detail.ts";
import { mentionsAny, namesService, stemsOf } from "./service-words.ts";

/**
 * "Do you do mould removal?" is a question, and a reply that quotes the clean
 * and says nothing about the mould tells the customer something untrue by
 * leaving it out. Every explicit "do you do X?" is recorded as a question the
 * owner answers Yes or No; until they do, nothing is "reply ready".
 *
 * A question about something the owner said they do not offer is read as
 * "No" (still a reading, confirmed with one tap). A question about one of the
 * business's own services is not a question here - that is the job or an
 * extra, priced as usual.
 */

export const QUESTION_PREFIX = "question:";

export const QUESTION_ANSWER = { yes: "yes", no: "no", open: "open" } as const;

export function questionField(thing: string): string {
  return `${QUESTION_PREFIX}${thing}`;
}

export function isQuestionField(field: string): boolean {
  return field.trim().toLowerCase().startsWith(QUESTION_PREFIX);
}

export function questionThing(field: string): string {
  return field.trim().slice(QUESTION_PREFIX.length).trim();
}

export type ServiceQuestion = {
  /** What they asked about, in their words, lower case: "mould removal". */
  thing: string;
  /** Their words: "do you do mould removal?". */
  span: string;
  /** Read as "No" because the business said it does not offer it. */
  notOffered: boolean;
  /**
   * Asked for without a question ("get the outside of the house painted")
   * and the owner said they don't do it: read as No for them to confirm, so
   * the reply says so rather than passing over it.
   */
  requested?: true;
};

/** A sentence that turns something down or is about the past: never a request. */
const NOT_ASKED =
  /\b(?:no(?!\s+idea)|not(?!\s+(?:sure|certain))|don'?t(?!\s+know)|do not(?!\s+know)|doesn'?t|without|except|skip|already|came|did|was|were|had|last (?:week|time|month|year)|ago|previously)\b/i;

/** The sentence that asks for a thing the owner said they don't do, or null. */
function requestSentence(text: string, service: string): string | null {
  for (const raw of text.split(/(?<=[.!?\n])/)) {
    const sentence = raw.trim();
    if (!sentence || !namesService(sentence, service)) continue;
    if (NOT_ASKED.test(sentence)) continue;
    return sentence.length > 140 ? `${sentence.slice(0, 137).trimEnd()}...` : sentence;
  }
  return null;
}

const ASKS = [
  /\b(?:do|would|could|can|will)\s+(?:you|u|ya)\s+(?:guys\s+)?(?:also\s+)?(?:do|offer|provide|handle|remove|fix|clean|paint|treat)\s+(?:any\s+)?([a-z][a-z0-9' -]{2,60}?)\s*(\?|\.|,|!|$|\s+(?:as well|too|at all|also)\b)/gi,
  /\bare\s+(?:you|u)\s+able\s+to\s+(?:do|remove|fix|clean|paint)\s+([a-z][a-z' -]{2,50}?)\s*(\?|\.|,|!|$)/gi,
  /\bis\s+([a-z][a-z' -]{2,40}?)\s+something\s+(?:you|u)\s+(?:do|offer)\b[^?]*(\?)/gi,
];

/** Where the thing asked about stops: "mould removal on Friday" is "mould removal". */
const CUT =
  /\s+(?:on|for|at|by|in|this|next|before|after|around|when|while|if|and|or|with|from|please|pls|as|too)\b.*$/i;

/** Things that are not a service: a day, a date, a pronoun, the job itself. */
const NOT_A_THING =
  /\d|\b(?:it|that|this|them|those|these|one|the job|a quote|quotes?|me|us|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|week|weekend|morning|afternoon|arvo|asap|anything|something|much|many|more|less|cash|card|payment|discount|mates? rates?|price|the price|better)\b/i;

/** Stems of the work words most services share. */
const GENERIC_WORK = new Set(["clean", "paint", "servi", "job", "work", "repai", "wash", "insta"]);

function clean(raw: string): string {
  return raw
    .toLowerCase()
    .replace(CUT, "")
    .replace(/^(?:the|a|an|some)\s+/, "")
    .replace(/[?.!,]+$/, "")
    .trim();
}

function notOfferedMatch(thing: string, details: readonly BusinessDetail[]): boolean {
  // All of the saved service's own words, never a partial match: a partial
  // match stays an open question for the owner, never a pre-selected No.
  return details.some((d) => d.kind === "not_offered" && namesService(thing, d.service));
}

/**
 * Explicit "do you do X?" questions in a message, about things that are not
 * one of `services`. A plain request ("can you do the end of lease clean")
 * must end in "?" or use "do you do" wording to count as a question.
 */
export function readServiceQuestions(
  text: string,
  services: readonly string[],
  details: readonly BusinessDetail[] = [],
): ServiceQuestion[] {
  // "gutter cleaning" is not the end of lease clean: only a service's own
  // words, not the work word it shares with everything, make it a match.
  const known = services.flatMap((s) => stemsOf(s)).filter((s) => !GENERIC_WORK.has(s));
  const out: ServiceQuestion[] = [];
  for (const pattern of ASKS) {
    for (const m of text.matchAll(pattern)) {
      const asked = m[0].trim();
      const isQuestion = m[2] === "?" || /\bdo\s+(?:you|u|ya)\b/i.test(asked);
      if (!isQuestion) continue;
      const thing = clean(m[1] ?? "");
      if (thing.length < 3 || thing.split(/\s+/).length > 4 || NOT_A_THING.test(thing)) continue;
      if (mentionsAny(thing, known)) continue;
      if (out.some((q) => q.thing === thing)) continue;
      out.push({
        thing,
        span: asked.replace(/\s+/g, " "),
        notOffered: notOfferedMatch(thing, details),
      });
    }
  }
  for (const d of details) {
    if (d.kind !== "not_offered") continue;
    const thing = d.service.trim().toLowerCase();
    if (out.some((q) => namesService(q.thing, thing) || namesService(thing, q.thing))) continue;
    const span = requestSentence(text, d.service);
    if (!span) continue;
    out.push({ thing, span: span.replace(/\s+/g, " "), notOffered: true, requested: true });
  }
  return out;
}

/** The reply's line for an answered question. Never a price. */
export function questionReplyLine(thing: string, answer: string): string | null {
  if (answer === QUESTION_ANSWER.no) return `Sorry, I don't do ${thing}.`;
  if (answer === QUESTION_ANSWER.yes) {
    return `Yes, I can help with ${thing} - I'll come back to you with a price for that.`;
  }
  return null;
}
