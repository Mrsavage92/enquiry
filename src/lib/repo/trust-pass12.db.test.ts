import assert from "node:assert/strict";
import test from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { ForbiddenError } from "./tenancy.server.ts";
import { confirmReviewedSendInTransaction } from "./sent-reply-core.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import { warningsKey } from "../../domain/edit-warnings.ts";
import { readBusinessDetails } from "../../domain/business-details-read.ts";
import {
  WED_30_SEP,
  answer,
  enquiry,
  freshDb,
  row,
  send,
  sendAs,
  settle,
  tell,
  tenant,
  tx,
} from "./pass8-db-helpers.ts";

/**
 * Trust pass 12, against a real database: the review of PR #80 (FIX FIRST).
 * Every reply that reaches a customer goes through
 * `prepareReviewedSendInTransaction`, and every send is recorded through
 * `confirmReviewedSendInTransaction`. A second tenant is refused and moves
 * nothing.
 */

const CLEANING = [
  "Regular house clean is $55 an hour, minimum 3 hours",
  "End of lease clean 2 bedroom $380",
  "End of lease clean 3 bedroom $480",
  "Oven clean $60",
  "Fridge clean $40",
  "Inside windows $8 per window",
  "Weekend jobs have a 20% surcharge",
  "We don't work Sundays",
  "Closed 24 December to 4 January",
  "We have $10 million public liability insurance",
].join("\n");

const MEL =
  "hey there!! need an end of lease clean for my 3 bed unit in Chermside, moving out Fri 16th Oct. can u also do the oven + fridge?? how much all up. cheers Mel";
const JASE =
  "EOL clean 2br unit, settlement 28/12 so need it done 27th or 28th. oven too. $$? ta Jase";

type Asked = { id: string; text: string; status: string };

async function setup(t: { after: (fn: () => Promise<void>) => void }, business = CLEANING) {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Dana Clean");
  await tenant(pg, "user-b", "Bravo");
  await tell(pg, a.businessId, business);
  return { pg, a };
}

async function ledger(pg: PGlite, enquiryId: string): Promise<Asked[]> {
  return (
    ((await row(pg, enquiryId)).decision_snapshot as unknown as { asked?: Asked[] }).asked ?? []
  );
}

async function settleDays(pg: PGlite, enquiryId: string, closedChoice = "not_available") {
  for (const item of await ledger(pg, enquiryId)) {
    if (item.status !== "open") continue;
    if (item.id.startsWith("closed_day:"))
      await answer(pg, "user-a", enquiryId, item.id, closedChoice);
    if (item.id.startsWith("date_check:"))
      await answer(pg, "user-a", enquiryId, item.id, "confirm");
  }
}

async function settleAndSend(
  pg: PGlite,
  businessId: string,
  enquiryId: string,
  answers: Record<string, string> = {},
  checks: [RegExp, string][] = [],
) {
  await settle(pg, enquiryId, { answers, checks });
  await settleDays(pg, enquiryId);
  await settle(pg, enquiryId, { answers, checks });
  return send(pg, businessId, enquiryId);
}

async function confirm(
  pg: PGlite,
  businessId: string,
  enquiryId: string,
  reviewedSendId: string,
  opts: { stale?: boolean; ack?: string } = {},
) {
  return tx(pg, (sql) =>
    confirmReviewedSendInTransaction(sql, {
      reviewedSendId,
      enquiryId,
      businessId,
      userId: "user-a",
      staleAttestation: opts.stale ?? false,
      ...(opts.ack ? { acknowledgedWarnings: opts.ack } : {}),
      now: WED_30_SEP,
    }),
  );
}

async function prepare(pg: PGlite, businessId: string, enquiryId: string, body: string) {
  return tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId,
      businessId,
      userId: "user-a",
      body,
      channel: "manual",
      now: WED_30_SEP,
    }),
  );
}

async function outbound(pg: PGlite, enquiryId: string): Promise<number> {
  const r = await pg.query(
    "select 1 from message where enquiry_id = $1 and direction = 'outbound'",
    [enquiryId],
  );
  return r.rows.length;
}

const at = (day: string) => new Date(`${day}T10:15:00+10:00`);

