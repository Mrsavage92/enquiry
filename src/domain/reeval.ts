import type { Enquiry } from "./types";
import { ACTION_LABELS } from "./labels";

/** Deterministic fixture re-evaluation after a structured correction. */
export function reevaluateAfterFact(
  enquiry: Enquiry,
  factId: string,
  nextValue: string,
  displayValue: string,
): Enquiry {
  const next: Enquiry = structuredClone(enquiry);
  const fact = next.facts.find((f) => f.id === factId);
  if (fact) {
    fact.value = nextValue;
    fact.displayValue = displayValue;
    fact.status = "confirmed";
    fact.confidence = "High";
    fact.assertedBy = "user";
    fact.blocking = false;
  }

  if (next.id === "f09" && factId === "f09-service") {
    return applyF09(next, nextValue);
  }
  if (next.id === "f17" && factId === "f17-pkg") {
    return applyF17(next, nextValue);
  }
  if (next.id === "f03") {
    return applyF03(next);
  }
  if (next.id === "f15" && factId === "f15-addr") {
    return applyF15(next, displayValue);
  }

  return applyGenericUnlock(next, enquiry, factId, displayValue);
}

function applyGenericUnlock(
  next: Enquiry,
  original: Enquiry,
  factId: string,
  displayValue: string,
): Enquiry {
  const fact = next.facts.find((f) => f.id === factId);
  next.updatedAt = new Date().toISOString();
  next.decision.changeDiff = [
    {
      factLabel: fact?.label ?? "Fact",
      from: original.facts.find((f) => f.id === factId)?.displayValue ?? "",
      to: displayValue,
    },
  ];
  next.decision.missing = next.decision.missing.filter((m) => {
    const f = next.facts.find((x) => x.field === m.factField && !x.superseded);
    if (!f) return true;
    return f.status === "unknown" || f.status === "check_this" || (f.status === "range" && m.blocking);
  });
  const stillBlocking = next.facts.some(
    (f) =>
      !f.superseded &&
      f.blocking &&
      (f.status === "unknown" || f.status === "check_this"),
  );
  if (
    !stillBlocking &&
    next.decision.missing.length === 0 &&
    next.state.lifecycle === "OPEN" &&
    next.state.decision === "NEEDS_INFORMATION"
  ) {
    next.state.decision = "ACTION_READY";
    next.state.responsibility = "BUSINESS";
    if (next.valueExact) {
      next.state.commercial = "QUOTABLE";
      next.decision.recommendation = {
        ...next.decision.recommendation,
        action: "SEND_QUOTE",
        label: ACTION_LABELS.SEND_QUOTE,
        reason: "The blocking fact is in. An exact quote is allowed.",
        primaryEnabled: true,
        blockedReason: undefined,
      };
    } else if (next.valueRange) {
      next.state.commercial = "ESTIMATED";
      next.decision.recommendation = {
        ...next.decision.recommendation,
        action: "SEND_ESTIMATE",
        label: ACTION_LABELS.SEND_ESTIMATE,
        reason: "The blocking fact is in. The range stays a range.",
        primaryEnabled: true,
        blockedReason: undefined,
      };
    }
  }
  return next;
}

