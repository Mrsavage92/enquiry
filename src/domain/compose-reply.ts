import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import type { Decision } from "./decide.ts";

export type ReplyContext = {
  customerName?: string;
  ownerFirstName?: string;
  serviceLabel?: string;
  /**
   * The day the customer asked about, yyyy-mm-dd. Enquiry has no availability
   * to check it against, so the reply says the owner will confirm it rather
   * than ignoring the question or implying the day is free.
   */
  jobDateIso?: string;
};

/** "2026-10-03" -> "Saturday 3 October", or null for anything else. */
export function spokenDate(iso: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime()) || date.getDate() !== Number(m[3])) return null;
  return format(date, "EEEE d MMMM", { locale: enAU });
}

/** The line that answers a date question honestly when nothing checks availability. */
export function dateLine(iso: string | undefined): string | null {
  const day = spokenDate(iso);
  return day ? `I'll confirm whether ${day} works.` : null;
}

/**
 * A stored field name as a person says it: "num_bedrooms" and "numBedrooms"
 * read as "bedrooms", "gutter_metres" as "gutter metres".
 */
export function humanField(field: string): string {
  return field
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/^(?:num|no|nr|qty|count|number|total)(?: of)?\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "120 square metres", "1 bedroom": a count said the way a person says it. */
export function quantityPhrase(value: string, field: string): string {
  const name = humanField(field);
  const n = Number(value);
  const word = n === 1 && /[^s]s$/.test(name) ? name.slice(0, -1) : name;
  // "1,200", written the way the customer would read it back.
  const shown = Number.isFinite(n) && value.trim() !== "" ? n.toLocaleString("en-AU") : value;
  return `${shown} ${word}`.trim();
}

/** Money arrives in minor units; a customer reads dollars. */
function formatMinor(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    // Whole dollars unless the price genuinely has cents.
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

/**
 * The question for the one missing fact, as a person would ask it: "can you
 * let me know how many bedrooms there are?", not "...know the bedrooms?". A
 * singular field keeps "the" ("...know the address?").
 */
export function askFor(field: string): string {
  const name = humanField(field);
  if (!name) return "can you tell me a bit more about the job?";
  return /[^s]s$/.test(name)
    ? `can you let me know how many ${name} there are?`
    : `can you let me know the ${name}?`;
}

/**
 * Write the reply the owner will actually send.
 *
 * Deliberately not a language model. Every sentence here is derived from the
 * decision - the business's own price, its own workings, the one fact that is
 * missing - so nothing in a customer-facing message can be invented. A model
 * may one day phrase this better; it will still not be allowed to decide what
 * the message claims.
 *
 * Short on purpose. The owner is going to read it, paste it and send it, and a
 * long draft is one they will rewrite instead.
 */
export function composeReply(decision: Decision, opts: ReplyContext = {}): string {
  const first = (opts.customerName ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = first ? `Hi ${first},` : "Hi there,";
  const date = dateLine(opts.jobDateIso);
  const dateBlock = date ? [date, ""] : [];
  const signOff = opts.ownerFirstName?.trim() ? `Thanks,\n${opts.ownerFirstName.trim()}` : "Thanks";
  const service = (opts.serviceLabel ?? "").trim();

  if (decision.price.kind === "EXACT") {
    const total = formatMinor(decision.price.amountMinor, decision.price.currency);
    return [
      greeting,
      "",
      service
        ? `Thanks for getting in touch about ${service.toLowerCase()}.`
        : "Thanks for getting in touch.",
      "",
      `That comes to ${total}. ${decision.price.workings}`,
      "",
      ...dateBlock,
      "Happy to lock it in if that works - just let me know.",
      "",
      signOff,
    ].join("\n");
  }

  if (decision.price.kind === "BLOCKED") {
    const field = decision.price.missingField;
    const inferred = decision.blocker?.inferred;
    const thanks = service
      ? `Thanks for getting in touch about ${service.toLowerCase()}.`
      : "Thanks for getting in touch.";
    if (inferred) {
      // They already said it. The reply never asks again.
      return [
        greeting,
        "",
        thanks,
        "",
        `I'll work out the price from the ${quantityPhrase(inferred.value, field)} you mentioned and send it straight back.`,
        "",
        ...dateBlock,
        signOff,
      ].join("\n");
    }
    return [
      greeting,
      "",
      thanks,
      "",
      `Before I can give you a price, ${askFor(field)}`,
      "",
      ...dateBlock,
      "Once I have that I can send the full cost straight back.",
      "",
      signOff,
    ].join("\n");
  }

  // Nothing prices it. The owner is answering personally, so the draft opens
  // the conversation without committing the business to anything.
  return [
    greeting,
    "",
    "Thanks for getting in touch.",
    "",
    service
      ? `Let me check the details on ${service.toLowerCase()} and come straight back to you.`
      : "Let me check the details and come straight back to you.",
    "",
    ...dateBlock,
    signOff,
  ].join("\n");
}
