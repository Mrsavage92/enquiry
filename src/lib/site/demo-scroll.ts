/**
 * How far /demo scrolls after a toggle tap on a phone: the least distance that
 * shows the verdict, capped so the top of the controls stays on screen.
 * Critique round 4 measured scrollIntoView pushing the controls 98px above the
 * top of the viewport; this never returns more than `controlsTop - margin`.
 */
export function decisionScrollDelta(
  controlsTop: number,
  verdictBottom: number,
  viewportHeight: number,
  margin = 16,
): number {
  const needed = verdictBottom + margin - viewportHeight;
  if (needed <= 0) return 0;
  return Math.max(0, Math.min(needed, controlsTop - margin));
}
