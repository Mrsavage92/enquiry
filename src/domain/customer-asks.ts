import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import type { BusinessDetail } from "./business-detail.ts";
import { readServiceQuestions } from "./service-questions.ts";
import { mentionsAny, stemsOf } from "./service-words.ts";

/**
 * Questions a customer asks that are not "do you do X?": "r u free this sat or
 * sun?", "do you have insurance?", "how long will it take?". A reply that
 * quotes the clean and says nothing to them has left their question out -
 * the customer reads that as a yes, or as nobody reading their message. Each
 * is recorded as `ask:<topic>` and no priced reply is ready until the owner
 * answers it, says they'll come back on it, or chooses to leave it.
 *
 * An answer about availability is stored WITH the days it answers
 * ("2026-10-03=yes|2026-10-04=no"): if the day on the enquiry changes, the
 * old answer no longer settles the question, so a Yes never follows the date
 * to a day nobody agreed to.
 *
 * The owner's own answer to a question customers ask again ("Yes, fully
 * insured") is saved as a business answer the first time they type it, and
 * offered - never sent - the next time.
 */

export const ASK_PREFIX = "ask:";
export const ASK_AVAILABILITY = `${ASK_PREFIX}availability`;

/** The owner's choices; any other confirmed value on a general question is their answer. */
export const ASK_CHOICE = { yes: "yes", no: "no", later: "later", ignore: "ignore" } as const;

type DayChoice = "yes" | "no" | "later";
const DAY_CHOICES = new Set<string>(["yes", "no", "later"]);

export function isAskField(field: string): boolean {
  return field.trim().toLowerCase().startsWith(ASK_PREFIX);
}

export function askTopic(field: string): string {
  return field.trim().toLowerCase().slice(ASK_PREFIX.length);
}

export type CustomerAsk = {
  field: string;
  kind: "availability" | "ask";
  topic: string;
  /** Their words: "do you have insurance?". */
  question: string;
};

/** Topics a business is asked again and again: the saved answer is offered next time. */
const TOPICS: [string, RegExp][] = [
  ["insurance", /\b(?:insured|insurance|public liability)\b/i],
  ["licence", /\b(?:licen[cs]ed?|licen[cs]es?|registered|qualified|certified|accredited)\b/i],
  ["duration", /\bhow\s+long\b|\bhow\s+many\s+hours\b/i],
  ["deposit", /\bdeposit\b/i],
  ["payment", /\b(?:pay(?:ment)?|card|cash|invoice|afterpay|eftpos|bank transfer)\b/i],
  [
    "equipment",
    /\b(?:bring|supply|provide|use|using)\s+(?:your\s+own\s+|any\s+)?(?:\w+\s+)?(?:equipment|products|supplies|gear|vacuum|materials|chemicals)\b/i,
  ],
  ["pets", /\b(?:pets?|dogs?|cats?)\b/i],
  ["parking", /\bpark(?:ing)?\b/i],
  ["warranty", /\b(?:warrant(?:y|ies)|guarantee[ds]?)\b/i],
];

