import type { Enquiry } from "@/domain/types";
import { RIDGE_CREW_WINDOW_RULE } from "@/lib/site/signature-demo";
import { fact, msg, na, src, why } from "./helpers";

// Authored demonstration, not the output of a live crew evaluator.
export const UI1_PAINTING: Enquiry = {
  id: "ui1-painting",
  fixtureId: "UI1_PAINTING",
  businessId: "ridge",
  customerName: "Maya Chen",
  customerEmail: "maya.chen@example.com",
  source: "email",
  serviceLabel: "Interior painting",
  eventLabel: "Four bedrooms, living areas and ceilings",
  dateLabel: "Three-weekday window requested",
  locationLabel: "New Farm",
  receivedAt: "2026-09-14T09:00:00+10:00",
  updatedAt: "2026-09-14T10:15:00+10:00",
  state: {
    lifecycle: "OPEN",
    decision: "ACTION_READY",
    commercial: "UNASSESSED",
    responsibility: "BUSINESS",
  },
  facts: [
    fact({
      id: "ui1-scope",
      field: "scope",
      label: "Scope",
      value: "4 bedrooms + living areas + ceilings",
      displayValue: "4 bedrooms + living areas + ceilings",
      status: "confirmed",
      confidence: "High",
      assertedBy: "customer",
      provenance: src("message", "Maya's updated request"),
      customerSpecific: true,
    }),
    fact({
      id: "ui1-window",
      field: "window",
      label: "Working window",
      value: "3 weekdays",
      displayValue: "3 weekdays, reduced from 5",
      status: "confirmed",
      confidence: "High",
      assertedBy: "customer",
      provenance: src("message", "Maya's updated request"),
      customerSpecific: true,
    }),
  ],
  conversation: [
    msg({
      id: "ui1-m1",
      direction: "inbound",
      channel: "email",
      at: "2026-09-14T09:00:00+10:00",
      from: "Maya Chen",
      subject: "Painting before we move in",
      body: "Hi Tom, could you paint four bedrooms and the living areas in our New Farm house? It will be empty for five weekdays before we move in. Can we arrange a measure?",
    }),
    msg({
      id: "ui1-m2",
      direction: "inbound",
      channel: "email",
      at: "2026-09-14T10:15:00+10:00",
      from: "Maya Chen",
      body: "Hi Tom, a change to the plan: we now only have three weekdays before moving in, and we'd like the ceilings painted too. Can you still help?\n\nThanks,\nMaya",
    }),
  ],
  decision: {
    evaluators: [
      na("pricing", "Living areas need measuring before a quote can be prepared."),
      {
        type: "capacity",
        status: "FEASIBLE_WITH_CONDITION",
        summary:
          "The sample crew rule requires a third contractor. Their availability has not been confirmed.",
        ruleIds: [RIDGE_CREW_WINDOW_RULE.id],
      },
    ],
    missing: [],
    conflicts: [],
    recommendation: {
      action: "REQUEST_INFORMATION",
      label: "Ask about the extra crew option",
      reason:
        "Ceilings and the shorter window require a third contractor. Ask whether Maya is open to that option; check availability and keep the site measure before committing.",
      requiredApproval: true,
      reasonCodes: ["CREW_OPTION_REQUIRES_CONFIRMATION"],
      primaryEnabled: true,
    },
    explanation:
      "The sample business rule requires an extra contractor for ceilings or a window of three weekdays or fewer. This is a proposed option, not confirmed availability, a final quote or a booking.",
    why: [
      why(
        "ui1-rule",
        "The applicable crew rule",
        RIDGE_CREW_WINDOW_RULE.body,
        src("rule", "Tom's sample business rule"),
      ),
      why(
        "ui1-uncertain",
        "Still unconfirmed",
        "Contractor availability, the site measure and the final price. Nothing has been booked.",
        src("message", "Maya's updated request"),
      ),
    ],
    confidence: "Medium",
    risk: "MEDIUM",
    draft: {
      id: "ui1-draft",
      action: "REQUEST_INFORMATION",
      subject: "Re: Painting before we move in",
      body: "Hi Maya,\n\nThanks for the update. Adding the ceilings and reducing the window to three weekdays would need an extra painter under our crew rule.\n\nWould you be open to that option? I would need to check the contractor's availability before confirming the timing. We'd also keep the site measure so I can confirm the scope and price.\n\nNothing is booked yet.\n\nThanks,\nTom\nRidge & Co",
      groundedFacts: ["ui1-scope", "ui1-window"],
      voiceVersion: "v1",
    },
    quotes: [],
    automationEligible: false,
    failedGates: [],
    serviceComposition: [],
    changeDiff: [
      { factLabel: "Scope", from: "Bedrooms + living areas", to: "Ceilings added" },
      { factLabel: "Working window", from: "5 weekdays", to: "3 weekdays" },
    ],
  },
};
