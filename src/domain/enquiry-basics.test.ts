import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dateQuestion,
  readContact,
  readCustomerName,
  readDates,
  readEnquiryBasics,
  readJobDate,
} from "./enquiry-basics.ts";

// Fixed "now" so the year a date lands in never depends on when the suite runs.
const NOW = new Date("2026-09-25T09:00:00+10:00");

test("a sign-off name is read from the end of the message", () => {
  assert.equal(
    readCustomerName(
      "Hi, we need the outside painted. Would like it done before Christmas. Thanks, Karen",
    ),
    "Karen",
  );
  assert.equal(readCustomerName("Can you quote this? Cheers Tom"), "Tom");
  assert.equal(readCustomerName("Hello there.\n\nKind regards,\nPriya Nair"), "Priya Nair");
});

test("a bare name after the last sentence, even with a phone number, is the customer", () => {
  assert.equal(
    readCustomerName(
      "Hi there, can I get a price for an end of lease clean? Moving out on the 10th of October. Tom",
    ),
    "Tom",
  );
  assert.equal(readCustomerName("How much would that be? Priya 0412 555 019"), "Priya");
});

test("words that sit where a name sits are not taken as one", () => {
  assert.equal(readCustomerName("Can you come on Friday? Thanks"), undefined);
  assert.equal(readCustomerName("Is that possible before Christmas"), undefined);
  assert.equal(readCustomerName("need it done asap thanks a lot"), undefined);
  assert.equal(readCustomerName("Quote please. October"), undefined);
});

test("an introduction names the customer", () => {
  assert.equal(readCustomerName("Hi, my name is Sam and I need a clean"), "Sam");
});

test("'the 10th of October' is read as the next 10 October", () => {
  const d = readJobDate("moving out on the 10th of October. Tom", NOW);
  assert.deepEqual(d, {
    iso: "2026-10-10",
    label: "Sat 10 Oct",
    span: "10th of October",
    asked: false,
  });
});

test("a date is 'asked about' only when the customer asks, not when they mention it", () => {
  assert.equal(readJobDate("Could you do it on Saturday 3 October? Cheers", NOW)?.asked, true);
  assert.equal(readJobDate("Is 14/11 free?", NOW)?.asked, true);
  assert.equal(readJobDate("Are you available 3 Oct for a quote", NOW)?.asked, true);
  assert.equal(readJobDate("Our wedding is on the 14th of Feb at Sirromet.", NOW)?.asked, false);
  assert.equal(readJobDate("Keys go back Saturday 3 October. Can you help?", NOW)?.asked, false);
});

test("weekday, month-first and Australian numeric dates are read", () => {
  assert.equal(readJobDate("Keys go back Saturday 3 October.", NOW)?.iso, "2026-10-03");
  assert.equal(readJobDate("Could you do October 12th?", NOW)?.iso, "2026-10-12");
  assert.equal(readJobDate("Is 14/11 free?", NOW)?.iso, "2026-11-14");
  assert.equal(readJobDate("Booked for 3 Oct 2027", NOW)?.iso, "2027-10-03");
});

test("a day already past this year is next year's, never a date behind us", () => {
  assert.equal(readJobDate("the 2nd of March", NOW)?.iso, "2027-03-02");
});

test("loose time words and impossible dates are left unknown, not guessed", () => {
  assert.equal(readJobDate("next week or before Christmas", NOW), undefined);
  assert.equal(readJobDate("a 3 bedroom lowset brick house", NOW), undefined);
  assert.equal(readJobDate("the 31st of September", NOW), undefined);
  assert.equal(readJobDate("I may need 2 coats", NOW), undefined);
});

test("both basics come back together", () => {
  const b = readEnquiryBasics(
    "Hello, looking for an end of lease clean. Keys go back Friday 3 October. How much would that be? Priya 0412 555 019",
    NOW,
  );
  assert.equal(b.customerName, "Priya");
  // 3 October 2026 is a Saturday. Enquiry does not pick between the weekday
  // and the date: no job date, and the owner sees the conflict.
  assert.equal(b.jobDate, undefined);
  assert.equal(b.dates.issue?.note, "They wrote Friday 3 October - that date is a Saturday.");
  assert.equal(b.contact.phone, "0412 555 019");
});

test("dash sign-offs, kisses and short sign-offs all give the name", () => {
  const cases: [string, string][] = [
    ["hey mate need an end of lease clean for a 2 bed unit. can u do the 1st? - Priya", "Priya"],
    ["can u do the 1st?\n-- Priya", "Priya"],
    ["can u do the 1st? \u2013 Priya Nair", "Priya Nair"],
    ["can u do the 1st? \u2014 Priya", "Priya"],
    ["Would love a quote! Priya x", "Priya"],
    ["Would love a quote! Priya xx", "Priya"],
    ["Would love a quote. Thanks Priya", "Priya"],
    ["Would love a quote.\nRegards, Priya", "Priya"],
    ["Would love a quote.\nCheers, Karen Mills", "Karen Mills"],
  ];
  for (const [text, want] of cases) assert.equal(readCustomerName(text), want, text);
});

