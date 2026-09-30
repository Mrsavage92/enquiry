import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import type { ContextDate, DateRole } from "./enquiry-basics.ts";

/**
 * Every day a customer wrote, with what it is for. The job's own day lives in
 * the `date` fact (its role in provenance); every other day - the trial, the
 * inspection, the settlement, a second day they mentioned - lives in the
 * `date_context` fact, encoded in its value so the coverage fingerprint sees
 * it and no reader needs the provenance: `iso[..to]~role~what`, comma
 * separated. A value written before roles existed is a bare list of days,
 * each read as context.
 */

export type DateMention = {
  iso: string;
  /** The last day of a stretch ("a trial in December"). */
  to?: string;
  role: DateRole;
  /** "trial", "inspection", "settlement", "wedding"; "" for a plain day. */
  what: string;
  /** "Sat 24 Oct", "December". */
  label: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ROLES = new Set<DateRole>(["job", "deadline", "event", "trial", "context"]);

function clean(word: string): string {
  return word.replace(/[~,|]/g, " ").trim();
}

/** The `date_context` value for these days. */
export function encodeContextDates(days: readonly ContextDate[]): string {
  return days
    .map((d) => {
      const when = d.to ? `${d.iso}..${d.to}` : d.iso;
      return `${when}~${d.role ?? "context"}~${clean(d.what)}`;
    })
    .join(",");
}

/** "Sat 24 Oct" for a day, "December" for a whole month. */
function labelOf(iso: string, to?: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  if (to) return format(date, "MMMM", { locale: enAU });
  return format(date, "EEE d MMM", { locale: enAU });
}

/** The days in a `date_context` value, with their roles. */
export function contextMentions(value: string, display = ""): DateMention[] {
  const legacyWhat = display.split(/;\s*/).map((p) => p.split(/\s+/)[0] ?? "");
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part, i): DateMention[] => {
      const [when = "", rawRole, what] = part.split("~");
      const [iso = "", to] = when.split("..");
      if (!ISO.test(iso) || (to !== undefined && !ISO.test(to))) return [];
      const role = ROLES.has(rawRole as DateRole) ? (rawRole as DateRole) : "context";
      return [
        {
          iso,
          ...(to ? { to } : {}),
          role,
          what: rawRole === undefined ? (legacyWhat[i] ?? "") : (what ?? ""),
          label: labelOf(iso, to),
        },
      ];
    });
}

/** The owner's words for one of these days: "trial Sat 24 Oct", "inspection Sat 17 Oct". */
export function mentionWords(d: Pick<DateMention, "what" | "label" | "role">): string {
  if (d.role === "job" && !d.what) return `also ${d.label}`;
  return d.what ? `${d.what} ${d.label}` : d.label;
}

/** Event words a row can lead with: "Wedding Sun 8 Nov". */
const EVENT_LABELS = new Set([
  "wedding",
  "formal",
  "birthday",
  "party",
  "event",
  "funeral",
  "memorial",
  "christening",
  "baptism",
  "engagement",
  "graduation",
  "anniversary",
  "hens",
  "bucks",
  "gala",
  "ball",
  "recital",
  "ceremony",
  "reception",
]);

/**
 * The row's words for the job's day, by what it is for: "Deadline Thu 29
 * Oct", "Wedding Sun 8 Nov", or the day alone.
 */
export function roleLabel(
  role: DateRole | undefined,
  what: string | undefined,
  label: string,
): string {
  if (role === "deadline") return `Deadline ${label}`;
  const w = (what ?? "").toLowerCase();
  if (role === "event" && EVENT_LABELS.has(w))
    return `${w[0]!.toUpperCase()}${w.slice(1)} ${label}`;
  if (role === "event") return `Event ${label}`;
  return label;
}

/** A row label that already says what the day is for, shown as it is. */
export const ROLE_LABEL = new RegExp(
  String.raw`^(?:Deadline|Event|${[...EVENT_LABELS].map((w) => `${w[0]!.toUpperCase()}${w.slice(1)}`).join("|")})\s`,
);

/**
 * The days a reply is about, for the card: the job's own day first (its role
 * `job`, `deadline` or `event`), then every other day they wrote.
 */
export function datesOnCard(who: {
  jobDateIso?: string;
  jobDateRole?: DateRole;
  jobDateWhat?: string;
  otherDates?: readonly DateMention[];
}): DateMention[] {
  const out: DateMention[] = [];
  if (who.jobDateIso && ISO.test(who.jobDateIso)) {
    out.push({
      iso: who.jobDateIso,
      role: who.jobDateRole ?? "job",
      what: who.jobDateWhat ?? "",
      label: labelOf(who.jobDateIso),
    });
  }
  return [...out, ...(who.otherDates ?? [])];
}
