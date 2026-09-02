/**
 * The resend cooldown for auth mail.
 *
 * Two jobs, and only one of them is rate limiting. The visible countdown is
 * mostly there so a customer whose link has not arrived has something true to
 * do instead of hammering a button that reports success every time while
 * Supabase silently drops the extra requests.
 *
 * Pure and clock-injected so the boundary cases (exactly zero, a clock that
 * jumped backwards) are tested rather than eyeballed against a real timer.
 */

/** Comfortably above Supabase's default 60s-per-address mail throttle floor. */
export const RESEND_COOLDOWN_MS = 60_000;

/** Milliseconds left before another send is allowed. Never negative. */
export function resendCooldownRemainingMs(
  lastRequestedAt: number | null,
  now: number,
  cooldownMs: number = RESEND_COOLDOWN_MS,
): number {
  if (lastRequestedAt === null) return 0;
  // A clock that moved backwards (system time change, suspended laptop) would
  // otherwise strand the button for the size of the jump.
  const elapsed = now - lastRequestedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) return cooldownMs;
  return Math.max(0, cooldownMs - elapsed);
}

export function canResend(
  lastRequestedAt: number | null,
  now: number,
  cooldownMs: number = RESEND_COOLDOWN_MS,
): boolean {
  return resendCooldownRemainingMs(lastRequestedAt, now, cooldownMs) === 0;
}

/** Whole seconds remaining, rounded up so the label never shows "0s" while blocked. */
export function cooldownSeconds(remainingMs: number): number {
  return Math.ceil(Math.max(0, remainingMs) / 1000);
}

/** Button label for the resend control. */
export function resendLabel(remainingMs: number, busy: boolean): string {
  if (busy) return "Sending…";
  const seconds = cooldownSeconds(remainingMs);
  return seconds > 0 ? `Resend in ${seconds}s` : "Resend the link";
}
