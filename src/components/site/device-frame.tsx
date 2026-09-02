import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Frames for the product captures on the marketing site.
 *
 * A portrait screen recording dropped flat onto a dark plate reads as a stray
 * white rectangle, not as a phone - which is what the phone capture looked
 * like, floating at 304px in a 984px plate with black voids either side. A
 * bezel is what tells the eye "this is a phone", and once it is a phone it can
 * be shown at a size worth looking at.
 *
 * Both frames are pure CSS. No image assets, so nothing to keep in sync with
 * the capture inside them.
 */

export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-[2.6rem] bg-[#0b0a09] p-[0.7rem]",
        // Two rings: the outer edge of the device, and the polished lip that
        // catches light on a real handset.
        "shadow-[0_2px_0_rgba(255,255,255,0.10)_inset,0_40px_80px_-32px_rgba(0,0,0,0.9)]",
        "outline outline-1 -outline-offset-1 outline-white/12",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[1.95rem] bg-black">
        {children}
      </div>
    </div>
  );
}

/**
 * Browser chrome for the desktop capture.
 *
 * The copy says "the website is here if you sit down" and the capture was a
 * bare rectangle with nothing to say it was a website. This is the cheapest
 * honest signal: a title bar and the real address.
 */
export function BrowserFrame({
  children,
  url = "enquiry.app",
  className,
}: {
  children: ReactNode;
  url?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg bg-[#0b0a09]",
        "shadow-[0_40px_90px_-40px_rgba(0,0,0,0.85)]",
        "outline outline-1 -outline-offset-1 outline-white/12",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="ml-2 truncate rounded bg-white/[0.07] px-2.5 py-1 text-[0.7rem] text-paper/55">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}
