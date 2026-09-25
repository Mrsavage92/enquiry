import { getSql } from "@/lib/db";

type Sql = Awaited<ReturnType<typeof getSql>>;

export type FoundingEvent =
  | { kind: "joined"; email: string; customerId: string | null; subscriptionId: string | null }
  | { kind: "status"; subscriptionId: string; status: string }
  | { kind: "ignored" };

const normalise = (email: unknown) => (typeof email === "string" ? email.trim().toLowerCase() : "");

/**
 * Reduce a verified Stripe event to what the founding plan needs.
 *
 * checkout.session.completed from a Payment Link carries the buyer's email and
 * the new subscription; subscription updates and deletions carry its status.
 * Everything else is ignored, so adding more webhook events in the Stripe
 * dashboard can never change who has access.
 */
export function readFoundingEvent(event: unknown): FoundingEvent {
  const e = (event ?? {}) as { type?: string; data?: { object?: Record<string, unknown> } };
  const obj = e.data?.object ?? {};
  if (e.type === "checkout.session.completed") {
    const details = (obj.customer_details ?? {}) as Record<string, unknown>;
    const email = normalise(details.email ?? obj.customer_email);
    if (!email) return { kind: "ignored" };
    return {
      kind: "joined",
      email,
      customerId: typeof obj.customer === "string" ? obj.customer : null,
      subscriptionId: typeof obj.subscription === "string" ? obj.subscription : null,
    };
  }
  if (e.type === "customer.subscription.updated" || e.type === "customer.subscription.deleted") {
    const id = typeof obj.id === "string" ? obj.id : "";
    if (!id) return { kind: "ignored" };
    const status =
      e.type === "customer.subscription.deleted"
        ? "cancelled"
        : typeof obj.status === "string"
          ? obj.status
          : "active";
    return { kind: "status", subscriptionId: id, status };
  }
  return { kind: "ignored" };
}

/** Apply one event. Idempotent: Stripe retries, and a replay changes nothing. */
export async function applyFoundingEvent(
  ev: FoundingEvent,
  db?: Sql,
): Promise<"joined" | "updated" | "ignored"> {
  if (ev.kind === "ignored") return "ignored";
  const sql = db ?? (await getSql());
  if (ev.kind === "joined") {
    await sql`
      insert into founding_member (email, status, source, stripe_customer_id, stripe_subscription_id)
      values (${ev.email}, 'active', 'stripe', ${ev.customerId}, ${ev.subscriptionId})
      on conflict (email) do update set
        status = 'active',
        stripe_customer_id = coalesce(excluded.stripe_customer_id, founding_member.stripe_customer_id),
        stripe_subscription_id = coalesce(excluded.stripe_subscription_id, founding_member.stripe_subscription_id),
        updated_at = now()
    `;
    return "joined";
  }
  const rows = await sql<{ email: string }>`
    update founding_member set status = ${ev.status}, updated_at = now()
    where stripe_subscription_id = ${ev.subscriptionId}
    returning email
  `;
  return rows.length > 0 ? "updated" : "ignored";
}

/** Access states that may create a workspace. Stripe's past_due keeps access. */
const ACCESS_STATES = new Set(["active", "trialing", "past_due"]);

export async function isFoundingMember(email: string | null, db?: Sql): Promise<boolean> {
  const address = normalise(email);
  if (!address) return false;
  const sql = db ?? (await getSql());
  const rows = await sql<{ status: string }>`
    select status from founding_member where email = ${address} limit 1
  `;
  return rows.length > 0 && ACCESS_STATES.has(rows[0].status);
}

async function launchSetting(key: string, db?: Sql): Promise<string> {
  try {
    const sql = db ?? (await getSql());
    const rows = await sql<{ value: string }>`
      select value from launch_settings where key = ${key} limit 1
    `;
    return rows[0]?.value ?? "";
  } catch {
    return "";
  }
}

/**
 * Whether new workspaces require a founding membership. Off until the owner
 * turns it on (launch_settings.founding_gate = 'on'), so the current invited
 * flow keeps working until payments are live.
 */
export async function foundingGateOn(db?: Sql): Promise<boolean> {
  return (await launchSetting("founding_gate", db)) === "on";
}

/** Signing secret: env first, then the launch_settings row. */
export async function stripeWebhookSecret(db?: Sql): Promise<string> {
  return process.env.STRIPE_WEBHOOK_SECRET || (await launchSetting("stripe_webhook_secret", db));
}
