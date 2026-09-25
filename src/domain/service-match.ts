import { activeRules } from "./decide.ts";
import { setupStep } from "./next-action.ts";
import { serviceAuthority } from "./service-authority.ts";
import type { Business, Enquiry } from "./types";

/**
 * Which of the business's own services a message clearly names, if any.
 *
 * Only a suggestion: the chooser pre-selects it and the owner still confirms,
 * so it is stored nowhere and prices nothing on its own. "Clearly" means every
 * meaningful word of one service name appears in the message (so "painted"
 * finds "painting"), and no other service fits as well. Anything less leaves
 * nothing selected rather than guessing between two.
 */

const IGNORED = new Set(["and", "the", "for", "with", "our", "your", "service", "services"]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !IGNORED.has(w));
}

/** A shared stem: "paint" in "painted" and "painting", "clean" in "cleaning". */
function stem(word: string): string {
  return word.length > 5 ? word.slice(0, 5) : word;
}

export function suggestService(message: string, services: readonly string[]): string | undefined {
  const said = new Set(words(message).map(stem));
  const scored = [...new Set(services.map((s) => s.trim()).filter(Boolean))]
    .map((service) => {
      const need = words(service).map(stem);
      const all = need.length > 0 && need.every((w) => said.has(w));
      return { service, score: all ? need.length : 0 };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return undefined;
  if (scored.length > 1 && scored[1]!.score === scored[0]!.score) return undefined;
  return scored[0]!.service;
}

/** The business's own services, the ones with a price first. */
export function businessServices(business: Business | undefined): string[] {
  const priced = activeRules(business ?? {}).map((r) => r.service);
  const listed = (business?.services ?? []).map((s) => s.customerLabel || s.name);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...priced, ...listed]) {
    const key = (s ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s.trim());
  }
  return out;
}

export function customerWords(enquiry: Enquiry): string {
  return enquiry.conversation
    .filter((m) => m.direction === "inbound")
    .map((m) => m.body)
    .join("\n");
}

/** Whether the service still has to be said or confirmed by the owner. */
export function serviceNeedsOwner(enquiry: Enquiry): boolean {
  const authority = serviceAuthority(enquiry);
  if (authority.state === "proposed" || authority.state === "unattributed") return true;
  return authority.state === "absent" && setupStep(enquiry)?.kind === "choose_service";
}
