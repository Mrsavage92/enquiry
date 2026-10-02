import assert from "node:assert/strict";
import test from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { WED_30_SEP, enquiry, freshDb, tell, tenant, tx } from "./pass8-db-helpers.ts";
import { createPracticeEnquiryInTransaction } from "./practice-core.ts";
import { drive, type DriveOptions, type DriveResult } from "./laser-drive.ts";
import { replaceAmounts } from "../../domain/voice-detect.ts";

/**
 * Doc 50's state table, through the real engine and the real send path: one
 * test per row. Each asserts the verdict on first render, the one filled
 * button, and the taps from the screen opening to the recorded send, which is
 * always the owner's decisions plus Copy and Yes (plus the review panel for a
 * high-risk send). The traces are printed for the PR's tap table.
 */

type Row = {
  verdict: string | RegExp;
  primary: string | RegExp | null;
  taps: number;
  decisions: number;
};

function check(t: { diagnostic: (m: string) => void }, name: string, r: DriveResult, want: Row) {
  t.diagnostic(
    `${name}: ${r.taps} taps (${r.decisions} decisions) | first: ${r.first.verdict} / ${r.first.primary} | ${r.steps.map((s) => s.tap).join(" > ")}`,
  );
  if (want.verdict instanceof RegExp) assert.match(r.first.verdict, want.verdict, name);
  else assert.equal(r.first.verdict, want.verdict, name);
  if (want.primary instanceof RegExp) assert.match(r.first.primary ?? "", want.primary, name);
  else assert.equal(r.first.primary, want.primary, name);
  const review = r.steps.filter((s) => s.tap.endsWith("(opens the review panel)")).length;
  // The rule behind every row: taps = owner decisions + 2 (+1 for a high-risk send).
  assert.equal(r.taps, r.decisions + 2 + review, `${name}: taps = decisions + 2 (+review)`);
  assert.equal(r.decisions, want.decisions, `${name}: decisions`);
  assert.equal(r.taps, want.taps, `${name}: taps`);
}

async function shop(t: Parameters<typeof freshDb>[0], industry: string, lines: string[]) {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Alpha Co", industry);
  await tenant(pg, "user-b", "Bravo Co", industry);
  if (lines.length) await tell(pg, a.businessId, lines.join("\n"));
  return { pg, a };
}

async function run(
  pg: PGlite,
  businessId: string,
  text: string,
  service: string,
  opts: DriveOptions = {},
): Promise<DriveResult> {
  const e = await enquiry(pg, businessId, text, service, WED_30_SEP);
  return drive(pg, e.enquiryId, opts);
}

test("clean quote: priced, nothing flagged - Copy reply (covers 1 thing), Yes", async (t) => {
  const { pg, a } = await shop(t, "cleaning", ["Oven clean $95"]);
  const r = await run(pg, a.businessId, "Oven clean please. Jo", "Oven clean");
  check(t, "clean quote", r, {
    verdict: "Yes - reply ready",
    primary: "Copy reply - covers 1 thing",
    taps: 2,
    decisions: 0,
  });
  // The coverage was confirmed by the send itself, for the key it was prepared against.
  const covered = await pg.query<{ status: string }>(
    "select status from enquiry_fact where enquiry_id = (select enquiry_id from reviewed_send limit 1) and field = 'coverage' and superseded = false",
  );
  assert.equal(covered.rows[0]?.status, "confirmed");
  const quote = await pg.query<{ total_minor: string }>("select total_minor from quote_version");
  assert.equal(Number(quote.rows[0]?.total_minor), 9500);
  assert.match(r.body, /that comes to \$95/);
});

test("several items: insured?, a feature wall, ceilings, then what the price covers", async (t) => {
  const { pg, a } = await shop(t, "painting", [
    "Interior painting $680 per room",
    "Feature wall $180",
  ]);
  const r = await run(
    pg,
    a.businessId,
    "Hi, looking for a quote to paint 3 rooms, a feature wall in the lounge and the ceilings. Are you insured? Week of 9 Nov ideally. Tom",
    "Interior painting",
  );
  check(t, "several items", r, {
    verdict: "Not yet - check one detail they gave",
    primary: "Yes, 3 rooms",
    taps: 6,
    decisions: 4,
  });
});

test("one question, then priced: 'do you do ceilings?'", async (t) => {
  const { pg, a } = await shop(t, "cleaning", ["Oven clean $95"]);
  const r = await run(
    pg,
    a.businessId,
    "Oven clean please. Do you do fridges too? Jo",
    "Oven clean",
  );
  check(t, "one question then priced", r, {
    verdict: "Not yet - they asked if you do fridges",
    primary: "Yes, I do fridges",
    taps: 3,
    decisions: 1,
  });
});

test("one question, no price follows: an availability ask", async (t) => {
  const { pg, a } = await shop(t, "cleaning", ["Regular house clean $160"]);
  const r = await run(
    pg,
    a.businessId,
    "hey r u free this sat or sun for a clean? 3 bed. Lou",
    "Regular house clean",
  );
  check(t, "one question no price", r, {
    verdict: "Not yet - they asked if you're free Sat 3 or Sun 4 Oct",
    primary: null,
    taps: 3,
    decisions: 1,
  });
});