// ---------------------------------------------------------------------------
// H1. One reading of weekday words, in the reader and the sweep alike
// ---------------------------------------------------------------------------

test("H1: 'next Thursday' on Friday 2 October is Thursday 8 October in the reply that is sent", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, could you do a regular clean next Thursday? 3 hours should do it. Thanks, Liz",
    "Regular house clean",
    at("2026-10-02"),
  );
  assert.equal((await row(pg, e.enquiryId)).date_label, "Thu 8 Oct");
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId, {
    "number of hours": "3",
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /Thursday 8 October/);
  assert.doesNotMatch(body, /15 October/);
});

test("H1: 'any chance next Tuesday?' on Wednesday 30 September is Tuesday 6 October", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, oven clean please, any chance next Tuesday? Sam",
    "Oven clean",
  );
  assert.equal((await row(pg, e.enquiryId)).date_label, "Tue 6 Oct");
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /Tuesday 6 October/);
  assert.doesNotMatch(body, /13 October/);
});

// ---------------------------------------------------------------------------
// H2. A "jobs over" discount is a line of its own
// ---------------------------------------------------------------------------

const BIG_OFF = [
  "Oven clean $250",
  "Fridge clean $250",
  "Inside windows $250",
  "Jobs over $600 get $300 off",
].join("\n");

test("H2: '$300 off jobs over $600' is its own line, no job line goes negative, and the app's own reply sends", async (t) => {
  const { pg, a } = await setup(t, BIG_OFF);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, can you quote an oven clean, a fridge clean and the inside windows? Thanks, Jo",
    "Oven clean",
  );
  const { body, sent, snapshot } = await settleAndSend(pg, a.businessId, e.enquiryId, {}, [
    [/over \$600/, "apply"],
  ]);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(sent.ok && sent.amountMinor, 45_000);
  assert.match(
    body,
    /- Oven clean: \$250\n- Fridge clean: \$250\n- Inside windows: \$250\n- \$300 off jobs over \$600: -\$300/,
  );
  assert.doesNotMatch(body, /-\$50/);
  type Line = { label: string; amountMinor: number; adjustment?: boolean };
  const s = snapshot as unknown as { lines?: Line[]; price?: { lines?: Line[] } };
  const lines = s.lines ?? s.price?.lines ?? [];
  assert.equal(lines.length, 4, JSON.stringify(lines));
  for (const l of lines) {
    if (l.adjustment) assert.equal(l.amountMinor, -30_000, JSON.stringify(l));
    else assert.equal(l.amountMinor, 25_000, JSON.stringify(l));
  }
  // Said in the owner's own words beside its own label, the amount off stands.
  const own = body.replace("- $300 off jobs over $600: -$300", "- Less $300 for jobs over $600");
  const kept = await sendAs(pg, a.businessId, e.enquiryId, own);
  assert.equal(kept.ok, true, JSON.stringify(kept));
  // Taken off a service line instead, it is refused.
  const wrong = body.replace("- Oven clean: $250", "- Oven clean: -$300");
  const refused = await sendAs(pg, a.businessId, e.enquiryId, wrong);
  assert.equal(!refused.ok && refused.reason, "amount_mismatch");
  // Another tenant cannot take the discount, and nothing moves.
  const before = await row(pg, e.enquiryId);
  await assert.rejects(
    answer(pg, "user-b", e.enquiryId, "rule:discount:over:600:300", "waive"),
    ForbiddenError,
  );
  assert.deepEqual(await row(pg, e.enquiryId), before);
});

test("H2: '$490 off jobs over $500' on a $580 job is a $90 total, never a -$10 line", async (t) => {
  const { pg, a } = await setup(
    t,
    [
      "End of lease clean 3 bedroom $480",
      "Oven clean $60",
      "Fridge clean $40",
      "Jobs over $500 get $490 off",
    ].join("\n"),
  );
  const e = await enquiry(pg, a.businessId, MEL, "End of lease clean 3 bedroom");
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId, {}, [
    [/over \$500/, "apply"],
  ]);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(sent.ok && sent.amountMinor, 9_000);
  assert.match(body, /- \$490 off jobs over \$500: -\$490/);
  assert.doesNotMatch(body, /-\$10\b/);
});

