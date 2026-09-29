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
 * is recorded as `ask:<topic>` and nothing is "reply ready" until the owner
 * answers it, says they'll come back on it, or chooses to leave it.
 *
 * The owner's own answer to a question customers ask again ("Yes, fully
 * insured") is saved as a business answer the first time they type it, and
 * offered - never sent - the next time.
 */

export const ASK_PREFIX = "ask:";
export const ASK_AVAILABILITY = `${ASK_PREFIX}availability`;

/** The owner's choices; any other confirmed value on a general question is their answer. */
export const ASK_CHOICE = { yes: "yes", no: "no", later: "later", ignore: "ignore" } as const;

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
    /\b(?:bring|supply|provide|use)\s+(?:your\s+own\s+)?(?:equipment|products|supplies|gear|vacuum|materials|chemicals)\b/i,
  ],
  ["pets", /\b(?:pets?|dogs?|cats?)\b/i],
  ["parking", /\bpark(?:ing)?\b/i],
  ["warranty", /\b(?:warrant(?:y|ies)|guarantee[ds]?)\b/i],
];

/** "r u free", "are you available", "any availability", "can you fit us in". */
const AVAILABILITY =
  /\b(?:are|r)\s+(?:you|u|ya)\s+(?:free|available|around)\b|\b(?:do|would)\s+(?:you|u)\s+have\s+(?:any\s+)?(?:availability|time|room|space|a spot|spots|openings?)\b|\bany\s+availability\b|\bcan\s+(?:you|u)\s+fit\s+(?:me|us|it)\s+in\b|\bwhen\s+(?:are|r)\s+(?:you|u)\s+(?:free|available)\b/i;

/** Questions the quote itself answers: the price, and asking for the job. */
const ANSWERED_BY_QUOTE =
  /\b(?:how\s+much|price|prices|pricing|cost|costs|quote|charge|rate|rates|fee|fees)\b|\b(?:can|could|would|will)\s+(?:you|u|ya)\s+(?:please\s+)?(?:do|come|paint|clean|quote|book|fit|help|send|let|give|pop|make|get)\b/i;

/** How a real question starts. */
const QUESTION_START =
  /^(?:and\s+|also\s+|oh\s+|btw\s+|just\s+wondering\s+)?(?:do|does|did|are|r|is|was|can|could|will|would|have|has|how|what|when|who|which|where|should)\b/i;

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
    out.push({ text: raw.replace(/[.!]+$/, "").trim(), question: /\?/.test(raw) });
  }
  return out;
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

/**
 * The questions in a message the reply has to answer, beside the job itself.
 * Never "do you do X?" (that is a service question), never the price (the
 * quote answers it) and never asking for the job.
 */
export function readCustomerAsks(
  text: string,
  services: readonly string[] = [],
  details: readonly BusinessDetail[] = [],
): CustomerAsk[] {
  const out: CustomerAsk[] = [];
  const serviceQuestions = readServiceQuestions(text, services, details).map((q) =>
    q.span.toLowerCase(),
  );
  const seen = new Set<string>();
  for (const s of sentences(text)) {
    const words = s.text.replace(/\s+/g, " ");
    const lower = words.toLowerCase();
    if (serviceQuestions.some((q) => lower.includes(q.replace(/[?!.]+$/, "")))) continue;
    if (AVAILABILITY.test(words)) {
      if (!seen.has("availability")) {
        seen.add("availability");
        out.push({
          field: ASK_AVAILABILITY,
          kind: "availability",
          topic: "availability",
          question: `${words}?`.replace(/\?+$/, "?"),
        });
      }
      continue;
    }
    if (!s.question || !QUESTION_START.test(words)) continue;
    if (ANSWERED_BY_QUOTE.test(words) || words.split(/\s+/).length < 3) continue;
    // "do you do a trial?" is a service or an extra, read and priced as one.
    if (SERVICE_ASK.test(words)) continue;
    if (services.some((svc) => mentionsAny(words, ownStems(svc)))) continue;
    const topic = TOPICS.find(([, re]) => re.test(words))?.[0] ?? `q-${idOf(lower)}`;
    if (seen.has(topic)) continue;
    seen.add(topic);
    out.push({ field: `${ASK_PREFIX}${topic}`, kind: "ask", topic, question: `${words}?` });
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
  return TOPIC_WORDS[topic] ?? "your other question";
}

/** Whether a topic is one to save the owner's answer for, to offer next time. */
export function isReusableTopic(topic: string): boolean {
  return topic in TOPIC_WORDS;
}

/** The reply's line for an answered question, or null for one the owner chose to leave. */
export function askReplyLine(
  field: string,
  value: string,
  when: { phrase?: string } = {},
): string | null {
  const v = value.trim();
  const topic = askTopic(field);
  const at = when.phrase ? ` ${when.phrase}` : "";
  if (topic === "availability") {
    if (v === ASK_CHOICE.yes) return `Yes, I'm available${at}.`;
    if (v === ASK_CHOICE.no) return `Sorry, I'm not available${at}.`;
    if (v === ASK_CHOICE.later) {
      return when.phrase
        ? `I'll check my calendar for${at} and come back to you.`
        : "I'll check my calendar and come back to you.";
    }
    return null;
  }
  if (!v || v === ASK_CHOICE.ignore || v === "open") return null;
  if (v === ASK_CHOICE.later) return `I'll come back to you on ${topicWords(topic)}.`;
  // Their own answer, as they wrote it.
  return /[.!?]$/.test(v) ? v : `${v}.`;
}

/**
 * The days a question is about, from the date fact: "on Saturday 3 or Sunday
 * 4 October" for the reply, "Sat 3 or Sun 4 Oct" for the owner. A stretch or a
 * loose ask ("next week") keeps the owner's reading and adds no days to the reply.
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
  const dates = isos.map((iso) => {
    const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
    return new Date(y, m - 1, d);
  });
  const sameMonth = dates.every((d) => d.getMonth() === dates[0]!.getMonth());
  const long = dates.map((d, i) =>
    format(d, sameMonth && i < dates.length - 1 ? "EEEE d" : "EEEE d MMMM", { locale: enAU }),
  );
  const short = dates.map((d, i) =>
    format(d, sameMonth && i < dates.length - 1 ? "EEE d" : "EEE d MMM", { locale: enAU }),
  );
  return { phrase: `on ${long.join(" or ")}`, short: short.join(" or "), isos };
}

/** Validate an owner's answer to a question before it is stored. Null when fine. */
export function askAnswerProblem(field: string, value: string): string | null {
  const v = value.trim();
  if (askTopic(field) === "availability") {
    return v === ASK_CHOICE.yes || v === ASK_CHOICE.no || v === ASK_CHOICE.later
      ? null
      : "Answer yes, no, or that you'll come back to them.";
  }
  if (v === ASK_CHOICE.later || v === ASK_CHOICE.ignore) return null;
  if (v.length < 2) return "Write your answer in a sentence, or choose to come back to them.";
  if (v.length > 300) return "Keep the answer to one or two sentences.";
  return null;
}
