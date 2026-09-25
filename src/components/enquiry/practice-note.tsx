import { Badge } from "@/components/ui/badge";
import { MARKERS } from "@/domain/labels";
import type { Enquiry } from "@/domain/types";
import { useDeletePractice } from "@/lib/workspace/use-delete-practice";

/** The "Practice" marker that sits beside a practice enquiry's name everywhere. */
export function PracticeBadge({ enquiry }: { enquiry: Pick<Enquiry, "practice"> }) {
  return enquiry.practice ? <Badge tone="info">{MARKERS.practice}</Badge> : null;
}

/**
 * The line at the top of a practice enquiry: what it is, and the way out. It
 * says plainly that nothing is sent or counted, because that is what makes it
 * safe to press every button.
 */
export function PracticeNote({ enquiry }: { enquiry: Enquiry }) {
  const { remove, deleting } = useDeletePractice();
  if (!enquiry.practice) return null;
  return (
    <section
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-raised px-5 py-3"
      aria-label="Practice enquiry"
    >
      <Badge tone="info">{MARKERS.practice}</Badge>
      <p className="min-w-0 flex-1 text-sm text-ink-2">
        Try anything here. Nothing is sent or counted.
      </p>
      <button
        type="button"
        className="inline-flex min-h-11 items-center text-sm font-medium text-mark-strong underline-offset-4 hover:underline"
        disabled={deleting}
        onClick={() => void remove(enquiry.id)}
      >
        {deleting ? "Deleting…" : "Delete it"}
      </button>
    </section>
  );
}
