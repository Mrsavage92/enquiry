import type { Decision } from "./decide.ts";
import { composeReply, priceBlock, type ReplyContext } from "./compose-reply.ts";
import { impliedAmountsMinor } from "./price-compiler.ts";
import { holdingItems } from "./asked.ts";
import type { DecisionPrice } from "./types.ts";

/**
 * "That's everything" folded into Copy, only when the app is sure what the
 * price covers (research doc 51, decision 1).
 *
 * A separate confirm on every priced quote is the kind of prompt owners stop
 * reading by the second or third quote. What protects the customer is the
 * reply itself saying, in plain words, what the price covers and what it
 * leaves out. So when nothing about the scope is a guess, the reply already
 * carries the total and its scope sentence, Copy is labelled with what it
 * covers, and the coverage confirmation is written only when the owner says
 * they sent it. Whenever the app is unsure (an item read rather than stated,
 * a rough count, a range, something still to settle), the separate tap stays.
 */

/** Flags that only describe the price (per visit, a closed day the reply names). */
const DESCRIPTIVE_FLAGS = new Set(["recurring", "closed_day"]);

/** What the snapshot carries when the coverage tap is folded into Copy. */
export type CoverageFold = {
  /** The coverage key the owner attests by copying and recording this reply. */
  key: string;
  /** The reply as it reads once the coverage is confirmed. */
  body: string;
  price: Extract<DecisionPrice, { kind: "EXACT" }>;
  impliedAmountsMinor: number[];
  /** Every line that says what the price covers or leaves out: a copied reply keeps them all. */
  scope: string[];
  /** What Copy names: "covers 3 things". */
  items: number;
};

/** Whether this unconfirmed coverage can be confirmed by the send itself. */
export function foldable(decision: Decision): boolean {
  const coverage = decision.coverage;
  if (!coverage || coverage.confirmed) return false;
  if (decision.price.kind !== "EXACT" || decision.approximate) return false;
  if (decision.questionPending || decision.extraPending || decision.conflict) return false;
  if (decision.action === "DECLINE" || decision.provisional || decision.blocker) return false;
  if (decision.closedDay && !decision.closedDay.bookable) return false;
  if (holdingItems(decision.asked ?? []).length > 0) return false;
  if (coverage.lines.length === 0 || coverage.lines.some((l) => l.rough)) return false;
  return coverage.flagged.every((f) => DESCRIPTIVE_FLAGS.has(f.kind) && !f.thing);
}

/** A note that defers or excludes something they asked for: part of what the price leaves out. */
const LEAVES_OUT = /\bcome back to you on\b|\bhaven't included\b|\bdon't do\b|\bnot included\b/i;

/**
 * The scope lines of a priced reply: the total's sentence, its lines, what is
 * left out, and every note that says something they asked for is not in it.
 */
export function scopeLines(decision: Decision): string[] {
  const notes = (decision.replyNotes ?? []).filter((n) => LEAVES_OUT.test(n));
  return [...priceBlock(decision), ...notes].map((l) => l.trim()).filter(Boolean);
}

/** The fold for this decision, or nothing when the owner's own tap is still needed. */
export function coverageFold(decision: Decision, who: ReplyContext): CoverageFold | undefined {
  if (!foldable(decision) || decision.price.kind !== "EXACT") return undefined;
  const coverage = decision.coverage!;
  const confirmed: Decision = {
    ...decision,
    action: "SEND_QUOTE",
    coverage: { ...coverage, confirmed: true },
  };
  const scope = scopeLines(confirmed);
  if (scope.length === 0) return undefined;
  return {
    key: coverage.key,
    body: composeReply(confirmed, who),
    price: {
      kind: "EXACT",
      amountMinor: decision.price.amountMinor,
      currency: decision.price.currency,
      ...(decision.lines?.length ? { lines: decision.lines } : {}),
    },
    impliedAmountsMinor: impliedAmountsMinor(decision.price),
    scope,
    items: coverage.lines.filter((l) => !l.firstVisit).length,
  };
}

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Whether a reply still says everything the scope lines say, word for word. */
export function keepsScope(body: string, scope: readonly string[]): boolean {
  const text = squash(body);
  return scope.every((line) => text.includes(squash(line)));
}

/** "Copy reply - covers 3 things". */
export function coversLabel(items: number): string {
  return `Copy reply - covers ${items} ${items === 1 ? "thing" : "things"}`;
}
