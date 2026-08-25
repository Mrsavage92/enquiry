import { derivedLabel, queueSection } from "./labels";
import type { Enquiry } from "./types";

export function statusTone(enquiry: Enquiry): "neutral" | "ok" | "warn" | "danger" | "info" {
  const label = derivedLabel(enquiry.state, enquiry);
  if (enquiry.decision.risk === "PROHIBITED_AUTO") return "danger";
  if (label === "Reading" || label === "Snoozed") return "info";
  if (label === "Public comment") return "warn";
  if (label === "At risk" || label === "Needs you" || label === "Needs info") return "warn";
  if (label === "Follow-up ready") return "warn";
  if (label === "Ready to quote" || label === "Booked" || label === "Sent") return "ok";
  if (label === "Waiting on client") return "info";
  if (label === "Lost" || label === "Declined") return "neutral";
  return "neutral";
}

export { derivedLabel, queueSection };
