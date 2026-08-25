import type {
  ActionPolicy,
  EnquiryFact,
  EvaluatorResult,
  IntegrationHealth,
  KnowledgeItem,
  Message,
  Provenance,
  WhyItem,
} from "@/domain/types";

export const NOW = "2026-08-24T14:00:00+10:00";

export function msg(
  partial: Omit<Message, "id" | "to"> & { id: string; to?: string },
): Message {
  return {
    to: partial.to ?? "you",
    ...partial,
  };
}

export function fact(
  partial: EnquiryFact,
): EnquiryFact {
  return partial;
}

export function why(
  id: string,
  claim: string,
  evidence: string,
  provenance: Provenance,
): WhyItem {
  return { id, claim, evidence, provenance };
}

export function evalr(partial: EvaluatorResult): EvaluatorResult {
  return partial;
}

export function na(
  type: EvaluatorResult["type"],
  whyNot = "Not required for this enquiry",
): EvaluatorResult {
  return {
    type,
    status: "NOT_APPLICABLE",
    summary: "Not applicable",
    detail: whyNot,
  };
}

export function src(
  kind: Provenance["kind"],
  label: string,
  at?: string,
  detail?: string,
): Provenance {
  return { kind, label, at, detail };
}

export function knowledge(partial: KnowledgeItem): KnowledgeItem {
  return partial;
}

export const defaultPolicies = (
  overrides: Partial<Record<ActionPolicy["action"], ActionPolicy["mode"]>> = {},
): ActionPolicy[] => [
  pol("REQUEST_INFORMATION", "Ask one missing-info question", "LOW", overrides.REQUEST_INFORMATION ?? "Ask every time"),
  pol("SEND_QUOTE", "Send exact quote", "MEDIUM", overrides.SEND_QUOTE ?? "Never"),
  pol("SEND_ESTIMATE", "Send estimate", "MEDIUM", overrides.SEND_ESTIMATE ?? "Never"),
  pol("FOLLOW_UP", "Send normal follow-up", "MEDIUM", overrides.FOLLOW_UP ?? "Never"),
  pol("HANDOFF_BOOKING", "Send booking link", "MEDIUM", overrides.HANDOFF_BOOKING ?? "Never"),
  pol("DECLINE", "Decline an enquiry", "HIGH", "Never"),
];

function pol(
  action: ActionPolicy["action"],
  label: string,
  risk: ActionPolicy["risk"],
  mode: ActionPolicy["mode"],
): ActionPolicy {
  return {
    action,
    label,
    mode,
    risk,
    gates: [
      { id: "classification", label: "Enquiry classified with high confidence", passing: true },
      { id: "risk", label: "No high-risk flags", passing: true },
      { id: "send", label: "Send permission granted", passing: mode !== "Never" },
      { id: "grounding", label: "Draft grounding validator passes", passing: true },
    ],
  };
}

export function emailIntegration(
  status: IntegrationHealth["status"] = "connected",
): IntegrationHealth {
  return {
    id: "email",
    provider: "Google",
    kind: "email",
    status,
    technicalScopes: ["Read mail", "Send mail (not used until Assist)"],
    enquiryUsage: ["Detect new enquiries", "Keep conversation current", "Prepare replies"],
    lastSuccessAt: status === "connected" ? "2026-08-24T13:52:00+10:00" : undefined,
    accountLabel: "hello@business.example",
  };
}

export function calendarIntegration(
  status: IntegrationHealth["status"] = "connected",
): IntegrationHealth {
  return {
    id: "calendar",
    provider: "Google Calendar",
    kind: "calendar",
    status,
    technicalScopes: ["See free/busy"],
    enquiryUsage: ["Check whether another commitment overlaps the requested job"],
    lastSuccessAt: status === "connected" ? "2026-08-24T13:52:00+10:00" : undefined,
    accountLabel: "Primary calendar",
  };
}

export function formIntegration(
  accountLabel: string,
  status: IntegrationHealth["status"] = "connected",
): IntegrationHealth {
  return {
    id: "form",
    provider: "Website form",
    kind: "form",
    status,
    technicalScopes: ["Receive submissions", "Reply by email if they left one"],
    enquiryUsage: [
      "Treat as a form even when a copy lands in mail",
      "Structured facts — fewer invented fields",
    ],
    lastSuccessAt: status === "connected" ? "2026-08-24T13:52:00+10:00" : undefined,
    accountLabel,
  };
}

export function smsIntegration(
  accountLabel: string,
  status: IntegrationHealth["status"] = "connected",
): IntegrationHealth {
  return {
    id: "sms",
    provider: "Text",
    kind: "sms",
    status,
    technicalScopes: ["Receive texts", "Send texts (not used until Assist)"],
    enquiryUsage: ["Open a case file from a short message", "Reply on the same number"],
    lastSuccessAt: status === "connected" ? "2026-08-24T13:52:00+10:00" : undefined,
    accountLabel,
  };
}

export function instagramIntegration(
  accountLabel: string,
  status: IntegrationHealth["status"] = "connected",
): IntegrationHealth {
  return {
    id: "instagram",
    provider: "Instagram",
    kind: "social",
    status,
    technicalScopes: ["Read DMs", "Send DMs (not used until Assist)", "See comment text"],
    enquiryUsage: [
      "Open a case file from a DM",
      "Public comments are not quotes",
    ],
    lastSuccessAt: status === "connected" ? "2026-08-24T13:52:00+10:00" : undefined,
    accountLabel,
  };
}

export function facebookIntegration(
  accountLabel: string,
  status: IntegrationHealth["status"] = "connected",
): IntegrationHealth {
  return {
    id: "facebook",
    provider: "Facebook",
    kind: "social",
    status,
    technicalScopes: ["Read Page messages", "Send Page messages (not used until Assist)"],
    enquiryUsage: ["Open a case file from a Page DM", "Comments stay public"],
    lastSuccessAt: status === "connected" ? "2026-08-24T13:52:00+10:00" : undefined,
    accountLabel,
  };
}

