import { Bell } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as Popover from "@radix-ui/react-popover";
import { briefing } from "@/domain/briefing";
import { cn } from "@/lib/utils";
import { usePrototype } from "@/store/prototype-store";
import { Button } from "@/components/ui/button";

export function Notices({ inverse }: { inverse?: boolean }) {
  const navigate = useNavigate();
  const enquiries = usePrototype((s) => s.enquiries);
  const businesses = usePrototype((s) => s.businesses);
  const bookings = usePrototype((s) => s.bookings);
  const filter = usePrototype((s) => s.businessFilter);
  const lastArrivalId = usePrototype((s) => s.lastArrivalId);
  const lastAutomated = usePrototype((s) => s.lastAutomated);
  const prefs = usePrototype((s) => s.prefs);
  const dismissed = usePrototype((s) => s.dismissedNotices);
  const dismiss = usePrototype((s) => s.dismissNotice);
  const setQueue = usePrototype((s) => s.setQueueFilter);
  const setBrain = usePrototype((s) => s.setBrainTab);
  const [open, setOpen] = useState(false);
  const b = briefing(enquiries, businesses, bookings, filter);
  const arrival = enquiries.find((e) => e.id === lastArrivalId);

  const items = useMemo(() => {
    const list: { id: string; title: string; body: string; go: () => void }[] = [];
    if (prefs.notifyArrival && arrival) {
      list.push({
        id: `arrive-${arrival.id}`,
        title: `${arrival.customerName} just arrived`,
        body: arrival.serviceLabel,
        go: () => void navigate({ to: "/enquiries/$enquiryId", params: { enquiryId: arrival.id } }),
      });
    }
    if (prefs.notifyFollowUp && b.followUp) {
      list.push({
        id: "followups",
        title: `${b.followUp} follow-up${b.followUp === 1 ? "" : "s"} ready`,
        body: "Silence is not a decline.",
        go: () => {
          setQueue("at_risk");
          void navigate({ to: "/enquiries" });
        },
      });
    }
    if (prefs.notifyLearning && b.learning) {
      list.push({
        id: "learning",
        title: `${b.learning} learning waiting`,
        body: "Proposed interpretations need a decision.",
        go: () => {
          setBrain("learning");
          void navigate({ to: "/business" });
        },
      });
    }
    if (lastAutomated) {
      list.push({
        id: `auto-${lastAutomated.enquiryId}-${lastAutomated.at}`,
        title: `Autopilot sent to ${lastAutomated.customerName}`,
        body: lastAutomated.reason,
        go: () =>
          void navigate({
            to: "/enquiries/$enquiryId",
            params: { enquiryId: lastAutomated.enquiryId },
          }),
      });
    }
    return list.filter((i) => !dismissed.includes(i.id));
  }, [
    arrival,
    b.followUp,
    b.learning,
    dismissed,
    lastAutomated,
    navigate,
    prefs.notifyArrival,
    prefs.notifyFollowUp,
    prefs.notifyLearning,
    setBrain,
    setQueue,
  ]);

  const count = items.length;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant={inverse ? "inverse" : "ghost"}
          size="icon"
          aria-label={count ? `${count} notices` : "Notices"}
          className="relative"
        >
          <Bell className="size-4" aria-hidden />
          {count > 0 ? (
            <span
              className={cn(
                "absolute right-1.5 top-1.5 size-1.5 rounded-full",
                inverse ? "bg-paper" : "bg-ink",
              )}
            />
          ) : null}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-lg bg-raised p-3 shadow-float data-[state=open]:animate-menu-in"
        >
          <p className="eyebrow">Today</p>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-stone">Nothing waiting on you here.</p>
          ) : (
            <ul className="mt-2">
              {items.map((item) => (
                <li key={item.id} className="border-t border-line py-2.5 first:border-t-0">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      item.go();
                      dismiss(item.id);
                      setOpen(false);
                    }}
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-ink-2">{item.body}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
