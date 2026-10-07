import { channelBlocked } from "./channel";
import type { Business, Enquiry, EnquiryFact, KnowledgeItem } from "./types";

export type SituationKind =
  | "evaluating"
  | "duplicate"
  | "check_this"
  | "conflict"
  | "calendar_down"
  | "public_comment";

export type SituationTone = "warn" | "danger" | "neutral";

export type ConflictChoice = {
  knowledgeId: string;
  amount: number;
  title: string;
  body: string;
  source: string;
};

export type Situation = {
  kind: SituationKind;
  title: string;
  body: string;
  tone: SituationTone;
  fact?: EnquiryFact;
  conflictChoices?: ConflictChoice[];
  relatedName?: string;
};

/** One primary operator situation per enquiry. Priority is the product order, not fixture id. */
export function enquirySituation(
  enquiry: Enquiry,
  business?: Business,
): Situation | null {
  if (enquiry.state.decision === "EVALUATING") {
    return {
      kind: "evaluating",
      title: "Reading this enquiry",
      body: business
        ? `Checking how ${business.name} would price this, and whether the date is actually possible.`
        : "Checking price, eligibility and whether the date is possible.",
      tone: "neutral",
    };
  }

  if (enquiry.source === "comment" && enquiry.state.lifecycle === "OPEN") {
    const network = enquiry.commentOn === "facebook" ? "Facebook" : "Instagram";
    return {
      kind: "public_comment",
      title: "This is a public comment, not an enquiry",
      body: `${network} comments stay public. Enquiry will not quote here. Invite them to message, or mark it as not an enquiry.`,
      tone: "warn",
    };
  }

  if (enquiry.duplicateOf) {
    const related = enquiry.facts.find((f) => f.field === "duplicate");
    return {
      kind: "duplicate",
      title: "This looks like an enquiry you already have",
      body: "No automatic merge. Attach it to the existing job, or keep it as a separate enquiry.",
      tone: "warn",
      fact: related,
      relatedName: related?.displayValue,
    };
  }

  const check = enquiry.facts.find(
    (f) =>
      !f.superseded &&
      f.status === "check_this" &&
      (f.blocking || (f.alternatives && f.alternatives.length > 0)),
  );
  if (check) {
    return {
      kind: "check_this",
      title: "I need you to check one detail",
      body:
        check.displayValue ||
        "Enquiry understood more than one reading of this. It will not guess.",
      tone: "warn",
      fact: check,
    };
  }

  const pricing = enquiry.decision.evaluators.find((e) => e.type === "pricing");
  const calendarDown = enquiry.decision.evaluators.some(
    (e) =>
      (e.type === "capacity" || e.type === "availability") &&
      (e.status === "UNKNOWN_INTEGRATION" || e.unknownReason === "Integration unavailable"),
  );

  if (calendarDown) {
    const provider =
      business?.integrations.find((i) => i.kind === "calendar")?.provider ?? "the calendar";
    return {
      kind: "calendar_down",
      title: "I can’t verify availability",
      body: `${provider} needs reconnecting. Unknown is not busy, and it is not free. A draft cannot claim the date is available.`,
      tone: "warn",
    };
  }

  if (pricing?.status === "NOT_QUOTABLE" && enquiry.decision.conflicts.length > 0) {
    return {
      kind: "conflict",
      title: "This needs a human choice",
      body: enquiry.decision.conflicts[0] ?? "Enquiry will not pick a side on its own.",
      tone: "warn",
      conflictChoices: conflictChoices(business),
    };
  }

  if (enquiry.decision.conflicts.length > 0) {
    return {
      kind: "conflict",
      title: "Two prices disagree",
      body:
        enquiry.decision.conflicts[0] ??
        "Enquiry will not send an exact quote until you choose which figure is current.",
      tone: "danger",
      conflictChoices: conflictChoices(business),
    };
  }

  return null;
}

export function conflictChoices(business?: Business): ConflictChoice[] | undefined {
  if (!business) return undefined;
  const items = business.knowledge.filter(
    (k) => k.conflictWith && (k.state === "Needs review" || k.state === "Active"),
  );
  const full: ConflictChoice[] = [];
  for (const item of items) {
    const amount = amountFromKnowledge(item);
    if (amount == null) continue;
    if (full.some((c) => c.knowledgeId === item.id)) continue;
    full.push({
      knowledgeId: item.id,
      amount,
      title: item.title,
      body: item.body,
      source: item.source.label,
    });
  }
  return full.length >= 2 ? full : undefined;
}

export function amountFromKnowledge(item: KnowledgeItem): number | null {
  const match = item.body.match(/\$([0-9][0-9,]*)/);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function alternativeLabel(value: string): string {
  switch (value) {
    case "event":
      return "Event coverage";
    case "brand":
      return "Brand / headshot";
    case "identity":
      return "Brand identity";
    case "refresh":
      return "Brand refresh";
    default:
      return value;
  }
}

export function outboundBlocked(
  business: Business | undefined,
  offline: boolean,
  enquiry?: Enquiry,
): string | null {
  return channelBlocked(business, offline, enquiry);
}

const SENDABLE = new Set([
  "ACKNOWLEDGE",
  "REQUEST_INFORMATION",
  "SEND_QUALIFICATION_RESPONSE",
  "SEND_AVAILABILITY",
  "SEND_ESTIMATE",
  "SEND_QUOTE",
  "RECOMMEND_OFFER",
  "OFFER_BOOKING",
  "HANDOFF_BOOKING",
  "FOLLOW_UP",
  "DECLINE",
]);

export function isSendableAction(action: string): boolean {
  return SENDABLE.has(action);
}

export function queueSituationLabel(kind: SituationKind): string {
  switch (kind) {
    case "evaluating":
      return "Reading";
    case "duplicate":
      return "Possible duplicate";
    case "check_this":
      return "Check this";
    case "conflict":
      return "Price conflict";
    case "calendar_down":
      return "Calendar down";
    case "public_comment":
      return "Public comment";
  }
}
