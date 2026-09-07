import { useEffect, useRef, useState } from "react";

export type ScrollFadeEdges = { start: boolean; end: boolean };

type OverflowMetrics = {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
};

/**
 * Pure overflow math for a horizontally scrollable strip, kept separate from
 * the DOM-observing hook below so it can be unit-tested without a browser.
 * `start`/`end` follow reading order (left/right in LTR), not literal scroll
 * direction: `start` is true once the strip has been scrolled away from its
 * beginning, `end` is true while more content sits past the visible edge.
 */
export function computeFadeEdges({
  scrollWidth,
  clientWidth,
  scrollLeft,
}: OverflowMetrics): ScrollFadeEdges {
  const overflowing = scrollWidth > clientWidth + 1;
  return {
    start: overflowing && scrollLeft > 1,
    end: overflowing && scrollLeft < scrollWidth - clientWidth - 1,
  };
}

/**
 * Tracks horizontal overflow on the returned `scrollRef` element and which
 * edge(s) currently hide more content, refreshed on scroll and on resize
 * (`ResizeObserver`) - including at first paint, via a synchronous measure
 * inside the effect, so the cue is correct at rest and never depends on a
 * scroll event firing first. Re-measures whenever `deps` changes (e.g. the
 * strip's own option list changing length).
 *
 * Also scrolls a tab into view within the strip itself - never the page -
 * whenever one receives keyboard focus, so Tab (or a future roving-tabindex
 * arrow-key tablist) can reach a chip currently hidden past the fade.
 * `scrollIntoView({ block: "nearest", inline: "nearest" })` only moves the
 * nearest scrollable ancestor that needs to move, unlike the default
 * `scrollIntoView()` "start" alignment, which can drag the whole page.
 */
export function useScrollFade<T extends HTMLElement>(deps: readonly unknown[] = []) {
  const scrollRef = useRef<T>(null);
  const [edges, setEdges] = useState<ScrollFadeEdges>({ start: false, end: false });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () =>
      setEdges(
        computeFadeEdges({
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          scrollLeft: el.scrollLeft,
        }),
      );
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.getAttribute("role") === "tab") {
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    el.addEventListener("focusin", onFocusIn);
    return () => el.removeEventListener("focusin", onFocusIn);
  }, []);

  return { scrollRef, edges };
}
