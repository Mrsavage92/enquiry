import { EXTRA_CHOICE, extraLabel, isExtraField } from "./extras.ts";
import {
  QUESTION_ANSWER,
  isQuestionField,
  questionSettled,
  questionThing,
} from "./service-questions.ts";
import { ASK_CHOICE, askTopic, askWhen, availabilitySettled, isAskField } from "./customer-asks.ts";
import { contextMentions, mentionWords } from "./date-roles.ts";
import { COVERAGE_FIELD } from "./coverage.ts";

/**
 * Everything the customer asked for or asked about, and where each stands.
 *
 * A reply that quotes the clean and says nothing about the exterior they also
 * asked for, the discount they asked about or the day they need it done by
 * tells them something untrue by leaving it out. So every item is listed with
 * its status, the reply carries a line for each, and nothing is ready while
 * one is still `open`:
 *
 *  - `answered`: the reply prices it, answers it, or says the day;
 *  - `left_out`: the owner chose to leave it out, and the reply says so;
 *  - `come_back`: the reply says the owner will come back on it;
 *  - `open`: the owner has not settled it yet.
 */

export type AskedStatus = "answered" | "left_out" | "come_back" | "open";

export type AskedItem = {
  /** The fact it is recorded against, or "service" / "date". */
  id: string;
  kind: "service" | "extra" | "question" | "ask" | "date";
  /**
   * Their words, or the thing's name: "is the price including paint?", "Oven
   * clean". A "do you do X?" is always the thing they asked about ("Exterior
   * painting"), never the owner's answer.
   */
  text: string;
  status: AskedStatus;
  /** A "do you do X?" the owner answered No: answered, and the reply says so kindly. */
  declined?: true;
};

/** "exterior painting" -> "Exterior painting". */
function sentenceCase(thing: string): string {
  const t = thing.trim();
  return t ? `${t[0]!.toUpperCase()}${t.slice(1)}` : t;
}

/** The ledger's words for a "do you do X?": the thing they asked about. */
export function questionLabel(field: string): string {
  return sentenceCase(questionThing(field));
}

/**
 * The owner's answer where the ledger's words belong: "Yes - you do this",
 * "No - you don't do this", "You'll come back to them on it". An enquiry
 * decided before pass 10 stored these as the item's text.
 */
const ANSWER_AS_TEXT = /^(?:yes|no)\s+-\s|^you'll come back to them on it$/i;

/**
 * A stored ledger as the desk reads it: a "do you do X?" item whose text is the
 * owner's answer (stored before pass 10) reads as the thing they asked about.
 */
export function readableAsked(items: readonly AskedItem[] | undefined): AskedItem[] | undefined {
  if (!items) return items;
  return items.map((i) =>
    i.kind === "question" && ANSWER_AS_TEXT.test(i.text.trim())
      ? { ...i, text: questionLabel(i.id) }
      : i,
  );
}

type LedgerFact = {
  field: string;
  value: unknown;
  status: string;
  displayValue?: string;
};

