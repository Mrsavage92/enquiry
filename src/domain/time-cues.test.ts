import assert from "node:assert/strict";
import { test } from "node:test";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import {
  catchUpSince,
  concreteWhen,
  followUpDueWall,
  laterChoices,
  rowTimeCue,
  withFollowUpDue,
} from "./time-cues.ts";
import { queueSection } from "./labels.ts";
import { DEFAULT_PREFS } from "./workspace-prefs.ts";
import type { Enquiry } from "./types.ts";

const prefs = { ...DEFAULT_PREFS, timezone: "Australia/Brisbane" };

/** A quoted enquiry whose only reply went out at `sentAt`. */
function quoted(sentAt: string): Enquiry {
  const e = structuredClone(ENQUIRIES.find((x) => x.id === "f01")!);
  e.state = { ...e.state, decision: "WAITING_ON_CLIENT", commercial: "QUOTED" };
  e.state.responsibility = "CUSTOMER";
  e.followUpDue = false;
  e.atRisk = false;
  e.snoozedUntil = undefined;
  e.conversation = [
    ...e.conversation.filter((m) => m.direction === "inbound"),
    {
      id: "out",
      direction: "outbound",
      channel: "email",
      at: sentAt,
      from: "Mina",
      to: e.customerEmail,
      body: "Here is your quote.",
    },
  ];
  return e;
}

test("concrete time names a day a person can picture, never 'ago'", () => {
  const now = new Date("2026-09-24T15:00:00+10:00"); // Thu
  assert.equal(concreteWhen("2026-09-24T09:14:00+10:00", now), "today 9:14am");
  assert.equal(concreteWhen("2026-09-23T16:05:00+10:00", now), "yesterday 4:05pm");
  assert.equal(concreteWhen("2026-09-22T09:14:00+10:00", now), "Tue 9:14am");
  assert.equal(concreteWhen("2026-08-28T09:14:00+10:00", now), "Fri 28 Aug");
  for (const e of ENQUIRIES) {
    assert.doesNotMatch(rowTimeCue(e, prefs, now), /ago|about|less than/i);
  }
});

test("a reply sent Friday afternoon comes back after two working days, skipping the weekend", () => {
  // Fri 25 Sep 4pm: 1.5h Fri, 9.5h Mon, 5h Tue -> Tue 29 Sep 1pm.
  const due = followUpDueWall("2026-09-25T16:00:00+10:00", prefs);
  assert.ok(due);
  assert.equal(due.getDate(), 29);
  assert.equal(due.getHours(), 13);
});

test("a quiet customer comes back from what is on record, flags only", () => {
  const e = quoted("2026-09-21T10:00:00+10:00"); // Mon
  const before = withFollowUpDue(e, prefs, new Date("2026-09-22T12:00:00+10:00"));
  assert.equal(before, e, "not due yet: the same object comes back untouched");

  const after = withFollowUpDue(e, prefs, new Date("2026-09-24T09:00:00+10:00"));
  assert.equal(after.followUpDue, true);
  assert.match(after.followUpReason ?? "", /Mon 10:00am/);
  assert.equal(queueSection(after), "needs_you", "a due follow-up is a decision due now");
  // The stored decision is not rewritten, so nothing can offer a send the
  // server would refuse.
  assert.deepEqual(after.decision, e.decision);
  assert.deepEqual(after.state, e.state);
});

test("a parked enquiry does not come back early, and says when it will", () => {
  const e = quoted("2026-09-01T10:00:00+10:00");
  e.snoozedUntil = "2026-09-29T08:00:00+10:00";
  const now = new Date("2026-09-24T09:00:00+10:00");
  assert.equal(withFollowUpDue(e, prefs, now), e);
  assert.equal(rowTimeCue(e, prefs, now), "Back Tue 29 Sep");
});

test("a waiting row says when it was sent and when it comes back", () => {
  const e = quoted("2026-09-24T10:00:00+10:00");
  const cue = rowTimeCue(e, prefs, new Date("2026-09-24T11:00:00+10:00"));
  assert.equal(cue, "Sent today 10:00am · back tomorrow if no answer");
});

test("since-you-were-last-here needs a real absence and a real change", () => {
  const now = new Date("2026-09-24T15:00:00+10:00");
  const e = quoted("2026-09-22T10:00:00+10:00");
  e.receivedAt = "2026-09-24T12:00:00+10:00";
  assert.equal(catchUpSince([e], null, now), null, "first visit: nothing to catch up on");
  assert.equal(catchUpSince([e], "2026-09-24T14:00:00+10:00", now), null, "away under 2 hours");
  assert.deepEqual(catchUpSince([e], "2026-09-24T09:00:00+10:00", now), {
    arrived: 1,
    answered: 0,
    due: 0,
  });
});

test("later choices name real days: later today, tomorrow, after the weekend", () => {
  const thursdayMorning = new Date("2026-09-24T09:00:00+10:00");
  const choices = laterChoices(thursdayMorning, prefs);
  assert.deepEqual(
    choices.map((c) => c.id),
    ["today", "tomorrow", "weekend"],
  );
  assert.match(choices[1]!.label, /^Tomorrow, Fri 8:00am$/);
  assert.match(choices[2]!.label, /Mon 28 Sep/);
  assert.equal(new Date(choices[1]!.until).toISOString(), "2026-09-24T22:00:00.000Z");
  // Late in the evening there is no "later today".
  const late = laterChoices(new Date("2026-09-24T22:30:00+10:00"), prefs);
  assert.equal(late[0]!.id, "tomorrow");
});
