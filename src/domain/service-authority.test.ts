import assert from "node:assert/strict";
import test from "node:test";
import { needsServiceConfirmation, serviceAuthority } from "./service-authority.ts";
import type { Enquiry, EnquiryFact, FactStatus } from "./types.ts";

/**
 * CC1-03 / A03 - the desk and the server must agree on whether a service has
 * been confirmed. The server already refused an unconfirmed one; this is the
 * read the UI uses so it stops offering a button the server will refuse.
 */

const fact = (status: FactStatus, superseded = false): EnquiryFact => ({
  id: "f1",
  field: "service",
  label: "service",
  value: "Group makeup",
  displayValue: "Group makeup",
  status,
  confidence: "High",
  assertedBy: status === "confirmed" ? "user" : "system",
  provenance: { kind: status === "confirmed" ? "user" : "model", label: "" },
  superseded,
});

const enquiry = (facts: EnquiryFact[], serviceLabel = "Group makeup") =>
  ({ facts, serviceLabel }) as Pick<Enquiry, "facts" | "serviceLabel">;

test("A02: an owner-confirmed service needs no further confirmation", () => {
  const e = enquiry([fact("confirmed")]);
  assert.equal(serviceAuthority(e).state, "confirmed");
  assert.equal(needsServiceConfirmation(e), false);
});

test("A01: a model-proposed service needs confirmation", () => {
  for (const status of ["check_this", "inferred", "unknown", "conflict", "range"] as const) {
    const e = enquiry([fact(status)]);
    assert.equal(serviceAuthority(e).state, "proposed", status);
    assert.equal(needsServiceConfirmation(e), true, status);
  }
});

test("A03: a bare legacy label with no fact behind it needs confirmation", () => {
  // The case that had no control at all: the server refuses the quote and the
  // desk offered nowhere to resolve it.
  const e = enquiry([]);
  const authority = serviceAuthority(e);
  assert.equal(authority.state, "unattributed");
  if (authority.state !== "unattributed") return;
  assert.equal(authority.label, "Group makeup");
  assert.equal(needsServiceConfirmation(e), true);
});

test("A03: a superseded confirmation does not count as confirmed", () => {
  const e = enquiry([fact("confirmed", true)]);
  assert.equal(serviceAuthority(e).state, "unattributed");
  assert.equal(needsServiceConfirmation(e), true);
});

test("no service named at all is absent, not a confirmation prompt", () => {
  const e = enquiry([], "");
  assert.equal(serviceAuthority(e).state, "absent");
  assert.equal(
    needsServiceConfirmation(e),
    false,
    "there is nothing to confirm - this enquiry needs a service, not a confirmation",
  );
});

test("a fact for a different field never resolves the service", () => {
  const e = enquiry([{ ...fact("confirmed"), field: "guests" }]);
  assert.equal(serviceAuthority(e).state, "unattributed");
});