/** "r u free", "are you available", "any availability", "can you fit us in", "is the 10th ok?". */
const AVAILABILITY =
  /\b(?:are|r)\s+(?:you|u|ya)\s+(?:free|available|around)\b|\b(?:do|would)\s+(?:you|u)\s+have\s+(?:any\s+)?(?:availability|time|room|space|a spot|spots|openings?)\b|\bany\s+availability\b|\bhave\s+(?:a\s+|any\s+)?(?:crew|team|someone|anyone|spot|slot)s?\s+(?:free|available)\b|\bcan\s+(?:you|u)\s+fit\s+(?:me|us|it)\s+in\b|\bwhen\s+(?:are|r)\s+(?:you|u)\s+(?:free|available)\b|\b(?:is|would|does)\s+(?:the\s+)?(?:\d{1,2}(?:st|nd|rd|th)?|(?:this|next)\s+[a-z]+|(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*)\b[^?.!]{0,20}\b(?:ok|okay|free|available|possible|suit|work)\b/i;

/** Questions the quote itself answers: the price, and asking for the job. */
const ANSWERED_BY_QUOTE =
  /\b(?:how\s+much|price|prices|pricing|cost|costs|quote|charge|rate|rates|fee|fees|run\s+(?:me|us)|set\s+(?:me|us)\s+back|what\s+would\s+(?:it|that|this)\s+be)\b|\b(?:can|could|would|will)\s+(?:you|u|ya)\s+(?:(?:please|still|also|just|maybe)\s+)*(?:do|come|paint|clean|quote|book|fit|help|send|let|give|pop|make|get|start)\b/i;
/** A day, a date or "asap" in the question: the date line answers it, not a typed answer. */
const ABOUT_A_DAY =
  /\b(?:asap|today|tomorrow|tmrw|tonight|mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\b\d{1,2}\/\d{1,2}\b/i;

/** How a real question starts, after any lead-in ("ok thanks, will you ..."). */
const QUESTION_START =
  /^(?:and\s+|also\s+|oh\s+|btw\s+|just\s+wondering\s+|i\s+was\s+wondering\s+(?:if|whether)\s+|wondering\s+(?:if|whether)\s+)?(?:do|does|did|are|r|is|was|can|could|will|would|have|has|how|what|when|who|which|where|should)\b/i;

/** "do you do", "do you offer": a question about a service, read elsewhere. */
const SERVICE_ASK =
  /\b(?:do|would|could|can|will)\s+(?:you|u|ya)\s+(?:guys\s+)?(?:also\s+)?(?:do|offer|provide)\b/i;

/** Work words every service shares: never enough to say a question is about one. */
const SHARED = new Set([
  "clean",
  "paint",
  "servi",
  "wash",
  "repai",
  "insta",
  "remov",
  "job",
  "work",
]);

function ownStems(service: string): string[] {
  return stemsOf(service).filter((s) => !SHARED.has(s));
}

function sentences(text: string): { text: string; question: boolean }[] {
  const out: { text: string; question: boolean }[] = [];
  const re = /[^.!?\n]+[.!?]*/g;
  for (const m of text.matchAll(re)) {
    const raw = m[0].trim();
    if (!raw) continue;
    out.push({ text: raw.replace(/[.!?]+$/, "").trim(), question: /\?/.test(raw) });
  }
  return out;
}

/** "How much for a clean and are you insured?": each part asks on its own. */
function clauses(sentence: string): string[] {
  return sentence
    .split(
      /\s*[,;]\s*|\s+(?:and|then|also|plus)\s+(?=(?:do|does|are|r|is|can|could|will|would|have|has|how|what|when|who|which|where|should|you|u)\b)/i,
    )
    .map((c) => c.trim())
    .filter(Boolean);
}

/** FNV-1a: a short stable id for a question with no known topic. */
function idOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** A clause that is a question for the owner, not the job, the price or a service. */
function ownerQuestion(clause: string, isQuestion: boolean, services: readonly string[]): boolean {
  if (!QUESTION_START.test(clause)) return false;
  // Without a "?" only a known topic counts: "will you be using eco products".
  if (!isQuestion && !TOPICS.some(([, re]) => re.test(clause))) return false;
  if (!/\b(?:you|u|ya|your)\b/i.test(clause) && !TOPICS.some(([, re]) => re.test(clause))) {
    return false;
  }
  if (ANSWERED_BY_QUOTE.test(clause) || clause.split(/\s+/).length < 3) return false;
  if (ABOUT_A_DAY.test(clause) || SERVICE_ASK.test(clause)) return false;
  return !services.some((svc) => mentionsAny(clause, ownStems(svc)));
}

/**
 * The questions in a message the reply has to answer, beside the job itself.
 * Never "do you do X?" (that is a service question), never the price (the
 * quote answers it) and never asking for the job. A sentence with two
 * questions ("How much for a clean and are you insured?") is read part by part.
 */
export function readCustomerAsks(
  text: string,
  services: readonly string[] = [],
  details: readonly BusinessDetail[] = [],
): CustomerAsk[] {
  const out: CustomerAsk[] = [];
  const serviceQuestions = readServiceQuestions(text, services, details).map((q) =>
    q.span.toLowerCase().replace(/[?!.]+$/, ""),
  );
  const seen = new Set<string>();
  const add = (ask: CustomerAsk) => {
    if (seen.has(ask.topic)) return;
    seen.add(ask.topic);
    out.push(ask);
  };
  for (const s of sentences(text)) {
    const sentence = s.text.replace(/\s+/g, " ");
    if (serviceQuestions.some((q) => sentence.toLowerCase().includes(q))) continue;
    for (const clause of clauses(sentence)) {
      if (AVAILABILITY.test(clause)) {
        add({
          field: ASK_AVAILABILITY,
          kind: "availability",
          topic: "availability",
          question: `${clause}?`,
        });
        continue;
      }
      if (!ownerQuestion(clause, s.question, services)) continue;
      const topic =
        TOPICS.find(([, re]) => re.test(clause))?.[0] ?? `q-${idOf(clause.toLowerCase())}`;
      add({ field: `${ASK_PREFIX}${topic}`, kind: "ask", topic, question: `${clause}?` });
    }
  }
  return out;
}

const TOPIC_WORDS: Record<string, string> = {
  insurance: "your question about insurance",
  licence: "your question about licensing",
  duration: "how long it will take",
  deposit: "the deposit",
  payment: "payment",
  equipment: "equipment",
  pets: "your question about pets",
  parking: "parking",
  warranty: "the guarantee",
};

/** "your question about insurance", "your other question". */
export function topicWords(topic: string): string {
  if (topic === "availability") return "your question about availability";
  return TOPIC_WORDS[topic] ?? "your other question";
}

/** Whether a topic is one to save the owner's answer for, to offer next time. */
export function isReusableTopic(topic: string): boolean {
  return topic in TOPIC_WORDS;
}

/**
 * The line a reply that is still asking for a count carries about a question
 * they asked: said now, answered with the price.
 */
export function laterLine(topic: string): string {
  const words = TOPIC_WORDS[topic];
  if (topic === "availability") return "I'll let you know about the day with the price.";
  if (!words) return "I'll answer your question with the price.";
  return words.startsWith("your question")
    ? `I'll answer ${words} with the price.`
    : `I'll answer your question about ${words} with the price.`;
}

function dateOf(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** "Saturday 3 and Sunday 4 October", "Saturday 3 October". */
export function daysPhrase(isos: readonly string[], joiner: "and" | "or"): string {
  const dates = isos.map(dateOf);
  const sameMonth = dates.every((d) => d.getMonth() === dates[0]!.getMonth());
  const long = dates.map((d, i) =>
    format(d, sameMonth && i < dates.length - 1 ? "EEEE d" : "EEEE d MMMM", { locale: enAU }),
  );
  if (long.length <= 1) return long[0] ?? "";
  return `${long.slice(0, -1).join(", ")} ${joiner} ${long.at(-1)}`;
}

/** An availability answer, day by day: "2026-10-03=yes|2026-10-04=no". */
export function availabilityValue(days: ReadonlyArray<[string, DayChoice]>): string {
  return days.map(([iso, c]) => `${iso}=${c}`).join("|");
}

/** The stored answer as days and choices, a plain choice for a question with no days, or null. */
export function parseAvailability(
  value: string,
): { days: [string, DayChoice][] } | { plain: DayChoice } | null {
  const v = value.trim();
  if (DAY_CHOICES.has(v)) return { plain: v as DayChoice };
  const days: [string, DayChoice][] = [];
  for (const part of v.split("|")) {
    const m = /^(\d{4}-\d{2}-\d{2})=(yes|no|later)$/.exec(part.trim());
    if (!m) return null;
    days.push([m[1]!, m[2] as DayChoice]);
  }
  return days.length ? { days } : null;
}

/**
 * Whether a stored availability answer still answers the question: the days
 * it was given for are exactly the days asked for now.
 */
export function availabilitySettled(value: string, askedIsos: readonly string[]): boolean {
  const read = parseAvailability(value);
  if (!read) return false;
  if ("plain" in read) return askedIsos.length === 0;
  const answered = read.days.map(([iso]) => iso).sort();
  const asked = [...askedIsos].sort();
  return answered.length === asked.length && answered.every((iso, i) => iso === asked[i]);
}

/**
 * Validate an availability answer against the days asked now and the days
 * the owner does not work: every day answered, and never a Yes (or a "come
 * back") on a closed day.
 */
export function availabilityProblem(
  value: string,
  askedIsos: readonly string[],
  closedIsos: ReadonlySet<string>,
): string | null {
  const read = parseAvailability(value);
  if (!read) return "Answer yes, no, or that you'll come back to them.";
  if (!availabilitySettled(value, askedIsos)) {
    return "The days they asked about have changed. Open the enquiry again and answer for these days.";
  }
  if ("days" in read && read.days.some(([iso, c]) => closedIsos.has(iso) && c !== "no")) {
    return "That day is one you don't work, so the reply can't say you're free then.";
  }
  return null;
}

/** The reply's lines for an availability answer: yes days, no days, then days to come back on. */
function availabilityLines(value: string): string[] {
  const read = parseAvailability(value);
  if (!read) return [];
  if ("plain" in read) {
    if (read.plain === "yes") return ["Yes, I'm available."];
    if (read.plain === "no") return ["Sorry, I'm not available then."];
    return ["I'll check my calendar and come back to you."];
  }
  const of = (c: DayChoice) => read.days.filter(([, x]) => x === c).map(([iso]) => iso);
  const out: string[] = [];
  const yes = of("yes");
  const no = of("no");
  const later = of("later");
  if (yes.length) out.push(`Yes, I'm available on ${daysPhrase(yes, "and")}.`);
  if (no.length) out.push(`Sorry, I'm not available on ${daysPhrase(no, "or")}.`);
  if (later.length) {
    out.push(`I'll check my calendar for ${daysPhrase(later, "and")} and come back to you.`);
  }
  return out;
}

/** The reply's line(s) for an answered question, or none for one the owner chose to leave. */
export function askReplyLines(field: string, value: string): string[] {
  const v = value.trim();
  const topic = askTopic(field);
  if (topic === "availability") return availabilityLines(v);
  if (!v || v === ASK_CHOICE.ignore || v === "open") return [];
  if (v === ASK_CHOICE.later) return [`I'll come back to you on ${topicWords(topic)}.`];
  // Their own answer, as they wrote it.
  return [/[.!?]$/.test(v) ? v : `${v}.`];
}

/**
 * The days a question is about, from the date fact: "on Saturday 3 or Sunday
 * 4 October" for the reply, "Sat 3 or Sun 4 Oct" for the owner. A stretch or a
 * loose ask ("next week") keeps the owner's reading and adds no days.
 */
export function askWhen(
  facts: ReadonlyArray<{ field: string; value: unknown; displayValue?: string }>,
): { phrase?: string; short?: string; isos: string[] } {
  const date = facts.find((f) => f.field.trim().toLowerCase() === "date");
  const value = String(date?.value ?? "").trim();
  const isos = value.split("|").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (isos.length === 0) {
    const shown = String(date?.displayValue ?? "")
      .replace(/^Asked about:\s*/, "")
      .replace(/^"|"$/g, "")
      .trim();
    return shown && value !== "asap" ? { short: shown, isos } : { isos };
  }
  const dates = isos.map(dateOf);
  const sameMonth = dates.every((d) => d.getMonth() === dates[0]!.getMonth());
  const short = dates.map((d, i) =>
    format(d, sameMonth && i < dates.length - 1 ? "EEE d" : "EEE d MMM", { locale: enAU }),
  );
  return { phrase: `on ${daysPhrase(isos, "or")}`, short: short.join(" or "), isos };
}

/** "Sat 3 Oct". */
export function shortDay(iso: string): string {
  return format(dateOf(iso), "EEE d MMM", { locale: enAU });
}

/** Validate an owner's answer to a general question before it is stored. Null when fine. */
export function askAnswerProblem(field: string, value: string): string | null {
  const v = value.trim();
  if (askTopic(field) === "availability") return null;
  if (v === ASK_CHOICE.later || v === ASK_CHOICE.ignore) return null;
  if (v.length < 2) return "Write your answer in a sentence, or choose to come back to them.";
  if (v.length > 300) return "Keep the answer to one or two sentences.";
  return null;
}

/**
 * The owner's next step for a question waiting on them, and why it is "Not
 * yet": one wording for the row, the chip reason and the card.
 */
export function questionStep(q: { thing: string; kind?: "availability" | "ask"; when?: string }): {
  step: string;
  reason: string;
} {
  if (q.kind === "availability") {
    const when = q.when ? ` ${q.when}` : "";
    return { step: `Answer: are you free${when}?`, reason: `they asked if you're free${when}` };
  }
  if (q.kind === "ask") {
    return { step: "Answer their question", reason: "they asked you a question" };
  }
  return { step: `Answer: do you do ${q.thing}?`, reason: `they asked if you do ${q.thing}` };
}
