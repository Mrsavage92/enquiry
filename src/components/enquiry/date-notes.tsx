import type { Enquiry } from "@/domain/types";
import { dateNotes } from "@/domain/date-notes";

/**
 * What the customer wrote about the day that Enquiry did not turn into a job
 * date: a day that has passed, a weekday that disagrees with its date, days
 * they ruled out. Shown to the owner as readings; none of it is in the reply.
 */
export function DateNotes({ enquiry }: { enquiry: Enquiry }) {
  const notes = dateNotes(enquiry);
  if (notes.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm leading-relaxed text-ink-2">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}
