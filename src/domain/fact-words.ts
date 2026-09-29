import { parseBusinessRule, type BusinessRule } from "./business-rule.ts";
import { detailEffect, parseBusinessDetail, type BusinessDetail } from "./business-detail.ts";
import { decidingPhrase } from "./price-compiler.ts";
import type { KnowledgeItem, KnowledgeState } from "./types";

/**
 * A saved business fact in the owner's words. "authoritative · 1" and
 * "Active" were the database talking; the owner needs to know whether Enquiry
 * is using it, where it came from, what they wrote and what it does.
 */

const STATE_WORDS: Record<KnowledgeState, string> = {
  Active: "In use",
  "Needs review": "Check this",
  Superseded: "Replaced",
  Proposed: "Suggested",
  Confirmed: "Saved",
  Disabled: "Removed",
};

export function factStateWord(state: KnowledgeState): string {
  return STATE_WORDS[state] ?? state;
}

/** "Confirmed by the owner" is the owner themselves: "You added this". */
export function factSourceWords(label: string | undefined): string {
  const l = (label ?? "").trim();
  if (!l || /^confirmed by the owner$/i.test(l)) return "You added this";
  return l;
}

/** What the owner wrote when they saved it, when it was kept. */
export function factSaid(item: Pick<KnowledgeItem, "source">): string | undefined {
  const detail = item.source?.kind === "user" ? item.source.detail?.trim() : undefined;
  return detail || undefined;
}

export type FactPayload =
  { kind: "rule"; value: BusinessRule } | { kind: "detail"; value: BusinessDetail };

/** The machine half of a fact, validated, or null when it has none. */
export function factPayload(raw: unknown): FactPayload | null {
  if (raw === undefined || raw === null) return null;
  const rule = parseBusinessRule(raw);
  if (rule.ok) return { kind: "rule", value: rule.rule };
  const detail = parseBusinessDetail(raw);
  if (detail.ok) return { kind: "detail", value: detail.detail };
  return null;
}

/** What Enquiry does with it, one sentence. */
export function factEffect(payload: FactPayload): string {
  if (payload.kind === "detail") return detailEffect(payload.value);
  const rule = payload.value;
  if (rule.kind === "fixed_price")
    return "One flat price for this job, used on every quote for it.";
  if (rule.base) {
    return `Covers the first ${rule.base.upTo}; each one after that adds the extra price. When a customer does not say how many, Enquiry asks for ${decidingPhrase(rule.quantityField)}.`;
  }
  return `A price per ${rule.unit}. When a customer does not say how many, Enquiry asks for ${decidingPhrase(rule.quantityField)}.`;
}
