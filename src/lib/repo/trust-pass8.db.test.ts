import assert from "node:assert/strict";
import test from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { ForbiddenError } from "./tenancy.server.ts";
import { confirmCoverageForUser } from "./coverage-core.ts";
import { loadOwnerState, saveReplyDraftForUser } from "./owner-state-core.ts";
import { saveBusinessDetailsForUser } from "./business-rule-core.ts";
import { prepareReviewedSendInTransaction } from "./reviewed-send-core.ts";
import {
  WED_30_SEP,
  answer,
  enquiry,
  freshDb,
  row,
  send,
  sqlFor,
  tell,
  tenant,
  tx,
} from "./pass8-db-helpers.ts";

/**
 * Trust pass 8, against a real database. Each repro from the independent
 * review of main 9c64cc8 is driven the way the owner drives it - confirm a
 * reading, answer a question, settle a check, "That's everything" - and the
 * app's own reply goes through the send path (`prepareReviewedSendInTransaction`),
 * so what is proven is what would be sent. Every new write is also tried by a
 * second tenant: Forbidden, and nothing moves.
 */

const BUSINESS = [
  "Regular house clean $45 per hour, minimum 3 hours",
  "Oven clean $60",
  "End of lease clean $380 for up to 2 bedrooms, extra bedrooms $70 each",
  "Weekend jobs have a $50 surcharge",
  "Interior painting $28 per square metre",
  "Ceilings $15 per square metre",
  "Interior painting minimum charge $600",
  "Bridal makeup $180 per person",
  "Makeup trial $90",
  "Travel fee $25 for jobs within 15km",
  "Carpet steam cleaning $40 per room",
  "Gel manicure $55",
  "Lash lift $75",
  "We don't work Sundays",
  "Closed 20 Dec - 5 Jan",
  "Not available Friday 23 October",
  "We don't do mould removal",
  "We don't do exterior painting",
  "10% off for pensioners",
  "We have $20 million public liability insurance",
  "We bring our own equipment",
].join("\n");

async function setup(t: { after: (fn: () => Promise<void>) => void }) {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Savvy Services");
  const b = await tenant(pg, "user-b", "Bravo");
  await tell(pg, a.businessId, BUSINESS);
  return { pg, a, b };
}

type Choice = {
  /** Answers by fact field; a function of the pending question otherwise. */
  answers?: Record<string, string>;
  /** The choice for a rule check or a headcount, by the start of its text. */
  checks?: [RegExp, string][];
};

/**
 * Drive one enquiry to "That's everything" the way the owner does, one step
 * at a time, recording the checks counter at each step. Stops when nothing
 * is left for the owner, or after 20 steps.
 */
async function settle(pg: PGlite, enquiryId: string, choice: Choice = {}) {
  const counters: { done: number; total: number }[] = [];
  for (let i = 0; i < 20; i += 1) {
    const s = (await row(pg, enquiryId)).decision_snapshot;
    if (s.checks) counters.push(s.checks);
    const q = s.questionPending;
    if (q) {
      const typed = choice.answers?.[q.field];
      const value =
        typed ??
        (q.kind === "availability"
          ? "later"
          : q.kind === "ask"
            ? (q.saved ?? "later")
            : q.readAs === "no"
              ? "no"
              : "yes");
      await answer(pg, "user-a", enquiryId, q.field, value);
      continue;
    }
    const reading = s.missing.find((m) => m.inferred);
    if (reading) {
      await answer(pg, "user-a", enquiryId, reading.factField, reading.inferred!.value);
      continue;
    }
    const typedCount = s.missing[0] && choice.answers?.[s.missing[0].factField];
    if (typedCount) {
      await answer(pg, "user-a", enquiryId, s.missing[0]!.factField, typedCount);
      continue;
    }
    if (s.extraPending) {
      const value =
        choice.answers?.[s.extraPending.field] ??
        (s.extraPending.kind === "check" ? "include" : "come_back");
      await answer(pg, "user-a", enquiryId, s.extraPending.field, value);
      continue;
    }
    const flag = (s.coverage?.flagged ?? []).find((f) => f.check || f.kind === "headcount");
    if (flag && !s.coverage?.confirmed) {
      const field = flag.check?.field ?? flag.thing!;
      const picked = choice.checks?.find(([re]) => re.test(flag.text))?.[1];
      await answer(pg, "user-a", enquiryId, field, picked ?? (flag.check ? "waive" : "one"));
      continue;
    }
    // "They mention the garage": part of this price, the owner says.
    const mention = (s.coverage?.flagged ?? []).find((f) => f.kind === "mention" && f.thing);
    if (mention && !s.coverage?.confirmed) {
      await answer(pg, "user-a", enquiryId, `extra:${mention.thing}`, "covered");
      continue;
    }
    break;
  }
  return counters;
}

