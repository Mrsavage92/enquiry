import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { laterChoices } from "@/domain/time-cues";
import { usePrototype } from "@/store/prototype-store";

/**
 * Park an enquiry until a named time: later today, tomorrow morning, or after
 * the weekend. Each choice says the actual day, so the owner never has to work
 * out when "two days" lands. It comes back to Needs you on its own.
 */
export function LaterChoices({
  open,
  onOpenChange,
  compact,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compact?: boolean;
  onChoose: (untilIso: string, label: string) => void;
}) {
  const prefs = usePrototype((s) => s.prefs);
  const Panel = compact ? SheetContent : DialogContent;
  const choices = open ? laterChoices(new Date(), prefs) : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Panel title="Come back to this">
        <p className="text-sm text-ink-2">It returns to Needs you at the time you pick.</p>
        <div className="mt-4 grid gap-2">
          {choices.map((choice) => (
            <Button
              key={choice.id}
              variant="secondary"
              className="min-h-12 w-full justify-start"
              onClick={() => onChoose(choice.until, choice.label)}
            >
              {choice.label}
            </Button>
          ))}
          <Button variant="ghost" className="min-h-12 w-full" onClick={() => onOpenChange(false)}>
            Keep it here
          </Button>
        </div>
      </Panel>
    </Dialog>
  );
}
