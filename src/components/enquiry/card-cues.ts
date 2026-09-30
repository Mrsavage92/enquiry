import { mentionWords, roleLabel, type DateMention } from "@/domain/date-roles";
import { jobDateCue, leadMention } from "@/domain/time-cues";
import { holdingItems, type AskedItem, type AskedStatus } from "@/domain/asked";
import type { Enquiry } from "@/domain/types";

/**
 * Display-only readings of the decision snapshot for the enquiry card, the
 * header and the Today / Enquiries rows. Nothing here decides anything: the
 * server already worked out each day's role, what they asked and the owner's
 * checks; this only says them in the card's words.
 */

type Dated = Pick<Enquiry, "dateLabel" | "facts"> & {
  decision?: { dates?: readonly DateMention[] };
};

function capital(text: string): string {
  return text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text;
}

function dateFact(e: Pick<Enquiry, "facts">) {
  return (e.facts ?? []).find(
    (f) => !f.superseded && f.field.trim().toLowerCase() === "date" && String(f.value ?? "").trim(),
  );
}

/** A day that says what it is for: a trial, a deadline, an event, or a named day ("inspection"). */
function hasRealRole(d: DateMention): boolean {
  return d.role !== "context" || Boolean(d.what.trim());
}

/**
 * The mention the card leads with, and whether it is the job's own day.
 * When the job's day is a date fact that is not among the roled days (two
 * days offered, a stretch), the stored cue leads and every roled day is
 * secondary.
 */
function lead(e: Dated): { mention?: DateMention } {
  const dates = e.decision?.dates ?? [];
  const fact = dateFact(e);
  if (fact) {
    const value = String(fact.value);
    const first = value.split(/\||\.\./)[0] ?? "";
    const own = dates.find(
      (d) => d.iso === first && !value.includes("|") && !d.to && d.role !== "trial",
    );
    return { mention: own };
  }
  return { mention: leadMention(dates) };
}

/**
 * "Job Fri 16 Oct", "Deadline Thu 29 Oct", "Wedding Sun 8 Nov". The job's own
 * day says "Job" only once the owner confirmed it or another day beside it
 * says what it is for (the trial, the inspection); a day read from their
 * message keeps "Asked for Sat 3 Oct", and two offered days keep "Asked
 * about: ...". Without a roled day, the stored cue as before.
 */
export function leadDateCue(e: Dated): string {
  const dates = e.decision?.dates ?? [];
  const { mention } = lead(e);
  if (!mention) return jobDateCue(e);
  if (mention.role === "job") {
    const confirmed = dateFact(e)?.status === "confirmed";
    const beside = dates.some((d) => d !== mention && hasRealRole(d));
    return confirmed || beside
      ? `Job ${mention.label}`
      : jobDateCue(e) || `Asked for ${mention.label}`;
  }
  return roleLabel(mention.role, mention.what, mention.label);
}

/** Every other day they wrote, for small secondary text: "Trial Sat 24 Oct". */
export function otherDateCues(e: Dated): string[] {
  const dates = e.decision?.dates ?? [];
  const { mention } = lead(e);
  return dates.filter((d) => d !== mention).map((d) => capital(mentionWords(d)));
}

/**
 * "Check 2 of 4" from the server's stable count: settled plus open, so the
 * number never restarts at 1 as checks are answered. Null for a single check.
 */
export function checkStep(
  checks: { done: number; total: number } | undefined,
  enquiryId?: string,
): string | null {
  if (!checks || checks.total < 2) return null;
  const at = Math.min(checks.done + 1, checks.total);
  // The total known when the enquiry was opened is the one shown: "Check 3
  // of 5" after "Check 2 of 3" read as the work growing under the owner. A
  // check that turns up later is said as that, never folded into a new total.
  if (enquiryId) {
    const first = FIRST_TOTAL.get(enquiryId);
    if (first === undefined) FIRST_TOTAL.set(enquiryId, checks.total);
    else if (checks.total > first) {
      const more = checks.total - first;
      return `Check ${at} - ${more === 1 ? "one more" : `${more} more`} came up`;
    }
  }
  return `Check ${at} of ${checks.total}`;
}

/** enquiryId -> the check total when it was first shown this session. */
const FIRST_TOTAL = new Map<string, number>();

export const ASKED_CHIP: Record<AskedStatus, { word: string; tone: "ok" | "neutral" | "warn" }> = {
  answered: { word: "Answered", tone: "ok" },
  left_out: { word: "Left out", tone: "neutral" },
  come_back: { word: "Come back", tone: "neutral" },
  open: { word: "To settle", tone: "warn" },
};

/** A day they wrote that the owner doesn't work: the reply says so. */
export const CLOSED_CHIP = { word: "Not available", tone: "neutral" as const };

/**
 * What "That's everything" waits on from the ledger: the same items the server
 * refuses the confirmation over (the job itself and the days are never a
 * choice for the owner).
 */
export function openAskedItems(items: readonly AskedItem[] | undefined): AskedItem[] {
  return holdingItems(items ?? []);
}

/** A kept edit's changes, split for the notice: figures that moved, and lines it lacks. */
export function keptEditNotice(changes: readonly string[]): {
  figures: string[];
  missing: string[];
} {
  const missing = changes
    .filter((c) => c.startsWith("Not in your edit: "))
    .map((c) => c.slice("Not in your edit: ".length));
  return { figures: changes.filter((c) => !c.startsWith("Not in your edit: ")), missing };
}

/** "Fence painting: $35 per metre" under the heading "Fence painting" reads "$35 per metre". */
export function bodyWithoutTitle(title: string, body: string): string {
  const t = title.trim();
  if (!t) return body;
  const lead = body.slice(0, t.length + 1);
  if (lead.toLowerCase() === `${t.toLowerCase()}:`) {
    const rest = body.slice(t.length + 1).trim();
    return rest ? rest : body;
  }
  return body;
}