async function sendAs(pg: PGlite, businessId: string, enquiryId: string, body: string) {
  return tx(pg, (sql) =>
    prepareReviewedSendInTransaction(sql, {
      enquiryId,
      businessId,
      userId: "user-a",
      body,
      channel: "manual",
    }),
  );
}

/** Another tenant's write is refused and moves nothing: not the snapshot, not the revision. */
async function refusedForOther(pg: PGlite, enquiryId: string, field: string, value: string) {
  const before = await row(pg, enquiryId);
  await assert.rejects(answer(pg, "user-b", enquiryId, field, value), ForbiddenError);
  const after = await row(pg, enquiryId);
  assert.equal(after.decision_revision, before.decision_revision);
  assert.deepEqual(after.decision_snapshot, before.decision_snapshot);
}

const NEVER_GO_AHEAD_WHEN_CLOSED =
  /not available on[^\n]*\n(?:[^\n]*\n)*?[^\n]*Just let me know if you'd like to go ahead\./;

test("1a/7 Chloe: a Sunday wedding is said plainly, the trial gets its own line, the close never says go ahead", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi! Wedding is Sunday 8 November, ceremony 2pm at Maleny. Need bridal makeup for bride + mum + 2 bridesmaids. Are you insured? Also can you do a trial on 24 October? Chloe",
    "Bridal makeup",
  );
  const first = await row(pg, e.enquiryId);
  assert.equal(first.date_label, "Wedding Sun 8 Nov", "never 'Asked for Sat 24 Oct'");
  assert.deepEqual(
    first.decision_snapshot.dates?.map((d) => [d.iso, d.role]),
    [
      ["2026-11-08", "event"],
      ["2026-10-24", "trial"],
    ],
  );
  // The count is read from "bride + mum + 2 bridesmaids", never asked again.
  assert.equal(first.decision_snapshot.missing[0]?.inferred?.value, "4");
  assert.ok(
    first.decision_snapshot.asked?.some((i) => i.id === "ask:insurance" && i.status === "open"),
  );
  await answer(pg, "user-a", e.enquiryId, "people", "4");
  await answer(pg, "user-a", e.enquiryId, "extra:Makeup trial", "include");
  // Their question is answered from the owner's saved answer, offered with one tap.
  const asked = (await row(pg, e.enquiryId)).decision_snapshot.questionPending;
  assert.equal(asked?.saved, "We have $20 million public liability insurance.");
  await refusedForOther(pg, e.enquiryId, "ask:insurance", "Yes");
  await settle(pg, e.enquiryId, { checks: [[/makeup trial price is per booking/, "one"]] });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 81000, body);
  assert.match(body, /I'm not available on Sunday 8 November/);
  assert.match(
    body,
    /For the trial, you mentioned Saturday 24 October - I'll confirm whether that works\./,
  );
  assert.match(body, /We have \$20 million public liability insurance\./);
  assert.match(body, /Let me know what date suits and I'll confirm\./);
  assert.doesNotMatch(body, /Just let me know if you'd like to go ahead/);
  assert.doesNotMatch(body, NEVER_GO_AHEAD_WHEN_CLOSED);
});

test("1b Doyle: the deadline is acknowledged, 5 bedrooms and 4 upstairs are read, insured is answered", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, settlement is 30/10 so we need a vacate clean the day before (29/10). House is 5 bedrooms. Could you also steam clean carpets in the 4 bedrooms upstairs? And please confirm you are insured. Doyle",
    "End of lease clean",
  );
  const first = await row(pg, e.enquiryId);
  assert.equal(first.date_label, "Deadline Thu 29 Oct");
  assert.deepEqual(
    first.decision_snapshot.missing.map((m) => [m.factField, m.inferred?.value]),
    [["bedrooms", "5"]],
  );
  // "please confirm you are insured" is a question they asked, never passed over.
  assert.ok(
    first.decision_snapshot.asked?.some((i) => i.id === "ask:insurance" && i.status === "open"),
  );
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 75000, body);
  assert.match(
    body,
    /I understand you need it done by Thursday 29 October, before settlement on Friday 30 October - I'll confirm whether that works\./,
  );
  assert.match(body, /We have \$20 million public liability insurance\./);
  assert.match(body, /Just let me know if you'd like to go ahead and I'll confirm the day\./);
  assert.ok(
    snapshot.asked?.every((i) => i.status !== "open"),
    JSON.stringify(snapshot.asked),
  );
});

