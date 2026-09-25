import assert from "node:assert/strict";
import test from "node:test";
import { decideEnquiry, normaliseFactAnswer, validateFactAnswer } from "./decide.ts";
import { readExtraRequests, extraField, extraQuantityField } from "./extras.ts";
import { composeReply } from "./compose-reply.ts";
import { snapshotFromDecision } from "./decision-snapshot.ts";
import { readQuantityFromMessage, quantityContextFor } from "./quantity-reader.ts";
import { wordsToNumber, digitsForWrittenNumber } from "./number-words.ts";
import { promiseVerdict, nextStepLabel } from "./labels.ts";
import { setupStep } from "./next-action.ts";
import { amountAgrees } from "../lib/repo/reviewed-send-core.ts";

/**
 * Review pass 4, SERIOUS 3 and 4: a second thing the customer asked for must
 * never be silently dropped from a total, and a count must belong to the
 * service it was written beside.
 */

const EOL = {
  kind: "per_unit",
  service: "End of lease clean",
  amount: 190,
  currency: "AUD",
  unit: "bedroom",
  quantityField: "bedrooms",
};
const OVEN = { kind: "fixed_price", service: "Oven clean", amount: 120, currency: "AUD" };
const WALLS = {
  kind: "per_unit",
  service: "Interior wall painting",
  amount: 28,
  currency: "AUD",
  unit: "square metre",
  quantityField: "square metres",
};
const CEILINGS = {
  kind: "per_unit",
  service: "Ceilings",
  amount: 22,
  currency: "AUD",
  unit: "square metre",
  quantityField: "square metres",
};

const brain = (...rules: unknown[]) => ({
  knowledge: rules.map((r, i) => ({ id: `k${i}`, state: "Active", rulePayload: r }) as never),
});
const fact = (field: string, value: string, status = "confirmed", displayValue = value) =>
  ({ id: field, field, label: field, value, displayValue, status }) as never;

const LEASE_TEXT =
  "Hi, need an end of lease clean for a four bedroom house in Chermside, plus oven please. Keys back Fri 2 Oct.";

test("an extra with no saved price is read, labelled from the job, and never priced", () => {
  const extras = readExtraRequests(LEASE_TEXT, "End of lease clean", ["End of lease clean"]);
  assert.deepEqual(
    extras.map((e) => e.label),
    ["oven cleaning"],
  );
  assert.equal(extras[0]!.service, undefined);
});

test("an extra that names a saved service is that service", () => {
  const extras = readExtraRequests(LEASE_TEXT, "End of lease clean", [
    "End of lease clean",
    "Oven clean",
  ]);
  assert.deepEqual(
    extras.map((e) => [e.label, e.service]),
    [["Oven clean", "Oven clean"]],
  );
});

test("counts, fees and the main job itself are not extras", () => {
  const main = "End of lease clean";
  assert.deepEqual(readExtraRequests("3 bedrooms plus 2 bathrooms", main, [main]), []);
  assert.deepEqual(readExtraRequests("what does it cost plus GST?", main, [main]), []);
  assert.deepEqual(readExtraRequests("end of lease clean plus the clean", main, [main]), []);
  assert.deepEqual(
    readExtraRequests("end of lease clean, no oven please", main, [main, "Oven clean"]),
    [],
  );
});

test("the review repro: $760 is never quoted while the oven they asked for has no price", () => {
  const d = decideEnquiry(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [
      fact("service", "End of lease clean"),
      fact("bedrooms", "4"),
      fact(extraField("oven cleaning"), "include", "inferred", "plus oven please"),
    ],
  });
  assert.notEqual(d.action, "SEND_QUOTE");
  assert.equal(d.extraPending?.kind, "no_price");
  assert.equal(d.extraPending?.label, "oven cleaning");
  const snap = snapshotFromDecision(d);
  assert.equal(snap.price, undefined, "no total on file that omits the oven");
  assert.equal(snap.recommendation.primaryEnabled, false);
  const enquiry = {
    state: { lifecycle: "OPEN", decision: "NEEDS_HUMAN", commercial: "UNASSESSED" },
    decision: snap,
  } as never;
  assert.equal(promiseVerdict(enquiry).line, "Not yet - they also asked for oven cleaning");
  assert.equal(setupStep(enquiry)?.label, "Add a price for oven cleaning");
});

