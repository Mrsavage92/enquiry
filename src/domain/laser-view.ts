import type { Enquiry } from "./types.ts";
import { PROMISE_WORDS, promiseVerdict } from "./labels.ts";
import { dollarMatches } from "./voice-detect.ts";

/**
 * Display readings for the laser screen that are plain functions: the verdict
 * line and its tone, the reply split for its read view, and the safeguards in
 * the owner's words. Nothing here decides anything.
 */

/** Two lines of 16px text at 390px, about 34 characters a line (doc 50 section 5). */
export const VERDICT_MAX = 68;

export function verdictLine(enquiry: Enquiry): { line: string; tone: "ok" | "warn" | "danger" } {
  const v = promiseVerdict(enquiry);
  const line =
    v.line.length > VERDICT_MAX ? `${v.line.slice(0, VERDICT_MAX - 3).trimEnd()}...` : v.line;
  const tone =
    v.word === PROMISE_WORDS.yes ? "ok" : v.word === PROMISE_WORDS.no ? "danger" : "warn";
  return { line, tone };
}

export type Segment = { text: string; kind: "plain" | "amount" | "fresh" };

/** Split the reply into plain text, amounts and freshly changed lines, in order. */
export function segmentsOf(text: string, fresh: readonly string[]): Segment[] {
  const marks: { from: number; to: number; kind: Segment["kind"] }[] = [];
  for (const line of fresh) {
    const at = line.trim() ? text.indexOf(line) : -1;
    if (at >= 0) marks.push({ from: at, to: at + line.length, kind: "fresh" });
  }
  for (const m of dollarMatches(text)) {
    const inside = marks.some((k) => m.index >= k.from && m.index < k.to);
    if (!inside) marks.push({ from: m.index, to: m.index + m.raw.length, kind: "amount" });
  }
  const sorted = [...marks].sort((a, b) => a.from - b.from);
  const out: Segment[] = [];
  let at = 0;
  for (const mark of sorted) {
    if (mark.from < at) continue;
    if (mark.from > at) out.push({ text: text.slice(at, mark.from), kind: "plain" });
    out.push({ text: text.slice(mark.from, mark.to), kind: mark.kind });
    at = mark.to;
  }
  if (at < text.length) out.push({ text: text.slice(at), kind: "plain" });
  return out;
}

/** The safeguards the inline card showed, in the owner's words (all but the action-class line). */
const GATE_WORDS: Record<string, string> = {
  "PricingResult ERROR": "Pricing could not be verified",
  "Conflicting authoritative rules": "Your confirmed prices disagree",
  "Risk class PROHIBITED_AUTO": "This requires your personal review",
  "Public surface - needs your permission": "Public replies require your review",
  "Material service mapping below safe threshold":
    "The requested service is not clear enough to quote",
  "Follow-up action class is Ask every time": "Follow-ups require your approval",
};

export function riskLines(enquiry: Pick<Enquiry, "decision">): string[] {
  return enquiry.decision.failedGates
    .filter((gate) => !/^Action class .* is set to /i.test(gate))
    .map((gate) => GATE_WORDS[gate] ?? gate);
}
