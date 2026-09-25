import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import { startOfDay, wallNow } from "@/domain/format";
import {
  HARBOUR_SOLO_RULE,
  RIDGE_CREW_WINDOW_RULE,
  SIGNATURE_BUSINESSES,
  SIGNATURE_DEMO,
  buildSignatureBusinesses,
  buildSignatureDates,
  buildSignatureDemo,
  signatureChangedFactIds,
  signatureState,
} from "./signature-demo.ts";

const FIXTURE_PHONES = ["0412 880 441", "0412 773 091", "07 3000 0000", "+61 4 glow"];

/** A handful of `now` values that cross month, year and leap-day boundaries. */
const SAMPLE_NOWS = [
  new Date("2026-09-25T09:00:00+10:00"),
  new Date("2026-01-05T14:30:00+10:00"),
  new Date("2026-12-29T23:50:00+10:00"),
  new Date("2027-02-27T06:00:00+10:00"),
  new Date("2028-02-27T06:00:00+10:00"), // 2028 is a leap year
  new Date("2026-06-30T00:05:00+10:00"),
];

/** Independent of the implementation's own date-fns call, for cross-checking. */
function ordinalSuffix(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return "th";
  return n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
}

function weekdayName(d: Date): string {
  return new Intl.DateTimeFormat("en-AU", { weekday: "long" }).format(d);
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test("Ridge & Co demo begins as a website form and continues as a text", () => {
  assert.equal(SIGNATURE_DEMO.business, "Sample business · Ridge & Co Painting");
  assert.equal(SIGNATURE_DEMO.form.channel, "Website form");
  assert.equal(SIGNATURE_DEMO.text.channel, "Text message");
  assert.match(SIGNATURE_DEMO.form.message, /New Farm/i);
  assert.match(SIGNATURE_DEMO.text.message, /ceilings/i);
});

test("the later text is linked by the same mobile number, not a guessed identity", () => {
  assert.ok(SIGNATURE_DEMO.text.link);
  assert.match(SIGNATURE_DEMO.text.link!.label, /existing enquiry/i);
  assert.match(SIGNATURE_DEMO.text.link!.reason, /mobile number/i);
  assert.match(SIGNATURE_DEMO.phone, /^04\d{2} \d{3} \d{3}$/);
});

test("Maya's mobile is not already used by another fixture or integration", () => {
  assert.ok(!FIXTURE_PHONES.includes(SIGNATURE_DEMO.phone));
  const blob =
    readFileSync(new URL("../../fixtures/businesses.ts", import.meta.url), "utf8") +
    readFileSync(new URL("../../fixtures/enquiries.ts", import.meta.url), "utf8");
  assert.equal(blob.includes(SIGNATURE_DEMO.phone), false);
});

test("deadline and scope are the facts that change", () => {
  const ids = signatureChangedFactIds(SIGNATURE_DEMO.form, SIGNATURE_DEMO.text);
  assert.deepEqual(ids.sort(), ["deadline", "scope"]);
  const formDeadline = SIGNATURE_DEMO.form.facts.find((f) => f.id === "deadline");
  const deadline = SIGNATURE_DEMO.text.facts.find((f) => f.id === "deadline");
  const scope = SIGNATURE_DEMO.text.facts.find((f) => f.id === "scope");
  // The changed fact's "from" is the previous state's own value - not a
  // separately recomputed date, so this can never drift with "now".
  assert.equal(deadline?.from, formDeadline?.value);
  assert.match(deadline?.from ?? "", /^\d{1,2} \w+$/);
  assert.match(deadline?.value ?? "", /^\d{1,2} \w+$/);
  assert.notEqual(deadline?.from, deadline?.value);
  assert.match(scope?.value ?? "", /ceilings/);
});

test("capacity and next action change; price is not the payoff", () => {
  const form = signatureState("form");
  const text = signatureState("text");
  assert.notEqual(form.nextAction, text.nextAction);
  assert.match(form.nextAction, /site measure/i);
  assert.match(text.nextAction, /extra crew/i);
  const formCap = form.checks.find((c) => c.id === "capacity");
  const textCap = text.checks.find((c) => c.id === "capacity");
  assert.match(formCap?.value ?? "", /Provisional/);
  assert.match(formCap?.value ?? "", /two-person/i);
  assert.match(textCap?.value ?? "", /condition/);
  assert.match(textCap?.value ?? "", /third contractor/i);
  assert.equal(textCap?.changed, true);
  const blob = `${form.nextAction} ${text.nextAction} ${form.want} ${text.want}`;
  assert.doesNotMatch(blob, /\$\d/);
  assert.match(form.commercialNote, /measure/i);
});

test("capacity claims stay grounded in Tom's empty-house crew-window rule", () => {
  const form = signatureState("form");
  const text = signatureState("text");
  const formCap = form.checks.find((c) => c.id === "capacity");
  const textCap = text.checks.find((c) => c.id === "capacity");
  assert.equal(RIDGE_CREW_WINDOW_RULE.id, "rd-crew-window");
  assert.equal(formCap?.why, RIDGE_CREW_WINDOW_RULE.body);
  assert.equal(textCap?.why, RIDGE_CREW_WINDOW_RULE.body);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /five-weekday empty-house window/i);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /provisional until the living areas are measured/i);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /ceilings/i);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /three weekdays/i);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /third contractor/i);
  assert.match(RIDGE_CREW_WINDOW_RULE.body, /48 hours notice/i);
  const brain = readFileSync(new URL("../../fixtures/businesses.ts", import.meta.url), "utf8");
  assert.match(brain, /id: "rd-crew-window"/);
  assert.ok(brain.includes(RIDGE_CREW_WINDOW_RULE.body));
  assert.match(brain, /source: src\("user", "Tom"\)/);
});