test("1c Dave: the job by Friday, the inspection Saturday; the row shows the day, never 'No date given'", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "end of lease clean 3 bed 2 bath in Chermside, need it done fri 16th oct b4 inspection sat. also oven pls. how much?? thx Dave",
    "End of lease clean",
  );
  const first = await row(pg, e.enquiryId);
  assert.equal(first.date_label, "Deadline Fri 16 Oct");
  // The interim reply names the oven, so nothing they asked for is passed over.
  assert.match(
    first.decision_snapshot.draft.body,
    /I'll come back to you on the oven clean with the price\./,
  );
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 51000, body);
  assert.match(
    body,
    /I understand you need it done by Friday 16 October, before the inspection on Saturday 17 October - I'll confirm whether that works\./,
  );
});

test("1d/3 Mel: '4 of us' is read, the wedding in a closed stretch and a December trial are both said", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi! I'm getting married on Saturday 2 January 2027 in Samford and would love bridal makeup for me plus 3 bridesmaids (4 of us total). Could we also book a trial in December? Do you have public liability insurance? Mel",
    "Bridal makeup",
  );
  const first = await row(pg, e.enquiryId);
  assert.equal(first.decision_snapshot.missing[0]?.inferred?.value, "4");
  assert.doesNotMatch(first.decision_snapshot.draft.body, /how many people/);
  await settle(pg, e.enquiryId, { checks: [[/makeup trial price is per booking/, "one"]] });
  const { body, sent } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /I'm not available on Saturday 2 January/);
  assert.match(
    body,
    /For the trial in December, I'll confirm which day works - I'm not working from 20 December to 5 January\./,
  );
  assert.doesNotMatch(body, /Just let me know if you'd like to go ahead/);
});

test("3 Brooke: two manicures are never quoted as one; another tenant cannot choose", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "hiya could i book gel mani for me n my sister (2 ppl) this sat 3rd? at my place in Nundah. also how much is lash lift? ta, Brooke",
    "Gel manicure",
  );
  const open = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(open.extraPending?.label, "Lash lift");
  await answer(pg, "user-a", e.enquiryId, open.extraPending!.field, "include");
  const s = (await row(pg, e.enquiryId)).decision_snapshot;
  const flag = s.coverage?.flagged.find((f) => /gel manicure price is per booking/.test(f.text));
  assert.equal(flag?.text, "They mention 2 people - your gel manicure price is per booking");
  assert.equal(s.coverage?.confirmed, false);
  await refusedForOther(pg, e.enquiryId, flag!.thing!, "each");
  const counters = await settle(pg, e.enquiryId, {
    checks: [
      [/gel manicure price is per booking/, "each"],
      [/lash lift price is per booking/, "one"],
    ],
  });
  // "Check 1 of 4" never restarts: settled only grows, and so does the total.
  for (let i = 1; i < counters.length; i += 1) {
    assert.ok(counters[i]!.done >= counters[i - 1]!.done, JSON.stringify(counters));
    assert.ok(counters[i]!.total >= counters[i - 1]!.total, JSON.stringify(counters));
  }
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 18500, body);
  assert.match(body, /Gel manicure: \$110 \(2 people at \$55 each\)/);
});

