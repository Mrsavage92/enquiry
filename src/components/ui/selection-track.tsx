import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Indicator = { x: number; y: number; width: number; height: number };

/** The indicator follows actual controls, including wrapped labels and resized tabs. */
export function SelectionTrack({
  activeKey,
  children,
  className,
  label,
  role,
  as: Tag = "div",
}: {
  activeKey: string;
  children: ReactNode;
  className?: string;
  label: string;
  role?: "tablist";
  as?: "div" | "nav";
}) {
  const root = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);

  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const selected = container.querySelector<HTMLElement>("[data-motion-selected='true']");
    if (!selected) {
      setIndicator(null);
      return;
    }
    const measure = () => {
      const parent = container.getBoundingClientRect();
      const item = selected.getBoundingClientRect();
      const next = {
        x: item.left - parent.left + container.scrollLeft - container.clientLeft,
        y: item.top - parent.top + container.scrollTop - container.clientTop,
        width: item.width,
        height: item.height,
      };
      setIndicator((current) =>
        current &&
        Object.keys(next).every(
          (key) => current[key as keyof Indicator] === next[key as keyof Indicator],
        )
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    // Earlier tabs can change width when a count updates or the font finishes loading.
    container
      .querySelectorAll<HTMLElement>("[data-motion-selected]")
      .forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [activeKey]);

  return (
    <Tag
      ref={(element) => {
        root.current = element;
      }}
      role={role}
      aria-label={label}
      className={cn("selection-track", className)}
      data-indicator={indicator ? "ready" : undefined}
    >
      {indicator ? (
        <span
          aria-hidden
          className="selection-track-indicator"
          style={{
            width: indicator.width,
            height: indicator.height,
            transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
          }}
        />
      ) : null}
      {children}
    </Tag>
  );
}
