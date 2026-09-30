import { useRef } from "react";

/**
 * The last element that had focus outside any dialog. A trigger that goes
 * disabled while it works ("Preparing review...") drops focus to <body>
 * before its dialog opens, so the element focused at that moment is not the
 * one to return to; the last one the owner actually focused is.
 */
let lastFocused: HTMLElement | null = null;
let listening = false;

function track() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target === document.body) return;
      if (target.closest('[role="dialog"], [role="alertdialog"]')) return;
      lastFocused = target;
    },
    true,
  );
}

/**
 * Put focus back where it was when a sheet or dialog closes (Esc, the close
 * button, a tap outside). These dialogs are opened from state, not from a
 * Radix Trigger, so Radix had nothing to return to and focus fell to <body>.
 */
export function useReturnFocus(onOpenAutoFocus?: (event: Event) => void) {
  track();
  const returnTo = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = typeof document === "undefined" ? null : document.activeElement;
      returnTo.current =
        active instanceof HTMLElement && active !== document.body ? active : lastFocused;
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
