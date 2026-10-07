import assert from "node:assert/strict";
import { test } from "node:test";
import { BUSINESSES } from "../fixtures/businesses.ts";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import {
  channelBlocked,
  isShortChannel,
  replyChannel,
  replyTo,
  threadLabel,
} from "./channel.ts";

function byId(id: string) {
  return ENQUIRIES.find((e) => e.id === id)!;
}

test("a website form replies by email and never blocks on a mailbox", () => {
  const jordan = byId("f02");
  const northlight = BUSINESSES.find((b) => b.id === "northlight")!;
  assert.equal(jordan.source, "form");
  assert.equal(replyChannel(jordan), "email");
  assert.equal(replyTo(jordan), "jordan@lumengoods.example");
  assert.equal(isShortChannel(jordan.source), false);
  assert.equal(threadLabel("form"), "Form submission");
  assert.equal(channelBlocked(northlight, false, jordan), null);
});

test("a text replies as a text, not a letter", () => {
  const patel = byId("f03");
  assert.equal(patel.source, "sms");
  assert.equal(replyChannel(patel), "sms");
  assert.equal(replyTo(patel), "0412 773 091");
  assert.equal(isShortChannel("sms"), true);
});

test("an Instagram DM replies on Instagram", () => {
  const tash = byId("f18");
  const glow = BUSINESSES.find((b) => b.id === "glow")!;
  assert.equal(tash.source, "instagram");
  assert.equal(replyChannel(tash), "instagram");
  assert.equal(replyTo(tash), "@tash.moves");
  assert.equal(channelBlocked(glow, false, tash), null);
});

test("a Facebook message replies on Facebook", () => {
  const samira = byId("f19");
  assert.equal(samira.source, "facebook");
  assert.equal(replyChannel(samira), "facebook");
});

test("a public comment is not a quoting conversation", () => {
  const jess = byId("f20");
  assert.equal(jess.source, "comment");
  assert.equal(replyChannel(jess), "instagram");
  assert.equal(jess.decision.recommendation.action, "NO_ACTION");
  assert.equal(jess.decision.recommendation.primaryEnabled, false);
});

test("disconnected Instagram blocks send, form never does", () => {
  const atelier = BUSINESSES.find((b) => b.id === "atelier")!;
  const glowIg = { ...byId("f18"), businessId: "atelier" };
  assert.match(channelBlocked(atelier, false, glowIg) ?? "", /isn’t connected/);
  const form = { ...byId("f02"), businessId: "atelier", source: "form" as const };
  assert.equal(channelBlocked(atelier, false, form), null);
});
