import { getSql } from "@/lib/db";

/**
 * The tenancy boundary (server-only).
 *
 * Every read and write of product data passes through here. The rule is single
 * and absolute: a caller may only touch a business they are a member of, and
 * membership is resolved from the VERIFIED user id, never from anything the
 * client sent.
 *
 * RLS is on for these tables but the app connects as the table owner and so
 * bypasses it (see migrations/0005). That is deliberate - it keeps one clear
 * authorization story instead of two half-enforced ones - but it means this
 * module is the only thing standing between one tenant and another's data.
 * Do not add a query path that skips it.
 */

/** Raised when a caller asks for a business they are not a member of. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

/**
 * Make sure a row exists in `app_user` for this identity.
 *
 * Supabase owns `auth.users`; this is our own mirror, so the rest of the schema
 * can carry real foreign keys without reaching into the auth schema. Idempotent
 * - safe to call on every request.
 */
export async function ensureAppUser(
  userId: string,
  email: string | null,
): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into app_user (id, email, updated_at)
    values (${userId}, ${email ?? ""}, now())
    on conflict (id) do update set
      email = case when excluded.email <> '' then excluded.email else app_user.email end,
      updated_at = now()
  `;
}

/** Every business id this user belongs to. Empty when they belong to none. */
export async function listUserBusinessIds(userId: string): Promise<string[]> {
  const sql = await getSql();
  const rows = await sql<{ business_id: string }>`
    select business_id from business_member where user_id = ${userId}
  `;
  return rows.map((r) => r.business_id);
}

/**
 * Assert membership, or throw. Call this before ANY query scoped to one
 * business, and pass the returned id onward rather than the caller's string, so
 * a checked value is what reaches the query.
 */
export async function requireBusinessAccess(
  userId: string,
  businessId: string,
): Promise<string> {
  const sql = await getSql();
  const rows = await sql<{ business_id: string }>`
    select business_id from business_member
    where user_id = ${userId} and business_id = ${businessId}
    limit 1
  `;
  const found = rows[0]?.business_id;
  if (!found) throw new ForbiddenError();
  return found;
}

/**
 * Assert that an enquiry belongs to a business this user is a member of, and
 * return the owning business id.
 *
 * Resolved in ONE query joined through membership rather than "load the enquiry,
 * then check its business" - the two-step version leaks existence, and invites a
 * later edit that forgets the second step.
 */
export async function requireEnquiryAccess(
  userId: string,
  enquiryId: string,
): Promise<{ enquiryId: string; businessId: string }> {
  const sql = await getSql();
  const rows = await sql<{ id: string; business_id: string }>`
    select e.id, e.business_id
    from enquiry e
    join business_member m
      on m.business_id = e.business_id and m.user_id = ${userId}
    where e.id = ${enquiryId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError();
  return { enquiryId: row.id, businessId: row.business_id };
}

/** Same, for a booking. */
export async function requireBookingAccess(
  userId: string,
  bookingId: string,
): Promise<{ bookingId: string; businessId: string }> {
  const sql = await getSql();
  const rows = await sql<{ id: string; business_id: string }>`
    select b.id, b.business_id
    from booking b
    join business_member m
      on m.business_id = b.business_id and m.user_id = ${userId}
    where b.id = ${bookingId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new ForbiddenError();
  return { bookingId: row.id, businessId: row.business_id };
}

/**
 * Record something that happened, against a business.
 *
 * Append-only by design: the product promises the operator can always ask "why
 * did it do that, and was it allowed to", and that promise is only as good as
 * whether the write actually happened.
 */
export async function recordAudit(
  businessId: string,
  event: {
    actor: string;
    summary: string;
    detail?: string;
    objectType: "enquiry" | "trust" | "brain" | "integration" | "booking";
    objectId?: string;
  },
): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into audit_event (business_id, actor, summary, detail, object_type, object_id)
    values (
      ${businessId}, ${event.actor}, ${event.summary}, ${event.detail ?? null},
      ${event.objectType}, ${event.objectId ?? null}
    )
  `;
}