test("2/4 Bruce: the exterior he asked for is said no to, and both his questions are answered", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, looking to get the outside of the house painted plus the inside of the garage, about 60m2 for the garage walls. Also, is the price including paint? When's your earliest? Bruce",
    "Interior painting",
  );
  const first = (await row(pg, e.enquiryId)).decision_snapshot;
  // Read as No from the owner's own rule, for them to confirm - never passed over.
  assert.equal(first.questionPending?.thing, "exterior painting");
  assert.equal(first.questionPending?.readAs, "no");
  assert.deepEqual(
    first.asked?.filter((i) => i.kind !== "service").map((i) => [i.id, i.status]),
    [
      ["question:exterior painting", "open"],
      ["ask:inclusions", "open"],
      ["ask:availability", "open"],
    ],
  );
  await refusedForOther(pg, e.enquiryId, "question:exterior painting", "no");
  await settle(pg, e.enquiryId, {
    answers: { "ask:inclusions": "Yes, paint is included." },
  });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(body, /\$1,680/);
  assert.match(body, /Sorry, I don't do exterior painting\./);
  assert.match(body, /Yes, paint is included\./);
  assert.match(body, /I'll check my calendar and come back to you\./);
  assert.doesNotMatch(body, /your other question/);
  assert.ok(
    snapshot.asked?.every((i) => i.status !== "open"),
    JSON.stringify(snapshot.asked),
  );
});

test("2 Geoff: 'ceilings done' and 'for $500?' are both said while asking the size, and both settled after", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, I'm a landlord and need the walls in the lounge and kitchen painted. Not sure of the size. Sometime between 9 and 20 November. Could you do it for $500? I'd also want the ceilings done. Geoff",
    "Interior painting",
  );
  const interim = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  assert.match(interim, /can you let me know how many square metres there are\?/);
  assert.match(interim, /I'll come back to you on the ceilings with the price\./);
  assert.match(interim, /I'll come back to you on the price you suggested with the quote\./);
  assert.doesNotMatch(interim, /\$500/, "their figure is never echoed as if it were a price");
  const asking = await sendAs(pg, a.businessId, e.enquiryId, interim);
  assert.equal(asking.ok, true, JSON.stringify(asking));
  await settle(pg, e.enquiryId, {
    answers: {
      "square metres": "18",
      "square metres for ceilings": "10",
      "ask:offer": "Sorry, I can't do it for $500 - the price above is my best for this job.",
    },
    checks: [[/Your minimum/, "apply"]],
  });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 75000, body);
  assert.match(body, /Ceilings: \$150/);
  assert.match(body, /Sorry, I can't do it for \$500/);
});

test("4 Kylie: a plain No to 'do you do exterior painting?' is the polite reply, ready at once", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Do you guys do exterior painting? Just the front fence and the eaves. Kylie",
  );
  const first = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(first.questionPending?.readAs, "no", "the saved 'not offered' is pre-selected");
  assert.equal(first.questionPending?.said, "You don't offer exterior painting");
  await answer(pg, "user-a", e.enquiryId, first.questionPending!.field, "no");
  const r = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(r.recommendation.action, "DECLINE", "never 'Which service is this?'");
  assert.match(r.draft.body, /Sorry, I don't do exterior painting\./);
  const sent = await sendAs(pg, a.businessId, e.enquiryId, r.draft.body);
  assert.equal(sent.ok, true, JSON.stringify(sent));
});