test("closed day, nothing bookable: the reply asks to move the date and names no price", async (t) => {
  const { pg, a } = await shop(t, "beauty", ["Bridal makeup $250", "We don't work Sundays"]);
  const r = await run(
    pg,
    a.businessId,
    "Hi! Need bridal makeup for my wedding on Sunday 8 November. Chloe",
    "Bridal makeup",
  );
  check(t, "closed day nothing bookable", r, {
    verdict: "Not yet - that day is a closed day",
    primary: "Copy reply",
    taps: 2,
    decisions: 0,
  });
  assert.doesNotMatch(r.body, /\$\d/, "names no price");
  assert.match(r.body, /what date suits/);
});

test("decline as a reply: a kind no is high risk, so the first Copy opens the review panel", async (t) => {
  const { pg, a } = await shop(t, "painting", [
    "Interior painting $32 per square metre",
    "We don't do exterior painting",
  ]);
  const r = await run(
    pg,
    a.businessId,
    "Do you guys do exterior painting? Just the front fence and the eaves. Kylie",
    "",
  );
  check(t, "decline as reply", r, {
    verdict: "Not yet - they asked if you do exterior painting",
    primary: "No, I don't do exterior painting",
    taps: 4,
    decisions: 1,
  });
  assert.ok(r.steps.some((s) => s.tap.endsWith("(opens the review panel)")));
  assert.match(r.body, /Sorry, I don't do exterior painting\./);
});

test("needs detail, ask the customer: the reply asks for the one detail", async (t) => {
  const { pg, a } = await shop(t, "cleaning", ["End of lease clean $190 per bedroom"]);
  const r = await run(pg, a.businessId, "End of lease clean please. Jo", "End of lease clean");
  check(t, "needs detail ask", r, {
    verdict: "Not yet - one detail decides it",
    primary: "Copy reply",
    taps: 2,
    decisions: 0,
  });
});

test("needs detail they already gave: one tap confirms their own words", async (t) => {
  const { pg, a } = await shop(t, "cleaning", ["End of lease clean $190 per bedroom"]);
  const r = await run(
    pg,
    a.businessId,
    "End of lease clean for my 3 bedroom unit please. Jo",
    "End of lease clean",
  );
  check(t, "needs detail they gave", r, {
    verdict: "Not yet - check one detail they gave",
    primary: "Yes, 3 bedrooms",
    taps: 3,
    decisions: 1,
  });
});

test("needs prices: Add your prices, the pricing screen (P), then Copy and Yes", async (t) => {
  const { pg, a } = await shop(t, "cleaning", []);
  const r = await run(pg, a.businessId, "Oven clean please. Jo", "Oven clean", {
    prices: "Oven clean $95",
  });
  check(t, "needs prices", r, {
    verdict: "Not yet - your prices decide it",
    primary: "Add your prices",
    taps: 3,
    decisions: 1,
  });
});

async function practice(t: Parameters<typeof freshDb>[0], lines: string[]) {
  const { pg, a } = await shop(t, "cleaning", lines);
  const p = await tx(pg, (sql) =>
    createPracticeEnquiryInTransaction(sql, { businessId: a.businessId, now: WED_30_SEP }),
  );
  return { pg, a, id: p.enquiryId };
}

test("practice, priced: records nothing", async (t) => {
  const { pg, id } = await practice(t, ["End of lease clean $380"]);
  const r = await drive(pg, id, { service: "End of lease clean" });
  check(t, "practice priced", r, {
    verdict: "Not yet - say which service",
    primary: null,
    taps: 3,
    decisions: 1,
  });
  const sent = await pg.query("select 1 from message where direction = 'outbound'");
  assert.equal(sent.rows.length, 0, "practice records nothing");
});

test("practice, needs prices: a sample price, then Copy and Yes (simulated)", async (t) => {
  const { pg, id } = await practice(t, []);
  const r = await drive(pg, id);
  check(t, "practice needs prices", r, {
    verdict: "Not yet - your prices decide it",
    primary: "Add your prices",
    taps: 4,
    decisions: 2,
  });
});

test("edit warnings: the warning shows before the tap and Copy anyway costs nothing", async (t) => {
  const { pg, a } = await shop(t, "cleaning", ["Oven clean $95"]);
  const r = await run(pg, a.businessId, "Oven clean please. Jo", "Oven clean", {
    edit: (body) => body.replace("Thanks,", "I'm fully licensed.\n\nThanks,"),
  });
  check(t, "edit warnings", r, {
    verdict: "Yes - reply ready",
    primary: "Copy reply - covers 1 thing",
    taps: 2,
    decisions: 0,
  });
  assert.ok(r.prepared?.ok && r.prepared.warnings.length > 0, "the warning shows before the tap");
});

test("send refused: a changed total is refused before the tap; the fix brings Copy back", async (t) => {
  const { pg, a } = await shop(t, "cleaning", ["Oven clean $95"]);
  const r = await run(pg, a.businessId, "Oven clean please. Jo", "Oven clean", {
    edit: (body) => body.replace("$95", "$90"),
    onRefused: (res, body) =>
      res.amounts?.expectedMinor != null
        ? (replaceAmounts(body, res.amounts.named, res.amounts.expectedMinor) ?? body)
        : body,
  });
  check(t, "send refused", r, {
    verdict: "Yes - reply ready",
    primary: "Copy reply - covers 1 thing",
    taps: 3,
    decisions: 1,
  });
  assert.equal(r.steps[0]?.tap, "Use the prepared total");
  assert.match(r.body, /\$95/);
});
