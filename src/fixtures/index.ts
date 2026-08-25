import { BUSINESSES, BUSINESS_BY_ID } from "./businesses";
import { ENQUIRIES, ENQUIRY_BY_ID } from "./enquiries";
import { BOOKINGS } from "./bookings";

export { BUSINESSES, BUSINESS_BY_ID, ENQUIRIES, ENQUIRY_BY_ID, BOOKINGS };

export const FIXTURE_INDEX = [
  { id: "F01", enquiryId: "f01", title: "Mobile beauty, complete", business: "Glow & Co", expect: "Exact $625, feasible, Send quote" },
  { id: "F02", enquiryId: "f02", title: "Photography with hour range", business: "Northlight", expect: "Range $720–$1,080, one missing fact" },
  { id: "F03", enquiryId: "f03", title: "Cleaning missing scope", business: "Harbour", expect: "No invented quote; two questions" },
  { id: "F04", enquiryId: "f04", title: "Painting deadline vs capacity", business: "Ridge & Co", expect: "Calendar clear ≠ feasible" },
  { id: "F05", enquiryId: "f05", title: "Unsupported TV + identity", business: "Atelier Field", expect: "Boundary, no invented capability" },
  { id: "F06", enquiryId: "f06", title: "Travel changes price and capacity", business: "Glow & Co", expect: "Travel line + 8am failure" },
  { id: "F07", enquiryId: "f07", title: "Hours changed after quote", business: "Northlight", expect: "Diff, immutable sent quote" },
  { id: "F08", enquiryId: "f08", title: "Follow-up ready", business: "Harbour", expect: "Conversation-aware follow-up" },
  { id: "F09", enquiryId: "f09", title: "Ambiguous service", business: "Northlight", expect: "Inline correction + Teach Enquiry" },
  { id: "F10", enquiryId: "f10", title: "Calendar disconnected", business: "Ridge & Co", expect: "Capacity Unknown, no availability claim" },
  { id: "F11", enquiryId: "f11", title: "Pricing-rule conflict", business: "Northlight", expect: "No exact quote until resolved" },
  { id: "F12", enquiryId: "f12", title: "Complaint / high-risk", business: "Harbour", expect: "Needs you, Autopilot blocked" },
  { id: "F13", enquiryId: "f13", title: "Possible duplicate", business: "Harbour", expect: "No automatic merge" },
  { id: "F14", enquiryId: "f14", title: "External booking handoff", business: "Atelier Field", expect: "Send booking link" },
  { id: "F15", enquiryId: "f15", title: "Autopilot-ready missing info", business: "Glow & Co", expect: "Ask address; evidence for Autopilot" },
  { id: "F16", enquiryId: "f16", title: "Hard vs soft feasibility", business: "Ridge & Co", expect: "Preference ≠ impossibility" },
  { id: "F17", enquiryId: "f17", title: "Same engine, different brain", business: "Atelier Field", expect: "Pricing/capacity N/A; compare with F01" },
  { id: "F18", enquiryId: "f18", title: "Instagram DM, complete", business: "Glow & Co", expect: "Exact $210, short DM, same quote sheet" },
  { id: "F19", enquiryId: "f19", title: "Facebook message, hours missing", business: "Northlight", expect: "Ask how long on Facebook; no invented hours" },
  { id: "F20", enquiryId: "f20", title: "Public Instagram comment", business: "Glow & Co", expect: "Not a quote. Invite to DM or ignore." },
] as const;

export function openValue(enquiries = ENQUIRIES): number {
  return enquiries
    .filter((e) => e.state.lifecycle === "OPEN")
    .reduce((sum, e) => sum + (e.valueExact?.amount ?? e.valueRange?.min ?? 0), 0);
}
