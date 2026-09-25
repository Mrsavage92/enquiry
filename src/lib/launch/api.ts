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
import { getWaitlistAnswers, joinWaitlistRow, leaveWaitlistRow } from "./waitlist.server";
import { guarded, notifyOwner } from "@/lib/server/alert";

/** Rate-limit and cross-site rejections are user outcomes, not incidents. */
const EXPECTED_LAUNCH_ERRORS = new Set(["Try again in a moment.", "Rejected."]);
const expectedLaunchError = (error: unknown) =>
  error instanceof Error && EXPECTED_LAUNCH_ERRORS.has(error.message);
const launchGuard = <R>(scope: string, run: () => Promise<R>) =>
  guarded(scope, run, expectedLaunchError)();

export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    const email = asString(d.email, 254).toLowerCase();
    if (!isEmail(email)) throw new Error("Enter a valid email.");
    return {
      email,
      existingId: asString(d.existingId, 80),
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
      elapsed_ms: Number(d.elapsed_ms) || 0,
    };
  })
  .handler(async ({ data }) =>
    launchGuard("joinWaitlist", async () => {
      const { protectLaunch } = await import("./protect.server");
      protectLaunch("waitlist");
      // Two independent bot signals: the hidden field, and a submit faster than
      // a person can read the field, type and click (measured from mount).
      const tooFast = data.elapsed_ms > 0 && data.elapsed_ms < 800;
      if (honeypotFilled(data.website) || tooFast) {
        // A bot gets a convincing success. A real visitor whose browser filled
        // the hidden field would be lost silently, so the hit is logged where
        // a spike can be seen.
        console.warn("[waitlist] bot signal", {
          landing_path: data.landing_path,
          honeypot: honeypotFilled(data.website),
          elapsed_ms: data.elapsed_ms,
        });
        return { id: crypto.randomUUID(), already: false };
      }
      const sessionId = isUuid(data.sessionId) ? data.sessionId : crypto.randomUUID();
      const sql = await getSql();
      const result = await joinWaitlistRow(
        {
          email: data.email,
          existingId: data.existingId,
          utm_source: data.utm_source,
          utm_medium: data.utm_medium,
          utm_campaign: data.utm_campaign,
          utm_content: data.utm_content,
          referrer: data.referrer,
          linkedin_post_id: data.linkedin_post_id,
          first_touch: data.first_touch,
          latest_touch: data.latest_touch,
        },
        sql,
      );
      if (!result.created) return { id: result.id, already: result.already };
      await sql`
      insert into launch_events (id, session_id, event_name, utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_path)
      values (
        ${crypto.randomUUID()}, ${sessionId}, ${"waitlist_signup"},
        ${data.utm_source}, ${data.utm_medium}, ${data.utm_campaign}, ${data.utm_content},
        ${data.referrer}, ${data.landing_path}
      )
    `;
      // Fire and forget: a signup must succeed whether or not the welcome
      // email does, and this is inert until the mailbox is configured.
      const { sendEmailInBackground } = await import("@/lib/email/send.server");
      const { waitlistWelcomeEmail } = await import("@/lib/email/waitlist-welcome");
      const { siteOrigin } = await import("@/lib/site/head");
      sendEmailInBackground(waitlistWelcomeEmail(data.email, siteOrigin()));
      return { id: result.id, already: false as const };
    }),
  );

/**
 * Self-service removal. The id only ever lives in the browser that joined,
 * so knowing it is the proof of ownership; nothing else is needed.
 */
export const leaveWaitlist = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    return { id: asString(d.id, 80), sessionId: asString(d.sessionId, 80) };
  })
  .handler(async ({ data }) =>
    launchGuard("leaveWaitlist", async () => {
      const { protectLaunch } = await import("./protect.server");
      protectLaunch("qualify");
      return leaveWaitlistRow(data.id);
    }),
  );

/**
 * The saved qualify-step answers for one waitlist row, so "Edit your
 * answers" can open pre-filled on a fresh page load instead of blank.
 * Knowing the id is the same proof of ownership used everywhere else here.
 */
export const getMyWaitlistAnswers = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    return { id: asString(d.id, 80) };
  })
  .handler(async ({ data }) =>
    launchGuard("getMyWaitlistAnswers", async () => {
      const { protectLaunch } = await import("./protect.server");
      protectLaunch("qualify");
      const answers = await getWaitlistAnswers(data.id);
      return { answers };
    }),
  );

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
  .handler(async ({ data }) =>
    launchGuard("qualifyWaitlist", async () => {
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
    }),
  );

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
  .handler(async ({ data }) =>
    launchGuard("trackLaunchEvent", async () => {
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
    }),
  );

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
  .handler(async ({ data }) =>
    launchGuard("toggleRoadmapNeed", async () => {
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
    }),
  );

export const listMyRoadmapNeeds = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    return { sessionId: asString(d.sessionId, 80) };
  })
  .handler(async ({ data }) =>
    launchGuard("listMyRoadmapNeeds", async () => {
      const { protectLaunch } = await import("./protect.server");
      if (protectLaunch("needs") === "drop") return { ids: [] as string[] };
      if (!isUuid(data.sessionId)) return { ids: [] as string[] };
      const sql = await getSql();
      const rows = await sql<{ feature_id: string }>`
      select feature_id from roadmap_interest where session_id = ${data.sessionId}
    `;
      return {
        ids: [
          ...new Set(rows.map((r) => canonicalFeatureId(r.feature_id)).filter(isAllowedFeature)),
        ],
      };
    }),
  );

export const saveRoadmapFeedback = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const d = (raw ?? {}) as Record<string, unknown>;
    return {
      feature_id: asString(d.feature_id, 80),
      sessionId: asString(d.sessionId, 80),
      waitlist_id: asString(d.waitlist_id, 80),
      problem_text: asString(d.problem_text, 800),
      email: asString(d.email, 254),
      utm_source: asString(d.utm_source, 80),
      utm_medium: asString(d.utm_medium, 80),
      utm_campaign: asString(d.utm_campaign, 120),
      utm_content: asString(d.utm_content, 120),
      referrer: asString(d.referrer, 400),
    };
  })
  .handler(async ({ data }) =>
    launchGuard("saveRoadmapFeedback", async () => {
      const { protectLaunch } = await import("./protect.server");
      protectLaunch("roadmap");
      const prepared = prepareRoadmapFeedback(data);
      if (!prepared) return { ok: true as const, saved: false as const };
      const sql = await getSql();
      await persistRoadmapFeedback(sql, prepared);
      // Every submission is a person who took the time to write something;
      // a person should see it, not just a row nobody reads.
      const contact = prepared.email ? ` (${prepared.email})` : "";
      notifyOwner(
        `Enquiry roadmap feedback on ${prepared.featureId}${contact}: ${prepared.problemText}`,
      );
      return { ok: true as const, saved: true as const };
    }),
  );
