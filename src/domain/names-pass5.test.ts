import assert from "node:assert/strict";
import { test } from "node:test";
import { readCustomerName } from "./enquiry-basics.ts";

test("a trailing parenthetical aside is dropped from a sign-off name", () => {
  assert.equal(
    readCustomerName("Hey, can u do Sat 3rd?? cheers, Dave (landlord said the oven must be done)"),
    "Dave",
  );
  assert.equal(readCustomerName("Could you fit me in? cheers, Dave (0412 555 019)"), "Dave");
});

test("a formal sign-off full name wins over an informal intro earlier in the message", () => {
  assert.equal(
    readCustomerName(
      "Jen here, looking for a quote on a deep clean.\n\nKind regards,\nJennifer Walsh",
    ),
    "Jennifer Walsh",
  );
});

test("two first names joined by '&' or 'and' are read as one name, as written", () => {
  assert.equal(
    readCustomerName("Hi, we need the house painted.\nThanks, Margaret & Tony"),
    "Margaret & Tony",
  );
  assert.equal(
    readCustomerName("Hi, we need the house painted.\nThanks, Margaret and Tony"),
    "Margaret and Tony",
  );
});

test("a company after the name on a sign-off line is dropped", () => {
  assert.equal(readCustomerName("Regards,\nPaul Nguyen, Nguyen Property Group"), "Paul Nguyen");
  assert.equal(
    readCustomerName("Could you come in? Cheers, Paul Nguyen, Nguyen Property Group"),
    "Paul Nguyen",
  );
});

test("a suburb in brackets after a name is dropped", () => {
  assert.equal(readCustomerName("Thanks, Sarah (Wooloowin)"), "Sarah");
});

test("a role in brackets after a name is dropped", () => {
  assert.equal(readCustomerName("Kind regards,\nAhmed Khan (Senior Solicitor)"), "Ahmed Khan");
});

test("an introduction still works when followed by a contraction, not a second name", () => {
  assert.equal(
    readCustomerName("Hi, my name is Priya and I've just moved in, can you quote a clean?"),
    "Priya",
  );
});

test("'Jen here' alone at the start, with no sign-off, is the customer's name", () => {
  assert.equal(readCustomerName("Jen here, need a quote for the bathroom please."), "Jen");
});

test("negative cases stay undefined, never invented", () => {
  const none = [
    "Can you quote this?\nThanks\nChermside",
    "Can you quote this? Cheers",
    "Can you quote this?\nThanks,\nOffice Manager",
    "Can you quote this?\ncheers\nBest Cleaning Co",
    "Thanks & regards",
    "Tony & Co",
  ];
  for (const text of none) assert.equal(readCustomerName(text), undefined, text);
});

test("a full name then a company closing the message, with no sign-off word", () => {
  assert.equal(
    readCustomerName(
      "Looking to get the house repainted. Mon 12 Oct would suit. Paul Nguyen, Nguyen Property Group",
    ),
    "Paul Nguyen",
  );
  assert.equal(
    readCustomerName("Need a quote.\nPaul Nguyen, Nguyen Property Group"),
    "Paul Nguyen",
  );
  // A tail that is not a company or a role is not taken.
  assert.equal(readCustomerName("Need a quote. Kedron Brisbane, Queensland Australia"), undefined);
});

test("L4: common words and 'The X' families are never read as a name", () => {
  for (const text of [
    "Need a quote asap.\nUrgent",
    "Quote for the clean please.\nThanks,\nMum",
    "Quote please.\nCheers,\nNo Name",
    "Quote please.\nKind regards,\nThe Smiths",
    "Quote please. - Urgent",
  ]) {
    assert.equal(readCustomerName(text), undefined, text);
  }
  assert.equal(readCustomerName("Quote please.\nKind regards,\nAnna Smith"), "Anna Smith");
});
