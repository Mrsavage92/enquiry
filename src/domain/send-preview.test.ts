import assert from "node:assert/strict";
import { test } from "node:test";
import { ENQUIRIES } from "../fixtures/enquiries.ts";
import { previewFor } from "./send-preview.ts";

function byId(id: string) {
  return ENQUIRIES.find((e) => e.id === id)!;
}

test("quote preview: channel, recipient, amount and reason all come from the decision", () => {
  const priya = byId("f01");
  const preview = previewFor({
    enquiry: priya,
    draft: priya.decision.draft.body,
    decision: priya.decision,
  });
  assert.equal(preview.channelLabel, "Email");
  assert.equal(preview.recipient, "priya.shah@example.com");
  assert.equal(preview.body, priya.decision.draft.body);
  assert.equal(preview.amountLabel, "$625");
  assert.equal(preview.reason, priya.decision.recommendation.reason);
  assert.equal(preview.edited, false, "the draft matches the prepared text verbatim");
});

test("quote preview flags an edited draft against the prepared text", () => {
  const priya = byId("f01");
  const preview = previewFor({
    enquiry: priya,
    draft: `${priya.decision.draft.body}\n\nP.S. bring extra brushes`,
    decision: priya.decision,
  });
  assert.equal(preview.edited, true);
});

test("request-info preview has no amount when there is nothing to quote yet", () => {
  const jordan = byId("f02");
  assert.equal(jordan.decision.recommendation.action, "REQUEST_INFORMATION");
  const preview = previewFor({
    enquiry: jordan,
    draft: jordan.decision.draft.body,
    decision: jordan.decision,
  });
  assert.equal(preview.channelLabel, "Email");
  assert.equal(preview.recipient, "jordan@lumengoods.example");
  assert.equal(preview.amountLabel, "$720–$1,080", "a range is restated, not silently dropped");
  assert.equal(preview.reason, jordan.decision.recommendation.reason);
});

test("escalate preview has no amount and no invented price", () => {
  const leah = byId("f09");
  assert.equal(leah.decision.recommendation.action, "ESCALATE_HUMAN");
  const preview = previewFor({
    enquiry: leah,
    draft: leah.decision.draft.body,
    decision: leah.decision,
  });
  assert.equal(preview.recipient, "leah@cornerstore.example");
  assert.equal(preview.amountLabel, null);
  assert.equal(preview.reason, leah.decision.recommendation.reason);
});

test("no-recipient preview reads 'no recipient on file' as an empty string, never an invented address", () => {
  const noContact = structuredClone(byId("f01"));
  noContact.customerName = "";
  noContact.customerEmail = "";
  noContact.customerPhone = undefined;
  noContact.customerHandle = undefined;
  noContact.source = "manual";
  noContact.conversation = [];
  const preview = previewFor({
    enquiry: noContact,
    draft: noContact.decision.draft.body,
    decision: noContact.decision,
  });
  assert.equal(preview.recipient, "", "empty string, not a fabricated name or address");
});

/**
 * A "manual" channel has no address of its own - the owner sends by hand
 * from their own inbox or phone, which is every first-beta send. These four
 * cases mirror `resolveToAddr()`'s server-side fallback exactly (email, then
 * phone, then handle, then "") so the preview shown before a send and the
 * audit line written after it never disagree about who it went to.
 */
test("manual-channel preview resolves to the enquiry's email when only email is on file", () => {
  const emailOnly = structuredClone(byId("f01"));
  emailOnly.customerName = "";
  emailOnly.customerEmail = "priya.shah@example.com";
  emailOnly.customerPhone = undefined;
  emailOnly.customerHandle = undefined;
  emailOnly.source = "manual";
  emailOnly.conversation = [];
  const preview = previewFor({
    enquiry: emailOnly,
    draft: emailOnly.decision.draft.body,
    decision: emailOnly.decision,
  });
  assert.equal(preview.recipient, "priya.shah@example.com");
});

test("manual-channel preview resolves to the enquiry's phone when only phone is on file", () => {
  const phoneOnly = structuredClone(byId("f01"));
  phoneOnly.customerName = "";
  phoneOnly.customerEmail = "";
  phoneOnly.customerPhone = "0412 773 091";
  phoneOnly.customerHandle = undefined;
  phoneOnly.source = "manual";
  phoneOnly.conversation = [];
  const preview = previewFor({
    enquiry: phoneOnly,
    draft: phoneOnly.decision.draft.body,
    decision: phoneOnly.decision,
  });
  assert.equal(preview.recipient, "0412 773 091");
});

test("manual-channel preview resolves to the enquiry's handle when only a handle is on file", () => {
  const handleOnly = structuredClone(byId("f01"));
  handleOnly.customerName = "";
  handleOnly.customerEmail = "";
  handleOnly.customerPhone = undefined;
  handleOnly.customerHandle = "@priya.shah";
  handleOnly.source = "manual";
  handleOnly.conversation = [];
  const preview = previewFor({
    enquiry: handleOnly,
    draft: handleOnly.decision.draft.body,
    decision: handleOnly.decision,
  });
  assert.equal(preview.recipient, "@priya.shah");
});

test("edited is null when the decision snapshot carries no prepared text to compare against", () => {
  const priya = structuredClone(byId("f01"));
  priya.decision.draft.body = "";
  const preview = previewFor({
    enquiry: priya,
    draft: "Hi Priya, here is the quote.",
    decision: priya.decision,
  });
  assert.equal(preview.edited, null);
});

test("amount comes from the decision snapshot's price when nothing else supplies it yet (a live enquiry before send)", () => {
  const priya = structuredClone(byId("f01"));
  priya.valueExact = undefined;
  priya.decision.quotes = [];
  priya.decision.price = { kind: "EXACT", amountMinor: 58000, currency: "AUD" };
  const preview = previewFor({
    enquiry: priya,
    draft: priya.decision.draft.body,
    decision: priya.decision,
  });
  assert.equal(preview.amountLabel, "$580");
});

test("a range price in the decision snapshot is restated before send, not silently dropped", () => {
  const priya = structuredClone(byId("f01"));
  priya.valueExact = undefined;
  priya.valueRange = undefined;
  priya.decision.quotes = [];
  priya.decision.price = { kind: "RANGE", minMinor: 72000, maxMinor: 108000, currency: "AUD" };
  const preview = previewFor({
    enquiry: priya,
    draft: priya.decision.draft.body,
    decision: priya.decision,
  });
  assert.equal(preview.amountLabel, "$720–$1,080");
});

test("a BLOCKED/unpriceable decision (no price on the snapshot) still has no amount before send", () => {
  const leah = structuredClone(byId("f09"));
  leah.valueExact = undefined;
  leah.valueRange = undefined;
  leah.decision.quotes = [];
  assert.equal(leah.decision.price, undefined, "escalated enquiries never carry a computed price");
  const preview = previewFor({
    enquiry: leah,
    draft: leah.decision.draft.body,
    decision: leah.decision,
  });
  assert.equal(preview.amountLabel, null);
});
