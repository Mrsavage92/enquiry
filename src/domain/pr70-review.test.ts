import assert from "node:assert/strict";
import test from "node:test";
import { decideEnquiry } from "./decide.ts";
import { extraField, readExtraRequests } from "./extras.ts";
import { lineChoicesFor } from "./line-choices.ts";
import { composeReply } from "./compose-reply.ts";
import { dollarMatches, replaceAmounts } from "./voice-detect.ts";
import { digitsForWrittenNumber } from "./number-words.ts";
import { parseQuantity } from "./quantity.ts";
import { readQuantityFromMessage, quantityContextFor } from "./quantity-reader.ts";
import { readPriceLine } from "./price-sentence.ts";
import { replyContextFromFacts } from "./reply-context.ts";
import { activeRules } from "./decide.ts";

/**
 * Independent review of PR #70: every repro it listed, as a test.
 */

const EOL = {
  kind: "per_unit",
  service: "End of lease clean",
  amount: 190,
  currency: "AUD",
  unit: "bedroom",
  quantityField: "bedrooms",
};
const OVEN = { kind: "fixed_price", service: "Oven cleaning", amount: 120, currency: "AUD" };
const brain = (...rules: unknown[]) => ({
  knowledge: rules.map((r, i) => ({ id: `k${i}`, state: "Active", rulePayload: r }) as never),
});
const fact = (field: string, value: string, status = "confirmed", displayValue = value) =>
  ({ id: field, field, label: field, value, displayValue, status }) as never;
const MAIN = "End of lease clean";

test("H1: connector phrases that are not things to price are read as nothing", () => {
  for (const text of [
    "End of lease clean please, and also the kids will be home",
    "End of lease clean as well as us moving out",
    "End of lease clean, plus my partner will let you in",
    "End of lease clean plus the house is 3 bed",
    "Do it as well as possible",
    "End of lease clean plus Saturday morning",
    "End of lease clean plus GST?",
    "End of lease clean plus I have a dog",
  ]) {
    assert.deepEqual(readExtraRequests(text, MAIN, [MAIN]), [], text);
  }
  // Still read: a real extra ending where a request ends.
  assert.deepEqual(
    readExtraRequests("End of lease clean plus oven please", MAIN, [MAIN]).map((e) => e.label),
    ["oven cleaning"],
  );
  assert.deepEqual(
    readExtraRequests("End of lease clean, plus the carpets.", MAIN, [MAIN]).map((e) => e.label),
    ["carpets"],
  );
});

