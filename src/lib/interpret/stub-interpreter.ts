import type { EnquiryInterpreter, InterpretationResult } from "./types";

/**
 * A deterministic, dev-only stand-in for a real model.
 *
 * NEVER wired up in production: `isStubInterpreterEnabled()` requires
 * `NODE_ENV !== "production"` AND the absence of `VERCEL`, on top of the
 * explicit `ENQUIRY_INTERPRETER=stub` opt-in, so a stray env var left set on a
 * deploy cannot turn this on by accident. Its provenance always reports the
 * model as `"stub-development"` - a value that can never collide with a real
 * model id - so a fact it produced can never be mistaken for one a real
 * provider produced.
 *
 * Deliberately simple pattern matching, not a parser: this exists so the
 * interpretation -> inferred-fact -> confirm loop can be exercised end to end
 * in a browser with no API key and no spend, not to demonstrate extraction
 * quality.
 */

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const QUANTITY_NOUN_RE = /\b(\d{1,3})\s*(guests?|people|pax|bridesmaids?|attendees?|persons?)\b/i;
const BARE_NUMBER_RE = /\b(\d{1,3})\b/;

export function isStubInterpreterEnabled(): boolean {
  return (
    process.env.ENQUIRY_INTERPRETER === "stub" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.VERCEL
  );
}

function extractQuantity(message: string): { value: string; span: string } | null {
  const withNoun = message.match(QUANTITY_NOUN_RE);
  if (withNoun) return { value: withNoun[1]!, span: withNoun[0] };
  const bare = message.match(BARE_NUMBER_RE);
  if (bare) return { value: bare[1]!, span: bare[0] };
  return null;
}

function extractDate(message: string): { label: string; span: string } | null {
  const lower = message.toLowerCase();
  for (const month of MONTHS) {
    const idx = lower.indexOf(month);
    if (idx === -1) continue;
    const withDay =
      message.match(new RegExp(`\\d{1,2}(?:st|nd|rd|th)?\\s+of\\s+${month}`, "i")) ??
      message.match(new RegExp(`${month}\\s+\\d{1,2}(?:st|nd|rd|th)?`, "i"));
    const span = withDay ? withDay[0] : message.slice(idx, idx + month.length);
    return { label: span, span };
  }
  return null;
}

export const stubInterpreter: EnquiryInterpreter = {
  async interpret({ rawMessage, messageId, business }) {
    const facts: InterpretationResult["facts"] = [];

    const quantity = extractQuantity(rawMessage);
    if (quantity) {
      facts.push({
        field: "guests",
        value: quantity.value,
        displayValue: `${quantity.value} guests`,
        confidence: "medium",
        span: quantity.span,
      });
    }

    const date = extractDate(rawMessage);
    if (date) {
      facts.push({
        field: "date",
        value: date.label,
        displayValue: date.label,
        confidence: "medium",
        span: date.span,
      });
    }

    // A confirmed pricing rule names the service just as reliably as a
    // catalogued service entry does, and in this dev/local-only path it is
    // often the ONLY place a service name lives - so fall back to it rather
    // than proposing nothing whenever a service catalogue hasn't been built
    // out yet.
    const firstRuleService = business.ruleSummaries
      .map((s) => s.split(":")[0]?.trim())
      .find((s) => s);
    const firstService = business.services.find((s) => s.trim()) ?? firstRuleService;
    const serviceCandidate = firstService
      ? {
          label: firstService,
          confidence: "medium" as const,
          span: rawMessage.slice(0, Math.min(60, rawMessage.length)) || firstService,
        }
      : null;

    const result: InterpretationResult = {
      serviceCandidate,
      facts,
      ambiguities: [],
      candidateMissingFacts: [],
    };
    void messageId; // not needed for a fixed stub result, kept for interface parity
    return { ok: true, result, model: "stub-development" };
  },
};
