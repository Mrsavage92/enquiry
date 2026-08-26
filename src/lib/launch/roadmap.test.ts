import assert from "node:assert/strict";
import { test } from "node:test";
import { ROADMAP_LEGEND, ROADMAP_PREVIEW, STAGES } from "./roadmap.ts";

test("public roadmap is six customer-facing eras", () => {
  assert.equal(STAGES.length, 6);
  assert.deepEqual(
    STAGES.map((s) => s.id),
    ["understand", "business-brain", "continuity", "keep-moving", "trusted-action", "endgame"],
  );
});

test("each era has a single visitor-facing status", () => {
  for (const stage of STAGES) {
    assert.equal(stage.status.length, 1, stage.id);
    assert.ok(
      ROADMAP_LEGEND.some((s) => s.id === stage.status[0]),
      stage.id,
    );
  }
  assert.equal(STAGES[0]?.status[0], "working");
  assert.equal(STAGES[1]?.status[0], "building");
  assert.equal(STAGES[2]?.status[0], "next");
  assert.equal(STAGES[3]?.status[0], "next");
  assert.equal(STAGES[4]?.status[0], "later");
  assert.equal(STAGES[5]?.status[0], "later");
});

test("I need this is only on future meaningful eras", () => {
  const voted = STAGES.filter((s) => s.feedbackEnabled).map((s) => s.id);
  assert.deepEqual(voted, ["continuity", "keep-moving", "trusted-action"]);
  assert.equal(STAGES.find((s) => s.id === "understand")?.feedbackEnabled, undefined);
  assert.equal(STAGES.find((s) => s.id === "endgame")?.feedbackEnabled, undefined);
});

test("homepage preview is three significant states, not the whole plan", () => {
  assert.equal(ROADMAP_PREVIEW.length, 3);
  assert.deepEqual(
    ROADMAP_PREVIEW.map((s) => s.id),
    ["understand", "business-brain", "continuity"],
  );
  assert.equal(ROADMAP_PREVIEW[0]?.statusLabel, "Working now");
  assert.equal(ROADMAP_PREVIEW[1]?.statusLabel, "Building");
  assert.equal(ROADMAP_PREVIEW[2]?.statusLabel, "Next");
});

test("removed internal stages are not public eras", () => {
  const ids = STAGES.map((s) => s.id);
  const titles = STAGES.map((s) => s.title).join(" ");
  for (const gone of ["prove", "decision", "connect", "leak", "pipeline", "autopilot"]) {
    assert.equal(ids.includes(gone), false, gone);
  }
  assert.doesNotMatch(titles, /evaluator|state-model|quote drift|Connect|Leak/i);
});

test("endgame keeps the booked-or-lost boundary", () => {
  const endgame = STAGES.find((s) => s.id === "endgame")!;
  const blob = `${endgame.goal} ${endgame.narrative} ${endgame.outcomes.flatMap((o) => o.items).join(" ")}`;
  assert.match(blob, /booked or lost/i);
  assert.match(blob, /first enquiry/i);
});

test("pricing and capacity are not described as universal", () => {
  const blob = STAGES.map((s) => `${s.narrative} ${s.outcomes.flatMap((o) => o.items).join(" ")}`).join(" ");
  assert.match(blob, /where they apply|when they apply/i);
  assert.match(blob, /not every enquiry is a quote/i);
});

test("trusted action stays permission-based", () => {
  const trust = STAGES.find((s) => s.id === "trusted-action")!;
  const blob = `${trust.narrative} ${trust.promise} ${trust.outcomes.flatMap((o) => o.items).join(" ")}`;
  assert.match(blob, /no giant AI-on switch/i);
  assert.match(blob, /per class of action|granted separately/i);
});

test("continuity does not claim every integration is live", () => {
  const continuity = STAGES.find((s) => s.id === "continuity")!;
  const blob = `${continuity.narrative} ${continuity.caveat} ${continuity.outcomes.flatMap((o) => o.items).join(" ")}`;
  assert.match(blob, /not all your messages in one inbox/i);
  assert.doesNotMatch(blob, /unified inbox/i);
});
