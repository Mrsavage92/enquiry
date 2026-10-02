import { useEffect, useRef, useState } from "react";

/** How long a changed sentence stays marked after a decision rewrites the reply. */
const FRESH_MS = 2000;

/** The lines of a new reply that the old one did not have. */
export function freshLines(before: string, after: string): string[] {
  const old = new Set(before.split("\n").map((l) => l.trim()));
  return after
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !old.has(l));
}

/**
 * The lines an answer just changed in the prepared reply (doc 50 6.1: instead
 * of a toast). Marked for two seconds; nothing while the owner's own edit is
 * on screen, since the prepared reply is not what they see.
 */
export function useFreshLines(prepared: string, edited: boolean): string[] {
  const last = useRef(prepared);
  const [fresh, setFresh] = useState<string[]>([]);
  useEffect(() => {
    const before = last.current;
    last.current = prepared;
    if (edited || before === prepared || !before) return;
    setFresh(freshLines(before, prepared));
    const t = window.setTimeout(() => setFresh([]), FRESH_MS);
    return () => window.clearTimeout(t);
  }, [prepared, edited]);
  return fresh;
}
