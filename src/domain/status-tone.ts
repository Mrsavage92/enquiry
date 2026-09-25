import { derivedLabel, queueSection, STATUS } from "./labels";
import type { Enquiry } from "./types";

export function statusTone(enquiry: Enquiry): "neutral" | "ok" | "warn" | "danger" | "info" {
  const label = derivedLabel(enquiry.state, enquiry);
  if (enquiry.decision.risk === "PROHIBITED_AUTO") return "danger";
  switch (label) {
    case STATUS.reading:
    case STATUS.later:
    case STATUS.waiting:
    case STATUS.bookingToConfirm:
      return "info";
    case STATUS.publicComment:
    case STATUS.needsLook:
    case STATUS.needsDetail:
    case STATUS.yourCall:
    case STATUS.followUp:
      return "warn";
    case STATUS.replyReady:
    case STATUS.booked:
      return "ok";
    default:
      return "neutral";
  }
}

export { derivedLabel, queueSection };