test("5: 'Keep my edit' survives 'That's everything': the greeting stays, only the moved figure changes", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Mia Makeup", "beauty");
  await tenant(pg, "user-b", "Bravo");
  await tell(pg, a.businessId, "Makeup trial $90");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, could I book a makeup trial please? Mia",
    "Makeup trial",
  );
  const s0 = await row(pg, e.enquiryId);
  const done = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    enquiryId: e.enquiryId,
    key: s0.decision_snapshot.coverage!.key,
    revision: Number(s0.decision_revision),
  });
  assert.equal(done.ok, true);
  const prepared = (await row(pg, e.enquiryId)).decision_snapshot.draft.body;
  const edited = prepared.replace("Hi there,", "Hi Mia,");
  assert.notEqual(edited, prepared);
  await saveReplyDraftForUser(sqlFor(pg) as never, "user-a", e.enquiryId, edited);

  // The price the reply names moves: the edit is out of date, and what moved is said.
  await tell(pg, a.businessId, "Makeup trial $95");
  const stale = await loadOwnerState(sqlFor(pg) as never, [a.businessId]);
  assert.equal(stale.staleDrafts[e.enquiryId], edited);
  assert.deepEqual(stale.draftChanges[e.enquiryId], ["Total $90 -> $95"]);

  // Keep my edit, then "That's everything".
  await saveReplyDraftForUser(sqlFor(pg) as never, "user-a", e.enquiryId, edited);
  const r1 = await row(pg, e.enquiryId);
  await assert.rejects(
    confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-b", {
      enquiryId: e.enquiryId,
      key: r1.decision_snapshot.coverage!.key,
      revision: Number(r1.decision_revision),
    }),
    ForbiddenError,
  );
  assert.deepEqual((await row(pg, e.enquiryId)).decision_snapshot, r1.decision_snapshot);
  const kept = await confirmCoverageForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    enquiryId: e.enquiryId,
    key: r1.decision_snapshot.coverage!.key,
    revision: Number(r1.decision_revision),
  });
  assert.equal(kept.ok, true, JSON.stringify(kept));
  assert.deepEqual(kept.ok && kept.editKept?.changes, ["Total $90 -> $95"]);
  const state = await loadOwnerState(sqlFor(pg) as never, [a.businessId]);
  const body = state.drafts[e.enquiryId]!;
  assert.match(body, /^Hi Mia,/, "the owner's greeting is kept, never the regenerated text");
  assert.match(body, /\$95/);
  assert.doesNotMatch(body, /\$90/);
  assert.equal(state.staleDrafts[e.enquiryId], undefined, "no longer out of date");
  const sent = await sendAs(pg, a.businessId, e.enquiryId, body);
  assert.equal(sent.ok, true, JSON.stringify(sent));
});

test("6: 'Mon-Sat 7am-5pm' sets the hours in Settings, the one place they live; another tenant cannot", async (t) => {
  const { pg, a } = await setup(t);
  const { readBusinessDetails } = await import("../../domain/business-details-read.ts");
  const read = readBusinessDetails("Mon-Sat 7am-5pm", WED_30_SEP);
  const details = read.details.map((d) => d.detail);
  await assert.rejects(
    saveBusinessDetailsForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-b", {
      businessId: a.businessId,
      rules: [],
      details,
    }),
    ForbiddenError,
  );
  const none = await pg.query("select prefs from workspace_prefs where business_id = $1", [
    a.businessId,
  ]);
  assert.equal(none.rows.length, 0);
  await saveBusinessDetailsForUser(sqlFor(pg), (fn) => tx(pg, fn), "user-a", {
    businessId: a.businessId,
    rules: [],
    details,
  });
  const prefs = await pg.query<{ prefs: Record<string, string> }>(
    "select prefs from workspace_prefs where business_id = $1",
    [a.businessId],
  );
  assert.equal(prefs.rows[0]?.prefs.workingDays, "Monday to Saturday");
  assert.equal(prefs.rows[0]?.prefs.hoursStart, "07:00");
  assert.equal(prefs.rows[0]?.prefs.hoursEnd, "17:00");
  const kept = await pg.query(
    "select id from knowledge_item where business_id = $1 and rule_payload->>'kind' = 'working_hours'",
    [a.businessId],
  );
  assert.equal(kept.rows.length, 0, "never a second copy on the business screen");
});

test("1g/3 Tash: 'tmrw' is Thursday 1 October in the reply, and three people are priced as three", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "gel nails tmrw for 3 of us?? birthday brunch lol. how much all up",
    "Gel manicure",
  );
  await settle(pg, e.enquiryId, { checks: [[/gel manicure price is per booking/, "each"]] });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 16500, body);
  assert.match(body, /You mentioned Thursday 1 October - I'll confirm whether that works\./);
  assert.doesNotMatch(body, /tomorrow|tmrw/i);
});

