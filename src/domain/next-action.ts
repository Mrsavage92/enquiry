import type { Enquiry } from "./types";

/**
 * A next step that happens somewhere other than the enquiry itself.
 *
 * Every new owner starts with no prices, and every real enquiry they added used
 * to end on a disabled "Read this one" button: the product knew exactly what
 * was missing (their prices) and offered no way to supply it. These are the
 * escalations that have a concrete, enabled next step, read from the decision's
 * reason code so the row, the Start here card and the enquiry screen all say
 * the same thing.
 */
export type SetupStep = {
  kind: "add_prices" | "add_price" | "choose_service";
  /** The owner's next step, as the button and the row both say it. */
  label: string;
};

const LABELS: Record<SetupStep["kind"], string> = {
  add_prices: "Add your prices",
  add_price: "Add a price for this job",
  choose_service: "Say which service this is",
};

const CODES: Record<string, SetupStep["kind"]> = {
  ADD_PRICES: "add_prices",
  ADD_PRICE: "add_price",
  CHOOSE_SERVICE: "choose_service",
};

/**
 * Snapshots stored before the reason code existed carry only the sentence.
 * Matched here so an enquiry added last week is not left on a dead end until
 * something else happens to re-decide it.
 */
const LEGACY_NO_PRICES = /^No pricing rules are set up yet/;

export function setupStep(enquiry: Pick<Enquiry, "state" | "decision">): SetupStep | null {
  if (enquiry.state.lifecycle !== "OPEN") return null;
  if (enquiry.state.decision === "WAITING_ON_CLIENT") return null;
  const rec = enquiry.decision?.recommendation;
  if (!rec || rec.action !== "ESCALATE_HUMAN") return null;
  const code = (rec.reasonCodes ?? []).map((c) => CODES[c]).find(Boolean);
  const kind = code ?? (LEGACY_NO_PRICES.test(rec.reason ?? "") ? "add_prices" : undefined);
  if (!kind) return null;
  // A second thing they asked for that nothing prices: the step names it.
  const extra = enquiry.decision?.extraPending;
  if (kind === "add_price" && extra?.kind === "no_price") {
    return { kind, label: `Add a price for ${extra.label.toLowerCase()}` };
  }
  return { kind, label: LABELS[kind] };
}

/** Whether the step is done on the business pricing screen. */
export function isPricingStep(step: SetupStep | null): boolean {
  return step?.kind === "add_prices" || step?.kind === "add_price";
}
