import { useRef, type KeyboardEvent } from "react";

/**
 * Arrow-key movement for a row of aria-pressed buttons (a toggle group that
 * is not a tablist). ArrowLeft/ArrowRight step, Home/End jump, and focus
 * follows the selection so a keyboard user never lands on a stale button.
 * Shared by the product showcase and the demo scene toggle so the two
 * identical-looking controls behave identically.
 */
export function useArrowGroup(count: number, selected: number, select: (index: number) => void) {
  const items = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: selected + 1,
      ArrowLeft: selected - 1,
      Home: 0,
      End: count - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const index = (next + count) % count;
    select(index);
    items.current[index]?.focus();
  };

  const bind = (index: number) => (el: HTMLButtonElement | null) => {
    items.current[index] = el;
  };

  return { onKeyDown, bind };
}
