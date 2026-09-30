import { Bell } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import * as Popover from "@radix-ui/react-popover";
import { briefing } from "@/domain/briefing";
import { cn } from "@/lib/utils";
import { usePrototype } from "@/store/prototype-store";
import { Button } from "@/components/ui/button";

type NoticeItem = { id: string; title: string; body: string; go: () => void };

/**
 * The notices waiting inside Enquiry, one list for the desktop bell and the
 * phone's More page, so the unread dot means the same thing on both.
 */
export function useNotices(): { items: NoticeItem[]; noticesOff: boolean; dismiss: (id: string) => void } {
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
  const b = briefing(enquiries, businesses, bookings, filter);
  const arrival = enquiries.find((e) => e.id === lastArrivalId);

  const items = useMemo(() => {
    const list: NoticeItem[] = [];
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
        title: `${b.followUp} back to you, no answer yet`,
        body: "Silence is not a no. Decide whether to follow up.",
        go: () => {
          setQueue("needs_you");
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
        title: `Sample workspace: reply recorded for ${lastAutomated.customerName}`,
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

  const noticesOff = !prefs.notifyArrival && !prefs.notifyFollowUp && !prefs.notifyLearning;
  return { items, noticesOff, dismiss };
}

/** The notices as a list: the phone reaches them from More. */
export function NoticesList({ onGo }: { onGo?: () => void }) {
  const { items, noticesOff, dismiss } = useNotices();
  return <NoticeBody items={items} noticesOff={noticesOff} dismiss={dismiss} onGo={onGo} />;
}

function NoticeBody({
  items,
  noticesOff,
  dismiss,
  onGo,
}: {
  items: NoticeItem[];
  noticesOff: boolean;
  dismiss: (id: string) => void;
  onGo?: () => void;
}) {
  if (items.length === 0) {
    return noticesOff ? (
      <p className="mt-3 text-sm text-stone">
        Notices are off, so nothing interrupts you. Turn them on in{" "}
        <Link to="/settings" className="font-medium text-mark-strong underline">
          Settings
        </Link>
        .
      </p>
    ) : (
      <p className="mt-3 text-sm text-stone">Nothing waiting on you here.</p>
    );
  }
  return (
    <ul className="mt-2">
      {items.map((item) => (
        <li key={item.id} className="border-t border-line py-2.5 first:border-t-0">
          <button
            type="button"
            className="min-h-11 w-full text-left"
            onClick={() => {
              item.go();
              dismiss(item.id);
              onGo?.();
            }}
          >
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-0.5 text-xs text-ink-2">{item.body}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Notices({ inverse }: { inverse?: boolean }) {
  const { items, noticesOff, dismiss } = useNotices();
  const [open, setOpen] = useState(false);
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
          <NoticeBody
            items={items}
            noticesOff={noticesOff}
            dismiss={dismiss}
            onGo={() => setOpen(false)}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
