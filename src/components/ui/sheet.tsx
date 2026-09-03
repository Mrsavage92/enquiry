import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Sheet = DialogPrimitive.Root;

export function SheetContent({
  children,
  className,
  title,
  flush,
  onOpenAutoFocus,
}: {
  children: ReactNode;
  className?: string;
  title: string;
  flush?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
      <DialogPrimitive.Content
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-raised shadow-float data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
          flush
            ? "p-0 pb-[var(--app-safe-bottom)]"
            : "px-5 pb-[calc(1.25rem+var(--app-safe-bottom))] pt-2",
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
            "flex items-start justify-between gap-3",
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
        <div className={cn("min-h-0 flex-1", flush ? "overflow-hidden pt-14" : "overflow-y-auto")}>
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
