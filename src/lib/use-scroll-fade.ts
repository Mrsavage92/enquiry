import { useEffect, useRef, useState } from "react";

export type ScrollFadeEdges = { start: boolean; end: boolean };

type OverflowMetrics = {
  scrollExtent: number;
  clientExtent: number;
  scrollPos: number;
};

/**
 * Pure overflow math, shared by the horizontal and vertical fade
 * computations below, kept separate from the DOM-observing hook so it can be
 * unit-tested without a browser. `start`/`end` follow reading/scroll order
 * (left-to-right or top-to-bottom), not a literal direction: `start` is true
 * once the container has been scrolled away from its beginning, `end` is
 * true while more content sits past the visible edge.
 */
function computeOverflowEdges({
  scrollExtent,
  clientExtent,
  scrollPos,
}: OverflowMetrics): ScrollFadeEdges {
  const overflowing = scrollExtent > clientExtent + 1;
  return {
    start: overflowing && scrollPos > 1,
    end: overflowing && scrollPos < scrollExtent - clientExtent - 1,
  };
}

/** Horizontal strip (e.g. a `Segmented` filter/tab row). */
export function computeFadeEdges({
  scrollWidth,
  clientWidth,
  scrollLeft,
}: {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
}): ScrollFadeEdges {
  return computeOverflowEdges({
    scrollExtent: scrollWidth,
    clientExtent: clientWidth,
    scrollPos: scrollLeft,
  });
}

/** Vertical panel (e.g. the enquiry decision column). */
export function computeVerticalFadeEdges({
  scrollHeight,
  clientHeight,
  scrollTop,
}: {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}): ScrollFadeEdges {
  return computeOverflowEdges({
    scrollExtent: scrollHeight,
    clientExtent: clientHeight,
    scrollPos: scrollTop,
  });
}

/**
 * Tracks overflow (horizontal by default, or vertical when `orientation` is
 * "vertical") on the returned `scrollRef` element and which edge(s)
 * currently hide more content, refreshed on scroll and on resize
 * (`ResizeObserver`) - including at first paint, via a synchronous measure
 * inside the effect, so the cue is correct at rest and never depends on a
 * scroll event firing first. Re-measures whenever `deps` changes (e.g. the
 * strip's own option list changing length).
 *
 * Also scrolls a tab into view within the strip itself - never the page -
 * whenever one receives keyboard focus, so Tab (or a future roving-tabindex
 * arrow-key tablist) can reach a chip currently hidden past the fade. Inert
 * for a vertical container with no `role="tab"` descendants.
 * `scrollIntoView({ block: "nearest", inline: "nearest" })` only moves the
 * nearest scrollable ancestor that needs to move, unlike the default
 * `scrollIntoView()` "start" alignment, which can drag the whole page.
 */
export function useScrollFade<T extends HTMLElement>(
  deps: readonly unknown[] = [],
  orientation: "horizontal" | "vertical" = "horizontal",
) {
  const scrollRef = useRef<T>(null);
  const [edges, setEdges] = useState<ScrollFadeEdges>({ start: false, end: false });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () =>
      setEdges(
        orientation === "vertical"
          ? computeVerticalFadeEdges({
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              scrollTop: el.scrollTop,
            })
          : computeFadeEdges({
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