test("a dash before a non-name is not a name", () => {
  assert.equal(readCustomerName("need it done asap - Thanks"), undefined);
  assert.equal(readCustomerName("price for 3 rooms - Monday"), undefined);
});

test("a date the customer rules out is never the job date, and one they only mention is never 'asked about'", () => {
  assert.equal(
    readJobDate("We're not available on 3 October, any other day is fine.", NOW),
    undefined,
  );
  assert.equal(readJobDate("We're away 3 October. Can you come after?", NOW), undefined);
  assert.equal(readJobDate("Any day except 3 October?", NOW), undefined);
  assert.equal(readJobDate("3 October won't work for us?", NOW), undefined);
  assert.equal(readJobDate("Free quote please for 3 October move", NOW)?.asked, false);
  assert.equal(readJobDate("Are you free on 3 October", NOW)?.asked, true);
  assert.equal(readJobDate("Does 3 October suit", NOW)?.asked, true);
});

// Review pass 4: the repros that produced wrong customer-facing dates.
const SAT_26_SEP = new Date("2026-09-26T09:00:00+10:00");

test("a past day is never rolled on to next year, and 'asap' is the request", () => {
  const text =
    "I needed it done by last Tuesday 22 September - the tenant bailed. Can you still do it asap??";
  const r = readDates(text, SAT_26_SEP);
  assert.equal(r.jobDate, undefined, "no job date from a day that has passed");
  assert.equal(r.issue?.kind, "past");
  assert.match(r.issue?.note ?? "", /last Tuesday 22 September/);
  assert.equal(r.asap, true);
  assert.equal(readJobDate(text, SAT_26_SEP), undefined);
});

test("a recently passed day, or one whose weekday matches this year, is past even without 'last'", () => {
  assert.equal(readDates("Could you have done 22 September?", SAT_26_SEP).issue?.kind, "past");
  assert.equal(readDates("Needed it on Tuesday 22 September", SAT_26_SEP).jobDate, undefined);
  assert.equal(readDates("It was booked for 1 Sept", SAT_26_SEP).issue?.kind, "past");
  // Long gone with no year: next year's, as before.
  assert.equal(readJobDate("the 2nd of March", SAT_26_SEP)?.iso, "2027-03-02");
});

test("a weekday that disagrees with its date is flagged, never picked", () => {
  const r = readDates("Can you do Wednesday 8 October?", SAT_26_SEP);
  assert.equal(r.jobDate, undefined);
  assert.equal(r.issue?.kind, "weekday_conflict");
  assert.equal(r.issue?.note, "They wrote Wednesday 8 October - that date is a Thursday.");
  // A weekday that agrees is fine.
  assert.equal(readJobDate("Can you do Thursday 8 October?", SAT_26_SEP)?.iso, "2026-10-08");
  assert.equal(readJobDate("Can you do Thu the 8th of October?", SAT_26_SEP)?.iso, "2026-10-08");
});

test("a day ruled out is recorded as not available and never becomes the job date", () => {
  const r = readDates(
    "Any day except Monday 5 October - that day is no good. End of lease clean please.",
    SAT_26_SEP,
  );
  assert.equal(r.jobDate, undefined);
  assert.equal(r.unavailable.length, 1);
  assert.equal(r.unavailable[0]!.label, "Mon 5 Oct");
  const both = readDates("Not Monday 5 October, but Friday 9 October would be great", SAT_26_SEP);
  assert.equal(both.jobDate?.iso, "2026-10-09");
  assert.deepEqual(
    both.unavailable.map((d) => d.iso),
    ["2026-10-05"],
  );
  // "away until" is a boundary, not a day ruled out and not the job date.
  const away = readDates("We're away until 3 October", SAT_26_SEP);
  assert.equal(away.jobDate, undefined);
  assert.equal(away.unavailable.length, 0);
});

test("sign-off names over several lines, with contact details, are read", () => {
  const cases: [string, string][] = [
    ["Can you quote an end of lease clean?\n\ncheers\n\nMel Tran\n0412 555 019", "Mel Tran"],
    ["how much for a regular clean? thx Dave", "Dave"],
    ["Quote please.\n\nThanks heaps,\nLiam O'Connor\nliam.oc@example.com", "Liam O'Connor"],
    ["Quote please.\nCheers,\nAnne-Marie Smith-Jones", "Anne-Marie Smith-Jones"],
    ["Quote please.\nKind regards,\nSean McDonald\nMob: 0412 555 019", "Sean McDonald"],
    ["Quote please.\nCheers,\nMel\nChermside", "Mel"],
    ["Could you come in? Regards, Priya Shah, Office Manager, Northside Dental", "Priya Shah"],
  ];
  for (const [text, want] of cases) assert.equal(readCustomerName(text), want, text);
});

