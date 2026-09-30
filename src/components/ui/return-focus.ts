import { useRef } from "react";

/**
 * Put focus back where it was when a sheet or dialog closes (Esc, the close
 * button, a tap outside). These dialogs are opened from state, not from a
 * Radix Trigger, so Radix has nothing to return to and focus fell to <body>.
 * The element focused at the moment the dialog opens is remembered and
 * refocused on close, if it is still on the page.
 */
export function useReturnFocus(onOpenAutoFocus?: (event: Event) => void) {
  const returnTo = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = typeof document === "undefined" ? null : document.activeElement;
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      const target = returnTo.current;
      returnTo.current = null;
      if (target && target.isConnected) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}
