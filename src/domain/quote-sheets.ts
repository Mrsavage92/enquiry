import type { Enquiry, QuoteVersion } from "./types";
import { resolvedHold } from "./commercial";

export function quoteSheets(enquiry: Enquiry): QuoteVersion[] {
  if (enquiry.decision.quotes.length > 0) {
    return [...enquiry.decision.quotes].sort((a, b) => a.version - b.version);
  }
  const pricing = enquiry.decision.evaluators.find((e) => e.type === "pricing");
  if (!pricing) return [];
  if (
    pricing.status === "NOT_QUOTABLE" ||
    pricing.status === "UNKNOWN" ||
    pricing.status === "NOT_APPLICABLE"
  ) {
    return [];
  }
  if (!pricing.total && !pricing.range) return [];
  return [
    {
      id: `${enquiry.id}-derived`,
      version: 1,
      status: "draft",
      total: pricing.total,
      range: pricing.range,
      lineItems: pricing.lineItems ?? [],
      assumptions: pricing.assumptions ?? [],
      ruleSetVersion: pricing.ruleIds?.[0] ?? "",
      hold: resolvedHold({
        total: pricing.total,
        range: pricing.range,
      }),
    },
  ];
}
