import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The media treatment for every product capture on the marketing site.
 *
 * This is the reference's frame, measured from linear.app rather than
 * designed: a #090a0b plate with 8px of padding and a 12px radius, holding a
 * #101112 panel with a 1px rgba(255,255,255,0.08) hairline and the same 12px
 * radius, with the capture itself inset behind a 1px rgba(255,255,255,0.05)
 * edge at an 8px radius and a rgba(0,0,0,0.2) 0 0 0 2px ring. All of it lives
 * in the `.mk-media*` rules at the end of styles.css so the four remaining
 * routes get the identical frame from one class.
 *
 * It replaces the previous hand-drawn phone bezel and fake browser chrome.
 * Neither exists on the reference, and the reference frames a portrait capture
 * and a landscape one exactly the same way - the aspect ratio of the child is
 * what makes it read as a phone or a desk, not a drawn device.
 *
 * There is deliberately no titlebar, address row or traffic-light chrome. The
 * reference frames its capture and nothing else, and the copy beside each film
 * already names the surface it is showing.
 */
export function MediaFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mk-media", className)}>
      <div className="mk-media-panel">
        <div className="mk-media-inner">{children}</div>
      </div>
    </div>
  );
}
