import assert from "node:assert/strict";
import { test } from "node:test";
import { BUSINESSES } from "../fixtures/businesses.ts";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import {
  applyBrainToOpenEnquiries,
  compileBrainChange,
  knowledgeAfterPreview,
} from "./brain-apply.ts";
import { applyVoiceToDraft } from "./voice-apply.ts";

const glow = BUSINESSES.find((b) => b.id === "glow")!;
const northlight = BUSINESSES.find((b) => b.id === "northlight")!;
const ridge = BUSINESSES.find((b) => b.id === "ridge")!;
const harbour = BUSINESSES.find((b) => b.id === "harbour")!;

test("immediate group price revises Priya from $625 to $685", () => {
  const preview = compileBrainChange(glow, "Group mobile makeup will be $160 a person.", ENQUIRIES);
  assert.ok(preview);
  const priya = preview.affected.find((a) => a.enquiryId === "f01");
  assert.equal(priya?.applies, true);
  assert.equal(priya?.to, "$685");
  const business = {
    ...glow,
    knowledge: knowledgeAfterPreview(glow.knowledge, preview, glow.id),
  };
  const { enquiries, affectedIds } = applyBrainToOpenEnquiries(business, ENQUIRIES);
  assert.ok(affectedIds.includes("f01"));
  const next = enquiries.find((e) => e.id === "f01")!;
  assert.equal(next.valueExact?.amount, 685);
  assert.match(next.decision.draft.body, /\$685/);
});

test("future-dated group price leaves Priya on the September rate", () => {
  const preview = compileBrainChange(
    glow,
    "Group mobile makeup will be $160 from 1 January 2027.",
    ENQUIRIES,
  );
  assert.ok(preview);
  const priya = preview.affected.find((a) => a.enquiryId === "f01");
  assert.equal(priya?.applies, false);
  const business = {
    ...glow,
    knowledge: knowledgeAfterPreview(glow.knowledge, preview, glow.id),
  };
  const { enquiries, affectedIds } = applyBrainToOpenEnquiries(business, ENQUIRIES);
  assert.equal(affectedIds.includes("f01"), false);
  assert.equal(enquiries.find((e) => e.id === "f01")?.valueExact?.amount, 625);
});

test("Naomi's Toowoomba job reprices the group line and keeps travel", () => {
  const preview = compileBrainChange(glow, "Group mobile makeup will be $160 a person.", ENQUIRIES);
  assert.ok(preview);
  const naomi = preview.affected.find((a) => a.enquiryId === "f06");
  assert.equal(naomi?.to, "$872");
});

test("Northlight event hourly revises Jordan's estimate range", () => {
  const preview = compileBrainChange(northlight, "Event coverage will be $200 an hour.", ENQUIRIES);
  assert.ok(preview);
  const jordan = preview.affected.find((a) => a.enquiryId === "f02");
  assert.equal(jordan?.to, "$800–$1,200");
});

test("sent Harbour quote is not rewritten", () => {
  const preview = compileBrainChange(harbour, "A 3 bed / 2 bath deep clean is $360.", ENQUIRIES);
  assert.ok(preview);
  const marcus = preview.affected.find((a) => a.enquiryId === "f08");
  assert.ok(!marcus || marcus.from === marcus.to);
  const business = {
    ...harbour,
    knowledge: knowledgeAfterPreview(harbour.knowledge, preview, harbour.id),
  };
  const { affectedIds } = applyBrainToOpenEnquiries(business, ENQUIRIES);
  assert.equal(affectedIds.includes("f08"), false);
});

test("Ridge bedroom rate revises Helen's 3-room job", () => {
  const preview = compileBrainChange(ridge, "Interior bedrooms will be $450.", ENQUIRIES);
  assert.ok(preview);
  const helen = preview.affected.find((a) => a.enquiryId === "f04");
  assert.equal(helen?.to, "$1,350");
});

test("Dana's sent $720 stays; proposed revision moves with the hourly rate", () => {
  const preview = compileBrainChange(northlight, "Event coverage will be $200 an hour.", ENQUIRIES);
  assert.ok(preview);
  const business = {
    ...northlight,
    knowledge: knowledgeAfterPreview(northlight.knowledge, preview, northlight.id),
  };
  const { enquiries } = applyBrainToOpenEnquiries(business, ENQUIRIES);
  const dana = enquiries.find((e) => e.id === "f07")!;
  const sent = dana.decision.quotes.find((q) => q.status === "sent");
  const draft = dana.decision.quotes.find((q) => q.status === "draft");
  assert.equal(sent?.total?.amount, 720);
  assert.equal(draft?.total?.amount, 1400);
});

test("voice rewrite changes greeting and sign-off only", () => {
  const body = "Hi Priya,\n\nMakeup for four of you is $625 including travel.\n\nMina\nGlow & Co";
  const next = applyVoiceToDraft(
    body,
    {
      greeting: "Hello {name},",
      signOff: "Mina Park\nGlow & Co",
      warmth: "Reserved",
      formality: "Conversational",
      energy: "Calm",
      directness: "Direct",
      salesPressure: "Low",
      paragraphLength: "Short",
      bullets: true,
      preferredPhrases: [],
      avoidedPhrases: [],
      emoji: "none",
      priceStyle: "",
      followUpPressure: "Low",
      summary: "",
      version: "v-test",
    },
    "Priya",
  );
  assert.match(next, /^Hello Priya,/);
  assert.match(next, /\$625/);
  assert.match(next, /Mina Park/);
});
