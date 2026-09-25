import type { ReplyContext } from "./compose-reply.ts";
import type { DateIssue } from "./enquiry-basics.ts";

/**
 * What the reply may say about the customer, from the live facts - and what it
 * may not. A name or a day only read from their message is a reading: the
 * greeting stays "Hi there," until the owner confirms the name, and a day is
 * only quoted back in their own words ("You mentioned Saturday 3 October").
 */

export const ASAP_VALUE = "asap";

export type ReplyFact = {
  field: string;
  value: string;
  status: string;
  /** provenance.asked, for a date. */
  date_asked?: string | boolean | null;
  /** provenance.span: the customer's words. */
  date_span?: string | null;
  /** provenance.issue, for a date that has passed or disagrees with its weekday. */
  date_issue?: unknown;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function field(f: ReplyFact): string {
  return f.field.trim().toLowerCase();
}

function asIssue(raw: unknown): ReplyContext["dateIssue"] | undefined {
  const value = typeof raw === "string" ? safeParse(raw) : raw;
  if (!value || typeof value !== "object") return undefined;
  const v = value as Partial<DateIssue>;
  if (!v.kind || !v.mention) return undefined;
  return { kind: v.kind, mention: v.mention, ...(v.actualDay ? { actualDay: v.actualDay } : {}) };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The greeting name: only a name the owner typed or confirmed. */
export function greetingName(customerName: string, facts: readonly ReplyFact[]): string {
  const read = facts.find((f) => field(f) === "name");
  if (read && read.status !== "confirmed") return "";
  return customerName;
}

export function replyContextFromFacts(
  facts: readonly ReplyFact[],
  base: Pick<ReplyContext, "ownerFirstName" | "serviceLabel"> & { customerName: string },
): ReplyContext {
  const date = facts.find((f) => field(f) === "date");
  const value = String(date?.value ?? "").trim();
  const confirmed = date?.status === "confirmed";
  const issue = date && !confirmed ? asIssue(date.date_issue) : undefined;
  const asked = String(date?.date_asked) === "true";
  return {
    customerName: greetingName(base.customerName, facts),
    ownerFirstName: base.ownerFirstName,
    serviceLabel: base.serviceLabel,
    ...(date && ISO_DAY.test(value) && (asked || confirmed)
      ? {
          jobDateIso: value,
          jobDateConfirmed: confirmed,
          ...(date.date_span ? { jobDateSpan: String(date.date_span) } : {}),
        }
      : {}),
    ...(issue ? { dateIssue: issue } : {}),
    asap: value === ASAP_VALUE,
  };
}
