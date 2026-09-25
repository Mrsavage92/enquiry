import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook for the founding plan.
 *
 * Verifies the signature against the raw body before reading anything, then
 * records the member. 503 until a signing secret exists, 400 on a bad
 * signature (Stripe shows a failed delivery), 200 on anything verified,
 * including events we ignore, so Stripe does not retry them.
 */
export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyStripeSignature } = await import("@/lib/billing/stripe-signature");
        const { readFoundingEvent, applyFoundingEvent, stripeWebhookSecret } =
          await import("@/lib/billing/founding.server");
        const { notifyOwner, reportServerError } = await import("@/lib/server/alert");
        const raw = await request.text();
        const secret = await stripeWebhookSecret();
        if (!secret) return new Response("Webhook not configured", { status: 503 });
        if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
          return new Response("Bad signature", { status: 400 });
        }
        try {
          const event = readFoundingEvent(JSON.parse(raw));
          const outcome = await applyFoundingEvent(event);
          if (outcome === "joined" && event.kind === "joined") {
            notifyOwner(`New founding member: ${event.email}`);
          }
          return new Response("ok", { status: 200 });
        } catch (error) {
          reportServerError({ scope: "stripeWebhook", error });
          return new Response("Could not record", { status: 500 });
        }
      },
    },
  },
});
