/**
 * Validation for the profile onboarding submits to create a real workspace.
 *
 * Pure and separate from the server function so the rules can be tested without
 * a database. The server function uses this, so what is tested here is what
 * actually runs - not a parallel reimplementation that can drift.
 */

export type RawProfile = Record<string, unknown>;

export type CleanProfile = {
  name: string;
  ownerFirstName: string;
  industry: string;
  baseLocation: string;
  timezone: string;
  soloOrTeam: "solo" | "team";
  currency: string;
};

const str = (v: unknown, max: number): string =>
  (typeof v === "string" ? v : "").trim().slice(0, max);

/**
 * A browser-supplied IANA zone, confirmed by the operator, validated here.
 *
 * Intl is the authority rather than a city list: Enquiry is not a single-market
 * product, and a hard-coded map silently excludes every business outside it.
 * Unrecognised or absent values become UTC rather than someone else's timezone.
 */
export function normaliseTimezone(value: unknown): string {
  const tz = str(value, 64);
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/**
 * ISO-4217-shaped code, upper-cased. Anything else falls back rather than throwing.
 *
 * Validates the WHOLE input, deliberately. Truncating to three characters first
 * turns "dollars" into the currency "DOL", which is not a currency and would be
 * stored against every price the business ever quotes.
 */
export function normaliseCurrency(value: unknown, fallback = "AUD"): string {
  const raw = (typeof value === "string" ? value : "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(raw) ? raw : fallback;
}

/**
 * Validate a submitted profile, or throw with a message the operator can act on.
 * Only the business name is required - everything else can be filled in later,
 * and blocking onboarding on optional fields just loses the account.
 */
export function cleanOnboardingProfile(raw: RawProfile): CleanProfile {
  const name = str(raw.name, 120);
  if (!name) throw new Error("A business name is required.");
  return {
    name,
    ownerFirstName: str(raw.ownerFirstName, 80),
    industry: str(raw.industry, 120),
    baseLocation: str(raw.baseLocation, 200),
    timezone: normaliseTimezone(raw.timezone),
    soloOrTeam: raw.soloOrTeam === "team" ? "team" : "solo",
    currency: normaliseCurrency(raw.currency),
  };
}
