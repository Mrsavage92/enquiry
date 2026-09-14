import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("roadmap uses native disclosures, real feedback and explicit failure states", () => {
  const board = read("src/components/site/roadmap-board.tsx");
  for (const text of [
    "<details",
    "<summary>",
    "listMyRoadmapNeeds",
    "toggleRoadmapNeed",
    "saveRoadmapFeedback",
    "aria-pressed={needed}",
    'role="alert"',
    'role="status"',
    "submitting.current",
    "voting.current",
    "!result.saved",
    "maxLength={800}",
    "roadmap_stage_engaged",
    "roadmap_endgame_view",
  ])
    assert.ok(board.includes(text), text);
  assert.match(board, /stage.status === "now"/);
  assert.match(board, /stage-\$\{stage.id\}/);
  assert.doesNotMatch(
    board,
    /setInterval|requestAnimationFrame|scrollTo|font-serif|tracking-tight/,
  );
});

test("roadmap asset is bounded, conceptual and separate from real product proof", () => {
  const visuals = read("src/components/site/roadmap-visuals.tsx");
  assert.match(visuals, /Planned concept/);
  assert.match(visuals, /Not yet available/);
  assert.match(visuals, /width=\{600\}/);
  assert.match(visuals, /height=\{400\}/);
  assert.match(visuals, /loading="lazy"/);
  assert.ok(
    statSync(new URL("../public/product/roadmap/native-apps-concept.webp", import.meta.url)).size <
      40_000,
  );
});

test("roadmap retains a readable static fallback, reduced motion and no decorative gradient", () => {
  const css = read("src/roadmap.css");
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /max-width: 700px/);
  assert.match(css, /scroll-margin-top/);
  assert.doesNotMatch(css, /gradient|font-size:[^;]*vw|letter-spacing:\s*-/);
  const route = read("src/routes/roadmap.tsx");
  assert.match(route, /Early access by invitation/);
  assert.match(route, /Enquiry roadmap/);
});