test("H1: 'They didn't ask for this' removes the extra with no line and no reply line", () => {
  const d = decideEnquiry(brain(EOL), {
    serviceLabel: MAIN,
    facts: [
      fact("service", MAIN),
      fact("bedrooms", "4"),
      fact(extraField("kids will be cleaning"), "not_asked"),
    ],
  });
  assert.equal(d.action, "SEND_QUOTE");
  assert.equal(d.extraPending, undefined);
  const reply = composeReply(d, {});
  assert.doesNotMatch(reply, /haven't included|kids/);
});

test("M3: a declined or passing mention of a saved service is not an extra", () => {
  const services = [MAIN, "Carpet steam clean", "Window cleaning"];
  assert.deepEqual(
    readExtraRequests(
      "End of lease clean please. The carpets are fine, no carpet steam clean needed.",
      MAIN,
      services,
    ),
    [],
  );
  assert.deepEqual(
    readExtraRequests(
      "End of lease clean please. The window cleaning guy came last week.",
      MAIN,
      services,
    ),
    [],
  );
});

test("H2: left out, then priced, then added as a line: one line, no 'haven't included'", () => {
  const facts = [
    fact("service", MAIN),
    fact("bedrooms", "4"),
    fact(extraField("oven cleaning"), "leave_out"),
  ];
  const rules = activeRules(brain(EOL, OVEN));
  // "Add a line" never offers what was deliberately left out...
  assert.deepEqual(
    lineChoicesFor(rules, facts as never, MAIN, [MAIN]).map((c) => c.rule.service),
    [],
  );
  // ...and when the owner adds it anyway, it lands on the existing field.
  const pending = [
    fact("service", MAIN),
    fact("bedrooms", "4"),
    fact(extraField("oven cleaning"), "include", "inferred"),
  ];
  assert.deepEqual(
    lineChoicesFor(rules, pending as never, MAIN, [MAIN]).map((c) => c.field),
    ["extra:oven cleaning"],
  );
  // Two names for the same priced thing, one left out and one added: one line.
  const d = decideEnquiry(brain(EOL, OVEN), {
    serviceLabel: MAIN,
    facts: [
      fact("service", MAIN),
      fact("bedrooms", "4"),
      fact(extraField("oven cleaning"), "leave_out"),
      fact(extraField("Oven cleaning"), "include"),
      fact(extraField("oven"), "include"),
    ],
  });
  assert.deepEqual(
    d.lines?.map((l) => [l.label, l.amountMinor]),
    [
      ["End of lease clean", 76000],
      ["Oven cleaning", 12000],
    ],
  );
  const reply = composeReply(d, {});
  assert.doesNotMatch(reply, /haven't included/);
  assert.equal((reply.match(/\$120/g) ?? []).length, 1);
});

test("H3: only one clearly wrong total is ever rewritten", () => {
  const minor = (n: number) => n * 100;
  assert.equal(
    replaceAmounts("That comes to $880, deposit $88", [minor(880), minor(88)], minor(760)),
    null,
  );
  assert.equal(
    replaceAmounts("$76, which is $76 total", [minor(76)], minor(760)),
    "$760, which is $760 total",
  );
  assert.equal(
    replaceAmounts("Total $880. A $50 deposit holds the day.", [minor(880), minor(50)], minor(760)),
    null,
  );
  assert.equal(replaceAmounts("$1,200 last year", [minor(1200)], minor(760)), null);
  assert.equal(
    replaceAmounts("That comes to $900 all up", [minor(900)], minor(880)),
    "That comes to $880 all up",
  );
  // "A $50" is the word A, not an A$ prefix.
  assert.deepEqual(
    dollarMatches("A $50 deposit").map((m) => [m.raw, m.amount]),
    [["$50", 50]],
  );
  assert.deepEqual(
    dollarMatches("A$50 deposit").map((m) => m.amount),
    [50],
  );
});

test("H4: 'two and a half' is refused, never stored as 2", () => {
  assert.equal(digitsForWrittenNumber("two and a half"), "two and a half");
  assert.equal(digitsForWrittenNumber("three or so"), "three or so");
  assert.equal(digitsForWrittenNumber("three bedrooms"), "3 bedrooms");
  for (const v of ["2 and a half", "3 and a bit", "4 odd", "two and a half"]) {
    assert.equal(parseQuantity(v, "bedroom", "bedrooms").ok, false, v);
  }
  assert.equal(parseQuantity("3 bedrooms", "bedroom", "bedrooms").ok, true);
});

test("LOW: counts tied to the service right before them; street names are not counts", () => {
  const services = ["Interior wall painting", "Ceilings"];
  const text = "Ceilings 45 sqm. Walls 120 sqm.";
  assert.equal(
    readQuantityFromMessage(
      text,
      "square metres",
      "square metre",
      quantityContextFor(text, "Ceilings", services),
    )?.value,
    "45",
  );
  assert.equal(
    readQuantityFromMessage(
      text,
      "square metres",
      "square metre",
      quantityContextFor(text, "Interior wall painting", services),
    )?.value,
    "120",
  );
  assert.equal(
    readQuantityFromMessage("We're at 12 Bedroom St, Kedron", "bedrooms", "bedroom"),
    undefined,
  );
});

test("LOW: price parser strips 'fixed price' and names the condition it refuses", () => {
  const rewire = readPriceLine("Fixed price rewire $900");
  assert.ok("rule" in rewire && rewire.rule.service === "Rewire");
  const pet = readPriceLine("Pet hair removal $40 per pet (dogs only)");
  assert.ok(!("rule" in pet) && /"only \.\.\."/.test(pet.reason));
  const except = readPriceLine("Oven clean $120 except self-cleaning ovens");
  assert.ok(!("rule" in except) && /"except \.\.\."/.test(except.reason));
});

test("P1/P2: a read name and a read day are never stated in the reply until confirmed", () => {
  const facts = [
    { field: "name", value: "Office Manager", status: "inferred" },
    {
      field: "date",
      value: "2026-10-03",
      status: "inferred",
      date_asked: "true",
      date_span: "Saturday 3 October",
    },
  ];
  const ctx = replyContextFromFacts(facts, { customerName: "Office Manager" });
  assert.equal(ctx.customerName, "");
  const d = decideEnquiry(brain(OVEN), {
    serviceLabel: "Oven cleaning",
    facts: [fact("service", "Oven cleaning")],
  });
  const reply = composeReply(d, ctx);
  assert.match(reply, /^Hi there,/);
  assert.match(reply, /You mentioned Saturday 3 October - I'll confirm whether that day works\./);
  const confirmed = replyContextFromFacts(
    [{ field: "name", value: "Priya Shah", status: "confirmed" }],
    { customerName: "Priya Shah" },
  );
  assert.match(composeReply(d, confirmed), /^Hi Priya,/);
});

test("date issues: the reply asks in the customer's words", () => {
  const d = decideEnquiry(brain(OVEN), {
    serviceLabel: "Oven cleaning",
    facts: [fact("service", "Oven cleaning")],
  });
  const conflict = replyContextFromFacts(
    [
      {
        field: "date",
        value: "Wednesday 8 October",
        status: "conflict",
        date_issue: {
          kind: "weekday_conflict",
          mention: "Wednesday 8 October",
          actualDay: "the 8th is a Thursday",
        },
      },
    ],
    { customerName: "" },
  );
  assert.match(
    composeReply(d, conflict),
    /You mentioned Wednesday 8 October - the 8th is a Thursday\. Which day did you mean\?/,
  );
  const past = replyContextFromFacts(
    [
      {
        field: "date",
        value: "asap",
        status: "check_this",
        date_issue: JSON.stringify({ kind: "past", mention: "22 September" }),
      },
    ],
    { customerName: "" },
  );
  assert.match(
    composeReply(d, past),
    /You mentioned 22 September, which has passed - I'll let you know the soonest day I can do it\./,
  );
});
