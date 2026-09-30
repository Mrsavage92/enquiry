import { useCallback, useEffect, useState } from "react";

/** Below this height (CSS px, so 200% browser zoom on a laptop counts) nothing is pinned. */
const SHORT_VIEWPORT = 640;
/** A pinned footer may take at most this share of the screen before it stops pinning. */
const MAX_FOOTER_SHARE = 0.4;

/**
 * Whether a sheet's footer can stay pinned under its scrolling body. On a
 * short screen, or with text zoomed until the buttons fill it, a pinned footer
 * left no room for the message itself; there the footer joins the scroll, so
 * the message is readable and the buttons are still reached by scrolling.
 */
export function usePinnedFooter(enabled: boolean) {
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const [pinned, setPinned] = useState(true);
  const footerRef = useCallback((node: HTMLElement | null) => setFooter(node), []);

  useEffect(() => {
    if (!enabled || !footer || typeof window === "undefined") return;
    const measure = () => {
      const height = window.innerHeight;
      setPinned(height >= SHORT_VIEWPORT && footer.offsetHeight <= height * MAX_FOOTER_SHARE);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(footer);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, footer]);

  return { footerRef, pinned: !enabled || pinned };
}