// ---------------------------------------------------------------------------
// H3 / M1. "Send anyway" is bound to the list shown, and works for an older message
// ---------------------------------------------------------------------------

test("H3: an older message already sent, with things to check, can be recorded - checked against the reply it was written over", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, JASE, "End of lease clean 2 bedroom");
  const first = await settleAndSend(pg, a.businessId, e.enquiryId);
  assert.equal(first.sent.ok, true, JSON.stringify(first.sent));
  assert.match(first.body, /I'm not available on/);
  const edited = first.body.replace("\n\nThanks,", "\n\nHappy to do the oven too.\n\nThanks,");
  const prepared = await prepare(pg, a.businessId, e.enquiryId, edited);
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) return;
  assert.deepEqual(prepared.warnings, [
    '"Happy to do" - a booking promise - nothing has checked your calendar.',
  ]);
  const stored = await pg.query<{ draft_body: string }>(
    "select draft_body from reviewed_send where id = $1",
    [prepared.reviewedSendId],
  );
  assert.equal(stored.rows[0]!.draft_body, first.body);
  // The owner then says they can do those days: the decision moves on, and the
  // prepared reply no longer says "not available".
  for (const item of await ledger(pg, e.enquiryId)) {
    if (item.id.startsWith("closed_day:")) {
      await answer(pg, "user-a", e.enquiryId, item.id, "available");
    }
  }
  const moved = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.doesNotMatch(moved, /not available/);
  // "I already sent that older message", with no "I've checked these": refused, with the list.
  const unchecked = await confirm(pg, a.businessId, e.enquiryId, prepared.reviewedSendId, {
    stale: true,
  });
  assert.equal(!unchecked.ok && unchecked.reason, "warnings");
  assert.deepEqual(!unchecked.ok && unchecked.warnings, prepared.warnings);
  // Checked: recorded, and the app's own older sentences are never warned about.
  const done = await confirm(pg, a.businessId, e.enquiryId, prepared.reviewedSendId, {
    stale: true,
    ack: warningsKey(prepared.warnings),
  });
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.equal(done.ok && done.stale, true);
  assert.equal(await outbound(pg, e.enquiryId), 1);
});

test("M1: 'Send anyway' for one list never records a send over a longer one", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, MEL, "End of lease clean 3 bedroom");
  const first = await settleAndSend(pg, a.businessId, e.enquiryId);
  assert.equal(first.sent.ok, true, JSON.stringify(first.sent));
  const edited = first.body.replace(
    "\n\nThanks,",
    "\n\nSee you then. If it suits, Saturday 17 October is fine too.\n\nThanks,",
  );
  const prepared = await prepare(pg, a.businessId, e.enquiryId, edited);
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) return;
  const shown = prepared.warnings;
  assert.ok(shown.some((w) => w.startsWith('"See you then"')));
  assert.ok(!shown.some((w) => w.includes("17 October")), JSON.stringify(shown));
  // In another tab, the owner closes 17 to 18 October.
  await tell(pg, a.businessId, "Closed 17 October to 18 October");
  const stale =
    Number((await row(pg, e.enquiryId)).decision_revision) !== prepared.decisionRevision;
  const refused = await confirm(pg, a.businessId, e.enquiryId, prepared.reviewedSendId, {
    stale,
    ack: warningsKey(shown),
  });
  assert.equal(!refused.ok && refused.reason, "warnings", JSON.stringify(refused));
  const grown = !refused.ok ? (refused.warnings ?? []) : [];
  assert.ok(
    grown.some((w) => w.includes("Saturday 17 October")),
    JSON.stringify(grown),
  );
  assert.equal(await outbound(pg, e.enquiryId), 0);
  // A bare `true` from an old client is not a key.
  const bare = await tx(pg, (sql) =>
    confirmReviewedSendInTransaction(sql, {
      reviewedSendId: prepared.reviewedSendId,
      enquiryId: e.enquiryId,
      businessId: a.businessId,
      userId: "user-a",
      staleAttestation: stale,
      acknowledgedWarnings: true as unknown as string,
      now: WED_30_SEP,
    }),
  );
  assert.equal(!bare.ok && bare.reason, "warnings");
  // The list now on screen, checked: recorded, and the audit names every item.
  const sent = await confirm(pg, a.businessId, e.enquiryId, prepared.reviewedSendId, {
    stale,
    ack: warningsKey(grown),
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  const audit = await pg.query<{ detail: string }>(
    "select detail from audit_event where object_id = $1 order by at desc limit 1",
    [e.enquiryId],
  );
  assert.match(audit.rows[0]!.detail, /See you then.*Saturday 17 October/s);
});

