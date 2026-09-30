import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useNarrow } from "@/lib/use-narrow";
import { Button } from "./button";
import { SheetContent } from "./sheet";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  children,
  className,
  title,
  onOpenAutoFocus,
  footer,
}: {
  children: ReactNode;
  className?: string;
  title: string;
  onOpenAutoFocus?: (event: Event) => void;
  /** Pinned under the scrolling body, as on the phone sheet. */
  footer?: ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
      <DialogPrimitive.Content
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-raised p-5 shadow-float data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          footer && "flex max-h-[90dvh] flex-col",
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-ink">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon" aria-label="Close">
              <X className="size-4" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        {footer ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            <div className="-mx-5 -mb-5 mt-4 shrink-0 border-t border-line px-5 pb-5 pt-3">
              {footer}
            </div>
          </>
        ) : (
          children
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

const PHONE_MAX = 860;
const PHONE_QUERY = `(max-width: ${PHONE_MAX}px)`;

/**
 * One dialog pattern across the app: a bottom sheet on a phone (the same
 * component as the send preview), a centred modal on a wider screen.
 */
export function ResponsiveDialogContent({
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
  title: string;
  onOpenAutoFocus?: (event: Event) => void;
}) {
  // Read synchronously: the content only mounts in the browser, and starting
  // from "not known yet" would swap the modal for the sheet after the first
  // frame and throw away anything already typed.
  const [initial] = useState(() =>
    typeof window === "undefined" ? null : window.matchMedia(PHONE_QUERY).matches,
  );
  const phone = useNarrow(PHONE_MAX) ?? initial;
  return phone ? (
    <SheetContent {...props} />
  ) : (
    <DialogContent {...props} className={cn("max-h-[90dvh] overflow-y-auto", className)} />
  );
}
