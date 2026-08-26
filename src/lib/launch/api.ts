import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import {
  asString,
  canonicalFeatureId,
  featureIdFamily,
  honeypotFilled,
  isAllowedEvent,
  isAllowedFeature,
  isEmail,
  isUuid,
  sanitizePath,
} from "./guard";
import { persistRoadmapFeedback, prepareRoadmapFeedback } from "./feedback";

export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const email = asString(d.email, 254).toLowerCase();
    if (!isEmail(email)) throw new Error("Enter a valid email.");
    return {
      email,
      sessionId: asString(d.sessionId, 80),
      utm_source: asString(d.utm_source, 80),
      utm_medium: asString(d.utm_medium, 80),
      utm_campaign: asString(d.utm_campaign, 120),
      utm_content: asString(d.utm_content, 120),
      referrer: asString(d.referrer, 400),
      linkedin_post_id: asString(d.linkedin_post_id, 80),
      first_touch: asString(d.first_touch, 800),
      latest_touch: asString(d.latest_touch, 800),
      landing_path: sanitizePath(asString(d.landing_path, 200) || "/early-access"),
      website: asString(d.website, 80),
    };
  })
  .handler(async ({ data }) => {
    const { protectLaunch } = await import("./protect.server");
    protectLaunch("waitlist");
    if (honeypotFilled(data.website)) {
      return { id: crypto.randomUUID(), already: false };
    }
    const sessionId = isUuid(data.sessionId) ? data.sessionId : crypto.randomUUID();
    const sql = await getSql();
    const existing = await sql<{ id: string }>`
      select id from waitlist where email = ${data.email} limit 1
    `;
    if (existing[0]) {
      await sql`
        update waitlist
        set latest_touch = ${data.latest_touch || data.first_touch},
            utm_source = coalesce(nullif(utm_source, ''), ${data.utm_source}),
            linkedin_post_id = coalesce(nullif(linkedin_post_id, ''), ${data.linkedin_post_id})
        where id = ${existing[0].id}
      `;
      // Never hand back another person's waitlist id.
      return { already: true as const, id: "" };
    }
    const id = crypto.randomUUID();
    await sql`
      insert into waitlist (
        id, email, utm_source, utm_medium, utm_campaign, utm_content,
        referrer, linkedin_post_id, first_touch, latest_touch
      ) values (
        ${id}, ${data.email}, ${data.utm_source}, ${data.utm_medium},
        ${data.utm_campaign}, ${data.utm_content}, ${data.referrer},
        ${data.linkedin_post_id}, ${data.first_touch}, ${data.latest_touch}
      )
    `;
    await sql`
      insert into launch_events (id, session_id, event_name, utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_path)
      values (
        ${crypto.randomUUID()}, ${sessionId}, ${"waitlist_signup"},
        ${data.utm_source}, ${data.utm_medium}, ${data.utm_campaign}, ${data.utm_content},
        ${data.referrer}, ${data.landing_path}
      )
    `;
    return { id, already: false as const };
  });