test("H3/M1: another tenant cannot record the send, and nothing moves", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, MEL, "End of lease clean 3 bedroom");
  const first = await settleAndSend(pg, a.businessId, e.enquiryId);
  const edited = first.body.replace("\n\nThanks,", "\n\nSee you then.\n\nThanks,");
  const prepared = await prepare(pg, a.businessId, e.enquiryId, edited);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const b = await pg.query<{ id: string }>("select id from business where name = 'Bravo'");
  const before = await pg.query("select * from reviewed_send where enquiry_id = $1", [e.enquiryId]);
  const other = await confirm(pg, b.rows[0]!.id, e.enquiryId, prepared.reviewedSendId, {
    stale: true,
    ack: warningsKey(prepared.warnings),
  });
  assert.equal(!other.ok && other.reason, "missing");
  const after = await pg.query("select * from reviewed_send where enquiry_id = $1", [e.enquiryId]);
  assert.deepEqual(after.rows, before.rows);
  assert.equal(await outbound(pg, e.enquiryId), 0);
});

// ---------------------------------------------------------------------------
// M2, M5, ALSO, LOW. What the reply says
// ---------------------------------------------------------------------------

test("M2: 'If not Monday. 3 hour clean.' never becomes 'You mentioned Monday. 3'", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, is Saturday ok? If not Monday. 3 hour clean. Thanks, Bo",
    "Regular house clean",
  );
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId, {
    "ask:availability": "2026-10-03=later",
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.doesNotMatch(body, /Monday\. 3/);
  assert.doesNotMatch(body, /You mentioned Monday/);
});

test("M5: a stretch across the new year is checked day by day, and named days are read", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, oven clean please, any day 28 December to 3 January works. Thanks, Al",
    "Oven clean",
  );
  const open = (await ledger(pg, e.enquiryId)).filter((i) => i.status === "open");
  assert.ok(
    open.some((i) => i.text === "Part of 28 December to 3 January is in your closed dates"),
    JSON.stringify(open),
  );
  const f = await enquiry(
    pg,
    a.businessId,
    "Hi, oven clean please, Christmas Eve if you can. Thanks, Al",
    "Oven clean",
  );
  const items = await ledger(pg, f.enquiryId);
  assert.ok(
    items.some((i) => /Thu 24 Dec/.test(i.text)),
    JSON.stringify(items),
  );
});

test("ALSO: money said in words is money - refused unless it is the quote", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, MEL, "End of lease clean 3 bedroom");
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  for (const said of [
    "Make it 5 hundred.",
    "Let's say five hundred and fifty.",
    "I'll knock fifty off.",
    "Call it 550.",
    "five fifty all up.",
  ]) {
    const res = await sendAs(
      pg,
      a.businessId,
      e.enquiryId,
      body.replace("\n\nThanks,", `\n\n${said}\n\nThanks,`),
    );
    assert.equal(!res.ok && res.reason, "amount_mismatch", said);
  }
  // The quote's own total, said in words, is the quote: $580.
  const total = await sendAs(
    pg,
    a.businessId,
    e.enquiryId,
    body.replace("\n\nThanks,", "\n\nCall it 580 all up.\n\nThanks,"),
  );
  assert.equal(total.ok, true, JSON.stringify(total));
});

test("ALSO: 'done on the 30th Dec, keys back 31st' never says the keys are due on 30 December", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, end of lease clean for a 2 bedroom, need it done on the 30th Dec, keys back 31st. Thanks, Jo",
    "End of lease clean 2 bedroom",
  );
  const body = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.doesNotMatch(body, /keys are due on Wednesday 30 December/);
});

