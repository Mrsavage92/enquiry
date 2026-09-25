import { createHmac, timingSafeEqual } from "node:crypto";

/** Stripe's default replay window. */
export const STRIPE_TOLERANCE_SECONDS = 300;

/**
 * Verify a Stripe-Signature header against the raw request body.
 *
 * Stripe signs `${timestamp}.${rawBody}` with HMAC-SHA256 using the endpoint's
 * signing secret and sends `t=<timestamp>,v1=<hex>[,v1=<hex>]`. Implemented
 * here rather than through the Stripe SDK so the webhook adds no dependency;
 * the scheme is documented at https://docs.stripe.com/webhooks#verify-manually.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value ?? "";
    if (key === "v1" && value) signatures.push(value);
  }
  const t = Number(timestamp);
  if (!timestamp || !Number.isFinite(t) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - t) > STRIPE_TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
