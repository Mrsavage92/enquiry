import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

/**
 * public/og.jpg is a screenshot of /og-card, so it cannot follow offer.ts on
 * its own. These checks keep the card reading the offer rather than restating
 * it, and keep the regeneration reminder next to the prices.
 */
test("the share card reads the offer from offer.ts and states no price itself", () => {
  const card = read("src/routes/og-card.tsx");
  assert.match(card, /OFFER\.headline/);
  assert.match(card, /OFFER\.after/);
  assert.doesNotMatch(card, /A\$\d|\$\d/, "og-card.tsx must not hard-code a price");
  assert.match(card, /regenerate it/);
});

test("offer.ts reminds whoever changes a price to regenerate og.jpg", () => {
  const offer = read("src/lib/site/offer.ts");
  const reminder = offer.indexOf("regenerate it from the\n * /og-card route");
  assert.ok(reminder > 0, "the og.jpg reminder is in offer.ts");
  assert.ok(
    reminder < offer.indexOf('export const FOUNDING_PRICE = "'),
    "it sits above the prices",
  );
});
