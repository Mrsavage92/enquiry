import assert from "node:assert/strict";
import { test } from "node:test";
import { readCustomerName, readEnquiryBasics, readJobDate } from "./enquiry-basics.ts";

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
  assert.equal(readJobDate("Keys go back Friday 3 October. Can you help?", NOW)?.asked, false);
});

test("weekday, month-first and Australian numeric dates are read", () => {
  assert.equal(readJobDate("Keys go back Friday 3 October.", NOW)?.iso, "2026-10-03");
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
  // 3 October 2026 is a Saturday: the label comes from the calendar, not
  // from the weekday the customer wrote.
  assert.equal(b.jobDate?.label, "Sat 3 Oct");
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
