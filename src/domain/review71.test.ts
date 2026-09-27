import assert from "node:assert/strict";
import test from "node:test";
import { decideEnquiry } from "./decide.ts";
import { decideConfirmed } from "./coverage-testing.ts";
import { composeReply } from "./compose-reply.ts";
import { snapshotFromDecision } from "./decision-snapshot.ts";
import { extraField } from "./extras.ts";
import { COVERAGE_FIELD, frequencyIn, unsettledFlags } from "./coverage.ts";
import { questionField, readServiceQuestions } from "./service-questions.ts";
import { readDetailLine } from "./business-detail.ts";
import { readBusinessDetails } from "./business-details-read.ts";
import { dollarAmounts, unreadableMoney } from "./voice-detect.ts";
import { readPriceLine } from "./price-sentence.ts";
import { replacementsFor } from "./price-replacement.ts";
import { readDates } from "./enquiry-basics.ts";
import type { BusinessRule } from "./business-rule.ts";
import { modelFactsToKeep } from "../lib/repo/manual-enquiry-core.ts";

/** Review of PR #71 (FIX FIRST): every repro is a test here or in review71.db.test.ts. */

const fact = (field: string, value: string, status = "confirmed", displayValue?: string) => ({
  field,
  value,
  status,
  ...(displayValue ? { displayValue } : {}),
});
const brain = (...rules: unknown[]) => ({
  knowledge: rules.map((rulePayload) => ({ state: "Active", rulePayload })),
});
const EOL = {
  kind: "per_unit",
  service: "End of lease clean",
  amount: 190,
  currency: "AUD",
  unit: "bedroom",
  quantityField: "bedrooms",
};
const base = [fact("service", "End of lease clean"), fact("bedrooms", "3")];

// M1 ---------------------------------------------------------------------------

test("M1: every flag must be settled before the price can be confirmed, and each is said", () => {
  const message = "End of lease clean for 3 bedrooms. Also the garage and the deck.";
  const open = decideEnquiry(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: base as never,
    messageText: message,
  });
  const things = unsettledFlags(open.coverage!.flagged).map((f) => f.thing);
  assert.ok(things.includes("garage") && things.includes("deck"), JSON.stringify(things));
  // A confirmation stored for this exact coverage still does not count.
  const forced = decideEnquiry(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [...base, fact(COVERAGE_FIELD, open.coverage!.key)] as never,
    messageText: message,
  });
  assert.equal(forced.coverage?.confirmed, false);
  assert.equal(forced.action, "ESCALATE_HUMAN");

  const settled = [
    ...base,
    fact(extraField("garage"), "come_back"),
    fact(extraField("deck"), "leave_out"),
  ];
  const d = decideConfirmed(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: settled as never,
    messageText: message,
  });
  assert.equal(d.action, "SEND_QUOTE");
  const reply = composeReply(d, {});
  assert.match(reply, /I'll come back to you on the garage\./);
  assert.match(reply, /I haven't included the deck in this price\./);
});

