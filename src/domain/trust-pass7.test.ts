import assert from "node:assert/strict";
import test from "node:test";
import { readBusinessDetails } from "./business-details-read.ts";
import { closedRangeCovers, describeDetail, type BusinessDetail } from "./business-detail.ts";
import { compilePrice } from "./price-compiler.ts";
import { describeRule, type BusinessRule } from "./business-rule.ts";

/**
 * Review 6b (41/52 on eed60b9): each untrue reply it found, reproduced here as
 * the reading or decision that caused it, and now true.
 */

const TUE_29_SEP = new Date("2026-09-29T10:00:00+10:00");

function detailsOf(line: string): BusinessDetail[] {
  return readBusinessDetails(line, TUE_29_SEP).details.map((d) => d.detail);
}

test("2: 'Not available Saturday 10 October' is one closed date, never every Saturday", () => {
  for (const line of ["Not available Saturday 10 October", "not available Sat 10 Oct"]) {
    const [detail, ...rest] = detailsOf(line);
    assert.equal(rest.length, 0, line);
    assert.deepEqual(detail, { kind: "closed_dates", from: "10-10", to: "10-10", year: 2026 });
    assert.equal(describeDetail(detail!), "Closed on Saturday 10 October only");
    assert.equal(closedRangeCovers("2026-10-10", detail as never), true);
    assert.equal(closedRangeCovers("2026-10-17", detail as never), false, "not the next Saturday");
    assert.equal(closedRangeCovers("2027-10-10", detail as never), false, "not next year");
  }
});

test("2: one-off and yearly dates read as dates; only recurring words make a weekday rule", () => {
  assert.deepEqual(detailsOf("closed Christmas Day"), [
    { kind: "closed_dates", from: "12-25", to: "12-25" },
  ]);
  assert.equal(
    describeDetail(detailsOf("closed Christmas Day")[0]!),
    "Closed on 25 December every year",
  );
  assert.deepEqual(detailsOf("away 20-27 Dec"), [
    { kind: "closed_dates", from: "12-20", to: "12-27", year: 2026 },
  ]);
  for (const [line, days, said] of [
    ["no Saturdays", [6], "You don't work Saturdays"],
    ["not working weekends", [0, 6], "You don't work Saturdays or Sundays"],
    ["we don't work Saturdays", [6], "You don't work Saturdays"],
    ["closed Saturdays", [6], "You don't work Saturdays"],
  ] as const) {
    const read = detailsOf(line);
    assert.deepEqual(read, [{ kind: "closed_days", days: [...days] }], line);
    assert.equal(describeDetail(read[0]!), said);
  }
});

test("4: a weekend surcharge and a fortnightly discount are rules, not notes", () => {
  assert.deepEqual(detailsOf("Weekend jobs add 20%"), [
    { kind: "surcharge", percent: 20, days: [0, 6] },
  ]);
  assert.deepEqual(detailsOf("Fortnightly cleans get 10% off"), [
    { kind: "discount", percent: 10, frequency: "fortnightly" },
  ]);
  const travel = readBusinessDetails("Travel $1 per km after the first 20 km", TUE_29_SEP);
  assert.equal(travel.unread[0]?.note, true, "travel stays a note");
});

function tier(text: string): BusinessRule {
  const read = readBusinessDetails(text, TUE_29_SEP);
  assert.equal(read.unread.length, 0, JSON.stringify(read.unread));
  assert.equal(read.prices.length, 1);
  return read.prices[0]!.rule;
}

function quote(rule: BusinessRule, bedrooms: string): number {
  const price = compilePrice([rule], rule.service, [
    { field: "service", value: rule.service, status: "confirmed" },
    { field: "bedrooms", value: bedrooms, status: "confirmed" },
  ]);
  assert.equal(price.kind, "EXACT");
  return price.kind === "EXACT" ? price.amountMinor : 0;
}

test("5: '$160 for up to 3 bedrooms, extra bedrooms $35 each' quotes 4 bed $195 and 5 bed $230", () => {
  const rule = tier("Regular house clean $160 for up to 3 bedrooms, extra bedrooms $35 each");
  assert.equal(
    describeRule(rule),
    "Regular house clean: $160 for up to 3 bedrooms, then $35 per extra bedroom",
  );
  assert.equal(quote(rule, "2"), 16000);
  assert.equal(quote(rule, "3"), 16000);
  assert.equal(quote(rule, "4"), 19500);
  assert.equal(quote(rule, "5"), 23000);
});

test("5: split over two lines the threshold is kept; an extra price with no threshold is refused", () => {
  const joined = tier("Regular house clean $160 for up to 3 bedrooms\nExtra bedrooms $35 each");
  assert.equal(quote(joined, "4"), 19500);
  const pair = readBusinessDetails("Regular house clean $160\nExtra bedroom $35", TUE_29_SEP);
  assert.equal(pair.prices.length, 0, "neither line of the pair is saved on its own");
  assert.equal(pair.unread.length, 2);
  assert.match(pair.unread[1]!.reason, /no price says how many bedrooms come before/);
  const alone = readBusinessDetails("Regular house clean $160 for up to 3 bedrooms", TUE_29_SEP);
  assert.equal(alone.prices.length, 0);
  assert.match(alone.unread[0]!.reason, /not what each bedroom after that costs/);
  assert.notEqual(alone.unread[0]!.note, true, "never kept as a harmless note");
});

test("3: event words near the day mark it fixed; an ordinary day is not", async () => {
  const { fixedEventNear } = await import("./fixed-event.ts");
  assert.equal(fixedEventNear("Getting married 19 Dec need bridal makeup", "19 Dec"), "wedding");
  assert.equal(fixedEventNear("makeup for our year 12 formal Sat 7 Nov", "Sat 7 Nov"), "formal");
  assert.equal(
    fixedEventNear("need it done by Friday 10 October please", "Friday 10 October"),
    "deadline",
  );
  assert.equal(fixedEventNear("can u do sat 3 oct?? also the oven", "sat 3 oct"), undefined);
});

