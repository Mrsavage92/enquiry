import type { BusinessRule } from "./business-rule.ts";
import { EXTRA_CHOICE, extraField, extraLabel, isExtraField } from "./extras.ts";
import { matchRule } from "./price-compiler.ts";

/**
 * The saved prices "Add a line" may offer when an edited reply names more than
 * the quote: never the main job, never something already on the quote, never
 * something the owner deliberately left out. Choosing one writes to the extra
 * already recorded for it (so "oven cleaning", left out and then priced, is one
 * fact with one answer - not a second field that puts "$120" and "I haven't
 * included oven cleaning" in the same reply).
 */
export type LineChoice = { rule: BusinessRule; field: string };

type FactLike = { field: string; value: string; status: string; superseded?: boolean };

export function lineChoicesFor(
  rules: BusinessRule[],
  facts: readonly FactLike[],
  serviceLabel: string,
  lineLabels: readonly string[],
): LineChoice[] {
  const key = (s: string) => s.trim().toLowerCase();
  const ruleOf = (label: string) => {
    const m = matchRule(rules, label);
    return m.kind === "one" ? m.rule : undefined;
  };
  const onQuote = new Set([serviceLabel, ...lineLabels].map(key));
  const extras = facts
    .filter((f) => !f.superseded && isExtraField(f.field))
    .map((f) => ({ fact: f, rule: ruleOf(extraLabel(f.field)) }));
  const leftOut = new Set(
    extras
      .filter(
        (e) => e.rule && e.fact.status === "confirmed" && e.fact.value === EXTRA_CHOICE.leaveOut,
      )
      .map((e) => key(e.rule!.service)),
  );
  return rules
    .filter((r) => !onQuote.has(key(r.service)) && !leftOut.has(key(r.service)))
    .map((rule) => {
      const existing = extras.find((e) => e.rule && key(e.rule.service) === key(rule.service));
      return { rule, field: existing ? existing.fact.field : extraField(rule.service) };
    });
}