test("M1: a service they mention that you don't offer is said in the reply once you confirm", () => {
  const detail = { kind: "not_offered", service: "mould removal" };
  const message =
    "End of lease clean for 3 bedrooms, and there is some mould removal needed in the bathroom.";
  const open = decideEnquiry(brain(EOL, detail), {
    serviceLabel: "End of lease clean",
    facts: base as never,
    messageText: message,
  });
  const flag = open.coverage!.flagged.find((f) => f.kind === "not_offered");
  assert.equal(flag?.thing, "mould removal");
  const d = decideConfirmed(brain(EOL, detail), {
    serviceLabel: "End of lease clean",
    facts: [...base, fact(questionField("mould removal"), "no")] as never,
    messageText: message,
  });
  assert.equal(d.action, "SEND_QUOTE");
  assert.match(composeReply(d, {}), /Sorry, I don't do mould removal\./);
});

// M2 ---------------------------------------------------------------------------

test("M2: a not-offered service matches only when all its own words are there", () => {
  const mould = [{ kind: "not_offered" as const, service: "mould removal" }];
  const black = [{ kind: "not_offered" as const, service: "black mould" }];
  const q = (text: string, details: typeof mould) =>
    readServiceQuestions(text, ["End of lease clean"], details).map((x) => [x.thing, x.notOffered]);
  assert.deepEqual(q("Do you do rubbish removal?", mould), [["rubbish removal", false]]);
  assert.deepEqual(q("Do you do mould inspections?", black), [["mould inspections", false]]);
  assert.deepEqual(q("Do you do mould removal?", mould), [["mould removal", true]]);
});

// M3 ---------------------------------------------------------------------------

test("M3: a qualified rule is a note, a vague one is refused, trailing words are trimmed", () => {
  assert.deepEqual(readDetailLine("We can't do windows above two storeys"), {
    kind: "note",
    text: "We can't do windows above two storeys",
  });
  assert.deepEqual(readDetailLine("I don't do mould removal, sorry"), {
    kind: "not_offered",
    service: "mould removal",
  });
  assert.equal((readDetailLine("We don't do jobs under 100") as { kind: string }).kind, "note");
  assert.ok("refuse" in (readDetailLine("we don't do it") as object));
  assert.deepEqual(readDetailLine("We don't do Sunday jobs but we do Saturdays"), {
    kind: "closed_days",
    days: [0],
  });
});

// M4 ---------------------------------------------------------------------------

test("M4: money in every form is caught, and unreadable money is refused", () => {
  for (const [text, want] of [
    ["That's 880 AUD", 880],
    ["That's 880AUD", 880],
    ["that's 880 aud", 880],
    ["That's 880$", 880],
    ["USD 880", 880],
    ["eight hundred and eighty dollars", 880],
    ["That comes to 880.", 880],
  ] as const) {
    assert.deepEqual(dollarAmounts(text), [want], text);
  }
  assert.deepEqual(dollarAmounts("That comes to 3 bedrooms"), []);
  assert.equal(unreadableMoney("about nine-ish hundred dollars"), true);
  assert.equal(unreadableMoney("That comes to $880."), false);
});

// M5 ---------------------------------------------------------------------------

test("M5: per-unit forms, notes kept, conditions and variants refused, never dropped", () => {
  const rule = (line: string) => {
    const r = readPriceLine(line);
    assert.ok("rule" in r, `${line}: ${"reason" in r ? r.reason : ""}`);
    return r as { rule: BusinessRule; note?: string };
  };
  for (const line of ["Doors $90 each (includes frame)", "Doors $90 each incl frame"]) {
    const r = rule(line);
    assert.equal(r.rule.kind === "per_unit" && r.rule.unit, "door");
    assert.equal(r.note, "frame");
  }
  for (const line of ["Doors each $90", "Each door $90"]) {
    const r = rule(line).rule;
    assert.equal(r.service, "Doors");
    assert.equal(r.kind === "per_unit" && r.unit, "door");
  }
  const tiles = rule("Tiles $30 per hour, 2 hr min").rule;
  assert.equal(tiles.kind === "per_unit" && tiles.minimumQuantity, 2);
  for (const line of [
    "Gutters $150 for single storey",
    "Gutters $250 for double storey homes",
    "Rubbish $50 per load approx",
  ]) {
    assert.ok(!("rule" in readPriceLine(line)), line);
  }
  // Two gutter lines: neither is saved as a price, so neither retires the other.
  const both = readBusinessDetails(
    "Gutters $150 for single storey\nGutters $250 for double storey homes",
  );
  assert.equal(both.prices.length, 0);
  assert.equal(both.unread.filter((u) => u.note).length, 2);
  const inc = readBusinessDetails("Doors $90 each (includes frame)");
  assert.deepEqual(inc.details[0]?.detail, {
    kind: "note",
    text: "Doors includes frame",
    service: "Doors",
  });
});

// M6 ---------------------------------------------------------------------------

test("M6: recurring needs a frequency, and it is a reading the owner confirms", () => {
  for (const text of [
    "just a regular end of lease clean",
    "we clean regularly ourselves, need a one-off",
    "ongoing issue with mould, one clean please",
  ]) {
    assert.equal(frequencyIn(text), undefined, text);
  }
  assert.equal(frequencyIn("a regular clean every fortnight"), "every fortnight");
  assert.equal(frequencyIn("weekly please"), "weekly");
  const message = "End of lease clean for 3 bedrooms every fortnight";
  const open = decideEnquiry(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: base as never,
    messageText: message,
  });
  assert.equal(open.coverage?.recurring, false);
  assert.ok(
    open.coverage?.flagged.some((f) => f.text === "They want this every fortnight - correct?"),
  );
  const yes = decideConfirmed(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [...base, fact("recurring", "yes")] as never,
    messageText: message,
  });
  assert.match(composeReply(yes, {}), /per visit/);
  const no = decideConfirmed(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [...base, fact("recurring", "no")] as never,
    messageText: message,
  });
  assert.doesNotMatch(composeReply(no, {}), /per visit/);
});

