import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
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
}: {
  children: ReactNode;
  className?: string;
  title: string;
  onOpenAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
      <DialogPrimitive.Content
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-raised p-5 shadow-float data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
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
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

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
  const phone = useNarrow(860);
  return phone ? (
    <SheetContent {...props} />
  ) : (
    <DialogContent {...props} className={cn("max-h-[90dvh] overflow-y-auto", className)} />
  );
}
