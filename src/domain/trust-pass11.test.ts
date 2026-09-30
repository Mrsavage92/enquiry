import assert from "node:assert/strict";
import test from "node:test";
import { detectVoiceEdit } from "./voice-detect.ts";
import type { VoiceProfile } from "./types.ts";

/**
 * Trust pass 11, pure logic: the review of main d9651c5. Every date is read
 * against an injected clock, Wednesday 30 September 2026 in Brisbane.
 */

export const WED_30_SEP = new Date("2026-09-30T10:15:00+10:00");

const VOICE: VoiceProfile = {
  warmth: "Warm",
  formality: "Casual",
  energy: "Calm",
  directness: "Direct",
  salesPressure: "Low",
  greeting: "Hi {name},",
  paragraphLength: "Short",
  bullets: false,
  signOff: "Thanks,\nDana",
  preferredPhrases: [],
} as VoiceProfile;

test("1: a greeting changed only by a confirmed name is not the owner changing their voice", () => {
  const prepared = "Hi Mel,\n\nThanks for getting in touch.\n\nThanks,\nDana";
  const kept = "Hi there,\n\nThanks for getting in touch. Looking forward to it.\n\nThanks,\nDana";
  assert.equal(detectVoiceEdit(prepared, kept, VOICE, "Mel"), null);
  assert.equal(detectVoiceEdit(kept, prepared, VOICE, "Mel"), null);
  // A greeting the owner really changed is still offered.
  const own = "Hey Mel!\n\nThanks for getting in touch.\n\nThanks,\nDana";
  assert.equal(detectVoiceEdit(prepared, own, VOICE, "Mel")?.reason, "You changed the greeting.");
});
