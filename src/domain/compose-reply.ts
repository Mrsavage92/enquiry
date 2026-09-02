import type { Decision } from "./decide.ts";

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
export function composeReply(
  decision: Decision,
  opts: { customerName?: string; ownerFirstName?: string; serviceLabel?: string } = {},
): string {
  const first = (opts.customerName ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = first ? `Hi ${first},` : "Hi,";
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
      "Happy to lock it in if that works - just let me know.",
      "",
      signOff,
    ].join("\n");
  }

  if (decision.price.kind === "BLOCKED") {
    const field = decision.price.missingField;
    return [
      greeting,
      "",
      service
        ? `Thanks for getting in touch about ${service.toLowerCase()}.`
        : "Thanks for getting in touch.",
      "",
      `Before I can give you a price, can you let me know the ${field}?`,
      "",
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
    signOff,
  ].join("\n");
}
