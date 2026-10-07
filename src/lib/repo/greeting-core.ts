import type { Sql } from "../db.ts";
import { greetedFirst, greetingLine } from "../../domain/greeting.ts";

/**
 * Recording a send whose greeting uses the name read from their message
 * confirms that reading (doc 50 6.4, doc 51 decision 2): the owner attested a
 * text that contains it. Nothing confirms it earlier. Runs inside the confirm
 * transaction, and writes no decision, so the revision the send's Undo
 * compares against is unchanged.
 */
export async function confirmGreetedName(sql: Sql, enquiryId: string, body: string): Promise<void> {
  const [read] = await sql<{ id: string; value: string }>`
    select id, value from enquiry_fact
    where enquiry_id = ${enquiryId} and lower(field) = ${"name"} and superseded = false
      and status <> ${"confirmed"}
    limit 1
  `;
  if (!read) return;
  const first = greetedFirst(String(read.value ?? ""));
  if (!first) return;
  const opening = body.replace(/\r\n?/g, "\n").trimStart().split("\n")[0]?.trim() ?? "";
  if (opening !== greetingLine(first)) return;
  await sql`
    update enquiry_fact
    set status = ${"confirmed"}, asserted_by = ${"user"},
      provenance = ${JSON.stringify({ kind: "user", label: "In a reply the owner sent" })}::jsonb,
      updated_at = now()
    where id = ${read.id}
  `;
}