test("'Cheers' alone and a suburb on its own are not names", () => {
  assert.equal(readCustomerName("Can you quote this?\ncheers"), undefined);
  assert.equal(readCustomerName("Can you quote this?\nCheers\n0412 555 019"), undefined);
  assert.equal(readCustomerName("Can you quote this? Cheers"), undefined);
});

test("a phone number and an email are read as written", () => {
  assert.deepEqual(readContact("cheers\nMel Tran\n0412 555 019"), { phone: "0412 555 019" });
  assert.deepEqual(readContact("Thanks,\nLiam\nliam.oc@example.com."), {
    email: "liam.oc@example.com",
  });
  assert.deepEqual(readContact("a 3 bedroom house, 120 sqm, $450 budget"), {});
  assert.equal(readContact("call +61 412 555 019 anytime").phone, "+61 412 555 019");
});

// Review of PR #70: every repro is a test.
test("M1: a negation elsewhere in the clause does not rule the day out", () => {
  for (const text of [
    "I'm not fussy about times but could you do 5 October?",
    "I don't mind which day but 5 October is ideal",
    "Not sure if you're free on 5 October?",
  ]) {
    const r = readDates(text, SAT_26_SEP);
    assert.equal(r.unavailable.length, 0, text);
    assert.equal(r.jobDate?.iso, "2026-10-05", text);
  }
  for (const text of [
    "Not on 5 October please",
    "We can't do 5 October",
    "5 October doesn't suit",
    "5 October is no good",
    "Not Monday 5 October",
  ]) {
    const r = readDates(text, SAT_26_SEP);
    assert.equal(r.jobDate, undefined, text);
    assert.deepEqual(
      r.unavailable.map((d) => d.iso),
      ["2026-10-05"],
      text,
    );
  }
});

test("M2: 'not urgent' is not asap", () => {
  assert.equal(readDates("It's not urgent, whenever suits", SAT_26_SEP).asap, false);
  assert.equal(readDates("Nothing urgent", SAT_26_SEP).asap, false);
  assert.equal(readDates("No rush - not asap", SAT_26_SEP).asap, false);
  assert.equal(readDates("Need it asap please", SAT_26_SEP).asap, true);
});

test("P2: fractions and 'may' are not dates; a date months away is a date to check", () => {
  assert.equal(readJobDate("Can you do 3/4 of the lawn?", SAT_26_SEP), undefined);
  assert.equal(readJobDate("1/2 day clean please", SAT_26_SEP), undefined);
  assert.equal(readJobDate("the dog 3 may need a bath", SAT_26_SEP), undefined);
  assert.equal(readJobDate("Is 14/11 free?", SAT_26_SEP)?.iso, "2026-11-14");
  assert.equal(readJobDate("Moving on 3 May 2027", SAT_26_SEP)?.iso, "2027-05-03");
  const far = readDates("Could you do 3 April?", SAT_26_SEP);
  assert.equal(far.jobDate, undefined, "rolled more than six months ahead");
  assert.equal(far.issue?.kind, "check_date");
});

test("P1: suburbs, job titles and business names are never read as the customer's name", () => {
  const none = [
    "Can you quote this?\nThanks\nChermside",
    "Can you quote this?\nThanks,\nOffice Manager",
    "Can you quote this?\nkind regards\nMount Gravatt",
    "Need a quote. Paddington",
    "Need a quote - Brisbane",
    "Can you quote this?\ncheers\nBest Cleaning Co",
    "Can you quote this?\nThanks\nMel",
  ];
  for (const text of none) assert.equal(readCustomerName(text), undefined, text);
  assert.equal(readCustomerName("Can you quote this?\nPriya Shah\nOffice Manager"), "Priya Shah");
  assert.equal(
    readCustomerName("Quote please.\nThanks\nKedron", { place: "Kedron, Brisbane" }),
    undefined,
  );
  assert.equal(readCustomerName("Quote please. Thanks, Priya"), "Priya");
});

test("a doubtful day is asked about in the customer's own words, never stated", () => {
  const conflict = readDates("Can you do Wednesday 8 October?", SAT_26_SEP).issue!;
  assert.equal(
    dateQuestion(conflict),
    "You mentioned Wednesday 8 October - the 8th is a Thursday. Which day did you mean?",
  );
  const past = readDates("I needed it by last Tuesday 22 September", SAT_26_SEP).issue!;
  assert.equal(
    dateQuestion(past),
    "You mentioned 22 September, which has passed - what day suits you?",
  );
});

test("a thank-you sentence is not a sign-off that hides the real one", () => {
  assert.equal(
    readCustomerName("Thanks for getting back to me.\nCan you do Friday?\n- Priya"),
    "Priya",
  );
});
