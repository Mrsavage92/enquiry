/**
 * Where a correction to an enquiry fact has to go.
 *
 * The pencil-edit control called `correctFact` on the client Zustand store in
 * every mode. It showed a success toast and wrote a local audit line, fired no
 * network request, persisted nothing, never recomputed the price, and reverted
 * on reload. A correction that claims to have worked and did not is worse than
 * one that fails, and it is the same class of untruth as the copy-is-a-send
 * defect this slice exists to remove.
 *
 * It also left P03 unexercisable: with no server-side way to change a confirmed
 * quantity, no approval could ever go stale underneath an owner.
 *
 * Pulled out of the component so the rule is provable without a browser. The
 * one thing that must never happen is a live correction resolving to the local
 * store, and that is a statement about this function, not about a JSX tree.
 */

/** The service is corrected through its own path, not the generic fact one. */
const SERVICE_FIELD = "service";

export type CorrectionRoute =
  /**
   * `setEnquiryService` - it updates `enquiry.service_label` as well as the
   * fact, and writes the owner-asserted authority the quote boundary checks.
   * Routing the service through the generic path would leave the label stale.
   */
  | { kind: "service" }
  /** `answerEnquiryFact` - supersede, insert confirmed, re-decide, bump. */
  | { kind: "fact"; field: string }
  /** The demo's scripted local store. Reachable only in demo mode. */
  | { kind: "demo" };

export function isServiceField(field: string): boolean {
  return field.trim().toLowerCase() === SERVICE_FIELD;
}

export function correctionRoute(field: string, demoMode: boolean): CorrectionRoute {
  // Demo first and unconditionally: the demo is a scripted story with no server
  // enquiry behind it, and its narrator is the local store. Everything else is
  // a real business's real fact and goes to the server, whatever the field.
  if (demoMode) return { kind: "demo" };
  if (isServiceField(field)) return { kind: "service" };
  return { kind: "fact", field: field.trim() };
}
