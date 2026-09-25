import type { Enquiry } from "./types";

/**
 * The owner-facing notes about the day, read from the live date facts. A plain
 * job date needs no note (it is on the row); a day that has passed, a weekday
 * that disagrees with its date, "as soon as possible" and days ruled out do.
 */
export function dateNotes(enquiry: Pick<Enquiry, "facts">): string[] {
  const live = (enquiry.facts ?? []).filter((f) => !f.superseded);
  const out: string[] = [];
  const date = live.find((f) => f.field.trim().toLowerCase() === "date");
  if (date && date.status !== "confirmed") {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(String(date.value ?? "").trim());
    if (date.status === "conflict") {
      out.push(`From their message: ${date.displayValue} Check the day with them.`);
    } else if (!iso && date.displayValue) {
      out.push(`From their message: ${date.displayValue}`);
    }
  }
  const away = live.find((f) => f.field.trim().toLowerCase() === "not_available");
  if (away?.displayValue) out.push(`Not available: ${away.displayValue} (from their message).`);
  return out.map((n) => (/[.!?)]$/.test(n) ? n : `${n}.`));
}
