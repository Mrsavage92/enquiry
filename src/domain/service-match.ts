import { activeRules } from "./decide.ts";
import { setupStep } from "./next-action.ts";
import { serviceAuthority } from "./service-authority.ts";
import type { Business, Enquiry } from "./types";
import { fitsTrade } from "./trades.ts";
import { withoutNegated } from "./service-words.ts";

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

/**
 * The ways customers say what a service name says: "the inside" is interior,
 * "3 bed" and "(3 bedroom)" are one word, "bond clean" is an end of lease
 * clean. Applied to the message and the service names alike.
 */
const SAME_WORDS: [RegExp, string][] = [
  // Short forms are the word itself: "gel mani" is a gel manicure.
  [/\bmanis?\b/g, " manicure "],
  [/\bpedis?\b/g, " pedicure "],
  [/\bgel\s+nails?\b/g, " gel manicure "],
  [/\b(?:vacate|vacating|exit|move[- ]?out|moving[- ]?out)\s+clean/g, " end lease clean"],
  [/\b(?:inside|internal|indoors?)\b/g, " interior "],
  [/\brepaint/g, " paint"],
  [/\b(?:outside|external|outdoors?)\b/g, " exterior "],
  [/\bbond\s+clean/g, " end lease clean"],
  // "a clean for a 4 bed" is a house; "fortnightly" is a regular clean.
  [/\b(\d+)\s*-?\s*(?:bed(?:room)?s?|brs?|bdrms?)\b/g, " $1bedroom house "],
  [/\b(\d+)\s*-?\s*(?:bath(?:room)?s?)\b/g, " $1bathroom "],
  [/\b(?:fortnightly|weekly|monthly|regularly)\b/g, " regular "],
  // "the walls" are interior painting, unless they are the outside walls.
  [
    /(?<!\b(?:outside|external|exterior|outer|brick|retaining|garden|fence|boundary|front)\s)\bwalls?\b/g,
    " walls interior ",
  ],
];

/** "Walls" say interior painting as plainly as the word itself. */
const STRONG_IMPLIED =
  /(?<!\b(?:outside|external|exterior|outer|brick|retaining|garden|fence|boundary|front)\s)\bwalls?\b/i;

function words(text: string): string[] {
  const said = SAME_WORDS.reduce((t, [re, to]) => t.replace(re, to), text.toLowerCase());
  return said
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !IGNORED.has(w) && !/^\d+$/.test(w));
}

/** A shared stem: "paint" in "painted" and "painting", "clean" in "cleaning". */
function stem(word: string): string {
  return word.length > 5 ? word.slice(0, 5) : word;
}

/** "inside is fine", "no need to do the deck": not what they want. */
const NOT_WANTED =
  /\b(?:is|are)\s+(?:fine|ok|okay|good|done|sorted)\b|\bno need\b|\bdon'?t need\b|\bnot needed\b|\bdoesn'?t need\b/i;

/** Short forms written out, so "mani" counts as their own word for a manicure. */
const SHORT_FORMS: [RegExp, string][] = [
  [/\bmanis?\b/g, "manicure"],
  [/\bpedis?\b/g, "pedicure"],
];

function plainWords(text: string): string[] {
  return SHORT_FORMS.reduce((t, [re, to]) => t.replace(re, to), text.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !IGNORED.has(w));
}

/**
 * What the message asks for, each stem weighted: their own word counts 1, a
 * word only read through a synonym ("outside" for exterior) counts half, so
 * "paint the fence outside" is fence painting before exterior painting.
 */
function saidWeights(message: string): Map<string, number> {
  const text = message
    .split(/[,.;!?\n]|\s-\s|\bbut\b/i)
    .filter((c) => !NOT_WANTED.test(c))
    .join(". ");
  const plain = new Set(plainWords(text).map(stem));
  if (STRONG_IMPLIED.test(text)) plain.add(stem("interior"));
  const out = new Map<string, number>();
  for (const w of words(text).map(stem)) out.set(w, plain.has(w) ? 1 : 0.5);
  return out;
}

/** A pasted form's "Service: Interior painting" line, when it names one of theirs. */
const FORM_SERVICE =
  /^\s*(?:service|job|type of (?:service|job)|service (?:needed|required|wanted))\s*[:\-–]\s*(.+?)\s*$/im;

