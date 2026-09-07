import type { Enquiry, EnquiryFact } from "./types";

/**
 * Whether the owner has actually confirmed what this enquiry is for.
 *
 * The server refuses to prepare a quote without a live `confirmed` service
 * fact, which is right: a nonblank `service_label` proves nothing about who
 * decided it, because the interpreter writes that column too. But the only
 * control that could create the fact rendered exclusively for a fact the MODEL
 * had proposed - so an enquiry created before this slice, carrying a label and
 * no fact, showed a ready quote and an enabled button, refused the send, and
 * offered nowhere to fix it. Permanently unquotable through the UI.
 *
 * This is the shared read of that state, so the confirm control and the primary
 * action cannot disagree about it.
 */
export type ServiceAuthority =
  | { state: "confirmed"; fact: EnquiryFact }
  /** A model read it and nobody has agreed yet. */
  | { state: "proposed"; fact: EnquiryFact }
  /** A label with no authority behind it - a legacy or imported enquiry. */
  | { state: "unattributed"; label: string }
  /** Nothing to confirm: no service named at all. */
  | { state: "absent" };

function liveServiceFact(enquiry: Pick<Enquiry, "facts">): EnquiryFact | undefined {
  return (enquiry.facts ?? []).find(
    (f) => !f.superseded && f.field.trim().toLowerCase() === "service",
  );
}

export function serviceAuthority(
  enquiry: Pick<Enquiry, "facts" | "serviceLabel">,
): ServiceAuthority {
  const fact = liveServiceFact(enquiry);
  if (fact) {
    return fact.status === "confirmed"
      ? { state: "confirmed", fact }
      : { state: "proposed", fact };
  }
  const label = (enquiry.serviceLabel ?? "").trim();
  return label ? { state: "unattributed", label } : { state: "absent" };
}

/**
 * Whether the desk should ask the owner to confirm the service before offering
 * a commercial action. True for both a model proposal and a bare legacy label -
 * the question differs, the answer required does not.
 */
export function needsServiceConfirmation(
  enquiry: Pick<Enquiry, "facts" | "serviceLabel">,
): boolean {
  const authority = serviceAuthority(enquiry);
  return authority.state === "proposed" || authority.state === "unattributed";
}
