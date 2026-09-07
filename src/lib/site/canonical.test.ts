import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalLink, canonicalUrl, SITE_ORIGIN } from "./canonical.ts";

test("SITE_ORIGIN has no trailing slash", () => {
  assert.equal(SITE_ORIGIN.endsWith("/"), false);
});

test("canonicalUrl joins the origin and path with no double slash", () => {
  assert.equal(canonicalUrl("/"), "https://enquiry-ashy.vercel.app/");
  assert.equal(canonicalUrl("/how"), "https://enquiry-ashy.vercel.app/how");
});

test("canonicalLink returns a canonical rel entry for a route's head links", () => {
  assert.deepEqual(canonicalLink("/roadmap"), {
    rel: "canonical",
    href: "https://enquiry-ashy.vercel.app/roadmap",
  });
});
