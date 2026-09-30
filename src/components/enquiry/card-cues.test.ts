import assert from "node:assert/strict";
import test from "node:test";
import {
  bodyWithoutTitle,
  checkStep,
  keptEditNotice,
  leadDateCue,
  openAskedItems,
  otherDateCues,
} from "./card-cues.ts";
import type { DateMention } from "../../domain/date-roles.ts";

type Fact = { field: string; value: string; status: string; superseded?: boolean };

function card(dates: DateMention[], facts: Fact[] = [], dateLabel?: string) {
  return {
    dateLabel,
    facts: facts.map((f, i) => ({ id: String(i), ...f })) as never,
    decision: { dates },
  };
}

const day = (iso: string, role: DateMention["role"], what: string, label: string) => ({
  iso,
  role,
  what,
  label,
});

test("the job's own day says Job once another day beside it has a role", () => {
  const e = card(
    [
      day("2026-10-16", "job", "", "Fri 16 Oct"),
      day("2026-10-17", "context", "inspection", "Sat 17 Oct"),
    ],
    [{ field: "date", value: "2026-10-16", status: "inferred" }],
    "Fri 16 Oct",
  );
  assert.equal(leadDateCue(e), "Job Fri 16 Oct");
  assert.deepEqual(otherDateCues(e), ["Inspection Sat 17 Oct"]);
});

test("a lone day read from the message keeps 'Asked for'", () => {
  const e = card(
    [day("2026-10-23", "job", "", "Fri 23 Oct")],
    [{ field: "date", value: "2026-10-23", status: "inferred" }],
    "Fri 23 Oct",
  );
  assert.equal(leadDateCue(e), "Asked for Fri 23 Oct");
  assert.deepEqual(otherDateCues(e), []);
});

test("rows lead with the job day, else the deadline, else the event", () => {
  const wedding = card(
    [
      day("2026-10-24", "trial", "trial", "Sat 24 Oct"),
      day("2026-11-08", "event", "wedding", "Sun 8 Nov"),
    ],
    [],
    "Wedding Sun 8 Nov",
  );
  assert.equal(leadDateCue(wedding), "Wedding Sun 8 Nov");
  assert.deepEqual(otherDateCues(wedding), ["Trial Sat 24 Oct"]);

  const vacate = card([
    day("2026-10-30", "context", "settlement", "Fri 30 Oct"),
    day("2026-10-29", "deadline", "", "Thu 29 Oct"),
  ]);
  assert.equal(leadDateCue(vacate), "Deadline Thu 29 Oct");
  assert.deepEqual(otherDateCues(vacate), ["Settlement Fri 30 Oct"]);
});

test("without roles the stored cue is unchanged", () => {
  const e = card([], [{ field: "date", value: "2026-10-03", status: "confirmed" }], "Sat 3 Oct");
  assert.equal(leadDateCue(e), "Job Sat 3 Oct");
  assert.equal(leadDateCue(card([], [], undefined)), "");
});

test("the check counter comes from the stable count and never restarts", () => {
  assert.equal(checkStep({ done: 0, total: 4 }), "Check 1 of 4");
  assert.equal(checkStep({ done: 2, total: 4 }), "Check 3 of 4");
  assert.equal(checkStep({ done: 4, total: 4 }), "Check 4 of 4");
  assert.equal(checkStep({ done: 0, total: 1 }), null);
  assert.equal(checkStep(undefined), null);
});

test("'That's everything' waits on open items, never on the job or its days", () => {
  const open = openAskedItems([
    { id: "service", kind: "service", text: "Clean", status: "open" },
    { id: "date", kind: "date", text: "Fri 16 Oct", status: "open" },
    { id: "extra:oven", kind: "extra", text: "Oven", status: "open" },
    { id: "ask:insurance", kind: "ask", text: "insured?", status: "answered" },
  ]);
  assert.deepEqual(
    open.map((i) => i.id),
    ["extra:oven"],
  );
});

test("a kept edit's changes split into figures and lines it lacks", () => {
  assert.deepEqual(keptEditNotice(["Total $90 -> $95", 'Not in your edit: "- Travel fee: $25"']), {
    figures: ["Total $90 -> $95"],
    missing: ['"- Travel fee: $25"'],
  });
});

test("a price card says the service once", () => {
  assert.equal(
    bodyWithoutTitle("Fence painting", "Fence painting: $35 per metre"),
    "$35 per metre",
  );
  assert.equal(
    bodyWithoutTitle("Fence painting", "fence painting: $35 per metre"),
    "$35 per metre",
  );
  assert.equal(bodyWithoutTitle("Oven clean", "Minimum charge $600"), "Minimum charge $600");
});
