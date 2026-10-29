import { EXTRA_CHOICE } from "@/domain/extras";
import { QUESTION_ANSWER, questionThing } from "@/domain/service-questions";
import { ASK_CHOICE, askTopic } from "@/domain/customer-asks";
import {
  CLOSED_DAY_CHOICE,
  DATE_CHECK_CHOICE,
  isClosedDayField,
  isDateCheckField,
} from "@/domain/date-sweep";
import type { AskedItem } from "@/domain/asked";
import type { Enquiry } from "@/domain/types";
import { leadDateCue } from "./card-cues";

/** The ways to settle one thing they asked, shared by the ledger and the laser step. */
export type Choice = { value: string; label: string; done: string };

/**
 * The owner's ways to change one item, only in values the server accepts for
 * it (answer-fact-core.ts): an extra takes include / covered / leave out /
 * come back, a "do you do X?" takes yes / no / later, a question in their
 * words takes later / ignore (a new answer is written on the question card).
 * The job itself, the days they wrote and "are you free?" are read-only here.
 */
export function choicesFor(item: AskedItem, priced: string | null): Choice[] {
  const thing = item.text.toLowerCase();
  if (item.kind === "extra") {
    return [
      ...(priced
        ? [{ value: EXTRA_CHOICE.include, label: `Add it - ${priced}`, done: `Added ${thing}.` }]
        : []),
      {
        value: EXTRA_CHOICE.covered,
        label: "Part of the price",
        done: `Noted: ${thing} is part of this price.`,
      },
      {
        value: EXTRA_CHOICE.leaveOut,
        label: "Leave out",
        done: `The reply says ${thing} is not included.`,
      },
      {
        value: EXTRA_CHOICE.comeBack,
        label: "Come back to them",
        done: `The reply says you'll come back to them on ${thing}.`,
      },
    ];
  }
  if (item.kind === "question") {
    return [
      { value: QUESTION_ANSWER.yes, label: "Yes, I do it", done: "The reply says you do it." },
      { value: QUESTION_ANSWER.no, label: "No, I don't", done: "The reply says you don't do it." },
      {
        value: QUESTION_ANSWER.later,
        label: "Come back to them",
        done: "The reply says you'll come back to them on it.",
      },
    ];
  }
  if (isClosedDayField(item.id)) {
    return [
      {
        value: CLOSED_DAY_CHOICE.notAvailable,
        label: "Tell them I'm not available",
        done: "The reply says you're not available that day.",
      },
      {
        value: CLOSED_DAY_CHOICE.available,
        label: "I can do that day",
        done: "The reply says you'll confirm which day works.",
      },
    ];
  }
  if (isDateCheckField(item.id)) {
    return [
      {
        value: DATE_CHECK_CHOICE.confirm,
        label: "Tell them I'll confirm the day",
        done: "The reply says you'll confirm which day works.",
      },
      {
        value: DATE_CHECK_CHOICE.notADate,
        label: "It's not a date",
        done: "Nothing about it goes in the reply.",
      },
    ];
  }
  if (item.kind === "ask" && askTopic(item.id) !== "availability") {
    return [
      {
        value: ASK_CHOICE.later,
        label: "Come back to them",
        done: "The reply says you'll come back to them on it.",
      },
      { value: ASK_CHOICE.ignore, label: "Leave out", done: "Nothing about it goes in the reply." },
    ];
  }
  return [];
}

/** A line's words: the job's day by what it is for ("Wedding Sun 8 Nov"), the rest capitalised. */
export function itemWords(item: AskedItem, enquiry: Enquiry): string {
  // A "do you do X?" is named by what they asked, never by the answer the
  // ledger may carry as its display ("No - you don't do this").
  const text =
    item.id === "date"
      ? leadDateCue(enquiry) || item.text
      : item.kind === "question"
        ? `Do you do ${questionThing(item.id)}?`
        : item.text;
  return text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text;
}
