import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Sql } from "../db.ts";
import { createEnquiryAndRead, type IntakeDeps } from "./enquiry-intake-core.ts";
import { requireBusinessAccess } from "./tenancy.server.ts";

/**
 * A business's own website form, posting enquiries straight in (server-only).
 *
 * POST /api/inbound/form carries an inbound key: a random secret scoped to one
 * business that can do exactly one thing, create a new enquiry for that
 * business. It cannot read anything back, so it is safe in a public website
 * bundle in the same way a web3forms access key is. Only its SHA-256 hash is
 * stored (migrations/0016), so the business is found by hashing what was sent.
 *
 * Every accepted submission goes through `createEnquiryAndRead`, the same
 * function an owner's pasted enquiry goes through, so the decision engine runs
 * identically for both. The customer's chosen service is sent as part of the
 * enquiry text, never as the owner-confirmed service: a website visitor's pick
 * is something to read, not something the owner has agreed to.
 *
 * Every function takes the query surface as a parameter so the whole path is
 * proven against a real database in inbound-form.db.test.ts.
 */

const KEY_PREFIX = "enqin_";
const KEY_PATTERN = /^enqin_[A-Za-z0-9_-]{43}$/;
/** Largest request body read. A form submission is a few hundred bytes. */
export const MAX_INBOUND_BYTES = 16_000;
/** Accepted submissions per business per hour. */
export const KEY_LIMIT_PER_HOUR = 30;
/** Accepted submissions per visitor (hashed IP) per business per hour. */
export const IP_LIMIT_PER_HOUR = 5;
/** Most origins one business may allow. */
export const MAX_ORIGINS = 5;
/** How long a submission id is remembered for replay protection. */
const SUBMISSION_RETENTION_DAYS = 30;

const INTAKE_NOTE = "Sent from your website form";

export function hashInboundKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function generateInboundKey(): string {
  return KEY_PREFIX + randomBytes(32).toString("base64url");
}

function hashIp(businessId: string, ip: string): string {
  return ip ? createHash("sha256").update(`${businessId}:${ip}`, "utf8").digest("hex") : "";
}

/**
 * `https://www.example.com.au` from anything an owner types, or null. Only
 * the scheme and host count: a browser's Origin header never carries a path.
 * Plain http is accepted for localhost alone, for testing a form locally.
 */
export function normalizeOrigin(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.length > 200) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.username || url.password) return null;
  if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) return null;
  return url.origin;
}

// ---------------------------------------------------------------------------
// The payload
// ---------------------------------------------------------------------------

export const InboundFormSchema = z.object({
  submissionId: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().max(320).pipe(z.email()),
  phone: z.string().trim().max(40).optional().default(""),
  service: z.string().trim().max(200).optional().default(""),
  eventDetails: z.string().trim().max(1000).optional().default(""),
  message: z.string().trim().min(1).max(4000),
  privacyConsent: z.literal(true),
  honeypot: z.string().max(500).optional().default(""),
  key: z.string().max(200).optional(),
});

export type InboundForm = z.infer<typeof InboundFormSchema>;

