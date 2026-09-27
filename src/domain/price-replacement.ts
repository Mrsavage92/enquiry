import { describeRule, ruleFingerprint, type BusinessRule } from "./business-rule.ts";

/**
 * What saving a batch of prices will retire, shown before anything is saved:
 * every Active price for the same service that differs ("Replaces $190 per
 * bedroom"), and any other price for the same service in the same batch - two
 * prices for one service cannot both stand, so the later one would silently
 * retire the earlier.
 */
export type Replacement = { replaces: string[]; clashesWith: string[] };

const norm = (s: string) => s.trim().toLowerCase();
const priceOnly = (rule: BusinessRule) => describeRule(rule).replace(/^[^:]*:\s*/, "");

export function replacementsFor(
  active: readonly BusinessRule[],
  batch: readonly BusinessRule[],
): Replacement[] {
  return batch.map((rule, i) => {
    const same = (r: BusinessRule) =>
      norm(r.service) === norm(rule.service) && ruleFingerprint(r) !== ruleFingerprint(rule);
    return {
      replaces: active.filter(same).map(priceOnly),
      clashesWith: batch.filter((r, j) => j !== i && same(r)).map(priceOnly),
    };
  });
}
