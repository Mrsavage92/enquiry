import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanOnboardingProfile,
  normaliseCurrency,
  normaliseTimezone,
} from "./onboarding-profile.ts";

test("a real profile round-trips", () => {
  const p = cleanOnboardingProfile({
    name: "  Ridge & Co  ",
    ownerFirstName: " Maya ",
    industry: "painting",
    baseLocation: "Lisbon",
    timezone: "Europe/Lisbon",
    soloOrTeam: "team",
    currency: "aud",
  });
  assert.deepEqual(p, {
    name: "Ridge & Co",
    ownerFirstName: "Maya",
    industry: "painting",
    baseLocation: "Lisbon",
    // Timezone is genuinely global; currency is not yet. See the currency test.
    timezone: "Europe/Lisbon",
    soloOrTeam: "team",
    currency: "AUD",
  });
});

test("a business name is required, so onboarding cannot silently create a blank tenant", () => {
  assert.throws(() => cleanOnboardingProfile({ name: "   " }), /business name/i);
  assert.throws(() => cleanOnboardingProfile({}), /business name/i);
});

test("optional fields never block account creation", () => {
  const p = cleanOnboardingProfile({ name: "Solo Painter" });
  assert.equal(p.ownerFirstName, "");
  assert.equal(p.industry, "");
  assert.equal(p.baseLocation, "");
});

test("timezone accepts any valid IANA zone, not one market's cities", () => {
  for (const tz of ["Europe/Lisbon", "America/New_York", "Asia/Tokyo", "Australia/Brisbane"]) {
    assert.equal(normaliseTimezone(tz), tz);
  }
});

test("an invalid or missing timezone becomes UTC, never someone else's zone", () => {
  assert.equal(normaliseTimezone("Mars/Olympus"), "UTC");
  assert.equal(normaliseTimezone(""), "UTC");
  assert.equal(normaliseTimezone(undefined), "UTC");
  assert.equal(normaliseTimezone(42), "UTC");
});

test("only a currency the money domain can represent is persisted", () => {
  // Money.currency, MoneyRange.currency and Business.currency are all the
  // literal type "AUD". Accepting EUR here would store a code the evaluators,
  // quote rendering and formatting all ignore - it would be calculated and
  // displayed as dollars regardless, which is worse than refusing it.
  assert.equal(normaliseCurrency("aud"), "AUD");
  assert.equal(normaliseCurrency("AUD"), "AUD");
  assert.equal(normaliseCurrency("EUR"), "AUD");
  assert.equal(normaliseCurrency("gbp"), "AUD");
  assert.equal(normaliseCurrency("USD"), "AUD");
  // Whole-input validation: truncating first would turn "dollars" into "DOL".
  assert.equal(normaliseCurrency("dollars"), "AUD");
  assert.equal(normaliseCurrency(""), "AUD");
  assert.equal(normaliseCurrency(null), "AUD");
});

test("soloOrTeam only ever resolves to a known value", () => {
  assert.equal(cleanOnboardingProfile({ name: "x", soloOrTeam: "team" }).soloOrTeam, "team");
  assert.equal(cleanOnboardingProfile({ name: "x", soloOrTeam: "solo" }).soloOrTeam, "solo");
  assert.equal(cleanOnboardingProfile({ name: "x", soloOrTeam: "admin" }).soloOrTeam, "solo");
  assert.equal(cleanOnboardingProfile({ name: "x" }).soloOrTeam, "solo");
});

test("oversized input is truncated rather than rejected or stored unbounded", () => {
  const p = cleanOnboardingProfile({ name: "n".repeat(500), baseLocation: "b".repeat(500) });
  assert.equal(p.name.length, 120);
  assert.equal(p.baseLocation.length, 200);
});

test("no field can carry a channel connection into a new tenant", () => {
  // Integration state is not part of the profile contract at all, so a channel
  // preference cannot become integration.status = "connected" (R2A s5).
  const p = cleanOnboardingProfile({
    name: "x",
    arrival: "instagram",
    integrations: [{ kind: "instagram", status: "connected" }],
  } as Record<string, unknown>);
  assert.deepEqual(Object.keys(p).sort(), [
    "baseLocation", "currency", "industry", "name", "ownerFirstName", "soloOrTeam", "timezone",
  ]);
});
