import { withTransaction, type Sql } from "@/lib/db";
import { BUSINESSES } from "@/fixtures";

/**
 * Creating a real tenant's first workspace (server-only).
 *
 * A real workspace starts EMPTY. It gets no fixture business identity and no
 * sample enquiries.
 *
 * An earlier version of this file seeded a new account from the demo fixtures so
 * the operator would not land on a blank queue. `AGENTS.project.md` section 13
 * forbids exactly that: fixture businesses and F01/F02 enquiries are product
 * demonstrations, and writing them into a live workspace makes a real business's
 * data indistinguishable from sample data. An empty queue on day one is honest;
 * a queue full of Priya Shah is not. `/demo` remains the fixture surface.
 *
 * What a new workspace DOES get is the action-policy catalogue, every entry set
 * to "Ask every time". That is configuration, not content: section 6 says
 * autonomy is earned per action class, so the safe starting state is that
 * Enquiry may prepare anything and send nothing.
 */

/** Placeholder name until onboarding collects the real one. */
const DEFAULT_BUSINESS_NAME = "Your business";

/**
 * The catalogue of action classes the product knows about, read from the
 * fixtures purely as a schema source - the action ids, labels and risk classes
 * are product definition, not tenant data. Modes and evidence are deliberately
 * NOT copied: a new tenant has earned nothing yet.
 */
function defaultActionPolicies(): {
  action: string;
  label: string;
  risk: string;
}[] {
  const catalogue = new Map<string, { action: string; label: string; risk: string }>();
  for (const b of BUSINESSES) {
    for (const p of b.actionPolicies) {
      if (!catalogue.has(p.action)) {
        catalogue.set(p.action, { action: p.action, label: p.label, risk: p.risk });
      }
    }
  }
  return [...catalogue.values()];
}

/** Best-effort human name from an email local part, for the owner field. */
function ownerNameFromEmail(email: string | null): string {
  const local = (email ?? "").split("@")[0] ?? "";
  if (!local) return "";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function insertEmptyBusiness(
  sql: Sql,
  email: string | null,
): Promise<string> {
  const ownerName = ownerNameFromEmail(email);
  const rows = await sql<{ id: string }>`
    insert into business (name, owner_name, owner_first_name, trust_mode, pause_level)
    values (
      ${DEFAULT_BUSINESS_NAME}, ${ownerName}, ${ownerName.split(" ")[0] ?? ""},
      ${"Observe"}, ${"none"}
    )
    returning id
  `;
  const id = rows[0]?.id;
  if (!id) throw new Error("Business insert returned no id");
  return id;
}

/**
 * Create this user's first workspace and make them its owner.
 *
 * One transaction: a half-created workspace (a business with no membership row)
 * would lock the owner out of their own tenant.
 */
export async function provisionWorkspace(
  userId: string,
  email: string | null = null,
): Promise<string> {
  return withTransaction(async (sql) => {
    const businessId = await insertEmptyBusiness(sql, email);

    await sql`
      insert into business_member (business_id, user_id, role)
      values (${businessId}, ${userId}, ${"owner"})
      on conflict (business_id, user_id) do nothing
    `;

    for (const p of defaultActionPolicies()) {
      await sql`
        insert into action_policy (business_id, action, label, mode, risk)
        values (${businessId}, ${p.action}, ${p.label}, ${"Ask every time"}, ${p.risk})
        on conflict (business_id, action) do nothing
      `;
    }

    await sql`
      insert into audit_event (business_id, actor, summary, detail, object_type)
      values (
        ${businessId}, ${"system"}, ${"Workspace created"},
        ${"Empty workspace. Autonomy starts at ask-every-time for every action."},
        ${"brain"}
      )
    `;
    return businessId;
  });
}

/**
 * Provision only when this user has no workspace yet. Returns the business id
 * they should land in, existing or freshly created.
 *
 * Membership is checked first, so a double-submit or a retried request cannot
 * produce two workspaces for one person.
 */
export async function provisionIfEmpty(
  userId: string,
  email: string | null = null,
): Promise<string | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const existing = await sql<{ business_id: string }>`
    select business_id from business_member where user_id = ${userId} limit 1
  `;
  if (existing[0]) return existing[0].business_id;
  return provisionWorkspace(userId, email);
}
