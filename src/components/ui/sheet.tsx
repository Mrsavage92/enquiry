import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useReturnFocus } from "./return-focus";
import { usePinnedFooter } from "./pinned-footer";

export const Sheet = DialogPrimitive.Root;

export function SheetContent({
  children,
  className,
  title,
  flush,
  onOpenAutoFocus,
  footer,
}: {
  children: ReactNode;
  className?: string;
  title: string;
  flush?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
  /**
   * Pinned under the scrolling body: the sheet's main action stays on screen
   * however long the content above it grows.
   */
  footer?: ReactNode;
}) {
  const focus = useReturnFocus(onOpenAutoFocus);
  const { footerRef, pinned } = usePinnedFooter(Boolean(footer));
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
      <DialogPrimitive.Content
        {...focus}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-raised shadow-float data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
          flush
            ? "p-0 pb-[var(--app-safe-bottom)]"
            : "px-5 pb-[calc(1.25rem+var(--app-safe-bottom))] pt-2",
          // Unpinned: the whole sheet scrolls, footer included.
          !pinned && "overflow-y-auto",
          className,
        )}
      >
        <div
          className={cn("flex justify-center", flush ? "absolute inset-x-0 top-2 z-10" : "mb-1")}
          aria-hidden
        >
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            flush ? "absolute inset-x-0 top-4 z-10 px-4" : "mb-4 mt-2",
          )}
        >
          <DialogPrimitive.Title
            className={cn(
              "text-lg font-semibold tracking-tight text-ink",
              flush && "rounded-md bg-raised/90 px-2 py-1",
            )}
          >
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close"
              className={flush ? "bg-raised/90" : undefined}
            >
              <X className="size-4" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        <div
          className={cn(
            flush
              ? "min-h-0 flex-1 overflow-hidden pt-14"
              : !pinned
                ? "flex-none"
                : footer
                  ? "min-h-24 flex-1 overflow-y-auto"
                  : "min-h-0 flex-1 overflow-y-auto",
          )}
        >
          {children}
        </div>
        {footer ? (
          <div
            ref={footerRef}
            data-pinned={pinned ? "true" : "false"}
            className={cn(
              "sheet-footer -mx-5 shrink-0 bg-raised px-5 pt-3",
              pinned ? "border-t border-line" : "mt-4",
            )}
          >
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
