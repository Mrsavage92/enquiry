import assert from "node:assert/strict";
import { test } from "node:test";
import { ROADMAP_LEGEND, ROADMAP_PREVIEW, STAGES } from "./roadmap.ts";
import { canonicalFeatureId, featureIdFamily, isAllowedFeature } from "./guard.ts";
import { prepareRoadmapFeedback } from "./feedback.ts";

const find = (id: string) => {
  const stage = STAGES.find((item) => item.id === id);
  assert.ok(stage, id);
  return stage;
};
const copy = (id: string) => {
  const stage = find(id);
  return [stage.summary, ...stage.details, stage.boundary].join(" ");
};

test("four horizons contain three concise customer outcomes each", () => {
  assert.deepEqual(
    ROADMAP_LEGEND.map((h) => h.id),
    ["now", "next", "later", "exploring"],
  );
  assert.equal(STAGES.length, 12);
  assert.equal(new Set(STAGES.map((s) => s.id)).size, STAGES.length);
  for (const horizon of ROADMAP_LEGEND)
    assert.equal(STAGES.filter((s) => s.status === horizon.id).length, 3);
  for (const stage of STAGES) {
    assert.ok(stage.title.length <= 40, stage.title);
    assert.ok(stage.summary.length <= 110, stage.id);
    assert.equal(stage.details.length, 2);
    assert.ok(stage.boundary.length > 30, stage.id);
    assert.doesNotMatch(stage.title, /understand|evaluator|brain|autopilot|endgame|validation/i);
  }
});

test("now is bounded to the current product, not integrations or future automation", () => {
  assert.deepEqual(
    STAGES.filter((s) => s.status === "now").map((s) => s.id),
    ["understand", "business-brain", "clear-outcomes"],
  );
  assert.match(copy("understand"), /invitation-only/);
  assert.match(copy("business-brain"), /Prepared is not sent/);
  assert.match(copy("business-brain"), /send externally/);
  assert.match(copy("business-brain"), /where they apply/);
  assert.match(copy("business-brain"), /not every enquiry is a quote/);
  assert.match(copy("clear-outcomes"), /actually been recorded/);
  assert.equal(ROADMAP_PREVIEW.length, 3);
  assert.ok(ROADMAP_PREVIEW.every((s) => s.statusLabel === "Now"));
});

test("native apps are priority direction, with no current store listing or delivery date", () => {
  assert.equal(find("native-apps").status, "next");
  assert.match(find("native-apps").summary, /Planned native iPhone and Android/);
  assert.match(copy("native-apps"), /Apple App Store and Google Play/);
  assert.match(copy("native-apps"), /after development and store approval/);
  assert.match(copy("native-apps"), /not yet available/);
  assert.match(copy("native-apps"), /concept, not a native-app screenshot/);
  assert.equal(ROADMAP_LEGEND.find((s) => s.id === "next")?.hint, "Priority direction");
  for (const stage of STAGES)
    assert.doesNotMatch(
      copy(stage.id),
      /Q[1-4] 20\d\d|download now|available on the app store|guaranteed|\d+%/i,
    );
});

test("future connectivity, booking and action retain material safeguards", () => {
  assert.match(copy("continuity"), /planned, not all live/);
  assert.match(copy("continuity"), /never silent merges/);
  assert.equal(find("booking-path").status, "later");
  assert.match(copy("booking-path"), /unknown availability stays unconfirmed/);
  assert.match(copy("trusted-action"), /granted separately for each class of action/);
  assert.match(copy("trusted-action"), /no blanket autopilot/);
  assert.match(copy("keep-moving"), /Silence is not a decline/);
  assert.match(copy("teach-by-correction"), /explicit approval/);
});

test("attention-friendly differentiation is ambitious without hiding important changes", () => {
  assert.equal(find("catch-up").status, "next");
  assert.equal(find("busy-mode").status, "exploring");
  assert.match(copy("busy-mode"), /time-sensitive changes must not disappear/);
  assert.match(copy("endgame"), /first enquiry to booked or lost/);
  assert.match(copy("endgame"), /No delivery-system connections/);
});

test("all outcomes support validated feedback and retain historical feature identities", () => {
  for (const stage of STAGES) {
    assert.equal(isAllowedFeature(stage.id), true, stage.id);
    assert.equal(canonicalFeatureId(stage.id), stage.id);
    const prepared = prepareRoadmapFeedback({
      feature_id: stage.id,
      sessionId: "3c7116e8-bef2-410c-b59a-d235086c6b34",
      problem_text: "This would save rereading the conversation.",
    });
    assert.equal(prepared?.featureId, stage.id);
  }
  for (const id of [
    "understand",
    "business-brain",
    "continuity",
    "keep-moving",
    "trusted-action",
    "endgame",
  ])
    assert.ok(find(id));
  assert.ok(featureIdFamily("trusted-action").includes("autopilot"));
  assert.ok(featureIdFamily("keep-moving").includes("pipeline"));
  assert.ok(featureIdFamily("business-brain").includes("learn"));
});