test("the same message gets a different correct answer at the second business", () => {
  assert.equal(SIGNATURE_BUSINESSES.length, 2);
  const ridge = signatureState("form", "ridge");
  const harbour = signatureState("form", "harbour");
  // Identical customer input: message, facts, channel.
  assert.equal(ridge.message, harbour.message);
  assert.deepEqual(ridge.facts, harbour.facts);
  // Different business rule, different next step.
  assert.notEqual(ridge.nextAction, harbour.nextAction);
  assert.match(harbour.nextAction, /full week/i);
  const cap = harbour.checks.find((c) => c.id === "capacity");
  assert.match(cap?.why ?? "", /alone/i);
  assert.equal(cap?.why, HARBOUR_SOLO_RULE.body);
});

test("one changed fact moves each business's answer for its own reason", () => {
  const ridge = signatureState("text", "ridge");
  const harbour = signatureState("text", "harbour");
  assert.equal(ridge.message, harbour.message);
  assert.match(ridge.nextAction, /extra crew/i);
  assert.match(harbour.nextAction, /say no/i);
  const eligibility = harbour.checks.find((c) => c.id === "eligibility");
  assert.equal(eligibility?.tone, "block");
  assert.match(eligibility?.value ?? "", /not offered/i);
  const capacity = harbour.checks.find((c) => c.id === "capacity");
  assert.match(capacity?.value ?? "", /not possible/i);
  // No invented price anywhere in either answer.
  const blob = `${ridge.nextAction} ${harbour.nextAction} ${harbour.nextReason} ${harbour.commercialNote}`;
  assert.doesNotMatch(blob, /\$\d/);
});

test("an unknown business id falls back to Ridge rather than throwing", () => {
  assert.equal(signatureState("form", "nope" as never).nextAction, SIGNATURE_DEMO.form.nextAction);
});

test("every business x scene combination carries a plain Yes / No / Not yet verdict", () => {
  for (const business of SIGNATURE_BUSINESSES) {
    for (const scene of ["form", "text"] as const) {
      const state = signatureState(scene, business.id);
      assert.ok(state.verdict && state.verdict.length > 0, `${business.id}/${scene} has a verdict`);
      assert.match(
        state.verdict,
        /\b(Yes|No|Not yet)\b/,
        `${business.id}/${scene} verdict "${state.verdict}" names a Yes/No/Not yet answer`,
      );
    }
  }
  assert.equal(SIGNATURE_DEMO.form.verdict, "Not yet - measure first");
  assert.equal(SIGNATURE_DEMO.text.verdict, "Yes, with a condition");
  assert.equal(signatureState("form", "harbour").verdict, "Not yet - measure first, hold the week");
  // The day is the one the customer's text names, so the copy never
  // contradicts the message above it; the answer itself is fixed.
  assert.equal(
    signatureState("text", "harbour").verdict,
    `No to the ${SIGNATURE_DEMO.textDeadlineDay} - offer the next full week`,
  );
  assert.match(
    SIGNATURE_DEMO.text.message,
    new RegExp(`Wednesday the ${SIGNATURE_DEMO.textDeadlineDay} `),
  );
});

test("each check's tone matches what its value says", () => {
  for (const business of SIGNATURE_BUSINESSES) {
    for (const scene of ["form", "text"] as const) {
      for (const check of signatureState(scene, business.id).checks) {
        const where = `${business.id}/${scene}/${check.id}`;
        if (/not possible|not offered/i.test(check.value))
          assert.equal(check.tone, "block", `${where} rules the request out`);
        if (/provisional|need a measure/i.test(check.value))
          assert.equal(check.tone, "check", `${where} holds only after a check`);
        if (check.tone === "ok")
          assert.doesNotMatch(check.value, /provisional|measure|not /i, `${where} is really clear`);
      }
    }
  }
  assert.match(
    signatureState("text", "harbour").nextReason,
    /^Same conversation, different business\./,
  );
});

