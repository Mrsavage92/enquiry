import { mentionWords, roleLabel, type DateMention } from "@/domain/date-roles";
import { jobDateCue } from "@/domain/time-cues";
import type { AskedItem, AskedStatus } from "@/domain/asked";
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

/** The day a row leads with: the job's own day, else the deadline, else the event. */
const LEAD_ORDER: readonly DateMention["role"][] = ["job", "deadline", "event"];

function leadMention(dates: readonly DateMention[]): DateMention | undefined {
  for (const role of LEAD_ORDER) {
    const hit = dates.find((d) => d.role === role);
    if (hit) return hit;
  }
  return undefined;
}

function capital(text: string): string {
  return text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text;
}

function dateConfirmed(e: Pick<Enquiry, "facts">): boolean {
  return (e.facts ?? []).some(
    (f) => !f.superseded && f.field.trim().toLowerCase() === "date" && f.status === "confirmed",
  );
}

/**
 * "Job Fri 16 Oct", "Deadline Thu 29 Oct", "Wedding Sun 8 Nov". The job's own
 * day says "Job" once its role is known against another day they wrote (the
 * trial, the inspection) or the owner confirmed it; a lone day read from their
 * message keeps "Asked for Sat 3 Oct". Without a role, the stored cue as before.
 */
export function leadDateCue(e: Dated): string {
  const dates = e.decision?.dates ?? [];
  const lead = leadMention(dates);
  if (!lead) return jobDateCue(e);
  if (lead.role === "job") {
    const known = dates.length > 1 || dateConfirmed(e);
    return known ? `Job ${lead.label}` : jobDateCue(e) || `Asked for ${lead.label}`;
  }
  return roleLabel(lead.role, lead.what, lead.label);
}

/** Every other day they wrote, for small secondary text: "Trial Sat 24 Oct". */
export function otherDateCues(e: Dated): string[] {
  const dates = e.decision?.dates ?? [];
  const lead = leadMention(dates);
  return dates.filter((d) => d !== lead).map((d) => capital(mentionWords(d)));
}

/**
 * "Check 2 of 4" from the server's stable count: settled plus open, so the
 * number never restarts at 1 as checks are answered. Null for a single check.
 */
export function checkStep(checks: { done: number; total: number } | undefined): string | null {
  if (!checks || checks.total < 2) return null;
  const at = Math.min(checks.done + 1, checks.total);
  return `Check ${at} of ${checks.total}`;
}

export const ASKED_CHIP: Record<AskedStatus, { word: string; tone: "ok" | "neutral" | "warn" }> = {
  answered: { word: "Answered", tone: "ok" },
  left_out: { word: "Left out", tone: "neutral" },
  come_back: { word: "Come back", tone: "neutral" },
  open: { word: "To settle", tone: "warn" },
};

/**
 * What "That's everything" waits on from the ledger: the same items the server
 * refuses the confirmation over (the job itself and the days are never a
 * choice for the owner).
 */
export function openAskedItems(items: readonly AskedItem[] | undefined): AskedItem[] {
  return (items ?? []).filter(
    (i) => i.status === "open" && i.kind !== "service" && i.kind !== "date",
  );
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