function applyF09(next: Enquiry, service: string): Enquiry {
  const isEvent = service === "event";
  next.serviceLabel = isEvent ? "Event coverage" : "Brand / headshot";
  next.state = {
    lifecycle: "OPEN",
    decision: "ACTION_READY",
    commercial: isEvent ? "ESTIMATED" : "QUOTABLE",
    responsibility: "BUSINESS",
  };
  if (isEvent) {
    next.valueRange = { min: 720, max: 1080, currency: "AUD" };
    next.valueExact = undefined;
    next.decision.evaluators = next.decision.evaluators.map((e) => {
      if (e.type === "pricing") {
        return {
          ...e,
          status: "RANGE",
          summary: "Estimated $720–$1,080 for 4–6 hours of event coverage",
          range: { min: 720, max: 1080, currency: "AUD" },
        };
      }
      if (e.type === "package_selection") {
        return { ...e, status: "VALIDATED", summary: "Mapped to Event coverage." };
      }
      if (e.type === "eligibility") {
        return { ...e, status: "PASS", summary: "Event coverage offered. Video still not offered." };
      }
      return e;
    });
    next.decision.recommendation = {
      action: "SEND_ESTIMATE",
      label: ACTION_LABELS.SEND_ESTIMATE,
      reason: "Service corrected to event coverage. Hours remain a range, so this is an estimate.",
      requiredApproval: true,
      reasonCodes: ["SEND_ESTIMATE"],
      primaryEnabled: true,
    };
    next.decision.draft = {
      ...next.decision.draft,
      action: "SEND_ESTIMATE",
      body: "Hi Leah,\n\nCoverage of the opening night is event photography - $180 an hour with a four-hour minimum, so likely $720–$1,080 depending on how long you need me. I don't shoot video. A few staff portraits can sit inside that coverage if we take them at the start.\n\nAlex\nNorthlight",
    };
    next.decision.explanation =
      "You corrected this to Event coverage. Video remains unsupported. Hours weren't given, so value stays a range.";
    next.decision.confidence = "High";
    next.decision.risk = "LOW";
    next.state.commercial = "ESTIMATED";
  } else {
    next.valueExact = { amount: 320, currency: "AUD" };
    next.valueRange = undefined;
    next.decision.evaluators = next.decision.evaluators.map((e) => {
      if (e.type === "pricing") {
        return {
          ...e,
          status: "EXACT",
          summary: "$320 half-day brand / headshot",
          total: { amount: 320, currency: "AUD" },
        };
      }
      if (e.type === "package_selection") {
        return { ...e, status: "VALIDATED", summary: "Mapped to Brand / headshot." };
      }
      return e;
    });
    next.decision.recommendation = {
      action: "SEND_QUOTE",
      label: ACTION_LABELS.SEND_QUOTE,
      reason: "Service corrected to brand / headshot. Exact half-day rate applies.",
      requiredApproval: true,
      reasonCodes: ["SEND_QUOTE"],
      primaryEnabled: true,
    };
    next.decision.draft = {
      ...next.decision.draft,
      action: "SEND_QUOTE",
      body: "Hi Leah,\n\nIf the main need is portraits of you and the team, that's a brand / headshot half-day - $320, up to three looks, studio or on-site at the cafe. I don't shoot video.\n\nAlex\nNorthlight",
    };
    next.decision.confidence = "High";
  }
  next.decision.changeDiff = [
    {
      factLabel: "Service",
      from: "Could be event coverage or brand / headshot",
      to: next.serviceLabel,
    },
    {
      factLabel: "Recommendation",
      from: "Needs you - ambiguous service",
      to: next.decision.recommendation.label,
    },
  ];
  next.updatedAt = new Date().toISOString();
  return next;
}

function applyF17(next: Enquiry, pkg: string): Enquiry {
  const identity = pkg === "identity";
  next.serviceLabel = identity ? "Brand identity" : "Brand refresh";
  next.valueExact = { amount: identity ? 4800 : 2400, currency: "AUD" };
  next.state = {
    lifecycle: "OPEN",
    decision: "ACTION_READY",
    commercial: "QUOTABLE",
    responsibility: "BUSINESS",
  };
  next.decision.evaluators = next.decision.evaluators.map((e) => {
    if (e.type === "pricing") {
      return {
        ...e,
        status: "EXACT",
        summary: identity ? "$4,800 identity" : "$2,400 refresh",
        total: next.valueExact,
      };
    }
    if (e.type === "package_selection") {
      return {
        ...e,
        status: "VALIDATED",
        summary: identity ? "New identity package." : "Refresh package.",
      };
    }
    return e;
  });
  next.decision.missing = [];
  next.decision.recommendation = {
    action: "SEND_QUOTE",
    label: ACTION_LABELS.SEND_QUOTE,
    reason: "Package selected. Price is now exact.",
    requiredApproval: true,
    reasonCodes: ["SEND_QUOTE"],
    primaryEnabled: true,
  };
  next.decision.changeDiff = [
    { factLabel: "Package", from: "Not chosen", to: next.serviceLabel },
    { factLabel: "Pricing", from: "Not applicable", to: identity ? "$4,800" : "$2,400" },
  ];
  next.updatedAt = new Date().toISOString();
  return next;
}

function applyF03(next: Enquiry): Enquiry {
  const type = next.facts.find((f) => f.field === "clean_type")?.value;
  const beds = next.facts.find((f) => f.field === "bedrooms")?.value;
  if (!type || !beds) return next;
  next.serviceLabel = type === "deep" ? "Deep clean" : "Standard clean";
  next.valueExact = { amount: type === "deep" ? 340 : 240, currency: "AUD" };
  next.state.decision = "ACTION_READY";
  next.state.commercial = "QUOTABLE";
  next.decision.missing = [];
  next.decision.recommendation = {
    action: "SEND_QUOTE",
    label: ACTION_LABELS.SEND_QUOTE,
    reason: "Scope is now known. Saturday morning remains possible.",
    requiredApproval: true,
    reasonCodes: ["SEND_QUOTE"],
    primaryEnabled: true,
  };
  next.decision.evaluators = next.decision.evaluators.map((e) => {
    if (e.type === "pricing") {
      return {
        ...e,
        status: "EXACT",
        summary: `$${next.valueExact?.amount} for the supplied scope`,
        total: next.valueExact,
      };
    }
    if (e.type === "capacity") {
      return { ...e, status: "FEASIBLE", summary: "Saturday morning crew window still holds." };
    }
    return e;
  });
  next.updatedAt = new Date().toISOString();
  return next;
}

