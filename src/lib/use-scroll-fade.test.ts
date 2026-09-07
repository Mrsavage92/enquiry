import assert from "node:assert/strict";
import { test } from "node:test";
import { computeFadeEdges } from "./use-scroll-fade.ts";

test("a strip narrower than its content shows only the end fade at rest", () => {
  // The queue filter strip at 1440px: clientWidth 295, scrollWidth 467.
  const edges = computeFadeEdges({ scrollWidth: 467, clientWidth: 295, scrollLeft: 0 });
  assert.deepEqual(edges, { start: false, end: true });
});

test("a strip that fits its content shows neither fade", () => {
  // The phone queue filter strip at 390px: clientWidth === scrollWidth.
  const edges = computeFadeEdges({ scrollWidth: 389, clientWidth: 389, scrollLeft: 0 });
  assert.deepEqual(edges, { start: false, end: false });
});

test("scrolled fully to the end shows only the start fade", () => {
  const edges = computeFadeEdges({ scrollWidth: 831, clientWidth: 736, scrollLeft: 95 });
  assert.deepEqual(edges, { start: true, end: false });
});

test("scrolled partway shows both fades", () => {
  const edges = computeFadeEdges({ scrollWidth: 831, clientWidth: 736, scrollLeft: 40 });
  assert.deepEqual(edges, { start: true, end: true });
});

test("a 1px rounding wobble at either boundary does not count as scrolled", () => {
  // Sub-pixel layout can leave scrollLeft or the end boundary off by
  // fractions of a pixel even when the strip is visually at rest - the
  // fade must not flicker on because of that.
  const atStart = computeFadeEdges({ scrollWidth: 467, clientWidth: 295, scrollLeft: 0.4 });
  assert.equal(atStart.start, false);
  const atEnd = computeFadeEdges({ scrollWidth: 467, clientWidth: 295, scrollLeft: 171.7 });
  assert.equal(atEnd.end, false);
});

test("widening the container past the content clears both fades", () => {
  const edges = computeFadeEdges({ scrollWidth: 467, clientWidth: 467, scrollLeft: 0 });
  assert.deepEqual(edges, { start: false, end: false });
});
