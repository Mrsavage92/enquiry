import { getSql } from "@/lib/db";
import { isUuid } from "./guard";

type Sql = Awaited<ReturnType<typeof getSql>>;

export type JoinWaitlistInput = {
  email: string;
  /** The id already stored in this browser, if any. */
  existingId: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  referrer: string;
  linkedin_post_id: string;
  first_touch: string;
  latest_touch: string;
};

export type JoinWaitlistResult = {
  id: string;
  already: boolean;
  /** True only for a brand new row, so the welcome email fires once. */
  created: boolean;
};

export type WaitlistAnswers = {
  business_type: string;
  enquiry_volume: string;
  pain_text: string;
  channels: string;
  beta_interest: string;
};

async function touchWaitlistRow(sql: Sql, id: string, input: JoinWaitlistInput) {
  await sql`
    update waitlist
    set latest_touch = ${input.latest_touch || input.first_touch},
        utm_source = coalesce(nullif(utm_source, ''), ${input.utm_source}),
        linkedin_post_id = coalesce(nullif(linkedin_post_id, ''), ${input.linkedin_post_id})
    where id = ${id}
  `;
}

/**
 * Insert or update the one waitlist row for a browser.
 *
 * `existingId` is the id already stored in this browser's localStorage, if
 * any - proof that a resubmission (for example, fixing a typo'd email) is
 * the same person, not a new signup. Without it, editing the email on an
 * already-submitted entry silently created a second row, because the lookup
 * used to find "the" entry was keyed on email alone.
 */
export async function joinWaitlistRow(
  input: JoinWaitlistInput,
  db?: Sql,
): Promise<JoinWaitlistResult> {
  const sql = db ?? (await getSql());
  const mineId = isUuid(input.existingId) ? input.existingId : null;

  if (mineId) {
    const mine = await sql<{ id: string; email: string }>`
      select id, email from waitlist where id = ${mineId} limit 1
    `;
    if (mine[0] && mine[0].email !== input.email) {
      const taken = await sql<{ id: string }>`
        select id from waitlist where email = ${input.email} and id != ${mineId} limit 1
      `;
      if (!taken[0]) {
        await sql`
          update waitlist
          set email = ${input.email},
              latest_touch = ${input.latest_touch || input.first_touch},
              utm_source = coalesce(nullif(utm_source, ''), ${input.utm_source}),
              linkedin_post_id = coalesce(nullif(linkedin_post_id, ''), ${input.linkedin_post_id})
          where id = ${mineId}
        `;
        return { id: mineId, already: false, created: false };
      }
      // The new address already belongs to a different entry; fall through
      // to the generic lookup below rather than creating a duplicate row.
    }
  }

  const existing = await sql<{ id: string }>`
    select id from waitlist where email = ${input.email} limit 1
  `;
  if (existing[0]) {
    await touchWaitlistRow(sql, existing[0].id, input);
    // Never hand back another person's waitlist id.
    return { id: "", already: true, created: false };
  }

  const id = crypto.randomUUID();
  await sql`
    insert into waitlist (
      id, email, utm_source, utm_medium, utm_campaign, utm_content,
      referrer, linkedin_post_id, first_touch, latest_touch
    ) values (
      ${id}, ${input.email}, ${input.utm_source}, ${input.utm_medium},
      ${input.utm_campaign}, ${input.utm_content}, ${input.referrer},
      ${input.linkedin_post_id}, ${input.first_touch}, ${input.latest_touch}
    )
  `;
  return { id, already: false, created: true };
}

/** Self-service removal. Knowing the id is proof of ownership. */
export async function leaveWaitlistRow(id: string, db?: Sql): Promise<{ removed: boolean }> {
  if (!isUuid(id)) return { removed: false };
  const sql = db ?? (await getSql());
  const rows = await sql<{ id: string }>`
    delete from waitlist where id = ${id} returning id
  `;
  return { removed: rows.length > 0 };
}

/**
 * The qualify-step answers already saved for a row, so "Edit your answers"
 * can open pre-filled instead of blank on a fresh page load.
 */
export async function getWaitlistAnswers(id: string, db?: Sql): Promise<WaitlistAnswers | null> {
  if (!isUuid(id)) return null;
  const sql = db ?? (await getSql());
  const rows = await sql<WaitlistAnswers>`
    select
      coalesce(business_type, '') as business_type,
      coalesce(enquiry_volume, '') as enquiry_volume,
      coalesce(pain_text, '') as pain_text,
      coalesce(channels, '') as channels,
      coalesce(beta_interest, '') as beta_interest
    from waitlist where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}
