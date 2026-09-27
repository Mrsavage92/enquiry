/**
 * Business details that are not prices: a note the owner wants shown on the
 * enquiries it concerns ("Travel fee $40 outside Brisbane northside"), a
 * service the business does not offer ("We don't do mould removal"), and the
 * days it does not work ("We don't work Sundays").
 *
 * Stored in the same `knowledge_item.rule_payload` column as a price, with
 * their own `kind`, so no schema change is needed and `parseBusinessRule`
 * (which only accepts prices) can never mistake one for a price. Like a price,
 * a detail is inert until its knowledge item is Active.
 */

export type NoteDetail = {
  kind: "note";
  /** The owner's own words, shown back exactly as written. */
  text: string;
  /** The saved service it is about, when it names one. */
  service?: string;
};

export type NotOfferedDetail = { kind: "not_offered"; service: string };

/** 0 is Sunday, 6 is Saturday. */
export type ClosedDaysDetail = { kind: "closed_days"; days: number[] };

export type BusinessDetail = NoteDetail | NotOfferedDetail | ClosedDaysDetail;

export const DETAIL_KINDS = ["note", "not_offered", "closed_days"] as const;

const MAX_TEXT = 300;

export function parseBusinessDetail(
  raw: unknown,
): { ok: true; detail: BusinessDetail } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Not a business detail." };
  const r = raw as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "");
  if (r.kind === "note") {
    const body = text(r.text);
    if (!body) return { ok: false, reason: "A note needs some words." };
    const service = text(r.service);
    return { ok: true, detail: { kind: "note", text: body, ...(service ? { service } : {}) } };
  }
  if (r.kind === "not_offered") {
    const service = text(r.service);
    if (!service) return { ok: false, reason: "Say which service you do not offer." };
    return { ok: true, detail: { kind: "not_offered", service } };
  }
  if (r.kind === "closed_days") {
    const days = Array.isArray(r.days) ? r.days : [];
    const valid = [...new Set(days)].filter(
      (d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6,
    );
    if (valid.length === 0 || valid.length !== days.length) {
      return { ok: false, reason: "Closed days must be days of the week." };
    }
    if (valid.length === 7) return { ok: false, reason: "A business open no days cannot quote." };
    return { ok: true, detail: { kind: "closed_days", days: valid.sort((a, b) => a - b) } };
  }
  return { ok: false, reason: `Unknown business detail: ${String(r.kind)}` };
}

type DetailBearing = { state?: string | null; rulePayload?: unknown };

/** The Active, valid details of a business. */
export function activeDetails(business: {
  knowledge?: ReadonlyArray<DetailBearing> | null;
}): BusinessDetail[] {
  const out: BusinessDetail[] = [];
  for (const item of business.knowledge ?? []) {
    if (item.state !== "Active" || item.rulePayload == null) continue;
    const parsed = parseBusinessDetail(item.rulePayload);
    if (parsed.ok) out.push(parsed.detail);
  }
  return out;
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** What the owner reads back on the business screen. */
export function describeDetail(detail: BusinessDetail): string {
  if (detail.kind === "note") return detail.text;
  if (detail.kind === "not_offered") return `You don't offer ${detail.service.toLowerCase()}`;
  const names = detail.days.map((d) => `${WEEKDAYS[d]!}s`);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0];
  return `You don't work ${list}`;
}

/** The knowledge section a detail is filed under. */
export function detailSection(detail: BusinessDetail): "policy" | "service" | "capacity" {
  if (detail.kind === "note") return "policy";
  if (detail.kind === "not_offered") return "service";
  return "capacity";
}

/** A title for the knowledge row. */
export function detailTitle(detail: BusinessDetail): string {
  if (detail.kind === "note") return detail.service ? `Note: ${detail.service}` : "Note";
  if (detail.kind === "not_offered") return `Not offered: ${detail.service}`;
  return "Days you don't work";
}

/** Every day the business does not work, from its closed-days details. */
export function closedDaysOf(details: readonly BusinessDetail[]): Set<number> {
  const out = new Set<number>();
  for (const d of details) if (d.kind === "closed_days") d.days.forEach((n) => out.add(n));
  return out;
}

const DAY_WORDS: [RegExp, number][] = [
  [/\bsun(?:day)?s?\b/i, 0],
  [/\bmon(?:day)?s?\b/i, 1],
  [/\btue(?:s(?:day)?)?s?\b/i, 2],
  [/\bwed(?:nesday)?s?\b/i, 3],
  [/\bthu(?:r(?:s(?:day)?)?)?s?\b/i, 4],
  [/\bfri(?:day)?s?\b/i, 5],
  [/\bsat(?:urday)?s?\b/i, 6],
];

const NEGATIVE = /\b(?:don'?t|do not|never|not|no|closed)\b/i;
const WORK_WORDS = /\b(?:work|working|open|trade|available|jobs?|bookings?)\b|\bclosed\b/i;
const OFFER =
  /^\s*(?:we|i)\s+(?:don'?t|do not|never|can'?t|cannot|won'?t)\s+(?:do|offer|provide|handle|take on|clean|paint|cover)\s+(?:any\s+)?(.+?)\s*[.!]*$/i;

/** The weekdays a line names ("Saturdays or Sundays", "weekends"). */
function daysIn(line: string): number[] {
  const days = new Set<number>();
  if (/\bweekends?\b/i.test(line)) [0, 6].forEach((d) => days.add(d));
  for (const [re, d] of DAY_WORDS) if (re.test(line)) days.add(d);
  return [...days].sort((a, b) => a - b);
}

/**
 * "We don't work Sundays", "Closed on weekends", "We don't do mould removal":
 * a line that states a rule and names no price. Returns null for anything else,
 * so a price line is never read here.
 */
export function readDetailLine(line: string): BusinessDetail | null {
  if (/\$\s?\d|\d\s*(?:dollars?|bucks)\b/i.test(line)) return null;
  const days = daysIn(line);
  if (days.length > 0 && days.length < 7 && NEGATIVE.test(line) && WORK_WORDS.test(line)) {
    return { kind: "closed_days", days };
  }
  const offer = OFFER.exec(line);
  const service = offer?.[1]?.replace(/[.,;!]+$/, "").trim() ?? "";
  if (service && service.split(/\s+/).length <= 5 && daysIn(service).length === 0) {
    return { kind: "not_offered", service: service.toLowerCase() };
  }
  return null;
}

export type DetailRead = { line: string; detail: BusinessDetail };

/** A conditional or fee line kept as a note, tied to the saved service it names. */
export function noteFor(line: string, services: readonly string[]): NoteDetail {
  const lower = line.toLowerCase();
  const named = [...services]
    .sort((a, b) => b.length - a.length)
    .find((s) => s.trim() && lower.includes(s.trim().toLowerCase()));
  const text = line.trim().replace(/[.;]+$/, "");
  return { kind: "note", text, ...(named ? { service: named.trim() } : {}) };
}
