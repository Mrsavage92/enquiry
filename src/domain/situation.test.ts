import assert from "node:assert/strict";
import { test } from "node:test";
import { BUSINESSES } from "../fixtures/businesses.ts";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import { arrivingEnquiry } from "../fixtures/arriving.ts";
import { enquirySituation, outboundBlocked } from "./situation.ts";

function byId(id: string) {
  return ENQUIRIES.find((e) => e.id === id)!;
}

test("Priya has no operator situation", () => {
  const glow = BUSINESSES.find((b) => b.id === "glow")!;
  assert.equal(enquirySituation(byId("f01"), glow), null);
});

test("Leah is check this, not a price conflict", () => {
  const nl = BUSINESSES.find((b) => b.id === "northlight")!;
  const s = enquirySituation(byId("f09"), nl);
  assert.equal(s?.kind, "check_this");
  assert.equal(s?.title, "I need you to check one detail");
  assert.ok(s?.fact?.alternatives?.includes("event"));
});

test("Ibrahim is calendar down", () => {
  const ridge = BUSINESSES.find((b) => b.id === "ridge")!;
  const s = enquirySituation(byId("f10"), ridge);
  assert.equal(s?.kind, "calendar_down");
  assert.match(s?.body ?? "", /Unknown is not busy/);
});

test("Rossi family is a price conflict with both sources", () => {
  const nl = BUSINESSES.find((b) => b.id === "northlight")!;
  const s = enquirySituation(byId("f11"), nl);
  assert.equal(s?.kind, "conflict");
  assert.ok(s?.conflictChoices && s.conflictChoices.length >= 2);
  const amounts = s.conflictChoices.map((c) => c.amount).sort((a, b) => a - b);
  assert.deepEqual(amounts, [450, 520]);
});

test("Marcus resend is a duplicate, not check this", () => {
  const harbour = BUSINESSES.find((b) => b.id === "harbour")!;
  const s = enquirySituation(byId("f13"), harbour);
  assert.equal(s?.kind, "duplicate");
});

test("Rowan is check this on package", () => {
  const atelier = BUSINESSES.find((b) => b.id === "atelier")!;
  const s = enquirySituation(byId("f17"), atelier);
  assert.equal(s?.kind, "check_this");
  assert.equal(s?.fact?.field, "package");
});

test("arriving enquiry is evaluating", () => {
  const glow = BUSINESSES.find((b) => b.id === "glow")!;
  const s = enquirySituation(arrivingEnquiry("live-1"), glow);
  assert.equal(s?.kind, "evaluating");
});

test("pause and offline block outbound", () => {
  const glow = BUSINESSES.find((b) => b.id === "glow")!;
  assert.equal(outboundBlocked(glow, false), null);
  assert.match(outboundBlocked({ ...glow, paused: true }, false) ?? "", /paused/);
  assert.match(outboundBlocked(glow, true) ?? "", /offline/);
});

test("jess.k is a public comment, not a quote", () => {
  const glow = BUSINESSES.find((b) => b.id === "glow")!;
  const s = enquirySituation(byId("f20"), glow);
  assert.equal(s?.kind, "public_comment");
});
