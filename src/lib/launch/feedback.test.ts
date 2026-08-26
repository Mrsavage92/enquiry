import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attributionFields,
  persistRoadmapFeedback,
  prepareRoadmapFeedback,
  type SqlLike,
} from "./feedback.ts";

const SESSION = "3c7116e8-bef2-410c-b59a-d235086c6b34";
const WAITLIST = "8f0c2a11-7b44-4d2e-9a01-2c3d4e5f6789";

function mockSql() {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    calls.push({ text, values });
    return [];
  }) as SqlLike;
  return { sql, calls };
}

test("valid feedback is prepared with canonical feature id and waitlist", () => {
  const prepared = prepareRoadmapFeedback({
    feature_id: "pipeline",
    sessionId: SESSION,
    waitlist_id: WAITLIST,
    problem_text: "  Follow-up falls through when we are on site.  ",
    utm_source: "linkedin",
    utm_medium: "social",
    utm_campaign: "launch",
    utm_content: "post-3",
    referrer: "https://linkedin.com/",
  });
  assert.ok(prepared);
  assert.equal(prepared.featureId, "keep-moving");
  assert.equal(prepared.sessionId, SESSION);
  assert.equal(prepared.waitlistId, WAITLIST);
  assert.equal(prepared.problemText, "Follow-up falls through when we are on site.");
  assert.equal(prepared.attribution.utm_source, "linkedin");
  assert.equal(prepared.attribution.referrer, "https://linkedin.com/");
});

test("empty optional feedback does not create a persistable row", () => {
  assert.equal(
    prepareRoadmapFeedback({
      feature_id: "continuity",
      sessionId: SESSION,
      problem_text: "   ",
    }),
    null,
  );
  assert.equal(
    prepareRoadmapFeedback({
      feature_id: "continuity",
      sessionId: SESSION,
      problem_text: "",
    }),
    null,
  );
});

test("invalid or unallowed feature IDs are a safe no-op", () => {
  assert.equal(
    prepareRoadmapFeedback({
      feature_id: "'; drop table waitlist --",
      sessionId: SESSION,
      problem_text: "Still interested.",
    }),
    null,
  );
  assert.equal(
    prepareRoadmapFeedback({
      feature_id: "",
      sessionId: SESSION,
      problem_text: "Still interested.",
    }),
    null,
  );
  assert.equal(
    prepareRoadmapFeedback({
      feature_id: "continuity",
      sessionId: "not-a-uuid",
      problem_text: "Still interested.",
    }),
    null,
  );
});

test("malformed waitlist id is dropped, feedback still prepares", () => {
  const prepared = prepareRoadmapFeedback({
    feature_id: "trusted-action",
    sessionId: SESSION,
    waitlist_id: "not-a-uuid",
    problem_text: "Need to send follow-ups only when they are due.",
  });
  assert.ok(prepared);
  assert.equal(prepared.waitlistId, null);
  assert.equal(prepared.featureId, "trusted-action");
});

test("valid feedback persists the problem text and attributed event", async () => {
  const { sql, calls } = mockSql();
  const prepared = prepareRoadmapFeedback({
    feature_id: "continuity",
    sessionId: SESSION,
    waitlist_id: WAITLIST,
    problem_text: "Customers change the job on Instagram after the form.",
    utm_source: "li",
    utm_medium: "social",
    utm_campaign: "beta",
    utm_content: "c1",
    referrer: "https://example.com/how",
  });
  assert.ok(prepared);
  await persistRoadmapFeedback(sql, prepared);

  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /insert into roadmap_feedback/i);
  assert.equal(calls[0].values[1], "continuity");
  assert.equal(calls[0].values[2], SESSION);
  assert.equal(calls[0].values[3], WAITLIST);
  assert.equal(calls[0].values[4], "Customers change the job on Instagram after the form.");
  assert.equal(calls[0].values[5], "li");

  assert.match(calls[1].text, /insert into launch_events/i);
  assert.equal(calls[1].values[2], "roadmap_feedback_submitted");
  assert.equal(calls[1].values[3], "continuity");
  assert.equal(calls[1].values[4], "li");
  assert.equal(calls[1].values[5], "social");
  assert.equal(calls[1].values[6], "beta");
  assert.equal(calls[1].values[7], "c1");
  assert.equal(calls[1].values[8], "https://example.com/how");
  assert.equal(calls[1].values[9], "/roadmap");

  for (const call of calls) {
    assert.doesNotMatch(call.text, /\bselect\b/i);
  }
});

test("attribution helper copies current-touch fields without inventing values", () => {
  assert.deepEqual(
    attributionFields({
      utm_source: "li",
      utm_medium: "social",
      utm_campaign: "x",
      utm_content: "y",
      referrer: "https://a.example/",
    }),
    {
      utm_source: "li",
      utm_medium: "social",
      utm_campaign: "x",
      utm_content: "y",
      referrer: "https://a.example/",
    },
  );
  assert.deepEqual(attributionFields({}), {
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    referrer: "",
  });
});