function applyF15(next: Enquiry, address: string): Enquiry {
  next.locationLabel = address;
  next.state.decision = "ACTION_READY";
  next.state.commercial = "QUOTABLE";
  next.decision.missing = [];
  next.decision.evaluators = next.decision.evaluators.map((e) => {
    if (e.type === "location_travel") {
      return { ...e, status: "VALIDATED", summary: `${address} is inside 15 km. Travel $45.` };
    }
    if (e.type === "capacity") {
      return { ...e, status: "FEASIBLE", summary: "Travel time known. 5 Sep evening still free." };
    }
    return e;
  });
  next.decision.recommendation = {
    action: "SEND_QUOTE",
    label: ACTION_LABELS.SEND_QUOTE,
    reason: "Address is local. Exact $210 including travel.",
    requiredApproval: true,
    reasonCodes: ["SEND_QUOTE"],
    primaryEnabled: true,
  };
  next.decision.changeDiff = [
    { factLabel: "Address", from: "Not given", to: address },
    { factLabel: "Travel", from: "Unknown", to: "$45" },
  ];
  next.updatedAt = new Date().toISOString();
  return next;
}

export function reconnectCalendar(enquiry: Enquiry): Enquiry {
  const down = enquiry.decision.evaluators.some(
    (e) =>
      (e.type === "capacity" || e.type === "availability") &&
      e.status === "UNKNOWN_INTEGRATION",
  );
  if (!down) return enquiry;
  const next = structuredClone(enquiry);
  next.state.decision = "ACTION_READY";
  next.decision.evaluators = next.decision.evaluators.map((e) => {
    if (e.type === "capacity") {
      return {
        ...e,
        status: "FEASIBLE",
        summary:
          enquiry.id === "f10"
            ? "Calendar reconnected. Week of 7 Sep is free for hall + living."
            : "Calendar reconnected. The requested window is free.",
        unknownReason: undefined,
      };
    }
    if (e.type === "availability") {
      return {
        ...e,
        status: "VALIDATED",
        summary: enquiry.id === "f10" ? "Week of 7 Sep is clear." : "Requested window is clear.",
        unknownReason: undefined,
      };
    }
    return e;
  });
  const amount = next.valueExact?.amount;
  next.decision.recommendation = {
    action: amount ? "SEND_QUOTE" : "ACKNOWLEDGE",
    label: amount ? ACTION_LABELS.SEND_QUOTE : ACTION_LABELS.ACKNOWLEDGE,
    reason: amount
      ? `Availability is now known. Send the $${amount.toLocaleString("en-AU")} quote.`
      : "Availability is now known.",
    requiredApproval: true,
    reasonCodes: [amount ? "SEND_QUOTE" : "ACKNOWLEDGE"],
    primaryEnabled: true,
  };
  if (enquiry.id === "f10") {
    next.decision.draft.body =
      "Hi Ibrahim,\n\nHall and living is $1,680 including prep and two coats. The week of 7 September is free - we can start Monday.\n\nTom\nRidge & Co";
  }
  next.decision.failedGates = [];
  next.decision.changeDiff = [
    { factLabel: "Calendar", from: "Disconnected / Unknown", to: "Reconnected · date is free" },
  ];
  return next;
}

export function resolveFamilyPrice(enquiry: Enquiry, amount: number): Enquiry {
  if (enquiry.id !== "f11") return enquiry;
  const next = structuredClone(enquiry);
  next.valueExact = { amount, currency: "AUD" };
  next.state.decision = "ACTION_READY";
  next.state.commercial = "QUOTABLE";
  next.decision.conflicts = [];
  next.decision.evaluators = next.decision.evaluators.map((e) => {
    if (e.type === "pricing") {
      return {
        ...e,
        status: "EXACT",
        summary: `$${amount} family session (conflict resolved)`,
        total: { amount, currency: "AUD" },
      };
    }
    return e;
  });
  next.decision.recommendation = {
    action: "SEND_QUOTE",
    label: ACTION_LABELS.SEND_QUOTE,
    reason: "Price conflict resolved. Exact quote is now allowed.",
    requiredApproval: true,
    reasonCodes: ["SEND_QUOTE"],
    primaryEnabled: true,
  };
  next.decision.draft.body = `Hi Elena,\n\nA family session at Edinburgh Gardens on 4 October is $${amount} for two hours and 30 edited images. Golden hour is free that afternoon.\n\nAlex\nNorthlight`;
  next.decision.failedGates = [];
  next.decision.changeDiff = [
    { factLabel: "Family session price", from: "Conflict $450 vs $520", to: `$${amount} active` },
  ];
  return next;
}
