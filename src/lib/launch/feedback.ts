import {
  asString,
  canonicalFeatureId,
  isAllowedFeature,
  isUuid,
} from "./guard.ts";

export const PROBLEM_TEXT_MAX = 800;

export type AttributionFields = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  referrer: string;
};

export type FeedbackInput = {
  feature_id?: unknown;
  sessionId?: unknown;
  waitlist_id?: unknown;
  problem_text?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  referrer?: unknown;
};

export type PreparedFeedback = {
  featureId: string;
  sessionId: string;
  waitlistId: string | null;
  problemText: string;
  attribution: AttributionFields;
};

export type SqlLike = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
};

export function attributionFields(raw: {
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  referrer?: unknown;
}): AttributionFields {
  return {
    utm_source: asString(raw.utm_source, 80),
    utm_medium: asString(raw.utm_medium, 80),
    utm_campaign: asString(raw.utm_campaign, 120),
    utm_content: asString(raw.utm_content, 120),
    referrer: asString(raw.referrer, 400),
  };
}

/**
 * Returns a persistable payload, or null for a safe no-op
 * (empty text, bad IDs, disallowed feature).
 */
export function prepareRoadmapFeedback(raw: FeedbackInput): PreparedFeedback | null {
  const featureId = canonicalFeatureId(asString(raw.feature_id, 80));
  if (!featureId || !isAllowedFeature(featureId) || featureId === "") return null;
  const sessionId = asString(raw.sessionId, 80);
  if (!isUuid(sessionId)) return null;
  const problemText = asString(raw.problem_text, PROBLEM_TEXT_MAX);
  if (!problemText) return null;
  const waitlistRaw = asString(raw.waitlist_id, 80);
  return {
    featureId,
    sessionId,
    waitlistId: isUuid(waitlistRaw) ? waitlistRaw : null,
    problemText,
    attribution: attributionFields(raw),
  };
}

export async function persistRoadmapFeedback(sql: SqlLike, prepared: PreparedFeedback) {
  const { featureId, sessionId, waitlistId, problemText, attribution } = prepared;
  await sql`
    insert into roadmap_feedback (
      id, feature_id, session_id, waitlist_id, problem_text,
      utm_source, utm_medium, utm_campaign, utm_content, referrer
    ) values (
      ${crypto.randomUUID()}, ${featureId}, ${sessionId}, ${waitlistId}, ${problemText},
      ${attribution.utm_source}, ${attribution.utm_medium}, ${attribution.utm_campaign},
      ${attribution.utm_content}, ${attribution.referrer}
    )
  `;
  await sql`
    insert into launch_events (
      id, session_id, event_name, feature_id,
      utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_path
    ) values (
      ${crypto.randomUUID()}, ${sessionId}, ${"roadmap_feedback_submitted"}, ${featureId},
      ${attribution.utm_source}, ${attribution.utm_medium}, ${attribution.utm_campaign},
      ${attribution.utm_content}, ${attribution.referrer}, ${"/roadmap"}
    )
  `;
}