export const qualifyWaitlist = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    return {
      id: asString(d.id, 80),
      sessionId: asString(d.sessionId, 80),
      business_type: asString(d.business_type, 160),
      enquiry_volume: asString(d.enquiry_volume, 40),
      pain_text: asString(d.pain_text, 800),
      channels: asString(d.channels, 200),
      beta_interest: asString(d.beta_interest, 40),
      landing_path: sanitizePath(asString(d.landing_path, 200) || "/early-access"),
    };
  })
  .handler(async ({ data }) => {
    const { protectLaunch } = await import("./protect.server");
    protectLaunch("qualify");
    if (!isUuid(data.id)) return { ok: true };
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      update waitlist
      set business_type = ${data.business_type},
          enquiry_volume = ${data.enquiry_volume},
          pain_text = ${data.pain_text},
          channels = ${data.channels},
          beta_interest = ${data.beta_interest},
          qualified_at = now()
      where id = ${data.id}
      returning id
    `;
    if (!rows[0]) return { ok: true };
    const sessionId = isUuid(data.sessionId) ? data.sessionId : "unknown";
    await sql`
      insert into launch_events (id, session_id, event_name, landing_path)
      values (${crypto.randomUUID()}, ${sessionId}, ${"qualification_completed"}, ${data.landing_path})
    `;
    return { ok: true };
  });

export const trackLaunchEvent = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    return {
      sessionId: asString(d.sessionId, 80) || "anonymous",
      event_name: asString(d.event_name, 80),
      feature_id: asString(d.feature_id, 80),
      utm_source: asString(d.utm_source, 80),
      utm_medium: asString(d.utm_medium, 80),
      utm_campaign: asString(d.utm_campaign, 120),
      utm_content: asString(d.utm_content, 120),
      referrer: asString(d.referrer, 400),
      landing_path: sanitizePath(asString(d.landing_path, 200) || "/"),
    };
  })
  .handler(async ({ data }) => {
    const { protectLaunch } = await import("./protect.server");
    if (protectLaunch("event") === "drop") return { ok: true };
    if (!isAllowedEvent(data.event_name)) return { ok: true };
    if (!isAllowedFeature(data.feature_id)) return { ok: true };
    const sessionId = isUuid(data.sessionId) ? data.sessionId : "anonymous";
    const sql = await getSql();
    await sql`
      insert into launch_events (
        id, session_id, event_name, feature_id,
        utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_path
      ) values (
        ${crypto.randomUUID()}, ${sessionId}, ${data.event_name}, ${data.feature_id || null},
        ${data.utm_source}, ${data.utm_medium}, ${data.utm_campaign}, ${data.utm_content},
        ${data.referrer}, ${data.landing_path}
      )
    `;
    return { ok: true };
  });

export const toggleRoadmapNeed = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    return {
      feature_id: asString(d.feature_id, 80),
      sessionId: asString(d.sessionId, 80),
      waitlist_id: asString(d.waitlist_id, 80),
      utm_source: asString(d.utm_source, 80),
      utm_medium: asString(d.utm_medium, 80),
      utm_campaign: asString(d.utm_campaign, 120),
      utm_content: asString(d.utm_content, 120),
      referrer: asString(d.referrer, 400),
    };
  })
  .handler(async ({ data }) => {
    const { protectLaunch } = await import("./protect.server");
    protectLaunch("roadmap");
    if (!isAllowedFeature(data.feature_id) || !data.feature_id) return { needed: false };
    if (!isUuid(data.sessionId)) return { needed: false };
    const waitlistId = isUuid(data.waitlist_id) ? data.waitlist_id : null;
    const sql = await getSql();
    const canonical = canonicalFeatureId(data.feature_id);
    const family = featureIdFamily(canonical);
    const existing: { id: string }[] = [];
    for (const fid of family) {
      const rows = await sql<{ id: string }>`
        select id from roadmap_interest
        where feature_id = ${fid} and session_id = ${data.sessionId}
        limit 1
      `;
      if (rows[0]) existing.push(rows[0]);
    }
    if (existing.length > 0) {
      for (const row of existing) {
        await sql`delete from roadmap_interest where id = ${row.id}`;
      }
      return { needed: false };
    }
    await sql`
      insert into roadmap_interest (id, feature_id, session_id, waitlist_id)
      values (${crypto.randomUUID()}, ${canonical}, ${data.sessionId}, ${waitlistId})
    `;
    await sql`
      insert into launch_events (
        id, session_id, event_name, feature_id,
        utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_path
      )
      values (
        ${crypto.randomUUID()}, ${data.sessionId}, ${"roadmap_vote"}, ${canonical},
        ${data.utm_source}, ${data.utm_medium}, ${data.utm_campaign}, ${data.utm_content},
        ${data.referrer}, ${"/roadmap"}
      )
    `;
    return { needed: true };
  });

export const listMyRoadmapNeeds = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    return { sessionId: asString(d.sessionId, 80) };
  })
  .handler(async ({ data }) => {
    const { protectLaunch } = await import("./protect.server");
    if (protectLaunch("needs") === "drop") return { ids: [] as string[] };
    if (!isUuid(data.sessionId)) return { ids: [] as string[] };
    const sql = await getSql();
    const rows = await sql<{ feature_id: string }>`
      select feature_id from roadmap_interest where session_id = ${data.sessionId}
    `;
    return { ids: [...new Set(rows.map((r) => canonicalFeatureId(r.feature_id)).filter(isAllowedFeature))] };
  });

export const saveRoadmapFeedback = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    return {
      feature_id: asString(d.feature_id, 80),
      sessionId: asString(d.sessionId, 80),
      waitlist_id: asString(d.waitlist_id, 80),
      problem_text: asString(d.problem_text, 800),
      utm_source: asString(d.utm_source, 80),
      utm_medium: asString(d.utm_medium, 80),
      utm_campaign: asString(d.utm_campaign, 120),
      utm_content: asString(d.utm_content, 120),
      referrer: asString(d.referrer, 400),
    };
  })
  .handler(async ({ data }) => {
    const { protectLaunch } = await import("./protect.server");
    protectLaunch("roadmap");
    const prepared = prepareRoadmapFeedback(data);
    if (!prepared) return { ok: true as const, saved: false as const };
    const sql = await getSql();
    await persistRoadmapFeedback(sql, prepared);
    return { ok: true as const, saved: true as const };
  });