// L1, L2 -------------------------------------------------------------------------

test("L1: the preview names every price retired and every clash in the same batch", () => {
  const p = (amount: number, unit = "bedroom") => ({
    kind: "per_unit" as const,
    service: "End of lease clean",
    amount,
    currency: "AUD" as const,
    unit,
    quantityField: `${unit}s`,
  });
  const out = replacementsFor([p(190), p(50, "room")], [p(200), p(210)]);
  assert.deepEqual(out[0]?.replaces, ["$190 per bedroom", "$50 per room"]);
  assert.deepEqual(out[0]?.clashesWith, ["$210 per bedroom"]);
  assert.deepEqual(out[1]?.clashesWith, ["$200 per bedroom"]);
});

test("L2: while an extra is unsettled the draft names no price and no 'go ahead'", () => {
  const d = decideEnquiry(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [
      ...base,
      fact(extraField("oven cleaning"), "include", "inferred", "plus oven"),
    ] as never,
  });
  assert.ok(d.extraPending);
  const body = snapshotFromDecision(d).draft.body;
  assert.doesNotMatch(body, /\$|go ahead/);
});

// L5 -----------------------------------------------------------------------------

test("L5: a weekday alone is asked, a ruled-out one excluded, history is not a problem line", () => {
  const fri = new Date("2026-09-25T09:00:00+10:00");
  const r = readDates("Can you come Sunday? Not Monday", fri);
  assert.equal(r.jobDate?.iso, "2026-09-27");
  assert.equal(r.unavailable[0]?.iso, "2026-09-28");
  const h = readDates("Last clean was on 3 Sept. Could you do 10 October?", fri);
  assert.equal(h.issue, undefined);
  assert.equal(h.jobDate?.iso, "2026-10-10");
});

test("L5: each of two offered days is checked against the days you don't work", () => {
  const closed = { kind: "closed_days", days: [0] };
  const d = decideEnquiry(brain(EOL, closed), {
    serviceLabel: "End of lease clean",
    facts: [...base, fact("date", "2026-10-03|2026-10-04", "inferred")] as never,
  });
  assert.ok(
    d.coverage?.flagged.some(
      (f) =>
        f.text === "A day they mentioned is a Sunday - you don't work Sundays, the reply says so",
    ),
  );
});

// L6 -----------------------------------------------------------------------------

test("L6: a model may only propose asks the message names, a few at a time, never owner steps", () => {
  const message = "End of lease clean please, plus the oven, the fridge, the garage and the shed.";
  const facts = [
    { field: "extra:oven" },
    { field: "extra:fridge" },
    { field: "extra:garage" },
    { field: "extra:shed" },
    { field: "extra:helicopter" },
    { field: "question:mould removal" },
    { field: "coverage" },
    { field: "recurring" },
    { field: "bedrooms" },
  ];
  assert.deepEqual(
    modelFactsToKeep(facts, message).map((f) => f.field),
    ["extra:oven", "extra:fridge", "extra:garage", "bedrooms"],
  );
});

test("M1: 'Part of this price' settles a mention with no line and nothing extra in the reply", () => {
  const message = "End of lease clean for 3 bedrooms, walls wiped down please.";
  const d = decideConfirmed(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [...base, fact(extraField("walls"), "covered")] as never,
    messageText: message,
  });
  assert.equal(d.action, "SEND_QUOTE");
  assert.deepEqual(d.coverage?.flagged, []);
  assert.doesNotMatch(composeReply(d, {}), /walls/);
});