/** The enquiry text: what they wrote, then what they picked in the form. */
export function composeInboundBody(form: InboundForm): string {
  const lines = [form.message];
  const extras = [
    form.service ? `Service: ${form.service}` : "",
    form.eventDetails ? `Event details: ${form.eventDetails}` : "",
  ].filter(Boolean);
  if (extras.length) lines.push("", ...extras);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// A cheap per-instance limiter, in front of the database
// ---------------------------------------------------------------------------

/**
 * Fixed-window counter per IP, held in memory. It only exists to stop one
 * client hammering the key lookup from a warm instance; the limits that
 * actually bound enquiry creation are counted in the database, where every
 * serverless instance sees the same rows.
 */
export function createWindowLimiter(limit: number, windowMs: number, maxEntries = 5_000) {
  const hits = new Map<string, { count: number; start: number }>();
  return (id: string, now = Date.now()): boolean => {
    const entry = hits.get(id);
    if (!entry || now - entry.start >= windowMs) {
      if (hits.size >= maxEntries) hits.clear();
      hits.set(id, { count: 1, start: now });
      return true;
    }
    if (entry.count >= limit) return false;
    hits.set(id, { count: entry.count + 1, start: entry.start });
    return true;
  };
}

// ---------------------------------------------------------------------------
// The endpoint
// ---------------------------------------------------------------------------

export type InboundDeps = IntakeDeps & {
  /** Returns false when this IP has made too many requests just now. */
  allowIp?: (ip: string) => boolean;
};

type InboundBusiness = { businessId: string; allowedOrigins: string[] };

async function businessForKey(sql: Sql, key: string): Promise<InboundBusiness | null> {
  if (!KEY_PATTERN.test(key)) return null;
  const rows = await sql<{ business_id: string; allowed_origins: string[] | null }>`
    select business_id, allowed_origins from business_inbound
    where key_hash = ${hashInboundKey(key)}
    limit 1
  `;
  const row = rows[0];
  return row ? { businessId: row.business_id, allowedOrigins: row.allowed_origins ?? [] } : null;
}

async function originAllowedAnywhere(sql: Sql, origin: string): Promise<boolean> {
  const rows = await sql<{ ok: number }>`
    select 1 as ok from business_inbound where ${origin} = any(allowed_origins) limit 1
  `;
  return rows.length > 0;
}

function corsHeaders(origin: string | null, allowed: boolean): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  if (origin && allowed) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-Enquiry-Key";
    headers["Access-Control-Max-Age"] = "600";
  }
  return headers;
}

function reply(status: number, ok: boolean, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ ok }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
  });
}

/** The client's IP as Vercel reports it. Empty when unknown. */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded ?? "").slice(0, 64);
}

/**
 * Handle one request to /api/inbound/form. Responses never say why a request
 * was refused beyond the status code: 401 unknown key, 403 origin not allowed
 * for that key, 400 invalid payload (the honeypot included), 413 too large,
 * 429 too many, 202 accepted (or already accepted).
 */
export async function handleInboundForm(request: Request, deps: InboundDeps): Promise<Response> {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    const allowed = origin ? await originAllowedAnywhere(deps.sql, origin) : false;
    return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
  }
  if (request.method !== "POST") return reply(405, false, corsHeaders(origin, false));

  const ip = clientIp(request);
  if (deps.allowIp && !deps.allowIp(ip || "unknown")) {
    return reply(429, false, corsHeaders(origin, false));
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_INBOUND_BYTES) return reply(413, false, corsHeaders(origin, false));
  const raw = await request.text();
  if (raw.length > MAX_INBOUND_BYTES) return reply(413, false, corsHeaders(origin, false));

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return reply(400, false, corsHeaders(origin, false));
  }
  const record = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;

  const headerKey = request.headers.get("x-enquiry-key")?.trim() ?? "";
  const bodyKey = typeof record.key === "string" ? record.key.trim() : "";
  const business = await businessForKey(deps.sql, headerKey || bodyKey);
  if (!business) return reply(401, false, corsHeaders(origin, false));

  // A browser always sends Origin on a cross-origin POST; it must be one this
  // business allowed. A request with no Origin is not from a browser page, and
  // CORS has nothing to say about it: the key alone authorises it.
  const originOk = !origin || business.allowedOrigins.includes(origin);
  const cors = corsHeaders(origin, originOk);
  if (!originOk) return reply(403, false, cors);

  // Checked on the raw payload, before any other validation, so a bot that
  // also fails the schema is refused for the same reason either way.
  if (typeof record.honeypot === "string" && record.honeypot.trim() !== "") {
    return reply(400, false, cors);
  }
  const parsed = InboundFormSchema.safeParse(payload);
  if (!parsed.success) return reply(400, false, cors);
  const form = parsed.data;
  const { businessId } = business;

  const seen = await deps.sql<{ submission_id: string }>`
    select submission_id from inbound_submission
    where business_id = ${businessId} and submission_id = ${form.submissionId}
    limit 1
  `;
  if (seen.length > 0) return reply(202, true, cors);

  const ipHash = hashIp(businessId, ip);
  const [counts] = await deps.sql<{ by_key: number; by_ip: number }>`
    select
      count(*)::int as by_key,
      count(*) filter (where ip_hash = ${ipHash} and ${ipHash} <> '')::int as by_ip
    from inbound_submission
    where business_id = ${businessId} and received_at > now() - interval '1 hour'
  `;
  if ((counts?.by_key ?? 0) >= KEY_LIMIT_PER_HOUR || (counts?.by_ip ?? 0) >= IP_LIMIT_PER_HOUR) {
    return reply(429, false, cors);
  }

  await createEnquiryAndRead(
    deps,
    {
      businessId,
      body: composeInboundBody(form),
      customerName: form.name,
      customerEmail: form.email,
      customerPhone: form.phone,
      serviceLabel: "",
      intakeNote: INTAKE_NOTE,
      source: "form",
    },
    { actor: "website-form", summary: "Enquiry arrived from your website form" },
    {
      // Claimed inside the creating transaction: a concurrent duplicate waits
      // on the primary key, then finds it taken and creates nothing.
      claim: async (tx) => {
        const claimed = await tx<{ submission_id: string }>`
          insert into inbound_submission (business_id, submission_id, ip_hash)
          values (${businessId}, ${form.submissionId}, ${ipHash})
          on conflict (business_id, submission_id) do nothing
          returning submission_id
        `;
        return claimed.length > 0;
      },
      link: async (tx, enquiryId) => {
        await tx`
          update inbound_submission set enquiry_id = ${enquiryId}
          where business_id = ${businessId} and submission_id = ${form.submissionId}
        `;
        await tx`
          delete from inbound_submission
          where business_id = ${businessId}
            and received_at < now() - make_interval(days => ${SUBMISSION_RETENTION_DAYS})
        `;
      },
    },
  );
  return reply(202, true, cors);
}