test("ALSO: 'every second week' is a recurring clean", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, could you do a regular clean every second week? 3 hours each time. Thanks, Pat",
    "Regular house clean",
  );
  await settle(pg, e.enquiryId, { answers: { hours: "3" } });
  const s = (await row(pg, e.enquiryId)).decision_snapshot as unknown as {
    coverage?: { recurring?: boolean; flagged?: { kind: string; text: string }[] };
  };
  const flag = (s.coverage?.flagged ?? []).find((f) => f.kind === "recurring");
  assert.ok(flag, JSON.stringify(s.coverage));
  assert.match(flag!.text, /every second week/);
});

test("ALSO: negated owner lines are kept as notes, never as rules", async (t) => {
  for (const line of [
    "We don't work Mon-Fri 7am-5pm",
    "We don't offer fortnightly cleans 10% off",
    "Oven clean is not $60",
  ]) {
    const read = readBusinessDetails(line, WED_30_SEP);
    assert.deepEqual(read.prices, [], line);
    assert.deepEqual(read.details, [], line);
    assert.equal(read.unread[0]?.note, true, line);
  }
  // Saved as the business screen saves them, nothing is a rule.
  const { pg, a } = await setup(
    t,
    ["Oven clean $60", "We don't work Mon-Fri 7am-5pm", "Oven clean is not $60"].join("\n"),
  );
  const rules = await pg.query<{ rule_payload: { kind: string } }>(
    "select rule_payload from knowledge_item where business_id = $1 and rule_payload is not null",
    [a.businessId],
  );
  const kinds = rules.rows.map((r) => r.rule_payload.kind);
  assert.ok(!kinds.includes("closed_days"), JSON.stringify(kinds));
});

test("LOW: a waived weekend rate on a Saturday-only job never adds 'weekends are 20% more'", async (t) => {
  const { pg, a } = await setup(
    t,
    [
      "Interior painting $32 per sqm, minimum charge $600",
      "Weekend jobs have a 20% surcharge",
      "We don't work Sundays",
    ].join("\n"),
  );
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, could you paint the hallway, about 15 square metres, Saturday 10 or Sunday 11 October? Kim",
    "Interior painting",
  );
  const { body, sent } = await settleAndSend(pg, a.businessId, e.enquiryId, {}, [
    [/minimum/i, "apply"],
    [/./, "waive"],
  ]);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /I'll confirm whether Saturday 10 October works\. I don't work Sundays\./);
  assert.doesNotMatch(body, /weekends are 20% more/);
});

test("LOW: a stored sweep that cannot be read holds the reply as dates to check", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(pg, a.businessId, JASE, "End of lease clean 2 bedroom");
  const saved = console.error;
  const logged: string[] = [];
  console.error = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
  try {
    await pg.query(
      "update enquiry_fact set value = '{not json' where enquiry_id = $1 and field = 'date_sweep'",
      [e.enquiryId],
    );
    await answer(pg, "user-a", e.enquiryId, "name", "Jase");
  } finally {
    console.error = saved;
  }
  assert.ok(
    logged.some((l) => l.includes("[date-sweep]")),
    JSON.stringify(logged),
  );
  const item = (await ledger(pg, e.enquiryId)).find(
    (i) => i.id === "date_check:dates in this message",
  );
  assert.equal(item?.status, "open");
  assert.equal(
    item?.text,
    "Enquiry could not re-check the dates in this message: check them against your closed dates",
  );
  await settle(pg, e.enquiryId);
  // Held: the quote cannot be confirmed until the owner checks the dates.
  await assert.rejects(
    send(pg, a.businessId, e.enquiryId),
    /Settle what they asked first: Enquiry could not re-check the dates in this message/,
  );
  await answer(pg, "user-a", e.enquiryId, "date_check:dates in this message", "confirm");
  await settle(pg, e.enquiryId);
  const { body, sent } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /I'll confirm which day works\./);
  // Another tenant cannot settle it, and nothing moves.
  const before = await row(pg, e.enquiryId);
  await assert.rejects(
    answer(pg, "user-b", e.enquiryId, "date_check:dates in this message", "not_a_date"),
    ForbiddenError,
  );
  assert.deepEqual(await row(pg, e.enquiryId), before);
});
