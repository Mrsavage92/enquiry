import assert from "node:assert/strict";
import test from "node:test";
import { correctionRoute } from "./fact-correction.ts";

/**
 * CC1-03 / A02 - correcting a fact has to reach the server.
 *
 * The pencil-edit control called `correctFact` on the client Zustand store in
 * every mode. It showed a success toast and an audit line, fired no network
 * request, persisted nothing, never recomputed the price, and reverted on
 * reload - so "the owner corrects it, and the correction survives" was true in
 * the UI and false in the database. It also left P03 unexercisable, because
 * there was no way to make a concurrent quantity change at all.
 *
 * This is the routing decision on its own, so the invariant is provable without
 * a browser: outside demo mode there is no local-store branch to fall into.
 */

test("A02: a quantity correction goes to the server in live mode", () => {
  const route = correctionRoute("guests", false);
  assert.equal(route.kind, "fact");
  if (route.kind !== "fact") return;
  assert.equal(route.field, "guests");
});

test("A02: a service correction goes to the service server path, not the generic one", () => {
  // setEnquiryService also updates enquiry.service_label and writes the
  // owner-asserted authority the quote boundary checks; answerEnquiryFact does
  // not, so routing the service through it would leave the label stale.
  for (const field of ["service", "Service", " service "]) {
    const route = correctionRoute(field, false);
    assert.equal(route.kind, "service", field);
  }
});

test("A02: NO field falls back to the local store in live mode", () => {
  // The defect, stated as an invariant. A correction that never leaves the
  // browser is worse than one that fails, because it claims to have worked.
  for (const field of [
    "guests",
    "service",
    "date",
    "location",
    "ready by",
    "",
    "   ",
    "anything at all",
  ]) {
    assert.notEqual(
      correctionRoute(field, false).kind,
      "demo",
      `${JSON.stringify(field)} must not be corrected client-side in live mode`,
    );
  }
});

test("demo mode keeps its scripted local behaviour, explicitly", () => {
  assert.equal(correctionRoute("guests", true).kind, "demo");
  assert.equal(correctionRoute("service", true).kind, "demo");
});
