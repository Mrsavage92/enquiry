import assert from "node:assert/strict";
import test from "node:test";
import { BUSINESSES } from "../../fixtures/businesses.ts";
import { businessSectionPreview, visibleBusinessServices } from "./section-preview.ts";

const business = BUSINESSES[0];

test("services preview the actual active catalogue, not generic copy", () => {
  assert.equal(
    businessSectionPreview(business, "service").preview,
    "Formal / event makeup · Group mobile makeup",
  );
});

test("pricing keeps conflicts visible without presenting either disputed price", () => {
  const result = businessSectionPreview(business, "pricing");
  assert.equal(result.needsReview, 2);
  assert.equal(result.preview, "Formal makeup · Group mobile makeup");
  assert.doesNotMatch(result.preview, /25|35|Lash/);
});

test("missing capacity rules do not imply calendar availability", () => {
  assert.equal(businessSectionPreview(business, "capacity").preview, "No active capacity rules");
});

test("another business's knowledge cannot enter the summary", () => {
  const other = structuredClone(business);
  other.knowledge = business.knowledge.map((item) => ({ ...item, businessId: "another-tenant" }));
  assert.deepEqual(businessSectionPreview(other, "pricing"), {
    preview: "No active details saved",
    needsReview: 0,
  });
});

test("superseded and proposed details are not promoted into active previews", () => {
  const copy = structuredClone(business);
  copy.knowledge = copy.knowledge.map((item) => ({ ...item, state: "Superseded" }));
  assert.equal(businessSectionPreview(copy, "pricing").preview, "No active details saved");
  copy.services = copy.services.map((service) => ({ ...service, state: "Needs review" }));
  assert.equal(businessSectionPreview(copy, "service").preview, "No active details saved");
});

test("long lists stay concise without mutating the source", () => {
  const before = structuredClone(business);
  assert.equal(
    businessSectionPreview(business, "operating").preview,
    "Travel · Mobile minimum +1 more",
  );
  assert.deepEqual(business, before);
});

test("services awaiting review remain flagged even when there are no supporting notes", () => {
  const copy = structuredClone(business);
  copy.knowledge = [];
  copy.services[0].state = "Needs review";
  const result = businessSectionPreview(copy, "service");
  assert.equal(result.needsReview, 1);
  assert.equal(result.preview, "Group mobile makeup");
});

test("saved capacity rules awaiting review are not described as unsaved", () => {
  const copy = structuredClone(business);
  copy.knowledge = [{ ...copy.knowledge[0], section: "capacity", state: "Needs review" }];
  assert.deepEqual(businessSectionPreview(copy, "capacity"), {
    preview: "No active capacity rules",
    needsReview: 1,
  });
});

test("catalogue search matches service names, labels and categories without changing data", () => {
  const before = structuredClone(business);
  assert.deepEqual(
    visibleBusinessServices(business, " GROUP ").map((service) => service.id),
    ["group-makeup"],
  );
  assert.equal(visibleBusinessServices(business, "event").length, 1);
  assert.equal(visibleBusinessServices(business, "Makeup").length, 2);
  assert.deepEqual(business, before);
});

test("catalogue search returns a truthful empty result and never fills an absent workspace", () => {
  assert.deepEqual(visibleBusinessServices(business, "not-a-service"), []);
  assert.deepEqual(visibleBusinessServices(undefined, ""), []);
});