// ---------------------------------------------------------------------------
// The owner's side: see, rotate and scope the key
// ---------------------------------------------------------------------------

export type InboundKeyStatus = {
  hasKey: boolean;
  keyHint: string;
  allowedOrigins: string[];
  rotatedAt: string | null;
};

export async function inboundKeyStatusForUser(
  sql: Sql,
  userId: string,
  businessId: string,
): Promise<InboundKeyStatus> {
  const id = await requireBusinessAccess(userId, businessId, sql);
  const rows = await sql<{ key_hint: string; allowed_origins: string[]; rotated_at: string }>`
    select key_hint, allowed_origins, rotated_at::text as rotated_at
    from business_inbound where business_id = ${id}
  `;
  const row = rows[0];
  if (!row) return { hasKey: false, keyHint: "", allowedOrigins: [], rotatedAt: null };
  return {
    hasKey: true,
    keyHint: row.key_hint,
    allowedOrigins: row.allowed_origins ?? [],
    rotatedAt: row.rotated_at,
  };
}

/**
 * Create the business's inbound key, or replace it. The new key is returned
 * this once and never stored; the old one stops working at once. Allowed
 * origins are kept across a rotation.
 */
export async function rotateInboundKeyForUser(
  sql: Sql,
  userId: string,
  businessId: string,
): Promise<{ key: string; keyHint: string }> {
  const id = await requireBusinessAccess(userId, businessId, sql);
  const key = generateInboundKey();
  const keyHint = key.slice(-4);
  await sql`
    insert into business_inbound (business_id, key_hash, key_hint)
    values (${id}, ${hashInboundKey(key)}, ${keyHint})
    on conflict (business_id) do update set
      key_hash = excluded.key_hash,
      key_hint = excluded.key_hint,
      rotated_at = now()
  `;
  return { key, keyHint };
}

/** Which website origins may post with this business's key. */
export async function setInboundOriginsForUser(
  sql: Sql,
  userId: string,
  businessId: string,
  origins: unknown,
): Promise<string[]> {
  const id = await requireBusinessAccess(userId, businessId, sql);
  if (!Array.isArray(origins)) throw new Error("List the website addresses, one per line.");
  const cleaned: string[] = [];
  for (const raw of origins) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const origin = normalizeOrigin(raw);
    if (!origin) throw new Error(`"${raw.trim().slice(0, 80)}" is not a website address.`);
    if (!cleaned.includes(origin)) cleaned.push(origin);
  }
  if (cleaned.length > MAX_ORIGINS) {
    throw new Error(`At most ${MAX_ORIGINS} website addresses.`);
  }
  const rows = await sql<{ business_id: string }>`
    update business_inbound set allowed_origins = ${cleaned}
    where business_id = ${id}
    returning business_id
  `;
  if (rows.length === 0) throw new Error("Create a website form key first.");
  return cleaned;
}
