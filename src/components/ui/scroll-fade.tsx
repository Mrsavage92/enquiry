import type { ScrollFadeEdges } from "@/lib/use-scroll-fade";
import { cn } from "@/lib/utils";

type ScrollFadeBackground = "paper-2";

// Full literal class strings, one per background token, so Tailwind's
// static scanner can find them - assembling the class name at runtime via
// template-literal interpolation would not be discovered by the v4 JIT scan.
const FADE_FROM_CLASS: Record<ScrollFadeBackground, string> = {
  "paper-2": "from-[color-mix(in_oklab,var(--color-ink)_14%,var(--color-paper-2))]",
};

/**
 * Left/right edge-fade overlays for a horizontally scrollable strip (e.g. a
 * `Segmented` filter/tab row). Render inside the same `relative` wrapper as
 * the scrollable element `edges` was measured from (`useScrollFade`), sized
 * to that wrapper's visible width.
 *
 * The anchor colour is ink mixed lightly into the strip's own background
 * token - the same `color-mix` idiom `--color-mark-strong` uses in
 * styles.css - not a flat match to that background. Fading an opaque
 * background-token to transparent measured as a visual no-op wherever no
 * text happened to sit under it: removing the original divs from a rendered
 * Business Brain tab strip changed a maximum of 7/255 in a region with no
 * text under it, versus 140/255 where the fade overlapped trailing letters.
 * A colour that differs from the surface underneath it is visible on its
 * own, independent of what happens to be there - see
 * docs/evidence/visual-v1/w3b-strip-affordance/ for the measurements.
 */
export function ScrollFade({
  edges,
  background,
  orientation = "horizontal",
}: {
  edges: ScrollFadeEdges;
  background: ScrollFadeBackground;
  /** Only "horizontal" is implemented; named explicitly for the vertical
   * strips this may grow into rather than baked in as an assumption. */
  orientation?: "horizontal";
}) {
  const fromClass = FADE_FROM_CLASS[background];
  if (orientation !== "horizontal") return null;
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r to-transparent transition-opacity duration-150",
          fromClass,
          edges.start ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent transition-opacity duration-150",
          fromClass,
          edges.end ? "opacity-100" : "opacity-0",
        )}
      />
    </>
  );
}