type LedgerDecision = {
  action: string;
  price: { kind: string };
  lines?: readonly { label: string }[];
  coverage?: { confirmed: boolean };
  questionPending?: unknown;
  extraPending?: unknown;
  declined?: readonly string[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Whether the reply names a priced total now. */
/**
 * Whether the quote prices it. "That's everything" is its own gate on top of
 * this, so an item on the quote is answered whether or not it is confirmed.
 */
function priced(d: LedgerDecision): boolean {
  return d.price.kind === "EXACT" && !d.questionPending && !d.extraPending;
}

function serviceStatus(d: LedgerDecision): AskedStatus {
  if (d.action === "DECLINE") return "answered";
  if (priced(d)) return "answered";
  // Still asking them for the one detail the price needs: the reply says so.
  if (d.action === "REQUEST_INFORMATION") return "answered";
  return "open";
}

function extraStatus(f: LedgerFact, d: LedgerDecision): AskedStatus | null {
  const choice = String(f.value ?? "")
    .trim()
    .toLowerCase();
  if (f.status !== "confirmed") return "open";
  if (choice === EXTRA_CHOICE.notAsked) return null;
  if (choice === EXTRA_CHOICE.covered) return "answered";
  if (choice === EXTRA_CHOICE.leaveOut) return "left_out";
  if (choice === EXTRA_CHOICE.comeBack) return "come_back";
  // A priced quote with nothing pending has every added extra on it, under
  // its own name or the saved price it matched; a reply still asking for the
  // count says it will be in the price.
  return priced(d) || d.action === "REQUEST_INFORMATION" ? "answered" : "open";
}

function askStatus(f: LedgerFact, askedIsos: readonly string[]): AskedStatus {
  if (f.status !== "confirmed") return "open";
  const v = String(f.value ?? "").trim();
  if (askTopic(f.field) === "availability") {
    if (!availabilitySettled(v, askedIsos)) return "open";
    return /(?:^|=)later\b/.test(v) ? "come_back" : "answered";
  }
  if (!v || v === "open") return "open";
  if (v === ASK_CHOICE.later) return "come_back";
  if (v === ASK_CHOICE.ignore) return "left_out";
  return "answered";
}

/** Every item they asked for or about, in the order the enquiry records them. */
export function askedLedger(
  decision: LedgerDecision,
  facts: readonly LedgerFact[],
  serviceLabel: string,
): AskedItem[] {
  const out: AskedItem[] = [];
  if (serviceLabel.trim()) {
    out.push({
      id: "service",
      kind: "service",
      text: serviceLabel.trim(),
      status: serviceStatus(decision),
    });
  }
  const when = askWhen(facts as never);
  for (const f of facts) {
    if (isExtraField(f.field)) {
      const status = extraStatus(f, decision);
      if (status) {
        out.push({ id: f.field, kind: "extra", text: extraLabel(f.field), status });
      }
      continue;
    }
    if (isQuestionField(f.field)) {
      const settled = f.status === "confirmed" && questionSettled(f.value);
      out.push({
        id: f.field,
        kind: "question",
        // The answered fact's display is the owner's answer ("No - you don't
        // do this"), never what they asked: the ledger names the thing.
        text: questionLabel(f.field),
        status: !settled
          ? "open"
          : String(f.value) === QUESTION_ANSWER.later
            ? "come_back"
            : "answered",
        ...(settled && String(f.value) === QUESTION_ANSWER.no ? { declined: true as const } : {}),
      });
      continue;
    }
    if (isAskField(f.field)) {
      out.push({
        id: f.field,
        kind: "ask",
        text: f.displayValue?.trim() || askTopic(f.field),
        status: askStatus(f, when.isos),
      });
    }
  }
  const date = facts.find((f) => norm(f.field) === "date");
  if (date && String(date.value ?? "").trim()) {
    out.push({
      id: "date",
      kind: "date",
      text: date.displayValue?.trim() || String(date.value),
      status: "answered",
    });
  }
  const context = facts.find((f) => norm(f.field) === "date_context");
  if (context) {
    for (const m of contextMentions(String(context.value ?? ""), context.displayValue ?? "")) {
      out.push({
        id: `date_context:${m.iso}`,
        kind: "date",
        text: mentionWords(m),
        status: "answered",
      });
    }
  }
  return out;
}

const NOT_A_CHECK = new Set([
  COVERAGE_FIELD,
  "service",
  "name",
  "phone",
  "email",
  "practice_price",
]);

/** The items still waiting on the owner. */
export function openAsked(items: readonly AskedItem[]): AskedItem[] {
  return items.filter((i) => i.status === "open");
}

/**
 * The owner's checks, settled and in all: every choice they made on this
 * enquiry (an extra, a question, an answer, a rule, how often), and every one
 * still open. The total only grows when something new is read, so a counter
 * built from it never restarts.
 */
export function checkCount(
  facts: readonly LedgerFact[],
  open: number,
): { done: number; total: number } {
  // Everything confirmed on an enquiry after it arrives is the owner's own
  // step; the service they typed and who the customer is are not checks.
  const done = facts.filter(
    (f) => f.status === "confirmed" && !NOT_A_CHECK.has(norm(f.field)),
  ).length;
  return { done, total: done + open };
}
