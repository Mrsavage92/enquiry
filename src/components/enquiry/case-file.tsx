import { formatWhen } from "@/domain/format";
import type { Enquiry } from "@/domain/types";

export function CaseFile({ enquiry }: { enquiry: Enquiry }) {
  const events = [
    {
      id: "received",
      at: enquiry.receivedAt,
      label: "Received",
      detail: enquiry.serviceLabel,
    },
    ...enquiry.conversation.map((m) => ({
      id: m.id,
      at: m.at,
      label: m.direction === "inbound" ? "They wrote" : "You sent",
      detail: m.quoted ? "Quote sheet attached" : m.subject ?? m.body.slice(0, 72),
    })),
    ...(enquiry.decision.changeDiff ?? []).map((d, i) => ({
      id: `diff-${i}`,
      at: enquiry.updatedAt,
      label: d.factLabel,
      detail: `${d.from} → ${d.to}`,
    })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return (
    <section className="border-b border-line px-5 py-5" aria-labelledby="file-heading">
      <p id="file-heading" className="eyebrow">
        Case file
      </p>
      <ol className="mt-3">
        {events.map((ev) => (
          <li key={ev.id} className="flex gap-3 border-t border-line py-2.5 first:border-t-0">
            <p className="w-28 shrink-0 text-2xs tabular-nums text-stone">{formatWhen(ev.at)}</p>
            <div className="min-w-0">
              <p className="text-sm font-medium">{ev.label}</p>
              <p className="mt-0.5 truncate text-xs text-ink-2">{ev.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
