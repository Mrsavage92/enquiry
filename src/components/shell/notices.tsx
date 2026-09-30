import { Bell } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNotices, type NoticeItem } from "./use-notices";

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
