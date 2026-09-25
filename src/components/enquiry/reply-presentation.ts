import type { Enquiry } from "@/domain/types";

// A recorded information request is history, not a new prepared reply.
export function isWaitingForInformation(enquiry: Enquiry): boolean {
  return (
    enquiry.state.lifecycle === "OPEN" &&
    enquiry.state.decision === "WAITING_ON_CLIENT" &&
    enquiry.state.responsibility === "CUSTOMER" &&
    enquiry.decision.recommendation.action === "REQUEST_INFORMATION" &&
    !enquiry.decision.recommendation.blockedReason &&
    enquiry.conversation.at(-1)?.direction === "outbound"
  );
}

/** An open enquiry whose ball is in the customer's court after a reply went out. */
export function isWaitingOnCustomer(enquiry: Enquiry): boolean {
  return (
    enquiry.state.lifecycle === "OPEN" &&
    enquiry.state.decision === "WAITING_ON_CLIENT" &&
    enquiry.state.responsibility === "CUSTOMER" &&
    enquiry.conversation.at(-1)?.direction === "outbound"
  );
}