export function formService(message: string, services: readonly string[]): string | undefined {
  const named = FORM_SERVICE.exec(message)?.[1]?.trim().toLowerCase();
  if (!named) return undefined;
  const exact = services.find((s) => s.trim().toLowerCase() === named);
  if (exact) return exact.trim();
  const said = new Set(words(named).map(stem));
  const fits = services.filter((s) => {
    const need = words(s).map(stem);
    return need.length > 0 && need.every((w) => said.has(w));
  });
  return fits.length === 1 ? fits[0]!.trim() : undefined;
}

/** Work words many services share. */
const WORK_STEMS = new Set(["paint", "clean", "servi", "wash", "repai", "insta", "remov"]);

/** Where a service is first mentioned: the lower, the earlier they asked for it. */
function firstMention(message: string, service: string): number {
  const said = words(message).map(stem);
  // By its own words: "painted" names every painting service at once.
  const all = words(service).map(stem);
  const own = all.filter((w) => !WORK_STEMS.has(w));
  const need = own.length ? own : all;
  const at = need.map((w) => said.indexOf(w)).filter((i) => i >= 0);
  return at.length ? Math.min(...at) : Number.MAX_SAFE_INTEGER;
}

export function suggestService(written: string, services: readonly string[]): string | undefined {
  // "Nothing bridal", "not the bride": never pre-picked from what they turned down.
  const message = withoutNegated(written);
  const fromForm = formService(message, services);
  if (fromForm) return fromForm;
  const said = saidWeights(message);
  const scored = [...new Set(services.map((s) => s.trim()).filter(Boolean))]
    // "Ceilings" for a mouldy bathroom they want cleaned, "Bridal makeup" for
    // a painting job: never offered from another trade than the message's.
    .filter((service) => fitsTrade(service, message))
    .map((service) => {
      const need = words(service).map(stem);
      const all = need.length > 0 && need.every((w) => said.has(w));
      return {
        service,
        score: all ? need.reduce((n, w) => n + (said.get(w) ?? 0), 0) : 0,
        first: firstMention(message, service),
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.first - b.first);
  if (scored.length === 0) return undefined;
  // Two named as fully: the one they asked for first ("could i book gel mani
  // ... also how much is lash lift?"), never a guess between two at once.
  const [top, next] = scored;
  if (next && next.score === top!.score && next.first === top!.first) return undefined;
  return top!.service;
}

/**
 * A fee or a minimum ("Travel fee", "Minimum call out") is added to a job; it
 * is never the job a customer asks for, so it is never offered as a service.
 */
const FEE_OR_MINIMUM = /\b(?:fees?|call[- ]?outs?|surcharges?|minimum|min|deposit|levy)\b/i;

export function isFeeOrMinimum(service: string): boolean {
  return FEE_OR_MINIMUM.test(service);
}

/**
 * The services a message most likely means, best first: how many of each
 * service's words the message uses; ties keep the business's own order.
 */
export function rankServices(written: string, services: readonly string[]): string[] {
  const message = withoutNegated(written);
  const said = saidWeights(message);
  return services
    .map((service, i) => {
      const need = words(service).map(stem);
      const score = need.reduce((n, w) => n + (said.get(w) ?? 0), 0);
      const hit = need.filter((w) => said.has(w)).length;
      // More of its words said ranks first; then the one they said all of;
      // then the one they wrote first ("walls ..., plus the ceilings").
      return {
        service,
        i,
        // Another trade's service is never in the top choices for this message.
        fits: fitsTrade(service, message) ? 1 : 0,
        score,
        share: need.length ? hit / need.length : 0,
        first: firstMention(message, service),
      };
    })
    .sort(
      (a, b) =>
        b.fits - a.fits || b.score - a.score || b.share - a.share || a.first - b.first || a.i - b.i,
    )
    .map((s) => s.service);
}

/** The business's own services, the ones with a price first. */
export function businessServices(business: Business | undefined): string[] {
  const priced = activeRules(business ?? {}).map((r) => r.service);
  const listed = (business?.services ?? []).map((s) => s.customerLabel || s.name);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...priced, ...listed]) {
    const key = (s ?? "").trim().toLowerCase();
    if (!key || seen.has(key) || isFeeOrMinimum(key)) continue;
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
