import { Dialog, DialogContent } from "@/components/ui/dialog";

const ROWS = [
  { keys: "⌘K", does: "Jump anywhere" },
  { keys: "/", does: "Find in the queue" },
  { keys: "J / K", does: "Next / previous enquiry" },
  { keys: "⌘Enter", does: "Send the recommended action" },
  { keys: "G then E", does: "Go to enquiries" },
  { keys: "G then B", does: "Go to bookings" },
  { keys: "G then I", does: "Go to insights" },
  { keys: "U", does: "Undo the last change" },
  { keys: "?", does: "This list" },
];

export function KeysHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Keyboard">
        <p className="text-sm text-ink-2">Enquiry is meant to be driven, not browsed.</p>
        <dl className="mt-4">
          {ROWS.map((row) => (
            <div key={row.keys} className="flex items-baseline justify-between gap-4 border-t border-line py-2.5">
              <dt>
                <kbd className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-xs">{row.keys}</kbd>
              </dt>
              <dd className="text-sm text-ink-2">{row.does}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