test("left out on purpose: the total is the main job and the reply says what was left out", () => {
  const d = decideEnquiry(brain(EOL), {
    serviceLabel: "End of lease clean",
    facts: [
      fact("service", "End of lease clean"),
      fact("bedrooms", "4"),
      fact(extraField("oven cleaning"), "leave_out"),
    ],
  });
  assert.equal(d.action, "SEND_QUOTE");
  assert.equal(d.price.kind === "EXACT" && d.price.amountMinor, 76000);
  const reply = composeReply(d, { customerName: "Mel" });
  assert.match(reply, /\$760/);
  assert.match(reply, /I haven't included oven cleaning in this price\./);
});

test("a priced extra waits for the owner, then becomes its own line on the total", () => {
  const read = decideEnquiry(brain(EOL, OVEN), {
    serviceLabel: "End of lease clean",
    facts: [
      fact("service", "End of lease clean"),
      fact("bedrooms", "4"),
      fact(extraField("Oven clean"), "include", "inferred", "plus oven please"),
    ],
  });
  assert.equal(read.action, "ESCALATE_HUMAN");
  assert.equal(read.extraPending?.kind, "check");
  assert.equal(read.extraPending?.amountMinor, 12000);

  const added = decideEnquiry(brain(EOL, OVEN), {
    serviceLabel: "End of lease clean",
    facts: [
      fact("service", "End of lease clean"),
      fact("bedrooms", "4"),
      fact(extraField("Oven clean"), "include"),
    ],
  });
  assert.equal(added.action, "SEND_QUOTE");
  assert.equal(added.price.kind === "EXACT" && added.price.amountMinor, 88000);
  assert.deepEqual(
    added.lines?.map((l) => [l.label, l.amountMinor]),
    [
      ["End of lease clean", 76000],
      ["Oven clean", 12000],
    ],
  );
  const snap = snapshotFromDecision(added, { customerName: "Mel" });
  assert.equal(snap.price?.kind === "EXACT" && snap.price.amountMinor, 88000);
  const reply = snap.draft.body;
  assert.match(reply, /That comes to \$880 all up:/);
  assert.match(reply, /- End of lease clean: \$760 \(4 bedrooms at \$190 each\)/);
  assert.match(reply, /- Oven clean: \$120/);
  // The product's own reply passes the amount check it is recorded against.
  assert.equal(amountAgrees(reply, snap.price ?? null, snap.impliedAmountsMinor ?? []), true);
  // An owner-typed $880 against a $760 decision is still refused.
  assert.equal(
    amountAgrees(
      "That's $880 all up",
      { kind: "EXACT", amountMinor: 76000, currency: "AUD" },
      [76000, 19000],
    ),
    false,
  );
});

test("written numbers, including compound ones, are read", () => {
  assert.equal(wordsToNumber("one hundred and twenty"), 120);
  assert.equal(wordsToNumber("twenty-five"), 25);
  assert.equal(wordsToNumber("a hundred"), 100);
  assert.equal(wordsToNumber("two thousand five hundred"), 2500);
  assert.equal(wordsToNumber("five five"), null);
  assert.equal(wordsToNumber("ten five"), null);
  assert.equal(digitsForWrittenNumber("three"), "3");
  assert.equal(digitsForWrittenNumber("Three bedrooms"), "3 bedrooms");
  assert.equal(digitsForWrittenNumber("3"), "3");
  assert.equal(digitsForWrittenNumber("a few"), "a few");
});

const PAINT_TEXT =
  "Hi, we need the inside done - one hundred and twenty square metres of wall, plus the ceilings in the lounge, about 45 sqm. Thanks, Karen";

test("the review repro: a count belongs to the service written beside it", () => {
  const services = ["Interior wall painting", "Ceilings"];
  const walls = readQuantityFromMessage(
    PAINT_TEXT,
    "square metres",
    "square metre",
    quantityContextFor(PAINT_TEXT, "Interior wall painting", services),
  );
  assert.equal(walls?.value, "120");
  assert.equal(walls?.span, "one hundred and twenty square metres");
  const ceilings = readQuantityFromMessage(
    PAINT_TEXT,
    extraQuantityField("square metres", "Ceilings"),
    "square metre",
    quantityContextFor(PAINT_TEXT, "Ceilings", services),
  );
  assert.equal(ceilings?.value, "45");
});

test("when two counts share a unit and cannot be tied, none is read", () => {
  const text = "walls and ceilings, 120 sqm and 45 sqm";
  const services = ["Interior wall painting", "Ceilings"];
  assert.equal(
    readQuantityFromMessage(
      text,
      "square metres",
      "square metre",
      quantityContextFor(text, "Interior wall painting", services),
    ),
    undefined,
  );
  // A message that names only one service reads as before.
  assert.equal(
    readQuantityFromMessage(
      "walls please, about 120 sqm",
      "square metres",
      "square metre",
      quantityContextFor("walls please, about 120 sqm", "Interior wall painting", services),
    )?.value,
    "120",
  );
});

test("both services asked for: each gets its own line from its own count", () => {
  const extras = readExtraRequests(PAINT_TEXT, "Interior wall painting", [
    "Interior wall painting",
    "Ceilings",
  ]);
  assert.deepEqual(
    extras.map((e) => e.service),
    ["Ceilings"],
  );
  const d = decideEnquiry(brain(WALLS, CEILINGS), {
    serviceLabel: "Interior wall painting",
    facts: [
      fact("service", "Interior wall painting"),
      fact("square metres", "120"),
      fact(extraField("Ceilings"), "include"),
      fact(extraQuantityField("square metres", "Ceilings"), "45", "inferred", "about 45 sqm"),
    ],
  });
  // The ceilings' count is still only a reading: check it, never price it.
  assert.equal(d.action, "REQUEST_INFORMATION");
  assert.equal(d.blocker?.field, "square metres for ceilings");
  assert.equal(d.blocker?.inferred?.value, "45");

  const priced = decideEnquiry(brain(WALLS, CEILINGS), {
    serviceLabel: "Interior wall painting",
    facts: [
      fact("service", "Interior wall painting"),
      fact("square metres", "120"),
      fact(extraField("Ceilings"), "include"),
      fact(extraQuantityField("square metres", "Ceilings"), "45"),
    ],
  });
  assert.equal(priced.action, "SEND_QUOTE");
  assert.equal(priced.price.kind === "EXACT" && priced.price.amountMinor, 120 * 2800 + 45 * 2200);
});

test("an extra's count is validated against its own rule, and a written count is stored as digits", () => {
  const b = brain(WALLS, CEILINGS);
  const field = extraQuantityField("square metres", "Ceilings");
  assert.equal(validateFactAnswer(b, "Interior wall painting", field, "45"), null);
  assert.match(validateFactAnswer(b, "Interior wall painting", field, "40-50") ?? "", /range/);
  assert.equal(normaliseFactAnswer(b, "square metres", "one hundred and twenty"), "120");
  assert.equal(normaliseFactAnswer(b, field, "forty five"), "45");
  assert.equal(normaliseFactAnswer(b, "address", "one Smith St"), "one Smith St");
});

test("the next step names the extra to settle", () => {
  const d = decideEnquiry(brain(EOL, OVEN), {
    serviceLabel: "End of lease clean",
    facts: [
      fact("service", "End of lease clean"),
      fact("bedrooms", "4"),
      fact(extraField("Oven clean"), "include", "inferred"),
    ],
  });
  const enquiry = {
    state: { lifecycle: "OPEN", decision: "NEEDS_HUMAN", commercial: "UNASSESSED" },
    decision: snapshotFromDecision(d),
  } as never;
  assert.equal(nextStepLabel(enquiry), "Add or leave out oven clean");
  assert.equal(promiseVerdict(enquiry).word, "Not yet");
});
