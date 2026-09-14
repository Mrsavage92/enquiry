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
