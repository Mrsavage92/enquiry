import type { Enquiry } from "@/domain/types";
import { ACTION_LABELS } from "@/domain/labels";
import { evalr, fact, msg, na, src, why } from "./helpers";

function rec(
  action: Enquiry["decision"]["recommendation"]["action"],
  reason: string,
  extra: Partial<Enquiry["decision"]["recommendation"]> = {},
): Enquiry["decision"]["recommendation"] {
  return {
    action,
    label: extra.label ?? ACTION_LABELS[action],
    reason,
    requiredApproval: extra.requiredApproval ?? true,
    reasonCodes: extra.reasonCodes ?? [action],
    primaryEnabled: extra.primaryEnabled ?? true,
    blockedReason: extra.blockedReason,
  };
}

/** A Glow enquiry that has just landed - facts extracted, decision not yet. */
export function arrivingEnquiry(id: string): Enquiry {
  return {
    id,
    fixtureId: "LIVE",
    businessId: "glow",
    customerName: "Sofia Rahman",
    customerEmail: "",
    customerHandle: "@sofia.eats",
    source: "instagram",
    serviceLabel: "Group mobile makeup",
    eventLabel: "Saturday lunch",
    dateLabel: "5 Sep 2026",
    locationLabel: "New Farm, Brisbane",
    receivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: {
      lifecycle: "OPEN",
      decision: "EVALUATING",
      commercial: "UNASSESSED",
      responsibility: "SYSTEM",
    },
    facts: [
      fact({
        id: `${id}-service`,
        field: "service",
        label: "Service",
        value: "group-makeup",
        displayValue: "Group mobile makeup",
        status: "inferred",
        confidence: "Medium",
        assertedBy: "system",
        provenance: src("message", "Instagram DM"),
      }),
      fact({
        id: `${id}-people`,
        field: "people",
        label: "People",
        value: "3",
        displayValue: "3 people",
        status: "inferred",
        confidence: "High",
        assertedBy: "customer",
        provenance: src("message", "Instagram DM"),
        customerSpecific: true,
      }),
      fact({
        id: `${id}-date`,
        field: "date",
        label: "Date",
        value: "2026-09-05",
        displayValue: "Saturday 5 Sep, from 10:30am",
        status: "inferred",
        confidence: "High",
        assertedBy: "customer",
        provenance: src("message", "Instagram DM"),
        customerSpecific: true,
      }),
      fact({
        id: `${id}-loc`,
        field: "location",
        label: "Location",
        value: "New Farm",
        displayValue: "New Farm, Brisbane",
        status: "inferred",
        confidence: "High",
        assertedBy: "customer",
        provenance: src("message", "Instagram DM"),
        customerSpecific: true,
      }),
    ],
    conversation: [
      msg({
        id: `${id}-m1`,
        direction: "inbound",
        channel: "instagram",
        at: new Date().toISOString(),
        from: "@sofia.eats",
        to: "@glowandco",
        body: "hi! makeup for me + two friends saturday 5th, 10.30 at mine in new farm? lunch not a wedding",
      }),
    ],
    decision: {
      evaluators: [
        evalr({ type: "pricing", status: "UNKNOWN", summary: "Still reading." }),
        evalr({ type: "capacity", status: "UNKNOWN", summary: "Still reading." }),
        evalr({ type: "availability", status: "UNKNOWN", summary: "Still reading." }),
        evalr({ type: "eligibility", status: "UNKNOWN", summary: "Still reading." }),
        na("package_selection"),
        na("location_travel"),
        na("qualification_routing"),
        na("deposit_booking_readiness"),
      ],
      missing: [],
      conflicts: [],
      recommendation: rec("WAIT", "Enquiry is still reading this request.", {
        label: "Reading",
        primaryEnabled: false,
      }),
      explanation: "Facts are extracted. Pricing and capacity have not finished.",
      why: [],
      confidence: "Low",
      risk: "LOW",
      draft: {
        id: `${id}-draft`,
        action: "WAIT",
        body: "",
        groundedFacts: [],
        voiceVersion: "v1",
      },
      quotes: [],
      automationEligible: false,
      failedGates: [],
      serviceComposition: [],
    },
  };
}

export function resolveArriving(enquiry: Enquiry): Enquiry {
  const next = structuredClone(enquiry);
  next.state = {
    lifecycle: "OPEN",
    decision: "ACTION_READY",
    commercial: "QUOTABLE",
    responsibility: "BUSINESS",
  };
  next.valueExact = { amount: 480, currency: "AUD" };
  next.facts = next.facts.map((f) =>
    f.status === "inferred" ? { ...f, status: "confirmed", confidence: "High" as const } : f,
  );
  next.decision = {
    evaluators: [
      evalr({
        type: "pricing",
        status: "EXACT",
        summary: "$145 × 3 + $45 travel = $480",
        total: { amount: 480, currency: "AUD" },
        lineItems: [
          { id: "p", label: "Group makeup × 3", amount: 435, quantity: 3, unit: "person", ruleId: "glow-price-group" },
          { id: "t", label: "Travel, New Farm", amount: 45, ruleId: "glow-travel" },
        ],
        ruleIds: ["glow-price-group", "glow-travel"],
      }),
      evalr({
        type: "capacity",
        status: "FEASIBLE",
        summary: "3 × 45 min + 20 min travel fits before the lunch.",
      }),
      evalr({
        type: "availability",
        status: "VALIDATED",
        summary: "Saturday 5 Sep morning is free.",
      }),
      evalr({
        type: "eligibility",
        status: "PASS",
        summary: "Group mobile makeup, three people, inside the travel radius.",
      }),
      evalr({
        type: "location_travel",
        status: "VALIDATED",
        summary: "New Farm is inside 15 km of Paddington.",
      }),
      na("package_selection"),
      na("qualification_routing"),
      na("deposit_booking_readiness"),
    ],
    missing: [],
    conflicts: [],
    recommendation: rec(
      "SEND_QUOTE",
      "Three people at the group rate, plus travel. They wrote on Instagram - reply there.",
      { label: "Send quote on Instagram" },
    ),
    explanation:
      "Group minimum is met. New Farm is inside the travel band. The diary is free Saturday morning.",
    why: [
      why(
        "w1",
        "Why $480?",
        "$145 each for three people, plus the $45 Paddington travel band.",
        src("rule", "Group Pricing v2"),
      ),
      why("w2", "Why feasible?", "3 × 45 min plus travel fits a 10:30am start.", src("calendar", "Glow diary")),
    ],
    confidence: "High",
    risk: "LOW",
    draft: {
      id: `${enquiry.id}-draft`,
      action: "SEND_QUOTE",
      body: "Hi Sofia - Saturday 5th from 10:30 in New Farm is $480 for the three of you, travel included. Want me to hold it?",
      groundedFacts: next.facts.map((f) => f.id),
      voiceVersion: "v1",
    },
    quotes: [
      {
        id: `${enquiry.id}-q1`,
        version: 1,
        status: "draft",
        total: { amount: 480, currency: "AUD" },
        lineItems: [
          { id: "p", label: "Group makeup × 3", amount: 435 },
          { id: "t", label: "Travel, New Farm", amount: 45 },
        ],
        assumptions: [],
        ruleSetVersion: "Group Pricing v2",
      },
    ],
    automationEligible: false,
    failedGates: [],
    serviceComposition: ["Group mobile makeup × 3", "Travel"],
    changeDiff: [{ factLabel: "Decision", from: "Reading", to: "Exact $480 · feasible" }],
  };
  next.updatedAt = new Date().toISOString();
  return next;
}
