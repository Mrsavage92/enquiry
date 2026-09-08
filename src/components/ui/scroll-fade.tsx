import type { ScrollFadeEdges } from "@/lib/use-scroll-fade";
import { cn } from "@/lib/utils";

/**
 * Left/right edge-fade overlays for a horizontally scrollable strip (e.g. a
 * `Segmented` filter/tab row). Render inside the same `relative` wrapper as
 * the scrollable element `edges` was measured from (`useScrollFade`), sized
 * to that wrapper's visible width.
 *
 * The anchor colour is ink at a low, fixed alpha (`ink/10`) - the same
 * translucent-scrim idiom as the dialog overlay (`bg-ink/40`), just far
 * lighter - fading to fully transparent, not an opaque colour-mix tint
 * fading to transparent. That distinction matters: a `from-[opaque colour]
 * to-transparent` gradient's *alpha* still sweeps the full 0-100% range
 * across its width even when the opaque colour itself is only lightly
 * tinted, so as a chip scrolls under it, some scroll position lands a
 * glyph under a near-opaque intermediate point where chip and overlay
 * converge toward the same colour - an earlier version of this fix
 * (color-mix(ink 14%, paper-2), an opaque anchor whose alpha still ran
 * 0-100% across the band) measured 6.54:1 / 6.65:1 at rest but as low as
 * 2.45:1 (queue) / 2.56:1 (Business Brain) at other scroll positions.
 * Capping the alpha itself at 10% bounds how far toward the overlay colour
 * *any* pixel underneath can be pulled, at any scroll position, not just
 * the rest states.
 *
 * Verified with a full scrollLeft sweep at 1px-4px resolution (queue: 0 to
 * 172; Business Brain: 0 to 95) at 1440 and 1920, each position captured
 * both with the fade present and with the fade divs removed from the DOM:
 * the fade causes zero contrast readings below 4.5:1 anywhere in that
 * range on either strip at either viewport. A handful of queue positions
 * do read below 4.5:1 (the count-badge digit's `text-stone-on-paper-2`
 * token, styles.css, already measures ~4.57:1 against `paper-2` on its
 * own) but read identically with the fade removed - pre-existing, not
 * caused by this component. See
 * docs/evidence/visual-v1/w3b-strip-affordance/ for the sweep data.
 */
export function ScrollFade({
  edges,
  orientation = "horizontal",
}: {
  edges: ScrollFadeEdges;
  /** Only "horizontal" is implemented; named explicitly for the vertical
   * strips this may grow into rather than baked in as an assumption. */
  orientation?: "horizontal";
}) {
  if (orientation !== "horizontal") return null;
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-ink/10 to-transparent transition-opacity duration-150",
          edges.start ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-ink/10 to-transparent transition-opacity duration-150",
          edges.end ? "opacity-100" : "opacity-0",
        )}
      />
    </>
  );
}