test("dates are consistent weekday/day pairs across now values spanning month and year boundaries", () => {
  for (const now of SAMPLE_NOWS) {
    const dates = buildSignatureDates(now);
    const demo = buildSignatureDemo(now);
    const label = `now=${now.toISOString()}`;

    assert.equal(dates.emptyFrom.getDay(), 1, `emptyFrom is not a Monday, ${label}`);
    assert.equal(dates.deadlineForm.getDay(), 5, `deadlineForm is not a Friday, ${label}`);
    assert.equal(dates.deadlineText.getDay(), 3, `deadlineText is not a Wednesday, ${label}`);

    const formMatch = /empty from (\w+) the (\d{1,2})(st|nd|rd|th)/.exec(demo.form.message);
    assert.ok(formMatch, `form message has no "empty from" date, ${label}`);
    const [, formWeekday, formDay, formSuffix] = formMatch!;
    assert.equal(formWeekday, weekdayName(dates.emptyFrom), `weekday word wrong, ${label}`);
    assert.equal(Number(formDay), dates.emptyFrom.getDate(), `day number wrong, ${label}`);
    assert.equal(formSuffix, ordinalSuffix(dates.emptyFrom.getDate()), `ordinal wrong, ${label}`);

    const textMatch = /finished by (\w+) the (\d{1,2})(st|nd|rd|th) instead/.exec(
      demo.text.message,
    );
    assert.ok(textMatch, `text message has no "finished by" date, ${label}`);
    const [, textWeekday, textDay, textSuffix] = textMatch!;
    assert.equal(textWeekday, weekdayName(dates.deadlineText), `weekday word wrong, ${label}`);
    assert.equal(Number(textDay), dates.deadlineText.getDate(), `day number wrong, ${label}`);
    assert.equal(
      textSuffix,
      ordinalSuffix(dates.deadlineText.getDate()),
      `ordinal wrong, ${label}`,
    );

    const access = demo.form.facts.find((f) => f.id === "access");
    assert.equal(access?.value, `Empty from ${format(dates.emptyFrom, "d MMM", { locale: enAU })}`);
    const formDeadline = demo.form.facts.find((f) => f.id === "deadline");
    assert.equal(formDeadline?.value, format(dates.deadlineForm, "d MMM", { locale: enAU }));
    const textDeadline = demo.text.facts.find((f) => f.id === "deadline");
    assert.equal(textDeadline?.value, format(dates.deadlineText, "d MMM", { locale: enAU }));
    assert.equal(textDeadline?.from, formDeadline?.value);
  }
});

test("the arrival is always in the past and the empty-house window always in the future, relative to now", () => {
  for (const now of SAMPLE_NOWS) {
    const dates = buildSignatureDates(now);
    const today = dayKey(startOfDay(wallNow(now)));
    const label = `now=${now.toISOString()}`;

    assert.ok(dayKey(dates.arrivalForm) < today, `form arrival is not before today, ${label}`);
    assert.ok(dayKey(dates.arrivalText) < today, `text arrival is not before today, ${label}`);
    assert.ok(
      dayKey(dates.arrivalForm) < dayKey(dates.arrivalText),
      `form arrival is not before text arrival, ${label}`,
    );
    assert.ok(dayKey(dates.emptyFrom) > today, `emptyFrom is not after today, ${label}`);
    assert.ok(
      dayKey(dates.deadlineText) > dayKey(dates.emptyFrom),
      `deadlineText is not after emptyFrom, ${label}`,
    );
    assert.ok(
      dayKey(dates.deadlineForm) > dayKey(dates.deadlineText),
      `deadlineForm is not after deadlineText, ${label}`,
    );
  }
});

test("the Yes / No / Not yet verdicts never move when the dates do", () => {
  for (const now of SAMPLE_NOWS) {
    const demo = buildSignatureDemo(now);
    const businesses = buildSignatureBusinesses(demo);
    const harbour = businesses.find((b) => b.id === "harbour")!;
    assert.equal(demo.form.verdict, "Not yet - measure first");
    assert.equal(demo.text.verdict, "Yes, with a condition");
    assert.equal(harbour.form.verdict, "Not yet - measure first, hold the week");
    assert.equal(
      harbour.text.verdict,
      `No to the ${demo.textDeadlineDay} - offer the next full week`,
    );
    assert.match(harbour.text.nextAction, new RegExp(`^Say no to the ${demo.textDeadlineDay},`));
  }
});