test("7: availability and other questions are read; 'do you do' and the price are not", async () => {
  const { readCustomerAsks } = await import("./customer-asks.ts");
  const services = ["Regular house clean", "Interior painting", "Bridal trial"];
  const asks = (text: string) => readCustomerAsks(text, services).map((a) => a.field);
  assert.deepEqual(asks("hey r u free this sat or sun for a clean? Lou"), ["ask:availability"]);
  assert.deepEqual(asks("Are you available next week?"), ["ask:availability"]);
  assert.deepEqual(asks("Do you have insurance? Also are you licensed?"), [
    "ask:insurance",
    "ask:licence",
  ]);
  assert.deepEqual(asks("How long will it take?"), ["ask:duration"]);
  assert.deepEqual(asks("Do you do hair?? And do you do a trial? How much for 3 bed?"), []);
  assert.deepEqual(asks("can u do sat 3 oct?? thx"), []);
});

test("8: counts they gave are read and tied to the right service", async () => {
  const { findQuantityInMessages } = await import("../lib/repo/quantity-inference.ts");
  const services = [
    "Interior painting",
    "Ceiling painting",
    "Regular house clean",
    "Window cleaning",
  ];
  const read = (body: string, field: string, unit: string, service: string) =>
    findQuantityInMessages([{ id: "m", body }], field, unit, service, services)?.value;
  const tom =
    "looking to get 2 bedrooms painted, walls roughly 60m2 plus the ceilings about 25 sqm. Tom";
  assert.equal(read(tom, "square metres", "square metre", "Interior painting"), "60");
  assert.equal(read(tom, "square metres", "square metre", "Ceiling painting"), "25");
  const graham =
    "after a quote to paint the outside of our house, and the lounge room inside, approx 30 m2. Graham";
  assert.equal(read(graham, "square metres", "square metre", "Interior painting"), "30");
  assert.equal(
    read(
      "can you clean my windows? Only 3 small ones. Bec",
      "windows",
      "window",
      "Window cleaning",
    ),
    "3",
  );
  assert.equal(
    read("about 140 square metres of wall", "square metres", "square metre", "Interior painting"),
    "140",
  );
});

test("8: names from 'xx Priya' and 'Name:'; a 'Service:' field picks the service; windows quote their own sentence", async () => {
  const { readCustomerName } = await import("./enquiry-basics.ts");
  const { suggestService } = await import("./service-match.ts");
  const { readExtraRequests } = await import("./extras.ts");
  assert.equal(readCustomerName("need bridal makeup, and do you do hair??\nxx Priya"), "Priya");
  assert.equal(readCustomerName("Name: Rachel Nguyen\nPhone: 0455 321 987"), "Rachel Nguyen");
  const services = ["Ceiling painting", "Interior painting", "Window cleaning"];
  assert.equal(
    suggestService("Name: Rachel\nService: Interior painting\nMessage: ceilings too", services),
    "Interior painting",
  );
  const extras = readExtraRequests(
    "About 140 square metres of wall inside. The dog hair needs to be cleaned off the carpets too. Also 18 windows cleaned inside and out.",
    "Interior painting",
    services,
  );
  assert.equal(
    extras.find((e) => e.label === "Window cleaning")?.span,
    "Also 18 windows cleaned inside and out",
  );
});

test("9: a window of days, 'this sat or sun', tomorrow, and 'except Friday' never become the wrong day", async () => {
  const { readDates } = await import("./enquiry-basics.ts");
  const b = readDates(
    "Any day except Friday works, sometime between 12 and 16 October.",
    TUE_29_SEP,
  );
  assert.equal(b.jobDate, undefined, "never 'Asked for Fri 16 Oct'");
  assert.deepEqual(b.unavailable, [], "never 'Not available: Fri 2 Oct'");
  assert.equal(b.window?.label, "12-16 Oct, not Fri");
  const rachel = readDates(
    "We get the keys on the 1st, painting sometime between 2 and 9 November, not weekends.",
    TUE_29_SEP,
  );
  assert.equal(rachel.window?.from, "2026-11-02");
  assert.equal(rachel.window?.to, "2026-11-09");
  assert.deepEqual(
    rachel.context.map((c) => [c.what, c.iso]),
    [["keys", "2026-11-01"]],
  );
  const lou = readDates("r u free this sat or sun for a clean?", TUE_29_SEP);
  assert.deepEqual(
    lou.options?.days.map((d) => d.iso),
    ["2026-10-03", "2026-10-04"],
  );
  const dave = readDates("can you do it tmrw?", TUE_29_SEP);
  assert.equal(dave.jobDate?.iso, "2026-09-30");
  assert.equal(dave.jobDate?.span, "tomorrow (Wednesday 30 September)");
});

test("12: a saved fact reads in the owner's words, never 'authoritative · 1' or 'Active'", async () => {
  const { factStateWord, factSourceWords, factSaid, factEffect, factPayload } =
    await import("./fact-words.ts");
  assert.equal(factStateWord("Active"), "In use");
  assert.equal(factStateWord("Needs review"), "Check this");
  assert.equal(factSourceWords("Confirmed by the owner"), "You added this");
  assert.equal(
    factSaid({ source: { kind: "user", label: "Confirmed by the owner", detail: "No Saturdays" } }),
    "No Saturdays",
  );
  const payload = factPayload({ kind: "closed_days", days: [6] });
  assert.equal(payload?.kind, "detail");
  assert.match(factEffect(payload!), /the reply says so/);
});
