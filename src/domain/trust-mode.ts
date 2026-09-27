/**
 * The trust modes an owner can choose. The old autonomous mode is gone:
 * nothing in Enquiry sends by itself, so a stored or submitted legacy value is
 * read as Assist (Enquiry prepares, the owner sends) - the most it could ever
 * have meant in practice - and never accepted as its own mode again.
 */
export const TRUST_MODES = ["Private", "Observe", "Assist"] as const;

export type ChoosableTrustMode = (typeof TRUST_MODES)[number];

const LEGACY_AUTONOMOUS = "autopilot";

export function normaliseTrustMode(raw: string | null | undefined): ChoosableTrustMode | null {
  const value = (raw ?? "").trim();
  if ((TRUST_MODES as readonly string[]).includes(value)) return value as ChoosableTrustMode;
  return value.toLowerCase() === LEGACY_AUTONOMOUS ? "Assist" : null;
}
