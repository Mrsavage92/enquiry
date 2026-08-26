export const LAUNCH_EVENTS = new Set([
  "page_view",
  "hero_cta_click",
  "waitlist_form_start",
  "waitlist_signup",
  "qualification_started",
  "qualification_completed",
  "roadmap_vote",
  "roadmap_waitlist_click",
  "roadmap_waitlist_signup",
  "roadmap_stage_engaged",
  "roadmap_feedback_click",
  "roadmap_view",
  "roadmap_endgame_view",
  "roadmap_stage_view",
  "roadmap_feedback_submitted",
]);

/** Public eras, plus retained legacy IDs so stored interest still validates. */
export const ROADMAP_FEATURE_IDS = new Set([
  "understand",
  "business-brain",
  "continuity",
  "keep-moving",
  "trusted-action",
  "endgame",
  "prove",
  "learn",
  "decision",
  "pipeline",
  "connect",
  "autopilot",
  "leak",
]);

/** Old public-stage IDs that map onto a current era. Unmapped IDs stay themselves. */
export const ROADMAP_FEATURE_CANONICAL: Record<string, string> = {
  prove: "understand",
  learn: "business-brain",
  pipeline: "keep-moving",
  autopilot: "trusted-action",
};

export function canonicalFeatureId(id: string) {
  return ROADMAP_FEATURE_CANONICAL[id] ?? id;
}

export function featureIdFamily(id: string) {
  const canonical = canonicalFeatureId(id);
  const family = new Set<string>([canonical, id]);
  for (const [legacy, target] of Object.entries(ROADMAP_FEATURE_CANONICAL)) {
    if (target === canonical) family.add(legacy);
  }
  return [...family];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function asString(v: unknown, max = 320) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export function isUuid(v: string) {
  return UUID_RE.test(v);
}

export function isEmail(v: string) {
  if (v.length < 6 || v.length > 254) return false;
  if (v.includes("..") || v.startsWith(".") || v.includes("@.")) return false;
  return /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9.-]{0,61}[a-z0-9])?\.[a-z]{2,24}$/i.test(
    v,
  );
}

export function sanitizePath(v: string) {
  const s = v.trim();
  if (!s.startsWith("/") || s.startsWith("//")) return "/";
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return "/";
  return s.slice(0, 200);
}

export function isAllowedEvent(name: string) {
  return LAUNCH_EVENTS.has(name);
}

export function isAllowedFeature(id: string) {
  return id === "" || ROADMAP_FEATURE_IDS.has(id);
}

export function honeypotFilled(v: unknown) {
  return typeof v === "string" && v.trim().length > 0;
}

type Bucket = { n: number; reset: number };
const buckets = new Map<string, Bucket>();

/** Returns false when the caller should be rejected. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || now >= current.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (current.n >= limit) return false;
  current.n += 1;
  return true;
}

export function resetRateLimit() {
  buckets.clear();
}
