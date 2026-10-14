import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { openUnsubscribeToken, sealUnsubscribeToken } from "./unsubscribe-token";
import { leaveWaitlistRow } from "./waitlist.server";

type Sql = Awaited<ReturnType<typeof getSql>>;

const SECRET_SETTING_KEY = "waitlist_unsubscribe_secret";
const SECRET_BYTES = 32;

/** The public page an unsubscribe link in the email body opens. */
export const UNSUBSCRIBE_PAGE_PATH = "/unsubscribe";
/** The RFC 8058 one-click endpoint named in the List-Unsubscribe header. */
export const UNSUBSCRIBE_API_PATH = "/api/unsubscribe";

let cachedSecret = "";

async function readSecret(sql: Sql): Promise<string> {
  const rows = await sql<{ value: string }>`
    select value from launch_settings where key = ${SECRET_SETTING_KEY} limit 1
  `;
  return rows[0]?.value ?? "";
}

/**
 * The sealing secret: `WAITLIST_UNSUBSCRIBE_SECRET` if set, otherwise a
 * random secret kept in launch_settings, created on first use so links work
 * without the owner having to configure anything. Read first and insert only
 * when missing, then cached for the life of the instance, so a signup costs
 * no query once warm. "" means it could not be read or created, and the
 * caller must not send a list email without a link.
 *
 * Rotating the secret (changing the env var or the launch_settings row)
 * invalidates every unsubscribe link already sent. Do not rotate it unless a
 * leak forces it; people then unsubscribe by replying instead.
 */
export async function unsubscribeSecret(db?: Sql): Promise<string> {
  const fromEnv = process.env.WAITLIST_UNSUBSCRIBE_SECRET ?? "";
  if (fromEnv) return fromEnv;
  if (cachedSecret) return cachedSecret;
  try {
    const sql = db ?? (await getSql());
    let value = await readSecret(sql);
    if (!value) {
      await sql`
        insert into launch_settings (key, value)
        values (${SECRET_SETTING_KEY}, ${randomBytes(SECRET_BYTES).toString("hex")})
        on conflict (key) do nothing
      `;
      value = await readSecret(sql);
    }
    cachedSecret = value;
    return value;
  } catch (error) {
    console.error("[unsubscribe] could not read or create the secret", error);
    return "";
  }
}

/** Test seam: forget the cached secret. */
export function resetUnsubscribeSecretCache(): void {
  cachedSecret = "";
}

export type UnsubscribeLinks = { page: string; oneClick: string };

/** Both unsubscribe URLs for one row, or null when no secret is available. */
export async function unsubscribeLinks(
  waitlistId: string,
  origin: string,
  db?: Sql,
): Promise<UnsubscribeLinks | null> {
  const secret = await unsubscribeSecret(db);
  if (!secret) return null;
  const token = encodeURIComponent(sealUnsubscribeToken(waitlistId, secret));
  return {
    page: `${origin}${UNSUBSCRIBE_PAGE_PATH}?t=${token}`,
    oneClick: `${origin}${UNSUBSCRIBE_API_PATH}?t=${token}`,
  };
}

export type UnsubscribeOutcome = "removed" | "already-removed" | "invalid";

/**
 * Remove the one waitlist row a genuine token names, exactly as the
 * in-page "Remove me from the list" does (a hard delete). A forged or
 * edited token removes nothing.
 */
export async function unsubscribeByToken(token: string, db?: Sql): Promise<UnsubscribeOutcome> {
  const sql = db ?? (await getSql());
  const secret = await unsubscribeSecret(sql);
  const id = openUnsubscribeToken(token, secret);
  if (!id) return "invalid";
  const { removed } = await leaveWaitlistRow(id, sql);
  return removed ? "removed" : "already-removed";
}
