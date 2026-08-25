import type { Business, Channel, Enquiry, IntegrationHealth } from "./types";

export function channelLabel(channel: Channel): string {
  switch (channel) {
    case "email":
      return "Email";
    case "form":
      return "Website form";
    case "forward":
      return "Forwarded";
    case "manual":
      return "Entered manually";
    case "sms":
      return "Text";
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "comment":
      return "Public comment";
  }
}

export function threadLabel(channel: Channel): string {
  switch (channel) {
    case "sms":
      return "Texts";
    case "instagram":
      return "Instagram messages";
    case "facebook":
      return "Facebook messages";
    case "form":
      return "Form submission";
    case "comment":
      return "Comment";
    case "forward":
      return "Forwarded mail";
    case "manual":
      return "Entered";
    default:
      return "Correspondence";
  }
}

export function isShortChannel(channel: Channel): boolean {
  return channel === "sms" || channel === "instagram" || channel === "facebook";
}

export function isLetterChannel(channel: Channel): boolean {
  return channel === "email" || channel === "forward" || channel === "manual";
}

/** Where the next outbound should go. A form is not a reply path — email is. A comment is not a quoting path. */
export function replyChannel(enquiry: Enquiry): Channel {
  const lastIn = [...enquiry.conversation].reverse().find((m) => m.direction === "inbound");
  if (lastIn?.channel && lastIn.channel !== "comment" && lastIn.channel !== "form") {
    return lastIn.channel;
  }
  if (enquiry.source === "comment" || lastIn?.channel === "comment") {
    return enquiry.commentOn === "facebook" ? "facebook" : "instagram";
  }
  if (enquiry.source === "form" || lastIn?.channel === "form") return "email";
  return enquiry.source;
}

export function replyTo(enquiry: Enquiry): string {
  const ch = replyChannel(enquiry);
  if (ch === "sms") return enquiry.customerPhone || enquiry.customerEmail;
  if (ch === "instagram" || ch === "facebook") {
    return enquiry.customerHandle || enquiry.customerName;
  }
  return enquiry.customerEmail || enquiry.customerHandle || enquiry.customerPhone || enquiry.customerName;
}

export function identityLine(enquiry: Enquiry): string {
  const parts: string[] = [];
  if (enquiry.customerHandle) parts.push(enquiry.customerHandle);
  if (enquiry.customerPhone) parts.push(enquiry.customerPhone);
  if (enquiry.customerEmail) parts.push(enquiry.customerEmail);
  return parts.join(" · ") || "No return address yet";
}

export function integrationForChannel(
  business: Business | undefined,
  channel: Channel,
  enquiry?: Enquiry,
): IntegrationHealth | undefined {
  if (!business) return undefined;
  if (channel === "email" || channel === "forward") {
    return business.integrations.find((i) => i.kind === "email");
  }
  if (channel === "sms") return business.integrations.find((i) => i.kind === "sms");
  if (channel === "instagram") return business.integrations.find((i) => i.id === "instagram");
  if (channel === "facebook") return business.integrations.find((i) => i.id === "facebook");
  if (channel === "comment") {
    const id = enquiry?.commentOn === "facebook" ? "facebook" : "instagram";
    return business.integrations.find((i) => i.id === id);
  }
  if (channel === "form") return business.integrations.find((i) => i.kind === "form");
  return undefined;
}

export function channelBlocked(
  business: Business | undefined,
  offline: boolean,
  enquiry?: Enquiry,
): string | null {
  if (offline) {
    return "You’re offline. Enquiry will keep working on this device. Nothing will send until you’re back.";
  }
  if (business?.paused) {
    return `${business.name} is paused. Enquiry will keep reading. Nothing will send.`;
  }
  if (!enquiry) return null;
  if (enquiry.source === "form" || enquiry.source === "manual") return null;
  const ch = replyChannel(enquiry);
  if (ch === "form" || ch === "manual") return null;
  const integ = integrationForChannel(business, ch, enquiry);
  if (integ && integ.status !== "connected") {
    return `${integ.provider} isn’t connected. Enquiry can still prepare a reply. Nothing will send.`;
  }
  return null;
}