test("2/6 Margaret: 'is there a discount?' is answered and the pensioner discount is the owner's one tap", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hello, I need the carpets steam cleaned in 2 bedrooms, any weekday next week. Do you bring your own equipment? (I'm a pensioner, is there a discount?) Margaret",
    "Carpet steam cleaning",
  );
  const first = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.deepEqual(
    first.asked?.filter((i) => i.kind === "ask").map((i) => i.id),
    ["ask:equipment", "ask:discount"],
  );
  await settle(pg, e.enquiryId, { checks: [[/pensioners discount/, "apply"]] });
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 7200, body);
  assert.match(body, /We bring our own equipment\./);
  assert.match(body, /Yes - 10% off for pensioners\./);
  assert.match(body, /10% pensioner discount on \$80/);
});

test("1/3 Leanne: her day is said, '4 hrs prob' is read as her rough figure, the mould is said no to", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, bathroom has black mould on the ceiling, can u clean that + do a regular clean of the rest? 4 hrs prob. Thurs 8th Oct if poss. Do you have insurance? Leanne",
    "Regular house clean",
  );
  const first = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.deepEqual(
    first.missing.map((m) => [m.factField, m.inferred?.value]),
    [["hours", "4"]],
  );
  assert.ok(
    !first.asked?.some((i) => i.kind === "extra"),
    "the painting service Ceilings is never read into a cleaning job",
  );
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 18000, body);
  assert.match(body, /Sorry, I don't do mould removal\./);
  assert.match(body, /You mentioned Thursday 8th October - I'll confirm whether that works\./);
  assert.match(body, /about \$180/);
});

test("2/3 Sandra: the form's bedrooms, both extras and her preferred date are all in the reply", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Name: Sandra Kim\nEmail: sandra.kim@yahoo.com\nPhone: 0421 000 888\nService: End of lease clean\nBedrooms: 2\nPreferred date: 14/10/2026\nExtras: Oven, Carpets (2 rooms)\nPets: no",
    "End of lease clean",
  );
  const first = (await row(pg, e.enquiryId)).decision_snapshot;
  assert.equal(first.missing[0]?.inferred?.value, "2");
  assert.deepEqual(
    first.asked?.filter((i) => i.kind === "extra").map((i) => i.text),
    ["Oven clean", "Carpet steam cleaning"],
  );
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 52000, body);
  assert.match(body, /Oven clean: \$60/);
  assert.match(body, /Carpet steam cleaning: \$80/);
  assert.match(body, /You mentioned Wednesday 14 October - I'll confirm whether that works\./);
});

test("1f Priya: the day she asked for is closed; the day offered skips the weekend surcharge and is never 'free'", async (t) => {
  const { pg, a } = await setup(t);
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, we need the lounge painted, maybe 90sqm of walls, and the ceilings maybe 35sqm? Could you come Friday 23 October? Priya 0412 345 678",
    "Interior painting",
  );
  await settle(pg, e.enquiryId);
  const { body, sent, snapshot } = await send(pg, a.businessId, e.enquiryId);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(snapshot.price?.amountMinor, 304500, body);
  assert.match(
    body,
    /I'm not available on Friday 23 October\. If another day suits, I could look at Monday 26 October - I'll confirm it's free\./,
  );
  assert.doesNotMatch(body, /Saturday 24 October/);
  assert.match(body, /Let me know what date suits and I'll confirm\./);
});

test("9: a thing they mention that a saved price covers carries that price for one tap", async (t) => {
  const pg = await freshDb(t);
  const a = await tenant(pg, "user-a", "Shine Cleaning");
  // The reviewer's oven price was saved under a name the message does not use.
  await tell(pg, a.businessId, "End of lease clean $380\nOven degrease $60");
  const e = await enquiry(
    pg,
    a.businessId,
    "Hi, need an end of lease clean for a 2 bedroom unit. The oven is pretty grimy. Jo",
    "End of lease clean",
  );
  const s = (await row(pg, e.enquiryId)).decision_snapshot;
  const oven = s.coverage?.flagged.find((f) => f.kind === "mention" && f.thing === "oven") as
    { offer?: { service: string; amountMinor?: number } } | undefined;
  assert.deepEqual(oven?.offer, { service: "Oven degrease", amountMinor: 6000 });
  // The stable counter: one check open, none done yet.
  assert.deepEqual(s.checks, { done: 0, total: 1 });
});
