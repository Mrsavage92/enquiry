import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Copy anyway" is for warnings the owner has seen (doc 50 7.3): each item
 * counts once at least half of it has been on screen, or once it or the list
 * has had keyboard or screen-reader focus. Counting per item lets a list taller
 * than the screen be acknowledged by scrolling through it once. A new list
 * starts again.
 */
export function useSeen(items: readonly string[]): {
  itemRef: (index: number) => (el: HTMLElement | null) => void;
  markAll: () => void;
  allSeen: boolean;
} {
  const key = items.join("\u0000");
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const nodes = useRef(new Map<number, HTMLElement>());

  useEffect(() => setSeen(new Set()), [key]);

  useEffect(() => {
    if (items.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.intersectionRatio >= 0.5)
          .map((e) => Number((e.target as HTMLElement).dataset.seenIndex));
        if (hit.length) setSeen((prev) => new Set([...prev, ...hit]));
      },
      { threshold: [0.5] },
    );
    for (const node of nodes.current.values()) observer.observe(node);
    return () => observer.disconnect();
    // Re-observe when the list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const itemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      if (el) {
        el.dataset.seenIndex = String(index);
        nodes.current.set(index, el);
      } else nodes.current.delete(index);
    },
    [],
  );
  const markAll = useCallback(
    () => setSeen(new Set(items.map((_, i) => i))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return { itemRef, markAll, allSeen: items.every((_, i) => seen.has(i)) };
}
