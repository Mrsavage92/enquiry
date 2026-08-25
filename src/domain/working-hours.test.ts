import assert from "node:assert/strict";
import { test } from "node:test";
import { FOLLOW_UP_AFTER_MINUTES, shouldReleaseFollowUp, workingMinutesBetween } from "./working-hours.ts";
import { ENQUIRIES } from "../fixtures/enquiries.ts";

const prefs = {
  hoursStart: "08:00",
  hoursEnd: "17:30",
  workingDays: "Monday–Friday",
  timezone: "Australia/Brisbane",
  notifyArrival: true,
  notifyFollowUp: true,
  notifyLearning: true,
};

test("weekend minutes do not count", () => {
  const from = new Date("2026-08-21T17:00:00+10:00"); // Friday 5pm Brisbane
  const to = new Date("2026-08-24T09:00:00+10:00"); // Monday 9am
  const mins = workingMinutesBetween(from, to, prefs);
  // Friday 17:00–17:30 (30) + Monday 08:00–09:00 (60)
  assert.ok(mins > 70 && mins < 130, `expected ~90 working minutes, got ${mins}`);
});

test("a quoted job becomes follow-up due after two working days", () => {
  const priya = structuredClone(ENQUIRIES.find((e) => e.id === "f01")!);
  priya.state.decision = "WAITING_ON_CLIENT";
  priya.state.commercial = "QUOTED";
  priya.followUpDue = false;
  priya.conversation.push({
    id: "out",
    direction: "outbound",
    channel: "email",
    at: "2026-08-20T10:00:00+10:00",
    from: "Mina",
    to: priya.customerEmail,
    body: "Quote sent",
  });
  assert.equal(shouldReleaseFollowUp(priya, prefs, new Date("2026-08-24T14:00:00+10:00")), true);
  assert.equal(shouldReleaseFollowUp(priya, prefs, new Date("2026-08-20T12:00:00+10:00")), false);
});

test("follow-up window is two working days", () => {
  assert.equal(FOLLOW_UP_AFTER_MINUTES, 16 * 60);
});
